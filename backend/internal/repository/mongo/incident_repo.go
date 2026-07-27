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

type incidentDoc struct {
	ID          bson.ObjectID   `bson:"_id,omitempty"`
	PUCode      string          `bson:"pu_code"`
	OfficerID   string          `bson:"officer_id"`
	Type        string          `bson:"type"`
	Description string          `bson:"description"`
	MediaIDs    []string        `bson:"media_ids,omitempty"`
	Lat         float64         `bson:"lat"`
	Lng         float64         `bson:"lng"`
	Severity    domain.Severity `bson:"severity"`
	CreatedAt   time.Time       `bson:"created_at"`
}

func (d *incidentDoc) toDomain() *domain.Incident {
	return &domain.Incident{
		ID:          d.ID.Hex(),
		PUCode:      d.PUCode,
		OfficerID:   d.OfficerID,
		Type:        d.Type,
		Description: d.Description,
		MediaIDs:    d.MediaIDs,
		Lat:         d.Lat,
		Lng:         d.Lng,
		Severity:    d.Severity,
		CreatedAt:   d.CreatedAt,
	}
}

type IncidentRepository struct {
	col *mongo.Collection
}

func NewIncidentRepository(db *mongo.Database) *IncidentRepository {
	return &IncidentRepository{col: db.Collection("incidents")}
}

func (r *IncidentRepository) Create(ctx context.Context, i *domain.Incident) error {
	doc := incidentDoc{
		ID:          bson.NewObjectID(),
		PUCode:      i.PUCode,
		OfficerID:   i.OfficerID,
		Type:        i.Type,
		Description: i.Description,
		MediaIDs:    i.MediaIDs,
		Lat:         i.Lat,
		Lng:         i.Lng,
		Severity:    i.Severity,
		CreatedAt:   time.Now(),
	}
	_, err := r.col.InsertOne(ctx, doc)
	if err != nil {
		return err
	}
	i.ID = doc.ID.Hex()
	i.CreatedAt = doc.CreatedAt
	return nil
}

func (r *IncidentRepository) List(ctx context.Context, puCode string, limit int) ([]*domain.Incident, error) {
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

	incidents := []*domain.Incident{}
	for cur.Next(ctx) {
		var doc incidentDoc
		if err := cur.Decode(&doc); err != nil {
			return nil, err
		}
		incidents = append(incidents, doc.toDomain())
	}
	return incidents, cur.Err()
}

func (r *IncidentRepository) FindByID(ctx context.Context, id string) (*domain.Incident, error) {
	oid, err := bson.ObjectIDFromHex(id)
	if err != nil {
		return nil, domain.ErrNotFound
	}
	var doc incidentDoc
	err = r.col.FindOne(ctx, bson.M{"_id": oid}).Decode(&doc)
	if errors.Is(err, mongo.ErrNoDocuments) {
		return nil, domain.ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	return doc.toDomain(), nil
}
