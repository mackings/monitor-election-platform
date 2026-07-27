package domain

import (
	"context"
	"time"
)

type RelatedType string

const (
	RelatedIncident RelatedType = "incident"
	RelatedResult   RelatedType = "result"
)

type Media struct {
	ID          string      `bson:"_id,omitempty" json:"id"`
	ObjectKey   string      `bson:"object_key" json:"object_key"`
	URL         string      `bson:"url" json:"url"`
	ContentType string      `bson:"content_type" json:"content_type"`
	UploadedBy  string      `bson:"uploaded_by" json:"uploaded_by"`
	RelatedType RelatedType `bson:"related_type,omitempty" json:"related_type,omitempty"`
	RelatedID   string      `bson:"related_id,omitempty" json:"related_id,omitempty"`
	CreatedAt   time.Time   `bson:"created_at" json:"created_at"`
}

type MediaRepository interface {
	Create(ctx context.Context, m *Media) error
	FindByID(ctx context.Context, id string) (*Media, error)
	FindByIDs(ctx context.Context, ids []string) ([]*Media, error)
}

// PresignedUpload is issued to a client so it can upload a file directly to
// object storage without proxying bytes through the API.
type PresignedUpload struct {
	UploadURL string `json:"upload_url"`
	ObjectKey string `json:"object_key"`
	PublicURL string `json:"public_url"`
	ExpiresIn int    `json:"expires_in_seconds"`
}

// ObjectStore is implemented by the storage adapter (Cloudflare R2 / S3).
type ObjectStore interface {
	PresignPutURL(ctx context.Context, objectKey, contentType string) (*PresignedUpload, error)
	PublicURL(objectKey string) string
}
