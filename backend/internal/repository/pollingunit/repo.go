package pollingunitrepo

import (
	"context"
	"errors"
	"time"

	"monitor/backend/internal/domain"

	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
)

// stateDoc holds only the parts of a polling unit that change during the
// day. A pu_code with no stateDoc simply hasn't had anything happen to it
// yet -- not_open, unassigned -- so the collection only ever has entries
// for units that have actually been touched.
type stateDoc struct {
	PUCode            string          `bson:"_id"`
	AssignedOfficerID string          `bson:"assigned_officer_id,omitempty"`
	CurrentStatus     domain.PUStatus `bson:"current_status,omitempty"`
	YardCode          string          `bson:"yardcode,omitempty"`
	UpdatedAt         time.Time       `bson:"updated_at,omitempty"`
}

type Repository struct {
	static map[string]staticPU
	order  []string
	col    *mongo.Collection
}

// New loads the static polling unit registry from dataPath once at
// startup and wires it to the Mongo collection that holds each unit's
// mutable election-day state.
func New(db *mongo.Database, dataPath string) (*Repository, error) {
	static, order, err := loadStatic(dataPath)
	if err != nil {
		return nil, err
	}
	return &Repository{static: static, order: order, col: db.Collection("polling_unit_state")}, nil
}

func merge(s staticPU, st *stateDoc) *domain.PollingUnit {
	pu := &domain.PollingUnit{
		ID:            s.PUCode,
		PUCode:        s.PUCode,
		PUName:        s.PUName,
		Ward:          s.Ward,
		LGA:           s.LGA,
		State:         s.State,
		Lat:           s.Lat,
		Lng:           s.Lng,
		CurrentStatus: domain.PUNotOpen,
	}
	if st != nil {
		pu.AssignedOfficerID = st.AssignedOfficerID
		pu.YardCode = st.YardCode
		pu.UpdatedAt = st.UpdatedAt
		if st.CurrentStatus != "" {
			pu.CurrentStatus = st.CurrentStatus
		}
	}
	return pu
}

func (r *Repository) fetchStates(ctx context.Context, codes []string) (map[string]*stateDoc, error) {
	cur, err := r.col.Find(ctx, bson.M{"_id": bson.M{"$in": codes}})
	if err != nil {
		return nil, err
	}
	defer cur.Close(ctx)

	states := make(map[string]*stateDoc, len(codes))
	for cur.Next(ctx) {
		var doc stateDoc
		if err := cur.Decode(&doc); err != nil {
			return nil, err
		}
		d := doc
		states[doc.PUCode] = &d
	}
	return states, cur.Err()
}

func (r *Repository) List(ctx context.Context, lga, ward string) ([]*domain.PollingUnit, error) {
	codes := make([]string, 0, len(r.order))
	for _, code := range r.order {
		s := r.static[code]
		if lga != "" && s.LGA != lga {
			continue
		}
		if ward != "" && s.Ward != ward {
			continue
		}
		codes = append(codes, code)
	}

	states, err := r.fetchStates(ctx, codes)
	if err != nil {
		return nil, err
	}

	pus := make([]*domain.PollingUnit, 0, len(codes))
	for _, code := range codes {
		pus = append(pus, merge(r.static[code], states[code]))
	}
	return pus, nil
}

func (r *Repository) FindByCode(ctx context.Context, code string) (*domain.PollingUnit, error) {
	s, ok := r.static[code]
	if !ok {
		return nil, domain.ErrNotFound
	}
	var st stateDoc
	err := r.col.FindOne(ctx, bson.M{"_id": code}).Decode(&st)
	if errors.Is(err, mongo.ErrNoDocuments) {
		return merge(s, nil), nil
	}
	if err != nil {
		return nil, err
	}
	return merge(s, &st), nil
}

func (r *Repository) AssignOfficer(ctx context.Context, code, officerID string) error {
	if _, ok := r.static[code]; !ok {
		return domain.ErrNotFound
	}
	_, err := r.col.UpdateOne(ctx,
		bson.M{"_id": code},
		bson.M{"$set": bson.M{"assigned_officer_id": officerID, "updated_at": time.Now()}},
		options.UpdateOne().SetUpsert(true),
	)
	return err
}

func (r *Repository) UpdateStatus(ctx context.Context, code string, status domain.PUStatus) error {
	if _, ok := r.static[code]; !ok {
		return domain.ErrNotFound
	}
	_, err := r.col.UpdateOne(ctx,
		bson.M{"_id": code},
		bson.M{"$set": bson.M{"current_status": status, "updated_at": time.Now()}},
		options.UpdateOne().SetUpsert(true),
	)
	return err
}

func (r *Repository) CountByStatus(ctx context.Context) (map[domain.PUStatus]int, error) {
	states, err := r.fetchStates(ctx, r.order)
	if err != nil {
		return nil, err
	}
	counts := map[domain.PUStatus]int{}
	for _, code := range r.order {
		status := domain.PUNotOpen
		if st := states[code]; st != nil && st.CurrentStatus != "" {
			status = st.CurrentStatus
		}
		counts[status]++
	}
	return counts, nil
}
