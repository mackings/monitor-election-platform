package pollingunit

import (
	"context"

	"monitor/backend/internal/domain"
)

type Usecase struct {
	pus domain.PollingUnitRepository
}

func New(pus domain.PollingUnitRepository) *Usecase {
	return &Usecase{pus: pus}
}

func (u *Usecase) List(ctx context.Context, lga, ward string) ([]*domain.PollingUnit, error) {
	return u.pus.List(ctx, lga, ward)
}

func (u *Usecase) Get(ctx context.Context, code string) (*domain.PollingUnit, error) {
	return u.pus.FindByCode(ctx, code)
}

type Overview struct {
	TotalPUs     int                     `json:"total_pus"`
	Unassigned   int                     `json:"unassigned"`
	StatusCounts map[domain.PUStatus]int `json:"status_counts"`
}

// Overview powers the dashboard's top-line stat tiles: coverage gaps
// (PUs with no assigned officer) plus a breakdown by voting status.
func (u *Usecase) Overview(ctx context.Context) (*Overview, error) {
	all, err := u.pus.List(ctx, "", "")
	if err != nil {
		return nil, err
	}
	counts, err := u.pus.CountByStatus(ctx)
	if err != nil {
		return nil, err
	}
	unassigned := 0
	for _, pu := range all {
		if pu.AssignedOfficerID == "" {
			unassigned++
		}
	}
	return &Overview{TotalPUs: len(all), Unassigned: unassigned, StatusCounts: counts}, nil
}
