package mongorepo

import (
	"context"
	"errors"
	"time"

	"monitor/backend/internal/domain"

	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
)

type resultDoc struct {
	ID                    bson.ObjectID       `bson:"_id,omitempty"`
	PUCode                string              `bson:"pu_code"`
	OfficerID             string              `bson:"officer_id"`
	VoteCounts            map[string]int      `bson:"vote_counts"`
	TotalAccreditedVoters int                 `bson:"total_accredited_voters"`
	MediaIDs              []string            `bson:"media_ids,omitempty"`
	Verified              bool                `bson:"verified"`
	Source                domain.ResultSource `bson:"source,omitempty"`
	LoggedByID            string              `bson:"logged_by_id,omitempty"`
	SubmittedAt           time.Time           `bson:"submitted_at"`
}

func (d *resultDoc) toDomain() *domain.Result {
	return &domain.Result{
		ID:                    d.ID.Hex(),
		PUCode:                d.PUCode,
		OfficerID:             d.OfficerID,
		VoteCounts:            d.VoteCounts,
		TotalAccreditedVoters: d.TotalAccreditedVoters,
		MediaIDs:              d.MediaIDs,
		Verified:              d.Verified,
		Source:                d.Source,
		LoggedByID:            d.LoggedByID,
		SubmittedAt:           d.SubmittedAt,
	}
}

type ResultRepository struct {
	col   *mongo.Collection
	puCol *mongo.Collection
}

func NewResultRepository(db *mongo.Database) *ResultRepository {
	return &ResultRepository{col: db.Collection("results"), puCol: db.Collection("polling_units")}
}

// Create inserts a new submission rather than replacing any prior one for
// the PU -- a PU can now have multiple independent submissions (a primary
// agent plus any sub-agents), which is the whole point of sub-agents:
// enough independently-reported results to cross-check against each
// other. Tally/FindByPU decide how to collapse multiple submissions back
// down to one canonical figure; the raw history is never discarded.
func (r *ResultRepository) Create(ctx context.Context, res *domain.Result) error {
	doc := resultDoc{
		ID:                    bson.NewObjectID(),
		PUCode:                res.PUCode,
		OfficerID:             res.OfficerID,
		VoteCounts:            res.VoteCounts,
		TotalAccreditedVoters: res.TotalAccreditedVoters,
		MediaIDs:              res.MediaIDs,
		Verified:              res.Verified,
		Source:                res.Source,
		LoggedByID:            res.LoggedByID,
		SubmittedAt:           time.Now(),
	}
	_, err := r.col.InsertOne(ctx, doc)
	if err != nil {
		return err
	}
	res.ID = doc.ID.Hex()
	res.SubmittedAt = doc.SubmittedAt
	return nil
}

// FindByPU returns the most recent submission for a PU.
func (r *ResultRepository) FindByPU(ctx context.Context, puCode string) (*domain.Result, error) {
	opts := options.FindOne().SetSort(bson.D{{Key: "submitted_at", Value: -1}})
	var doc resultDoc
	err := r.col.FindOne(ctx, bson.M{"pu_code": puCode}, opts).Decode(&doc)
	if errors.Is(err, mongo.ErrNoDocuments) {
		return nil, domain.ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	return doc.toDomain(), nil
}

// ListByPU returns every submission for a PU, newest first.
func (r *ResultRepository) ListByPU(ctx context.Context, puCode string) ([]*domain.Result, error) {
	opts := options.Find().SetSort(bson.D{{Key: "submitted_at", Value: -1}})
	cur, err := r.col.Find(ctx, bson.M{"pu_code": puCode}, opts)
	if err != nil {
		return nil, err
	}
	defer cur.Close(ctx)

	results := []*domain.Result{}
	for cur.Next(ctx) {
		var doc resultDoc
		if err := cur.Decode(&doc); err != nil {
			return nil, err
		}
		results = append(results, doc.toDomain())
	}
	return results, cur.Err()
}

// Tally aggregates submitted results by pu/ward/lga/state. Grouping happens
// in application code (rather than a Mongo pipeline) because vote_counts
// keys are dynamic per-candidate and easiest to sum in Go.
//
// A PU can have multiple submissions now (primary + sub-agents), so this
// first collapses to the single latest submission per PU before summing
// upward -- otherwise a PU with two agents reporting would silently count
// twice toward its ward/LGA/state totals.
func (r *ResultRepository) Tally(ctx context.Context, level domain.TallyLevel) ([]*domain.TallyRow, error) {
	puCursor, err := r.puCol.Find(ctx, bson.M{})
	if err != nil {
		return nil, err
	}
	defer puCursor.Close(ctx)

	type puMeta struct{ Ward, LGA, State string }
	puByCode := map[string]puMeta{}
	keyOf := func(m puMeta) string {
		switch level {
		case domain.TallyWard:
			return m.Ward
		case domain.TallyLGA:
			return m.LGA
		case domain.TallyState:
			return m.State
		default:
			return ""
		}
	}
	totalUnitsByKey := map[string]int{}
	for puCursor.Next(ctx) {
		var doc puDoc
		if err := puCursor.Decode(&doc); err != nil {
			return nil, err
		}
		meta := puMeta{Ward: doc.Ward, LGA: doc.LGA, State: doc.State}
		puByCode[doc.PUCode] = meta
		if level == domain.TallyPU {
			totalUnitsByKey[doc.PUCode]++
		} else {
			totalUnitsByKey[keyOf(meta)]++
		}
	}

	resCursor, err := r.col.Find(ctx, bson.M{})
	if err != nil {
		return nil, err
	}
	defer resCursor.Close(ctx)

	latestByPU := map[string]resultDoc{}
	for resCursor.Next(ctx) {
		var doc resultDoc
		if err := resCursor.Decode(&doc); err != nil {
			return nil, err
		}
		if existing, ok := latestByPU[doc.PUCode]; !ok || doc.SubmittedAt.After(existing.SubmittedAt) {
			latestByPU[doc.PUCode] = doc
		}
	}

	type acc struct {
		votes    map[string]int
		accred   int
		reported map[string]bool
	}
	rows := map[string]*acc{}
	for _, doc := range latestByPU {
		meta := puByCode[doc.PUCode]
		key := doc.PUCode
		if level != domain.TallyPU {
			key = keyOf(meta)
		}
		if key == "" {
			continue
		}
		a, ok := rows[key]
		if !ok {
			a = &acc{votes: map[string]int{}, reported: map[string]bool{}}
			rows[key] = a
		}
		for cand, n := range doc.VoteCounts {
			a.votes[cand] += n
		}
		a.accred += doc.TotalAccreditedVoters
		a.reported[doc.PUCode] = true
	}

	out := []*domain.TallyRow{}
	for key, a := range rows {
		out = append(out, &domain.TallyRow{
			Key:                   key,
			VoteCounts:            a.votes,
			TotalAccreditedVoters: a.accred,
			ReportingUnits:        len(a.reported),
			TotalUnits:            totalUnitsByKey[key],
		})
	}
	return out, nil
}
