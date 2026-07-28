// Package geocode resolves coordinates to a human-readable place name via
// LocationIQ's reverse geocoding API.
//
// We originally called OpenStreetMap's Nominatim directly (no key
// required), but its public instance actively blocks/rejects automated
// requests from major cloud-hosting IP ranges (Render, AWS, etc.) to
// protect itself from abuse -- it worked from a developer's home IP but
// consistently 403'd from the deployed backend. LocationIQ is built on
// the same OSM data and returns a near-identical response shape, but is a
// proper key-based service meant for exactly this kind of server-side use.
package geocode

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
)

// structuralKeys are the administrative/address fields LocationIQ always
// uses the same name for. Anything else in the address map is a POI tag
// (LocationIQ names it after the OSM category itself -- "hospital",
// "school", "shop", "amenity", etc. -- rather than one fixed key), so
// whatever's left over after excluding these is treated as a landmark.
var structuralKeys = map[string]bool{
	"house_number":   true,
	"road":           true,
	"neighbourhood":  true,
	"suburb":         true,
	"city_district":  true,
	"city":           true,
	"town":           true,
	"village":        true,
	"county":         true,
	"state":          true,
	"state_district": true,
	"postcode":       true,
	"country":        true,
	"country_code":   true,
	"ISO3166-2-lvl3": true,
	"ISO3166-2-lvl4": true,
}

type reverseResponse struct {
	DisplayName string            `json:"display_name"`
	Address     map[string]string `json:"address"`
}

func firstNonEmpty(vals ...string) string {
	for _, v := range vals {
		if v != "" {
			return v
		}
	}
	return ""
}

func landmarkFrom(addr map[string]string) string {
	for k, v := range addr {
		if !structuralKeys[k] && v != "" {
			return v
		}
	}
	return ""
}

// buildPreciseName assembles the most specific description the address
// data actually supports: a named landmark and/or street address first,
// falling back to neighbourhood/town, and only falling all the way back
// to the coarse display_name (county/state level) when the surrounding
// area isn't mapped in more detail. OSM's road-level coverage in Nigeria
// varies hugely between well-mapped urban areas and rural ones -- no
// amount of parsing recovers street detail that was never tagged.
func buildPreciseName(addr map[string]string, fallback string) string {
	var parts []string

	if landmark := landmarkFrom(addr); landmark != "" {
		parts = append(parts, landmark)
	}
	if road := addr["road"]; road != "" {
		if hn := addr["house_number"]; hn != "" {
			parts = append(parts, hn+" "+road)
		} else {
			parts = append(parts, road)
		}
	}
	if area := firstNonEmpty(addr["neighbourhood"], addr["suburb"], addr["city_district"]); area != "" {
		parts = append(parts, area)
	}
	if locality := firstNonEmpty(addr["city"], addr["town"], addr["village"]); locality != "" {
		parts = append(parts, locality)
	}

	if len(parts) == 0 {
		return fallback
	}
	return strings.Join(parts, ", ")
}

type Client struct {
	apiKey string
}

func NewClient(apiKey string) *Client {
	return &Client{apiKey: apiKey}
}

// ReverseGeocode resolves a lat/lng to a human-readable place name.
// Best-effort: callers should treat an error as "just show the raw
// coordinates instead" rather than a hard failure.
func (c *Client) ReverseGeocode(ctx context.Context, lat, lng float64) (string, error) {
	if c.apiKey == "" {
		return "", fmt.Errorf("geocode: LOCATIONIQ_API_KEY is not configured")
	}

	url := fmt.Sprintf(
		"https://us1.locationiq.com/v1/reverse?key=%s&lat=%f&lon=%f&format=json&zoom=18&addressdetails=1",
		c.apiKey, lat, lng,
	)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return "", err
	}

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("geocode: unexpected status %d", resp.StatusCode)
	}

	var out reverseResponse
	if err := json.NewDecoder(resp.Body).Decode(&out); err != nil {
		return "", err
	}
	return buildPreciseName(out.Address, out.DisplayName), nil
}
