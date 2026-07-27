package mongorepo

import (
	"context"
	"errors"
	"time"

	"monitor/backend/internal/domain"

	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
)

type resultDoc struct {
	ID                    bson.ObjectID  `bson:"_id,omitempty"`
	PUCode                string         `bson:"pu_code"`
	OfficerID             string         `bson:"officer_id"`
	VoteCounts            map[string]int `bson:"vote_counts"`
	TotalAccreditedVoters int            `bson:"total_accredited_voters"`
	MediaIDs              []string       `bson:"media_ids,omitempty"`
	Verified              bool           `bson:"verified"`
	SubmittedAt           time.Time      `bson:"submitted_at"`
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

func (r *ResultRepository) Create(ctx context.Context, res *domain.Result) error {
	doc := resultDoc{
		ID:                    bson.NewObjectID(),
		PUCode:                res.PUCode,
		OfficerID:             res.OfficerID,
		VoteCounts:            res.VoteCounts,
		TotalAccreditedVoters: res.TotalAccreditedVoters,
		MediaIDs:              res.MediaIDs,
		Verified:              res.Verified,
		SubmittedAt:           time.Now(),
	}
	// One result per PU: replace any prior submission so re-sends correct it.
	_, err := r.col.ReplaceOne(ctx, bson.M{"pu_code": res.PUCode}, doc, replaceUpsert())
	if err != nil {
		return err
	}
	res.ID = doc.ID.Hex()
	res.SubmittedAt = doc.SubmittedAt
	return nil
}

func (r *ResultRepository) FindByPU(ctx context.Context, puCode string) (*domain.Result, error) {
	var doc resultDoc
	err := r.col.FindOne(ctx, bson.M{"pu_code": puCode}).Decode(&doc)
	if errors.Is(err, mongo.ErrNoDocuments) {
		return nil, domain.ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	return doc.toDomain(), nil
}

// Tally aggregates submitted results by pu/ward/lga/state. Grouping happens
// in application code (rather than a Mongo pipeline) because vote_counts
// keys are dynamic per-candidate and easiest to sum in Go.
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

	type acc struct {
		votes    map[string]int
		accred   int
		reported map[string]bool
	}
	rows := map[string]*acc{}
	for resCursor.Next(ctx) {
		var doc resultDoc
		if err := resCursor.Decode(&doc); err != nil {
			return nil, err
		}
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
