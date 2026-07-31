// Package ipgeo resolves an IP address to an approximate lat/lng via
// ip-api.com's free JSON endpoint (no key required). City-level accuracy
// at best -- this exists purely as a fallback for the admin "near me"
// filter when the browser's own Geolocation API is unavailable (Location
// Services off at the OS level, a network blocking it, permission
// revoked...), not for anything that needs a real device fix.
package ipgeo

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
)

type Result struct {
	Lat     float64
	Lng     float64
	City    string
	Country string
}

type Client struct{}

func NewClient() *Client {
	return &Client{}
}

// Lookup resolves ip to an approximate location. ip must be the actual
// client's public IP (a private/loopback address, e.g. from local dev,
// can't be geolocated and returns an error).
func (c *Client) Lookup(ctx context.Context, ip string) (*Result, error) {
	if ip == "" {
		return nil, fmt.Errorf("ipgeo: no client IP to look up")
	}

	url := fmt.Sprintf("http://ip-api.com/json/%s?fields=status,message,lat,lon,city,country", ip)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, err
	}

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("ipgeo: unexpected status %d", resp.StatusCode)
	}

	var out struct {
		Status  string  `json:"status"`
		Message string  `json:"message"`
		Lat     float64 `json:"lat"`
		Lon     float64 `json:"lon"`
		City    string  `json:"city"`
		Country string  `json:"country"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&out); err != nil {
		return nil, err
	}
	if out.Status != "success" {
		return nil, fmt.Errorf("ipgeo: lookup failed: %s", out.Message)
	}
	return &Result{Lat: out.Lat, Lng: out.Lon, City: out.City, Country: out.Country}, nil
}
