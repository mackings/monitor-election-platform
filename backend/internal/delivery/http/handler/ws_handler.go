package handler

import (
	"net/http"

	"monitor/backend/internal/delivery/ws"
	"monitor/backend/pkg/httpresp"
	"monitor/backend/pkg/jwtutil"
)

type WSHandler struct {
	hub    *ws.Hub
	tokens *jwtutil.Manager
}

func NewWSHandler(hub *ws.Hub, tokens *jwtutil.Manager) *WSHandler {
	return &WSHandler{hub: hub, tokens: tokens}
}

// Serve upgrades the connection. Browsers can't set custom headers on a
// WebSocket handshake, so the JWT travels as a query param here instead of
// through the shared Auth middleware.
func (h *WSHandler) Serve(w http.ResponseWriter, r *http.Request) {
	token := r.URL.Query().Get("token")
	claims, err := h.tokens.Verify(token)
	if err != nil {
		httpresp.Error(w, http.StatusUnauthorized, "invalid token")
		return
	}
	if err := ws.Serve(h.hub, w, r, claims.UserID, claims.Role); err != nil {
		httpresp.Error(w, http.StatusInternalServerError, "ws upgrade failed")
		return
	}
}
