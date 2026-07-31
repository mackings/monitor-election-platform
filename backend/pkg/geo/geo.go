package geo

import "math"

const earthRadiusKm = 6371.0

// HaversineKm returns the great-circle distance between two points in km.
func HaversineKm(lat1, lng1, lat2, lng2 float64) float64 {
	rad := func(d float64) float64 { return d * math.Pi / 180 }
	dLat := rad(lat2 - lat1)
	dLng := rad(lng2 - lng1)
	a := math.Sin(dLat/2)*math.Sin(dLat/2) +
		math.Cos(rad(lat1))*math.Cos(rad(lat2))*math.Sin(dLng/2)*math.Sin(dLng/2)
	c := 2 * math.Atan2(math.Sqrt(a), math.Sqrt(1-a))
	return earthRadiusKm * c
}

// BBox is a lat/lng bounding box.
type BBox struct {
	MinLat, MaxLat float64
	MinLng, MaxLng float64
}

func (b BBox) Contains(lat, lng float64) bool {
	return lat >= b.MinLat && lat <= b.MaxLat && lng >= b.MinLng && lng <= b.MaxLng
}

// OyoStateBBox is a generous bounding box covering Oyo State, Nigeria --
// wide enough to tolerate IP geolocation's coarse imprecision, but narrow
// enough to reject a result that's clearly nowhere near the state (e.g. an
// ISP whose IP block is administratively registered in Lagos regardless of
// where the connection actually is).
var OyoStateBBox = BBox{MinLat: 7.20, MaxLat: 9.20, MinLng: 2.90, MaxLng: 4.60}
