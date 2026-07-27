package ws

import (
	"encoding/json"
	"log"
	"sync"

	"monitor/backend/internal/domain"
)

// Hub keeps the set of connected dashboard/field clients and fans out
// domain events to all of them. It implements domain.Broadcaster so
// usecases can publish without knowing about WebSockets.
type Hub struct {
	mu      sync.RWMutex
	clients map[*Client]bool
	publish chan domain.Event
}

func NewHub() *Hub {
	h := &Hub{
		clients: make(map[*Client]bool),
		publish: make(chan domain.Event, 256),
	}
	go h.run()
	return h
}

func (h *Hub) run() {
	for evt := range h.publish {
		payload, err := json.Marshal(evt)
		if err != nil {
			log.Printf("ws: marshal event: %v", err)
			continue
		}
		h.mu.RLock()
		for c := range h.clients {
			select {
			case c.send <- payload:
			default:
				// client too slow / dead — drop the connection
				close(c.send)
				delete(h.clients, c)
			}
		}
		h.mu.RUnlock()
	}
}

// Publish satisfies domain.Broadcaster.
func (h *Hub) Publish(e domain.Event) {
	h.publish <- e
}

func (h *Hub) register(c *Client) {
	h.mu.Lock()
	defer h.mu.Unlock()
	h.clients[c] = true
}

func (h *Hub) unregister(c *Client) {
	h.mu.Lock()
	defer h.mu.Unlock()
	if _, ok := h.clients[c]; ok {
		delete(h.clients, c)
		close(c.send)
	}
}

func (h *Hub) ClientCount() int {
	h.mu.RLock()
	defer h.mu.RUnlock()
	return len(h.clients)
}
