// Package geocode resolves coordinates to a human-readable place name via
// OpenStreetMap's Nominatim API.
package geocode

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
)

type nominatimAddress struct {
	Amenity       string `json:"amenity"`
	HouseNumber   string `json:"house_number"`
	Road          string `json:"road"`
	Neighbourhood string `json:"neighbourhood"`
	Suburb        string `json:"suburb"`
	CityDistrict  string `json:"city_district"`
	City          string `json:"city"`
	Town          string `json:"town"`
	Village       string `json:"village"`
}

type nominatimResponse struct {
	Name        string           `json:"name"`
	DisplayName string           `json:"display_name"`
	Address     nominatimAddress `json:"address"`
}

func firstNonEmpty(vals ...string) string {
	for _, v := range vals {
		if v != "" {
			return v
		}
	}
	return ""
}

// buildPreciseName assembles the most specific description Nominatim's
// data actually supports at this point: a named landmark and/or street
// address first, falling back to neighbourhood/town, and only falling
// all the way back to Nominatim's own display_name (county/state level)
// when the surrounding area isn't mapped in more detail. OpenStreetMap's
// road-level coverage in Nigeria varies hugely between well-mapped urban
// areas and rural ones -- no amount of parsing recovers street detail
// that was never tagged in the source data.
func buildPreciseName(name string, a nominatimAddress, fallback string) string {
	var parts []string

	if landmark := firstNonEmpty(name, a.Amenity); landmark != "" {
		parts = append(parts, landmark)
	}
	if a.Road != "" {
		if a.HouseNumber != "" {
			parts = append(parts, a.HouseNumber+" "+a.Road)
		} else {
			parts = append(parts, a.Road)
		}
	}
	if area := firstNonEmpty(a.Neighbourhood, a.Suburb, a.CityDistrict); area != "" {
		parts = append(parts, area)
	}
	if locality := firstNonEmpty(a.City, a.Town, a.Village); locality != "" {
		parts = append(parts, locality)
	}

	if len(parts) == 0 {
		return fallback
	}
	return strings.Join(parts, ", ")
}

// ReverseGeocode resolves a lat/lng to a human-readable place name.
// Best-effort: callers should treat an error as "just show the raw
// coordinates instead" rather than a hard failure.
func ReverseGeocode(ctx context.Context, lat, lng float64) (string, error) {
	url := fmt.Sprintf(
		"https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=%f&lon=%f&zoom=18&addressdetails=1",
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
	return buildPreciseName(out.Name, out.Address, out.DisplayName), nil
}
