package handler

import (
	"encoding/json"
	"net/http"
	"strings"

	"monitor/backend/internal/delivery/http/middleware"
	"monitor/backend/internal/domain"
	"monitor/backend/internal/usecase/media"
	"monitor/backend/pkg/httpresp"
)

type MediaHandler struct {
	media *media.Usecase
}

func NewMediaHandler(m *media.Usecase) *MediaHandler {
	return &MediaHandler{media: m}
}

func (h *MediaHandler) Presign(w http.ResponseWriter, r *http.Request) {
	var body struct {
		ContentType string `json:"content_type"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		httpresp.Error(w, http.StatusBadRequest, "invalid body")
		return
	}
	userID := middleware.UserID(r.Context())
	upload, err := h.media.Presign(r.Context(), userID, body.ContentType)
	if err != nil {
		httpresp.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	httpresp.JSON(w, http.StatusOK, upload)
}

func (h *MediaHandler) Register(w http.ResponseWriter, r *http.Request) {
	var body struct {
		ObjectKey   string             `json:"object_key"`
		ContentType string             `json:"content_type"`
		RelatedType domain.RelatedType `json:"related_type"`
		RelatedID   string             `json:"related_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		httpresp.Error(w, http.StatusBadRequest, "invalid body")
		return
	}
	userID := middleware.UserID(r.Context())
	m, err := h.media.Register(r.Context(), media.RegisterInput{
		ObjectKey: body.ObjectKey, ContentType: body.ContentType, UploadedBy: userID,
		RelatedType: body.RelatedType, RelatedID: body.RelatedID,
	})
	if err != nil {
		httpresp.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	httpresp.JSON(w, http.StatusCreated, m)
}

// List resolves a comma-separated list of media IDs (e.g. an incident's
// media_ids) to their viewable records/URLs in one call: GET /media?ids=a,b,c
func (h *MediaHandler) List(w http.ResponseWriter, r *http.Request) {
	idsParam := r.URL.Query().Get("ids")
	if idsParam == "" {
		httpresp.JSON(w, http.StatusOK, []domain.Media{})
		return
	}
	ids := strings.Split(idsParam, ",")
	media, err := h.media.GetMany(r.Context(), ids)
	if err != nil {
		httpresp.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	httpresp.JSON(w, http.StatusOK, media)
}
