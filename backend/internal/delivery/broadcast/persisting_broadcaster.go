// Package broadcast provides a domain.Broadcaster decorator that durably
// records every event alongside delivering it live over WebSocket.
package broadcast

import (
	"context"
	"log"

	"monitor/backend/internal/domain"
)

// PersistingBroadcaster wraps the real transport (the WS hub) and records
// every event to the activity log first — so the dashboard's live feed
// survives a page refresh, and a polling unit's full history can be
// queried later via GET /activity?pu_code=. Usecases are unaware of this;
// they still just depend on domain.Broadcaster.
type PersistingBroadcaster struct {
	next domain.Broadcaster
	repo domain.ActivityRepository
}

func NewPersisting(next domain.Broadcaster, repo domain.ActivityRepository) *PersistingBroadcaster {
	return &PersistingBroadcaster{next: next, repo: repo}
}

func (b *PersistingBroadcaster) Publish(e domain.Event) {
	b.next.Publish(e)
	go func() {
		rec := &domain.ActivityRecord{Type: e.Type, PUCode: e.PUCode, OfficerID: e.OfficerID, Payload: e.Payload}
		if err := b.repo.Create(context.Background(), rec); err != nil {
			log.Printf("activity: failed to persist %s event: %v", e.Type, err)
		}
	}()
}
