// Package pollingunitrepo implements domain.PollingUnitRepository over two
// sources: a static, read-only registry of Oyo State's 6,390 polling units
// loaded once from a JSON file (geography never changes on election day),
// and a Mongo collection holding only what does change -- status, officer
// assignment, timestamps -- keyed by pu_code.
package pollingunitrepo

import (
	"encoding/json"
	"fmt"
	"os"
	"strconv"
	"strings"
)

type staticPU struct {
	PUCode string
	PUName string
	Ward   string
	LGA    string
	State  string
	Lat    float64
	Lng    float64
}

// rawPU mirrors the on-disk export: lat/lng arrive as strings, sometimes
// empty for units that were never geocoded.
type rawPU struct {
	State  string `json:"state"`
	LGA    string `json:"lga"`
	Ward   string `json:"ward"`
	PUCode string `json:"pu_code"`
	PUName string `json:"pu_name"`
	Lat    string `json:"lat"`
	Lng    string `json:"lng"`
}

// loadStatic reads the polling unit data file, returning a lookup map and
// the original file order (grouped by LGA/ward) so List results stay
// stable and geographically grouped without an extra sort step.
func loadStatic(path string) (byCode map[string]staticPU, order []string, err error) {
	f, err := os.Open(path)
	if err != nil {
		return nil, nil, fmt.Errorf("open polling unit data file %q: %w", path, err)
	}
	defer f.Close()

	var raw []rawPU
	if err := json.NewDecoder(f).Decode(&raw); err != nil {
		return nil, nil, fmt.Errorf("decode polling unit data file %q: %w", path, err)
	}

	byCode = make(map[string]staticPU, len(raw))
	order = make([]string, 0, len(raw))
	for _, r := range raw {
		if r.PUCode == "" {
			continue
		}
		lat, _ := strconv.ParseFloat(strings.TrimSpace(r.Lat), 64)
		lng, _ := strconv.ParseFloat(strings.TrimSpace(r.Lng), 64)
		byCode[r.PUCode] = staticPU{
			PUCode: r.PUCode,
			PUName: r.PUName,
			Ward:   r.Ward,
			LGA:    r.LGA,
			State:  r.State,
			Lat:    lat,
			Lng:    lng,
		}
		order = append(order, r.PUCode)
	}
	return byCode, order, nil
}
