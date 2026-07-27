package domain

import (
	"context"
	"time"
)

// ActivityRecord is the durable copy of every Event ever broadcast. It's
// what makes the dashboard's live activity feed survive a page refresh,
// and what a polling unit's detail view queries to show its full history
// (check-ins, status changes, incidents, results, distress alerts) in one
// place.
type ActivityRecord struct {
	ID        string      `bson:"_id,omitempty" json:"id"`
	Type      EventType   `bson:"type" json:"type"`
	PUCode    string      `bson:"pu_code,omitempty" json:"pu_code,omitempty"`
	OfficerID string      `bson:"officer_id,omitempty" json:"officer_id,omitempty"`
	Payload   interface{} `bson:"payload" json:"payload"`
	CreatedAt time.Time   `bson:"created_at" json:"created_at"`
}

type ActivityRepository interface {
	Create(ctx context.Context, r *ActivityRecord) error
	// ListRecent returns the most recent records, optionally filtered to
	// a single polling unit. limit <= 0 means "no limit".
	ListRecent(ctx context.Context, limit int, puCode string) ([]*ActivityRecord, error)
}
