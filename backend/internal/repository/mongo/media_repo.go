package mongorepo

import (
	"context"
	"errors"
	"time"

	"monitor/backend/internal/domain"

	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
)

type mediaDoc struct {
	ID          bson.ObjectID      `bson:"_id,omitempty"`
	ObjectKey   string             `bson:"object_key"`
	URL         string             `bson:"url"`
	ContentType string             `bson:"content_type"`
	UploadedBy  string             `bson:"uploaded_by"`
	RelatedType domain.RelatedType `bson:"related_type,omitempty"`
	RelatedID   string             `bson:"related_id,omitempty"`
	SHA256      string             `bson:"sha256,omitempty"`
	CapturedAt  *time.Time         `bson:"captured_at,omitempty"`
	CapturedLat *float64           `bson:"captured_lat,omitempty"`
	CapturedLng *float64           `bson:"captured_lng,omitempty"`
	CreatedAt   time.Time          `bson:"created_at"`
}

func (d *mediaDoc) toDomain() *domain.Media {
	return &domain.Media{
		ID:          d.ID.Hex(),
		ObjectKey:   d.ObjectKey,
		URL:         d.URL,
		ContentType: d.ContentType,
		UploadedBy:  d.UploadedBy,
		RelatedType: d.RelatedType,
		RelatedID:   d.RelatedID,
		SHA256:      d.SHA256,
		CapturedAt:  d.CapturedAt,
		CapturedLat: d.CapturedLat,
		CapturedLng: d.CapturedLng,
		CreatedAt:   d.CreatedAt,
	}
}

type MediaRepository struct {
	col *mongo.Collection
}

func NewMediaRepository(db *mongo.Database) *MediaRepository {
	return &MediaRepository{col: db.Collection("media")}
}

func (r *MediaRepository) Create(ctx context.Context, m *domain.Media) error {
	doc := mediaDoc{
		ID:          bson.NewObjectID(),
		ObjectKey:   m.ObjectKey,
		URL:         m.URL,
		ContentType: m.ContentType,
		UploadedBy:  m.UploadedBy,
		RelatedType: m.RelatedType,
		RelatedID:   m.RelatedID,
		SHA256:      m.SHA256,
		CapturedAt:  m.CapturedAt,
		CapturedLat: m.CapturedLat,
		CapturedLng: m.CapturedLng,
		CreatedAt:   time.Now(),
	}
	_, err := r.col.InsertOne(ctx, doc)
	if err != nil {
		return err
	}
	m.ID = doc.ID.Hex()
	m.CreatedAt = doc.CreatedAt
	return nil
}

func (r *MediaRepository) FindByID(ctx context.Context, id string) (*domain.Media, error) {
	oid, err := bson.ObjectIDFromHex(id)
	if err != nil {
		return nil, domain.ErrNotFound
	}
	var doc mediaDoc
	err = r.col.FindOne(ctx, bson.M{"_id": oid}).Decode(&doc)
	if errors.Is(err, mongo.ErrNoDocuments) {
		return nil, domain.ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	return doc.toDomain(), nil
}

func (r *MediaRepository) FindByIDs(ctx context.Context, ids []string) ([]*domain.Media, error) {
	oids := make([]bson.ObjectID, 0, len(ids))
	for _, id := range ids {
		if oid, err := bson.ObjectIDFromHex(id); err == nil {
			oids = append(oids, oid)
		}
	}
	if len(oids) == 0 {
		return []*domain.Media{}, nil
	}
	cur, err := r.col.Find(ctx, bson.M{"_id": bson.M{"$in": oids}})
	if err != nil {
		return nil, err
	}
	defer cur.Close(ctx)

	media := []*domain.Media{}
	for cur.Next(ctx) {
		var doc mediaDoc
		if err := cur.Decode(&doc); err != nil {
			return nil, err
		}
		media = append(media, doc.toDomain())
	}
	return media, cur.Err()
}
