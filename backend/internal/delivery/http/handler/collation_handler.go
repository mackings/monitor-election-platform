package handler

import (
	"encoding/json"
	"net/http"

	"monitor/backend/internal/delivery/http/middleware"
	"monitor/backend/internal/domain"
	"monitor/backend/internal/usecase/collation"
	"monitor/backend/pkg/httpresp"
)

type CollationHandler struct {
	collation *collation.Usecase
}

func NewCollationHandler(c *collation.Usecase) *CollationHandler {
	return &CollationHandler{collation: c}
}

func (h *CollationHandler) Submit(w http.ResponseWriter, r *http.Request) {
	var body struct {
		PUCode                string         `json:"pu_code"`
		VoteCounts            map[string]int `json:"vote_counts"`
		TotalAccreditedVoters int            `json:"total_accredited_voters"`
		MediaIDs              []string       `json:"media_ids"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		httpresp.Error(w, http.StatusBadRequest, "invalid body")
		return
	}
	officerID := middleware.UserID(r.Context())
	result, err := h.collation.Submit(r.Context(), collation.SubmitInput{
		PUCode: body.PUCode, OfficerID: officerID, VoteCounts: body.VoteCounts,
		TotalAccreditedVoters: body.TotalAccreditedVoters, MediaIDs: body.MediaIDs,
	})
	if err != nil {
		httpresp.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	httpresp.JSON(w, http.StatusCreated, result)
}

func (h *CollationHandler) Tally(w http.ResponseWriter, r *http.Request) {
	level := domain.TallyLevel(r.URL.Query().Get("level"))
	rows, err := h.collation.Tally(r.Context(), level)
	if err != nil {
		httpresp.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	httpresp.JSON(w, http.StatusOK, rows)
}

// List returns every submission for a PU (newest first): GET /results?pu_code=
func (h *CollationHandler) List(w http.ResponseWriter, r *http.Request) {
	puCode := r.URL.Query().Get("pu_code")
	if puCode == "" {
		httpresp.Error(w, http.StatusBadRequest, "pu_code query param is required")
		return
	}
	results, err := h.collation.ListByPU(r.Context(), puCode)
	if err != nil {
		httpresp.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	httpresp.JSON(w, http.StatusOK, results)
}

// SubmitManual lets an admin/supervisor log a result an officer relayed
// by SMS/phone call because they had no data connection to submit
// through the app themselves.
func (h *CollationHandler) SubmitManual(w http.ResponseWriter, r *http.Request) {
	var body struct {
		PUCode                string         `json:"pu_code"`
		OfficerID             string         `json:"officer_id"`
		VoteCounts            map[string]int `json:"vote_counts"`
		TotalAccreditedVoters int            `json:"total_accredited_voters"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		httpresp.Error(w, http.StatusBadRequest, "invalid body")
		return
	}
	if body.PUCode == "" || body.OfficerID == "" {
		httpresp.Error(w, http.StatusBadRequest, "pu_code and officer_id are required")
		return
	}
	adminID := middleware.UserID(r.Context())
	result, err := h.collation.Submit(r.Context(), collation.SubmitInput{
		PUCode: body.PUCode, OfficerID: body.OfficerID, VoteCounts: body.VoteCounts,
		TotalAccreditedVoters: body.TotalAccreditedVoters,
		Source:                domain.ResultSourceSMS, LoggedByID: adminID,
	})
	if err != nil {
		httpresp.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	httpresp.JSON(w, http.StatusCreated, result)
}
