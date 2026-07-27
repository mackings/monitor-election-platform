package handler

import (
	"encoding/json"
	"net/http"
	"strconv"

	"monitor/backend/internal/delivery/http/middleware"
	"monitor/backend/internal/domain"
	"monitor/backend/internal/usecase/incident"
	"monitor/backend/pkg/httpresp"
)

type IncidentHandler struct {
	incident *incident.Usecase
}

func NewIncidentHandler(i *incident.Usecase) *IncidentHandler {
	return &IncidentHandler{incident: i}
}

func (h *IncidentHandler) Create(w http.ResponseWriter, r *http.Request) {
	var body struct {
		PUCode      string          `json:"pu_code"`
		Type        string          `json:"type"`
		Description string          `json:"description"`
		MediaIDs    []string        `json:"media_ids"`
		Lat         float64         `json:"lat"`
		Lng         float64         `json:"lng"`
		Severity    domain.Severity `json:"severity"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		httpresp.Error(w, http.StatusBadRequest, "invalid body")
		return
	}
	officerID := middleware.UserID(r.Context())
	created, err := h.incident.Create(r.Context(), incident.CreateInput{
		PUCode: body.PUCode, OfficerID: officerID, Type: body.Type, Description: body.Description,
		MediaIDs: body.MediaIDs, Lat: body.Lat, Lng: body.Lng, Severity: body.Severity,
	})
	if err != nil {
		httpresp.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	httpresp.JSON(w, http.StatusCreated, created)
}

func (h *IncidentHandler) List(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	limit, _ := strconv.Atoi(q.Get("limit"))
	incidents, err := h.incident.List(r.Context(), q.Get("pu_code"), limit)
	if err != nil {
		httpresp.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	httpresp.JSON(w, http.StatusOK, incidents)
}
