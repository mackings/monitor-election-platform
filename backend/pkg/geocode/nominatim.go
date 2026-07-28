// Package geocode resolves coordinates to a human-readable place name via
// OpenStreetMap's Nominatim API.
package geocode

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
)

type nominatimResponse struct {
	DisplayName string `json:"display_name"`
}

// ReverseGeocode resolves a lat/lng to a human-readable place name.
// Best-effort: callers should treat an error as "just show the raw
// coordinates instead" rather than a hard failure.
func ReverseGeocode(ctx context.Context, lat, lng float64) (string, error) {
	url := fmt.Sprintf(
		"https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=%f&lon=%f&zoom=16&addressdetails=0",
		lat, lng,
	)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return "", err
	}
	// Nominatim's usage policy requires a real identifying User-Agent for
	// any automated use -- requests without one get rejected outright, and
	// this is the one header a browser fetch can never set itself, which
	// is why this call is proxied through the backend instead of made
	// directly from the dashboard.
	req.Header.Set("User-Agent", "ElectionMonitor/1.0 (admin dashboard reverse geocoding)")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("geocode: unexpected status %d", resp.StatusCode)
	}

	var out nominatimResponse
	if err := json.NewDecoder(resp.Body).Decode(&out); err != nil {
		return "", err
	}
	return out.DisplayName, nil
}
