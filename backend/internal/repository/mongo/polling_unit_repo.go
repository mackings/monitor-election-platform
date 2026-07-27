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

type puDoc struct {
	ID                bson.ObjectID   `bson:"_id,omitempty"`
	PUCode            string          `bson:"pu_code"`
	PUName            string          `bson:"pu_name"`
	Ward              string          `bson:"ward"`
	LGA               string          `bson:"lga"`
	State             string          `bson:"state"`
	Lat               float64         `bson:"lat"`
	Lng               float64         `bson:"lng"`
	YardCode          string          `bson:"yardcode,omitempty"`
	AssignedOfficerID string          `bson:"assigned_officer_id,omitempty"`
	CurrentStatus     domain.PUStatus `bson:"current_status"`
	UpdatedAt         time.Time       `bson:"updated_at"`
}

func (d *puDoc) toDomain() *domain.PollingUnit {
	return &domain.PollingUnit{
		ID:                d.ID.Hex(),
		PUCode:            d.PUCode,
		PUName:            d.PUName,
		Ward:              d.Ward,
		LGA:               d.LGA,
		State:             d.State,
		Lat:               d.Lat,
		Lng:               d.Lng,
		YardCode:          d.YardCode,
		AssignedOfficerID: d.AssignedOfficerID,
		CurrentStatus:     d.CurrentStatus,
		UpdatedAt:         d.UpdatedAt,
	}
}

type PollingUnitRepository struct {
	col *mongo.Collection
}

func NewPollingUnitRepository(db *mongo.Database) *PollingUnitRepository {
	return &PollingUnitRepository{col: db.Collection("polling_units")}
}

// EnsureIndexes should be called once at startup.
func (r *PollingUnitRepository) EnsureIndexes(ctx context.Context) error {
	_, err := r.col.Indexes().CreateOne(ctx, mongo.IndexModel{
		Keys:    bson.D{{Key: "pu_code", Value: 1}},
		Options: options.Index().SetUnique(true),
	})
	return err
}

func (r *PollingUnitRepository) Upsert(ctx context.Context, pu *domain.PollingUnit) error {
	now := time.Now()
	status := pu.CurrentStatus
	if status == "" {
		status = domain.PUNotOpen
	}
	filter := bson.M{"pu_code": pu.PUCode}
	update := bson.M{
		"$set": bson.M{
			"pu_name":    pu.PUName,
			"ward":       pu.Ward,
			"lga":        pu.LGA,
			"state":      pu.State,
			"lat":        pu.Lat,
			"lng":        pu.Lng,
			"yardcode":   pu.YardCode,
			"updated_at": now,
		},
		"$setOnInsert": bson.M{
			"pu_code":        pu.PUCode,
			"current_status": status,
		},
	}
	_, err := r.col.UpdateOne(ctx, filter, update, options.UpdateOne().SetUpsert(true))
	return err
}

func (r *PollingUnitRepository) List(ctx context.Context, lga, ward string) ([]*domain.PollingUnit, error) {
	filter := bson.M{}
	if lga != "" {
		filter["lga"] = lga
	}
	if ward != "" {
		filter["ward"] = ward
	}
	cur, err := r.col.Find(ctx, filter)
	if err != nil {
		return nil, err
	}
	defer cur.Close(ctx)

	pus := []*domain.PollingUnit{}
	for cur.Next(ctx) {
		var doc puDoc
		if err := cur.Decode(&doc); err != nil {
			return nil, err
		}
		pus = append(pus, doc.toDomain())
	}
	return pus, cur.Err()
}

func (r *PollingUnitRepository) FindByCode(ctx context.Context, code string) (*domain.PollingUnit, error) {
	var doc puDoc
	err := r.col.FindOne(ctx, bson.M{"pu_code": code}).Decode(&doc)
	if errors.Is(err, mongo.ErrNoDocuments) {
		return nil, domain.ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	return doc.toDomain(), nil
}

func (r *PollingUnitRepository) AssignOfficer(ctx context.Context, code, officerID string) error {
	_, err := r.col.UpdateOne(ctx, bson.M{"pu_code": code}, bson.M{"$set": bson.M{"assigned_officer_id": officerID, "updated_at": time.Now()}})
	return err
}

func (r *PollingUnitRepository) UpdateStatus(ctx context.Context, code string, status domain.PUStatus) error {
	_, err := r.col.UpdateOne(ctx, bson.M{"pu_code": code}, bson.M{"$set": bson.M{"current_status": status, "updated_at": time.Now()}})
	return err
}

func (r *PollingUnitRepository) CountByStatus(ctx context.Context) (map[domain.PUStatus]int, error) {
	pipeline := bson.A{
		bson.D{{Key: "$group", Value: bson.D{
			{Key: "_id", Value: "$current_status"},
			{Key: "count", Value: bson.D{{Key: "$sum", Value: 1}}},
		}}},
	}
	cur, err := r.col.Aggregate(ctx, pipeline)
	if err != nil {
		return nil, err
	}
	defer cur.Close(ctx)

	result := map[domain.PUStatus]int{}
	for cur.Next(ctx) {
		var row struct {
			ID    domain.PUStatus `bson:"_id"`
			Count int             `bson:"count"`
		}
		if err := cur.Decode(&row); err != nil {
			return nil, err
		}
		result[row.ID] = row.Count
	}
	return result, cur.Err()
}
