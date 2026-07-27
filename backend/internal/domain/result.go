package domain

import (
	"context"
	"time"
)

type Result struct {
	ID                    string         `bson:"_id,omitempty" json:"id"`
	PUCode                string         `bson:"pu_code" json:"pu_code"`
	OfficerID             string         `bson:"officer_id" json:"officer_id"`
	VoteCounts            map[string]int `bson:"vote_counts" json:"vote_counts"`
	TotalAccreditedVoters int            `bson:"total_accredited_voters" json:"total_accredited_voters"`
	MediaIDs              []string       `bson:"media_ids,omitempty" json:"media_ids,omitempty"`
	Verified              bool           `bson:"verified" json:"verified"`
	SubmittedAt           time.Time      `bson:"submitted_at" json:"submitted_at"`
}

type TallyLevel string

const (
	TallyPU    TallyLevel = "pu"
	TallyWard  TallyLevel = "ward"
	TallyLGA   TallyLevel = "lga"
	TallyState TallyLevel = "state"
)

type TallyRow struct {
	Key                   string         `json:"key"`
	VoteCounts            map[string]int `json:"vote_counts"`
	TotalAccreditedVoters int            `json:"total_accredited_voters"`
	ReportingUnits        int            `json:"reporting_units"`
	TotalUnits            int            `json:"total_units"`
}

type ResultRepository interface {
	Create(ctx context.Context, r *Result) error
	FindByPU(ctx context.Context, puCode string) (*Result, error)
	Tally(ctx context.Context, level TallyLevel) ([]*TallyRow, error)
}
