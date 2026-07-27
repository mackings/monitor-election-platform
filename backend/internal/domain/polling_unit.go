package domain

import (
	"context"
	"time"
)

type PUStatus string

const (
	PUNotOpen  PUStatus = "not_open"
	PUVoting   PUStatus = "voting"
	PUIncident PUStatus = "incident"
	PUDistress PUStatus = "distress"
	PUComplete PUStatus = "completed"
	PUNoReport PUStatus = "no_report"
)

type PollingUnit struct {
	ID                string    `bson:"_id,omitempty" json:"id"`
	PUCode            string    `bson:"pu_code" json:"pu_code"`
	PUName            string    `bson:"pu_name" json:"pu_name"`
	Ward              string    `bson:"ward" json:"ward"`
	LGA               string    `bson:"lga" json:"lga"`
	State             string    `bson:"state" json:"state"`
	Lat               float64   `bson:"lat" json:"lat"`
	Lng               float64   `bson:"lng" json:"lng"`
	YardCode          string    `bson:"yardcode,omitempty" json:"yardcode,omitempty"`
	AssignedOfficerID string    `bson:"assigned_officer_id,omitempty" json:"assigned_officer_id,omitempty"`
	CurrentStatus     PUStatus  `bson:"current_status" json:"current_status"`
	UpdatedAt         time.Time `bson:"updated_at" json:"updated_at"`
}

type PollingUnitRepository interface {
	Upsert(ctx context.Context, pu *PollingUnit) error
	List(ctx context.Context, lga, ward string) ([]*PollingUnit, error)
	FindByCode(ctx context.Context, code string) (*PollingUnit, error)
	AssignOfficer(ctx context.Context, code, officerID string) error
	UpdateStatus(ctx context.Context, code string, status PUStatus) error
	CountByStatus(ctx context.Context) (map[PUStatus]int, error)
}

type StatusEvent struct {
	ID        string    `bson:"_id,omitempty" json:"id"`
	PUCode    string    `bson:"pu_code" json:"pu_code"`
	OfficerID string    `bson:"officer_id" json:"officer_id"`
	Status    PUStatus  `bson:"status" json:"status"`
	Note      string    `bson:"note,omitempty" json:"note,omitempty"`
	CreatedAt time.Time `bson:"created_at" json:"created_at"`
}

type StatusEventRepository interface {
	Create(ctx context.Context, e *StatusEvent) error
	ListByPU(ctx context.Context, puCode string) ([]*StatusEvent, error)
	ListRecent(ctx context.Context, limit int) ([]*StatusEvent, error)
}
