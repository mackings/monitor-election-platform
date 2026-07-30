package domain

import (
	"context"
	"time"
)

type ResultSource string

const (
	// ResultSourceApp is the normal path: an officer submitted this
	// through the field app directly.
	ResultSourceApp ResultSource = "app"
	// ResultSourceSMS is an admin manually logging a result an officer
	// phoned/texted in -- for when the officer had no data connection to
	// submit through the app itself.
	ResultSourceSMS ResultSource = "sms"
)

type Result struct {
	ID                    string         `bson:"_id,omitempty" json:"id"`
	PUCode                string         `bson:"pu_code" json:"pu_code"`
	OfficerID             string         `bson:"officer_id" json:"officer_id"`
	VoteCounts            map[string]int `bson:"vote_counts" json:"vote_counts"`
	TotalAccreditedVoters int            `bson:"total_accredited_voters" json:"total_accredited_voters"`
	MediaIDs              []string       `bson:"media_ids,omitempty" json:"media_ids,omitempty"`
	Verified              bool           `bson:"verified" json:"verified"`
	// Source/LoggedBy distinguish a normal in-app submission from an
	// admin manually keying in a result an officer relayed by SMS/phone
	// call -- both still count as a submission for cross-checking
	// purposes, but the dashboard should be honest about provenance.
	Source      ResultSource `bson:"source,omitempty" json:"source,omitempty"`
	LoggedByID  string       `bson:"logged_by_id,omitempty" json:"logged_by_id,omitempty"`
	SubmittedAt time.Time    `bson:"submitted_at" json:"submitted_at"`
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
	// ListByPU returns every submission for a PU (newest first) -- unlike
	// FindByPU, used where multiple independent submissions (a primary
	// agent plus any sub-agents) need to be shown side by side for
	// cross-checking rather than collapsed to just the latest one.
	ListByPU(ctx context.Context, puCode string) ([]*Result, error)
	Tally(ctx context.Context, level TallyLevel) ([]*TallyRow, error)
}
