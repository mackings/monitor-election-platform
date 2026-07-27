package mongorepo

import (
	"context"
	"time"

	"monitor/backend/internal/domain"

	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
)

type activityDoc struct {
	ID        bson.ObjectID    `bson:"_id,omitempty"`
	Type      domain.EventType `bson:"type"`
	PUCode    string           `bson:"pu_code,omitempty"`
	OfficerID string           `bson:"officer_id,omitempty"`
	Payload   interface{}      `bson:"payload"`
	CreatedAt time.Time        `bson:"created_at"`
}

func (d *activityDoc) toDomain() *domain.ActivityRecord {
	return &domain.ActivityRecord{
		ID:        d.ID.Hex(),
		Type:      d.Type,
		PUCode:    d.PUCode,
		OfficerID: d.OfficerID,
		Payload:   d.Payload,
		CreatedAt: d.CreatedAt,
	}
}

type ActivityRepository struct {
	col *mongo.Collection
}

func NewActivityRepository(db *mongo.Database) *ActivityRepository {
	return &ActivityRepository{col: db.Collection("activity_log")}
}

func (r *ActivityRepository) EnsureIndexes(ctx context.Context) error {
	_, err := r.col.Indexes().CreateMany(ctx, []mongo.IndexModel{
		{Keys: bson.D{{Key: "created_at", Value: -1}}},
		{Keys: bson.D{{Key: "pu_code", Value: 1}, {Key: "created_at", Value: -1}}},
	})
	return err
}

func (r *ActivityRepository) Create(ctx context.Context, rec *domain.ActivityRecord) error {
	doc := activityDoc{
		ID:        bson.NewObjectID(),
		Type:      rec.Type,
		PUCode:    rec.PUCode,
		OfficerID: rec.OfficerID,
		Payload:   rec.Payload,
		CreatedAt: time.Now(),
	}
	_, err := r.col.InsertOne(ctx, doc)
	if err != nil {
		return err
	}
	rec.ID = doc.ID.Hex()
	rec.CreatedAt = doc.CreatedAt
	return nil
}

func (r *ActivityRepository) ListRecent(ctx context.Context, limit int, puCode string) ([]*domain.ActivityRecord, error) {
	filter := bson.M{}
	if puCode != "" {
		filter["pu_code"] = puCode
	}
	opts := options.Find().SetSort(bson.D{{Key: "created_at", Value: -1}})
	if limit > 0 {
		opts.SetLimit(int64(limit))
	}
	cur, err := r.col.Find(ctx, filter, opts)
	if err != nil {
		return nil, err
	}
	defer cur.Close(ctx)

	records := []*domain.ActivityRecord{}
	for cur.Next(ctx) {
		var doc activityDoc
		if err := cur.Decode(&doc); err != nil {
			return nil, err
		}
		records = append(records, doc.toDomain())
	}
	return records, cur.Err()
}
