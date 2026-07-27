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

// BBox is a lat/lng bounding box used to grid-sweep an area.
type BBox struct {
	MinLat, MaxLat float64
	MinLng, MaxLng float64
}

// OyoStateBBox is a generous bounding box covering Oyo State, Nigeria.
// It still overlaps neighboring Ogun/Osun/Kwara state territory at the
// edges since state borders aren't rectangular — callers should filter
// results by the state field the PU lookup API returns, not rely on the
// box alone.
var OyoStateBBox = BBox{MinLat: 7.20, MaxLat: 9.20, MinLng: 2.90, MaxLng: 4.60}

// Grid generates a uniform lat/lng grid covering the box, spaced roughly
// stepKm apart.
func (b BBox) Grid(stepKm float64) [][2]float64 {
	const kmPerDegLat = 110.574
	midLat := (b.MinLat + b.MaxLat) / 2
	kmPerDegLng := 111.320 * math.Cos(midLat*math.Pi/180)

	latStep := stepKm / kmPerDegLat
	lngStep := stepKm / kmPerDegLng

	var points [][2]float64
	for lat := b.MinLat; lat <= b.MaxLat; lat += latStep {
		for lng := b.MinLng; lng <= b.MaxLng; lng += lngStep {
			points = append(points, [2]float64{lat, lng})
		}
	}
	return points
}
