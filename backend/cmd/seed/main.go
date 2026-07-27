// Command seed populates the polling_units collection with real Oyo State
// data pulled from the public YardCode "nearest polling units" API by
// sweeping a coordinate grid across the state and de-duplicating by
// pu_code. Requests are rate-limited to stay respectful of the third-party
// service.
package main

import (
	"context"
	"encoding/json"
	"flag"
	"fmt"
	"log"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"monitor/backend/internal/config"
	"monitor/backend/internal/domain"
	mongorepo "monitor/backend/internal/repository/mongo"
	"monitor/backend/pkg/geo"

	"github.com/joho/godotenv"
)

const nearestPUEndpoint = "https://election.yardcode.ng/api/public/nearest-pu"

type apiPU struct {
	PUCode   string  `json:"pu_code"`
	PUName   string  `json:"pu_name"`
	Ward     string  `json:"ward"`
	LGA      string  `json:"lga"`
	State    string  `json:"state"`
	Lat      float64 `json:"lat"`
	Lng      float64 `json:"lng"`
	YardCode string  `json:"yardcode"`
}

func main() {
	stepKm := flag.Float64("step-km", 3.0, "grid spacing in km; smaller = denser sweep = more requests")
	top := flag.Int("top", 20, "how many nearest PUs to request per grid point")
	delayMs := flag.Int("delay-ms", 350, "delay between requests, be polite to the third-party API")
	limit := flag.Int("limit", 0, "stop after this many grid points (0 = sweep the whole grid)")
	flag.Parse()

	_ = godotenv.Load()
	cfg := config.Load()

	db, disconnect, err := mongorepo.Connect(cfg.MongoURI, cfg.MongoDB)
	if err != nil {
		log.Fatalf("mongo connect: %v", err)
	}
	defer disconnect(context.Background())

	puRepo := mongorepo.NewPollingUnitRepository(db)
	if err := puRepo.EnsureIndexes(context.Background()); err != nil {
		log.Fatalf("ensure indexes: %v", err)
	}

	points := geo.OyoStateBBox.Grid(*stepKm)
	if *limit > 0 && *limit < len(points) {
		points = points[:*limit]
	}
	log.Printf("sweeping %d grid points (step=%.1fkm, top=%d)", len(points), *stepKm, *top)

	client := &http.Client{Timeout: 10 * time.Second}
	seen := map[string]bool{}
	upserted := 0

	for i, p := range points {
		lat, lng := p[0], p[1]
		results, err := fetchNearest(client, lat, lng, *top)
		if err != nil {
			log.Printf("[%d/%d] fetch %.4f,%.4f: %v", i+1, len(points), lat, lng, err)
			time.Sleep(time.Duration(*delayMs) * time.Millisecond)
			continue
		}
		for _, pu := range results {
			if pu.PUCode == "" || seen[pu.PUCode] {
				continue
			}
			// Grid points near the state border return the nearest PUs
			// regardless of state, so trust the API's own state field
			// rather than the query point to keep out neighboring states.
			if !strings.EqualFold(pu.State, "OYO") {
				continue
			}
			seen[pu.PUCode] = true
			err := puRepo.Upsert(context.Background(), &domain.PollingUnit{
				PUCode: pu.PUCode, PUName: pu.PUName, Ward: pu.Ward, LGA: pu.LGA,
				State: pu.State, Lat: pu.Lat, Lng: pu.Lng, YardCode: pu.YardCode,
			})
			if err != nil {
				log.Printf("upsert %s: %v", pu.PUCode, err)
				continue
			}
			upserted++
		}
		if (i+1)%25 == 0 {
			log.Printf("[%d/%d] %d unique PUs so far", i+1, len(points), len(seen))
		}
		time.Sleep(time.Duration(*delayMs) * time.Millisecond)
	}

	log.Printf("done: %d unique polling units upserted", upserted)
}

func fetchNearest(client *http.Client, lat, lng float64, top int) ([]apiPU, error) {
	q := url.Values{}
	q.Set("lat", strconv.FormatFloat(lat, 'f', -1, 64))
	q.Set("lng", strconv.FormatFloat(lng, 'f', -1, 64))
	q.Set("top", strconv.Itoa(top))
	fullURL := fmt.Sprintf("%s?%s", nearestPUEndpoint, q.Encode())

	resp, err := client.Get(fullURL)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("status %d", resp.StatusCode)
	}
	var results []apiPU
	if err := json.NewDecoder(resp.Body).Decode(&results); err != nil {
		return nil, err
	}
	return results, nil
}
