package mongorepo

import (
	"context"
	"time"

	"monitor/backend/internal/domain"

	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
)

type statusEventDoc struct {
	ID        bson.ObjectID   `bson:"_id,omitempty"`
	PUCode    string          `bson:"pu_code"`
	OfficerID string          `bson:"officer_id"`
	Status    domain.PUStatus `bson:"status"`
	Note      string          `bson:"note,omitempty"`
	CreatedAt time.Time       `bson:"created_at"`
}

func (d *statusEventDoc) toDomain() *domain.StatusEvent {
	return &domain.StatusEvent{
		ID:        d.ID.Hex(),
		PUCode:    d.PUCode,
		OfficerID: d.OfficerID,
		Status:    d.Status,
		Note:      d.Note,
		CreatedAt: d.CreatedAt,
	}
}

type StatusEventRepository struct {
	col *mongo.Collection
}

func NewStatusEventRepository(db *mongo.Database) *StatusEventRepository {
	return &StatusEventRepository{col: db.Collection("status_events")}
}

func (r *StatusEventRepository) Create(ctx context.Context, e *domain.StatusEvent) error {
	doc := statusEventDoc{
		ID:        bson.NewObjectID(),
		PUCode:    e.PUCode,
		OfficerID: e.OfficerID,
		Status:    e.Status,
		Note:      e.Note,
		CreatedAt: time.Now(),
	}
	_, err := r.col.InsertOne(ctx, doc)
	if err != nil {
		return err
	}
	e.ID = doc.ID.Hex()
	e.CreatedAt = doc.CreatedAt
	return nil
}

func (r *StatusEventRepository) ListByPU(ctx context.Context, puCode string) ([]*domain.StatusEvent, error) {
	cur, err := r.col.Find(ctx, bson.M{"pu_code": puCode}, options.Find().SetSort(bson.D{{Key: "created_at", Value: -1}}))
	if err != nil {
		return nil, err
	}
	defer cur.Close(ctx)
	return decodeStatusEvents(ctx, cur)
}

func (r *StatusEventRepository) ListRecent(ctx context.Context, limit int) ([]*domain.StatusEvent, error) {
	opts := options.Find().SetSort(bson.D{{Key: "created_at", Value: -1}}).SetLimit(int64(limit))
	cur, err := r.col.Find(ctx, bson.M{}, opts)
	if err != nil {
		return nil, err
	}
	defer cur.Close(ctx)
	return decodeStatusEvents(ctx, cur)
}

func decodeStatusEvents(ctx context.Context, cur *mongo.Cursor) ([]*domain.StatusEvent, error) {
	events := []*domain.StatusEvent{}
	for cur.Next(ctx) {
		var doc statusEventDoc
		if err := cur.Decode(&doc); err != nil {
			return nil, err
		}
		events = append(events, doc.toDomain())
	}
	return events, cur.Err()
}
