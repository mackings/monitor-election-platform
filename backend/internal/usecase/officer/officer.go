package officer

import (
	"context"
	"time"

	"monitor/backend/internal/domain"
)

type Usecase struct {
	users        domain.UserRepository
	pus          domain.PollingUnitRepository
	statusEvents domain.StatusEventRepository
	broadcaster  domain.Broadcaster
}

func New(users domain.UserRepository, pus domain.PollingUnitRepository, statusEvents domain.StatusEventRepository, b domain.Broadcaster) *Usecase {
	return &Usecase{users: users, pus: pus, statusEvents: statusEvents, broadcaster: b}
}

type officerStatusPayload struct {
	OfficerID string               `bson:"officer_id" json:"officer_id"`
	Status    domain.OfficerStatus `bson:"status" json:"status"`
	Location  *domain.Location     `bson:"location,omitempty" json:"location,omitempty"`
	At        time.Time            `bson:"at" json:"at"`
}

// assignedPUCode looks up an officer's assigned PU so their check-in/out
// and distress events carry a PUCode too — without it, that activity
// wouldn't show up when a supervisor opens that PU's detail view.
func (u *Usecase) assignedPUCode(ctx context.Context, officerID string) string {
	user, err := u.users.FindByID(ctx, officerID)
	if err != nil {
		return ""
	}
	return user.AssignedPUCode
}

func (u *Usecase) CheckIn(ctx context.Context, officerID string, loc domain.Location) error {
	if err := u.users.UpdateStatus(ctx, officerID, domain.OfficerActive, &loc); err != nil {
		return err
	}
	u.broadcaster.Publish(domain.Event{
		Type:      domain.EventOfficerCheckedIn,
		PUCode:    u.assignedPUCode(ctx, officerID),
		OfficerID: officerID,
		Payload:   officerStatusPayload{OfficerID: officerID, Status: domain.OfficerActive, Location: &loc, At: time.Now()},
	})
	return nil
}

func (u *Usecase) CheckOut(ctx context.Context, officerID string) error {
	if err := u.users.UpdateStatus(ctx, officerID, domain.OfficerOffline, nil); err != nil {
		return err
	}
	u.broadcaster.Publish(domain.Event{
		Type:      domain.EventOfficerCheckedOut,
		PUCode:    u.assignedPUCode(ctx, officerID),
		OfficerID: officerID,
		Payload:   officerStatusPayload{OfficerID: officerID, Status: domain.OfficerOffline, At: time.Now()},
	})
	return nil
}

// UpdateStatus records a PU-level voting-stage transition reported by the
// officer assigned to that PU (not_open -> voting -> completed, or
// incident/no_report).
func (u *Usecase) UpdateStatus(ctx context.Context, officerID, puCode string, status domain.PUStatus, note string) error {
	if err := u.pus.UpdateStatus(ctx, puCode, status); err != nil {
		return err
	}
	event := &domain.StatusEvent{PUCode: puCode, OfficerID: officerID, Status: status, Note: note}
	if err := u.statusEvents.Create(ctx, event); err != nil {
		return err
	}
	u.broadcaster.Publish(domain.Event{
		Type:      domain.EventPUStatusChanged,
		PUCode:    puCode,
		OfficerID: officerID,
		Payload:   event,
	})
	return nil
}

type distressPayload struct {
	OfficerID string          `bson:"officer_id" json:"officer_id"`
	PUCode    string          `bson:"pu_code" json:"pu_code"`
	Location  domain.Location `bson:"location" json:"location"`
	At        time.Time       `bson:"at" json:"at"`
}

func (u *Usecase) Distress(ctx context.Context, officerID, puCode string, loc domain.Location) error {
	if err := u.users.UpdateStatus(ctx, officerID, domain.OfficerDistress, &loc); err != nil {
		return err
	}
	if puCode != "" {
		if err := u.pus.UpdateStatus(ctx, puCode, domain.PUDistress); err != nil {
			return err
		}
	}
	u.broadcaster.Publish(domain.Event{
		Type:      domain.EventDistressTriggered,
		PUCode:    puCode,
		OfficerID: officerID,
		Payload:   distressPayload{OfficerID: officerID, PUCode: puCode, Location: loc, At: time.Now()},
	})
	return nil
}

func (u *Usecase) List(ctx context.Context) ([]*domain.User, error) {
	return u.users.List(ctx, domain.RoleFieldOfficer)
}

// AssignPU assigns an officer to a polling unit, keeping the relationship
// one-to-one on both sides: if the officer was already assigned elsewhere,
// that PU's back-reference is cleared, and if the target PU already had a
// different officer, that officer's assignment is cleared too — otherwise
// either side could end up pointing at a stale, no-longer-true assignment.
func (u *Usecase) AssignPU(ctx context.Context, officerID, puCode string) error {
	officer, err := u.users.FindByID(ctx, officerID)
	if err != nil {
		return err
	}
	if officer.AssignedPUCode != "" && officer.AssignedPUCode != puCode {
		if err := u.pus.AssignOfficer(ctx, officer.AssignedPUCode, ""); err != nil {
			return err
		}
	}

	pu, err := u.pus.FindByCode(ctx, puCode)
	if err != nil {
		return err
	}
	if pu.AssignedOfficerID != "" && pu.AssignedOfficerID != officerID {
		if err := u.users.UpdateAssignment(ctx, pu.AssignedOfficerID, ""); err != nil {
			return err
		}
	}

	if err := u.users.UpdateAssignment(ctx, officerID, puCode); err != nil {
		return err
	}
	return u.pus.AssignOfficer(ctx, puCode, officerID)
}
