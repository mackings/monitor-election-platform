package handler

import (
	"net/http"
	"strconv"

	"monitor/backend/internal/usecase/activity"
	"monitor/backend/pkg/httpresp"
)

type ActivityHandler struct {
	activity *activity.Usecase
}

func NewActivityHandler(a *activity.Usecase) *ActivityHandler {
	return &ActivityHandler{activity: a}
}

func (h *ActivityHandler) List(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	limit, _ := strconv.Atoi(q.Get("limit"))
	if limit <= 0 {
		limit = 100
	}
	records, err := h.activity.List(r.Context(), limit, q.Get("pu_code"))
	if err != nil {
		httpresp.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	httpresp.JSON(w, http.StatusOK, records)
}
