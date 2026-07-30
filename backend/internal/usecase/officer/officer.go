package officer

import (
	"context"
	"time"

	"monitor/backend/internal/domain"
	"monitor/backend/pkg/geo"
)

type Usecase struct {
	users        domain.UserRepository
	pus          domain.PollingUnitRepository
	statusEvents domain.StatusEventRepository
	broadcaster  domain.Broadcaster
	// live is a broadcaster that only delivers over WS, without going
	// through the persisting decorator -- a location ping fires every
	// ~25s per checked-in officer, and durably logging each one to the
	// activity collection forever would flood both the live feed and
	// Atlas storage with GPS breadcrumbs nobody needs to query later.
	live domain.Broadcaster
}

func New(users domain.UserRepository, pus domain.PollingUnitRepository, statusEvents domain.StatusEventRepository, b domain.Broadcaster, live domain.Broadcaster) *Usecase {
	return &Usecase{users: users, pus: pus, statusEvents: statusEvents, broadcaster: b, live: live}
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

type officerLocationPayload struct {
	OfficerID  string               `json:"officer_id"`
	PUCode     string               `json:"pu_code,omitempty"`
	Status     domain.OfficerStatus `json:"status"`
	Location   domain.Location      `json:"location"`
	DistanceKm *float64             `json:"distance_km,omitempty"`
	At         time.Time            `json:"at"`
}

// UpdateLocation records a live position ping from an officer's device
// while they're checked in -- separate from CheckIn/Distress, which only
// capture a single location at the moment they fire. Status is left
// untouched (see UserRepository.UpdateLocation) and the event goes out
// over live (not the persisting broadcaster) since this fires far too
// often to be worth durably logging.
func (u *Usecase) UpdateLocation(ctx context.Context, officerID string, loc domain.Location) error {
	user, err := u.users.FindByID(ctx, officerID)
	if err != nil {
		return err
	}
	if err := u.users.UpdateLocation(ctx, officerID, loc); err != nil {
		return err
	}

	var distanceKm *float64
	if user.AssignedPUCode != "" {
		if pu, err := u.pus.FindByCode(ctx, user.AssignedPUCode); err == nil {
			d := geo.HaversineKm(loc.Lat, loc.Lng, pu.Lat, pu.Lng)
			distanceKm = &d
		}
	}

	u.live.Publish(domain.Event{
		Type:      domain.EventOfficerLocationUpdated,
		PUCode:    user.AssignedPUCode,
		OfficerID: officerID,
		Payload: officerLocationPayload{
			OfficerID: officerID, PUCode: user.AssignedPUCode, Status: user.Status,
			Location: loc, DistanceKm: distanceKm, At: time.Now(),
		},
	})
	return nil
}

func (u *Usecase) List(ctx context.Context) ([]*domain.User, error) {
	return u.users.List(ctx, domain.RoleFieldOfficer)
}

// clearOldPrimaryIfOwned clears a PU's back-reference to officerID only if
// officerID was actually recorded as that PU's primary agent -- an officer
// can also hold a PU code as a sub-agent (see AssignSubAgent), and in that
// case the PU's real primary must not be evicted just because the
// sub-agent is being reassigned elsewhere.
func (u *Usecase) clearOldPrimaryIfOwned(ctx context.Context, officerID, oldPUCode string) error {
	if oldPUCode == "" {
		return nil
	}
	oldPU, err := u.pus.FindByCode(ctx, oldPUCode)
	if err != nil || oldPU.AssignedOfficerID != officerID {
		return nil
	}
	return u.pus.AssignOfficer(ctx, oldPUCode, "")
}

// AssignPU assigns an officer as a polling unit's PRIMARY agent, keeping
// that relationship one-to-one on both sides: if the officer was already
// someone else's PU's primary, that PU's back-reference is cleared, and if
// the target PU already had a different primary, that officer's
// assignment is cleared too — otherwise either side could end up pointing
// at a stale, no-longer-true assignment. Doesn't touch sub-agents on
// either PU (see AssignSubAgent) -- those are independent of who's
// primary.
func (u *Usecase) AssignPU(ctx context.Context, officerID, puCode string) error {
	officer, err := u.users.FindByID(ctx, officerID)
	if err != nil {
		return err
	}
	if officer.AssignedPUCode != puCode {
		if err := u.clearOldPrimaryIfOwned(ctx, officerID, officer.AssignedPUCode); err != nil {
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

// AssignSubAgent gives an officer access to submit for a polling unit
// without making them its primary -- the PU's AssignedOfficerID (which
// drives the dashboard's single "assigned agent" display/call button)
// stays whoever it already was, or empty if nobody's primary yet. A
// sub-agent is just any other officer whose AssignedPUCode matches the PU;
// there's no separate list to maintain, so this is a one-field update.
func (u *Usecase) AssignSubAgent(ctx context.Context, officerID, puCode string) error {
	officer, err := u.users.FindByID(ctx, officerID)
	if err != nil {
		return err
	}
	if _, err := u.pus.FindByCode(ctx, puCode); err != nil {
		return err
	}
	if officer.AssignedPUCode != puCode {
		if err := u.clearOldPrimaryIfOwned(ctx, officerID, officer.AssignedPUCode); err != nil {
			return err
		}
	}
	return u.users.UpdateAssignment(ctx, officerID, puCode)
}

// UnassignPU clears an officer's PU assignment entirely (primary or
// sub-agent) -- used to remove a sub-agent, or to unassign someone
// without immediately picking a replacement.
func (u *Usecase) UnassignPU(ctx context.Context, officerID string) error {
	officer, err := u.users.FindByID(ctx, officerID)
	if err != nil {
		return err
	}
	if err := u.clearOldPrimaryIfOwned(ctx, officerID, officer.AssignedPUCode); err != nil {
		return err
	}
	return u.users.UpdateAssignment(ctx, officerID, "")
}
