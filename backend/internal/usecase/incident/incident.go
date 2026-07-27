package incident

import (
	"context"

	"monitor/backend/internal/domain"
)

type Usecase struct {
	incidents   domain.IncidentRepository
	pus         domain.PollingUnitRepository
	broadcaster domain.Broadcaster
}

func New(incidents domain.IncidentRepository, pus domain.PollingUnitRepository, b domain.Broadcaster) *Usecase {
	return &Usecase{incidents: incidents, pus: pus, broadcaster: b}
}

type CreateInput struct {
	PUCode      string
	OfficerID   string
	Type        string
	Description string
	MediaIDs    []string
	Lat, Lng    float64
	Severity    domain.Severity
}

func (u *Usecase) Create(ctx context.Context, in CreateInput) (*domain.Incident, error) {
	if in.Severity == "" {
		in.Severity = domain.SeverityMedium
	}
	incident := &domain.Incident{
		PUCode:      in.PUCode,
		OfficerID:   in.OfficerID,
		Type:        in.Type,
		Description: in.Description,
		MediaIDs:    in.MediaIDs,
		Lat:         in.Lat,
		Lng:         in.Lng,
		Severity:    in.Severity,
	}
	if err := u.incidents.Create(ctx, incident); err != nil {
		return nil, err
	}
	// An incident report flips the PU's live status so the map reflects it
	// immediately, unless it's already further along (completed).
	if pu, err := u.pus.FindByCode(ctx, in.PUCode); err == nil && pu.CurrentStatus != domain.PUComplete {
		_ = u.pus.UpdateStatus(ctx, in.PUCode, domain.PUIncident)
	}
	u.broadcaster.Publish(domain.Event{
		Type:      domain.EventIncidentCreated,
		PUCode:    incident.PUCode,
		OfficerID: incident.OfficerID,
		Payload:   incident,
	})
	return incident, nil
}

func (u *Usecase) List(ctx context.Context, puCode string, limit int) ([]*domain.Incident, error) {
	return u.incidents.List(ctx, puCode, limit)
}
