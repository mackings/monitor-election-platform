package handler

import (
	"net/http"

	"github.com/go-chi/chi/v5"

	"monitor/backend/internal/domain"
	"monitor/backend/internal/usecase/pollingunit"
	"monitor/backend/pkg/httpresp"
)

type PollingUnitHandler struct {
	pu *pollingunit.Usecase
}

func NewPollingUnitHandler(p *pollingunit.Usecase) *PollingUnitHandler {
	return &PollingUnitHandler{pu: p}
}

func (h *PollingUnitHandler) List(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	pus, err := h.pu.List(r.Context(), q.Get("lga"), q.Get("ward"))
	if err != nil {
		httpresp.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	httpresp.JSON(w, http.StatusOK, pus)
}

func (h *PollingUnitHandler) Get(w http.ResponseWriter, r *http.Request) {
	code := chi.URLParam(r, "code")
	pu, err := h.pu.Get(r.Context(), code)
	if err == domain.ErrNotFound {
		httpresp.Error(w, http.StatusNotFound, "polling unit not found")
		return
	}
	if err != nil {
		httpresp.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	httpresp.JSON(w, http.StatusOK, pu)
}

func (h *PollingUnitHandler) Overview(w http.ResponseWriter, r *http.Request) {
	overview, err := h.pu.Overview(r.Context())
	if err != nil {
		httpresp.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	httpresp.JSON(w, http.StatusOK, overview)
}
