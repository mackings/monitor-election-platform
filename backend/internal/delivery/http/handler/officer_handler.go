package handler

import (
	"encoding/json"
	"net/http"

	"monitor/backend/internal/delivery/http/middleware"
	"monitor/backend/internal/domain"
	"monitor/backend/internal/usecase/officer"
	"monitor/backend/pkg/httpresp"
)

type OfficerHandler struct {
	officer *officer.Usecase
}

func NewOfficerHandler(o *officer.Usecase) *OfficerHandler {
	return &OfficerHandler{officer: o}
}

func (h *OfficerHandler) List(w http.ResponseWriter, r *http.Request) {
	officers, err := h.officer.List(r.Context())
	if err != nil {
		httpresp.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	httpresp.JSON(w, http.StatusOK, officers)
}

func (h *OfficerHandler) Assign(w http.ResponseWriter, r *http.Request) {
	var body struct {
		OfficerID string `json:"officer_id"`
		PUCode    string `json:"pu_code"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		httpresp.Error(w, http.StatusBadRequest, "invalid body")
		return
	}
	if err := h.officer.AssignPU(r.Context(), body.OfficerID, body.PUCode); err != nil {
		httpresp.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	httpresp.JSON(w, http.StatusOK, map[string]string{"status": "assigned"})
}

func (h *OfficerHandler) AssignSubAgent(w http.ResponseWriter, r *http.Request) {
	var body struct {
		OfficerID string `json:"officer_id"`
		PUCode    string `json:"pu_code"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		httpresp.Error(w, http.StatusBadRequest, "invalid body")
		return
	}
	if err := h.officer.AssignSubAgent(r.Context(), body.OfficerID, body.PUCode); err != nil {
		httpresp.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	httpresp.JSON(w, http.StatusOK, map[string]string{"status": "assigned"})
}

func (h *OfficerHandler) Unassign(w http.ResponseWriter, r *http.Request) {
	var body struct {
		OfficerID string `json:"officer_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		httpresp.Error(w, http.StatusBadRequest, "invalid body")
		return
	}
	if err := h.officer.UnassignPU(r.Context(), body.OfficerID); err != nil {
		httpresp.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	httpresp.JSON(w, http.StatusOK, map[string]string{"status": "unassigned"})
}

func (h *OfficerHandler) CheckIn(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Lat float64 `json:"lat"`
		Lng float64 `json:"lng"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		httpresp.Error(w, http.StatusBadRequest, "invalid body")
		return
	}
	officerID := middleware.UserID(r.Context())
	if err := h.officer.CheckIn(r.Context(), officerID, domain.Location{Lat: body.Lat, Lng: body.Lng}); err != nil {
		httpresp.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	httpresp.JSON(w, http.StatusOK, map[string]string{"status": "checked_in"})
}

func (h *OfficerHandler) UpdateLocation(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Lat float64 `json:"lat"`
		Lng float64 `json:"lng"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		httpresp.Error(w, http.StatusBadRequest, "invalid body")
		return
	}
	officerID := middleware.UserID(r.Context())
	if err := h.officer.UpdateLocation(r.Context(), officerID, domain.Location{Lat: body.Lat, Lng: body.Lng}); err != nil {
		httpresp.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	httpresp.JSON(w, http.StatusOK, map[string]string{"status": "location_updated"})
}

func (h *OfficerHandler) CheckOut(w http.ResponseWriter, r *http.Request) {
	officerID := middleware.UserID(r.Context())
	if err := h.officer.CheckOut(r.Context(), officerID); err != nil {
		httpresp.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	httpresp.JSON(w, http.StatusOK, map[string]string{"status": "checked_out"})
}

func (h *OfficerHandler) UpdateStatus(w http.ResponseWriter, r *http.Request) {
	var body struct {
		PUCode string          `json:"pu_code"`
		Status domain.PUStatus `json:"status"`
		Note   string          `json:"note"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		httpresp.Error(w, http.StatusBadRequest, "invalid body")
		return
	}
	officerID := middleware.UserID(r.Context())
	if err := h.officer.UpdateStatus(r.Context(), officerID, body.PUCode, body.Status, body.Note); err != nil {
		httpresp.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	httpresp.JSON(w, http.StatusOK, map[string]string{"status": "updated"})
}

func (h *OfficerHandler) Distress(w http.ResponseWriter, r *http.Request) {
	var body struct {
		PUCode string  `json:"pu_code"`
		Lat    float64 `json:"lat"`
		Lng    float64 `json:"lng"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		httpresp.Error(w, http.StatusBadRequest, "invalid body")
		return
	}
	officerID := middleware.UserID(r.Context())
	if err := h.officer.Distress(r.Context(), officerID, body.PUCode, domain.Location{Lat: body.Lat, Lng: body.Lng}); err != nil {
		httpresp.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	httpresp.JSON(w, http.StatusOK, map[string]string{"status": "distress_triggered"})
}
