package collation

import (
	"context"

	"monitor/backend/internal/domain"
)

type Usecase struct {
	results     domain.ResultRepository
	broadcaster domain.Broadcaster
}

func New(results domain.ResultRepository, b domain.Broadcaster) *Usecase {
	return &Usecase{results: results, broadcaster: b}
}

type SubmitInput struct {
	PUCode                string
	OfficerID             string
	VoteCounts            map[string]int
	TotalAccreditedVoters int
	MediaIDs              []string
	// Source/LoggedByID are set by the admin manual-entry path (an
	// officer relayed results by SMS/phone with no data connection to
	// submit through the app); left zero-value for a normal in-app
	// submission.
	Source     domain.ResultSource
	LoggedByID string
}

func (u *Usecase) Submit(ctx context.Context, in SubmitInput) (*domain.Result, error) {
	source := in.Source
	if source == "" {
		source = domain.ResultSourceApp
	}
	result := &domain.Result{
		PUCode:                in.PUCode,
		OfficerID:             in.OfficerID,
		VoteCounts:            in.VoteCounts,
		TotalAccreditedVoters: in.TotalAccreditedVoters,
		MediaIDs:              in.MediaIDs,
		Source:                source,
		LoggedByID:            in.LoggedByID,
	}
	if err := u.results.Create(ctx, result); err != nil {
		return nil, err
	}
	u.broadcaster.Publish(domain.Event{
		Type:      domain.EventResultSubmitted,
		PUCode:    result.PUCode,
		OfficerID: result.OfficerID,
		Payload:   result,
	})
	return result, nil
}

// ListByPU returns every submission for a PU (newest first) -- multiple
// independent submissions (a primary agent plus any sub-agents) are shown
// side by side rather than collapsed, so an admin can cross-check them.
func (u *Usecase) ListByPU(ctx context.Context, puCode string) ([]*domain.Result, error) {
	return u.results.ListByPU(ctx, puCode)
}

func (u *Usecase) Tally(ctx context.Context, level domain.TallyLevel) ([]*domain.TallyRow, error) {
	if level == "" {
		level = domain.TallyLGA
	}
	return u.results.Tally(ctx, level)
}
