package handler

import (
	"net"
	"net/http"
	"strconv"
	"strings"

	"monitor/backend/pkg/geocode"
	"monitor/backend/pkg/httpresp"
	"monitor/backend/pkg/ipgeo"
)

type GeoHandler struct {
	geocode *geocode.Client
	ipgeo   *ipgeo.Client
}

func NewGeoHandler(client *geocode.Client, ipgeoClient *ipgeo.Client) *GeoHandler {
	return &GeoHandler{geocode: client, ipgeo: ipgeoClient}
}

// clientIP prefers X-Forwarded-For (Render terminates TLS and proxies to
// the app, so RemoteAddr alone would be Render's internal proxy, not the
// browser's actual public IP) and falls back to RemoteAddr for local dev.
func clientIP(r *http.Request) string {
	if fwd := r.Header.Get("X-Forwarded-For"); fwd != "" {
		if first := strings.TrimSpace(strings.Split(fwd, ",")[0]); first != "" {
			return first
		}
	}
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return host
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

// IPLocation is the "near me" fallback for when the browser's own
// Geolocation API is unavailable -- an approximate (city-level) fix
// derived from the caller's IP address instead of a hard failure.
func (h *GeoHandler) IPLocation(w http.ResponseWriter, r *http.Request) {
	result, err := h.ipgeo.Lookup(r.Context(), clientIP(r))
	if err != nil {
		httpresp.Error(w, http.StatusBadGateway, "couldn't determine an approximate location for your network")
		return
	}
	httpresp.JSON(w, http.StatusOK, map[string]any{"lat": result.Lat, "lng": result.Lng, "city": result.City})
}
