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
