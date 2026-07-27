package activity

import (
	"context"

	"monitor/backend/internal/domain"
)

type Usecase struct {
	repo domain.ActivityRepository
}

func New(repo domain.ActivityRepository) *Usecase {
	return &Usecase{repo: repo}
}

// List returns recent activity, optionally scoped to a single polling
// unit — the same call powers both the dashboard's global live feed
// (puCode == "") and a PU detail sheet's full history.
func (u *Usecase) List(ctx context.Context, limit int, puCode string) ([]*domain.ActivityRecord, error) {
	return u.repo.ListRecent(ctx, limit, puCode)
}
