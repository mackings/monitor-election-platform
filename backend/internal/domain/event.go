package domain

// EventType names every fact the WS layer can push to connected dashboards.
type EventType string

const (
	EventOfficerStatusChanged   EventType = "officer.status_changed"
	EventOfficerCheckedIn       EventType = "officer.checked_in"
	EventOfficerCheckedOut      EventType = "officer.checked_out"
	EventOfficerLocationUpdated EventType = "officer.location_updated"
	EventPUStatusChanged        EventType = "pu.status_changed"
	EventIncidentCreated        EventType = "incident.created"
	EventDistressTriggered      EventType = "distress.triggered"
	EventResultSubmitted        EventType = "result.submitted"
)

// Event is the payload broadcast to connected WS clients. Usecases build
// these and hand them to a Broadcaster; they never talk to the transport
// directly. PUCode/OfficerID are set by the usecase alongside Payload so
// the persistence layer can index/filter activity (e.g. "everything that
// happened at this PU") without needing to know each payload's shape.
type Event struct {
	Type      EventType   `json:"type"`
	PUCode    string      `json:"pu_code,omitempty"`
	OfficerID string      `json:"officer_id,omitempty"`
	Payload   interface{} `json:"payload"`
}

// Broadcaster decouples usecases from the WS transport. The delivery/ws
// package implements this; usecases depend only on this interface.
type Broadcaster interface {
	Publish(e Event)
}
