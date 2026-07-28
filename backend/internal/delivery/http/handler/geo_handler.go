package handler

import (
	"net/http"
	"strconv"

	"monitor/backend/pkg/geocode"
	"monitor/backend/pkg/httpresp"
)

type GeoHandler struct {
	geocode *geocode.Client
}

func NewGeoHandler(client *geocode.Client) *GeoHandler {
	return &GeoHandler{geocode: client}
}

func (h *GeoHandler) ReverseGeocode(w http.ResponseWriter, r *http.Request) {
	lat, latErr := strconv.ParseFloat(r.URL.Query().Get("lat"), 64)
	lng, lngErr := strconv.ParseFloat(r.URL.Query().Get("lng"), 64)
	if latErr != nil || lngErr != nil {
		httpresp.Error(w, http.StatusBadRequest, "lat and lng query params are required")
		return
	}

	name, err := h.geocode.ReverseGeocode(r.Context(), lat, lng)
	if err != nil {
		httpresp.Error(w, http.StatusBadGateway, "couldn't resolve a location name")
		return
	}
	httpresp.JSON(w, http.StatusOK, map[string]string{"name": name})
}
