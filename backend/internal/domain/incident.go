package domain

import (
	"context"
	"time"
)

type Severity string

const (
	SeverityLow      Severity = "low"
	SeverityMedium   Severity = "medium"
	SeverityHigh     Severity = "high"
	SeverityCritical Severity = "critical"
)

type Incident struct {
	ID          string    `bson:"_id,omitempty" json:"id"`
	PUCode      string    `bson:"pu_code" json:"pu_code"`
	OfficerID   string    `bson:"officer_id" json:"officer_id"`
	Type        string    `bson:"type" json:"type"`
	Description string    `bson:"description" json:"description"`
	MediaIDs    []string  `bson:"media_ids,omitempty" json:"media_ids,omitempty"`
	Lat         float64   `bson:"lat" json:"lat"`
	Lng         float64   `bson:"lng" json:"lng"`
	Severity    Severity  `bson:"severity" json:"severity"`
	CreatedAt   time.Time `bson:"created_at" json:"created_at"`
}

type IncidentRepository interface {
	Create(ctx context.Context, i *Incident) error
	List(ctx context.Context, puCode string, limit int) ([]*Incident, error)
	FindByID(ctx context.Context, id string) (*Incident, error)
}
