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
}

func (u *Usecase) Submit(ctx context.Context, in SubmitInput) (*domain.Result, error) {
	result := &domain.Result{
		PUCode:                in.PUCode,
		OfficerID:             in.OfficerID,
		VoteCounts:            in.VoteCounts,
		TotalAccreditedVoters: in.TotalAccreditedVoters,
		MediaIDs:              in.MediaIDs,
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

func (u *Usecase) Tally(ctx context.Context, level domain.TallyLevel) ([]*domain.TallyRow, error) {
	if level == "" {
		level = domain.TallyLGA
	}
	return u.results.Tally(ctx, level)
}
