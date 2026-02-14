package models

import "time"

type Arrival struct {
	RouteID           string    `json:"routeId"`
	RouteName         string    `json:"routeName"`
	StopID            string    `json:"stopId"`
	StopName          string    `json:"stopName"`
	Destination       string    `json:"destination"`
	PredictedAt       time.Time `json:"predictedAt"`
	MinutesAway       int       `json:"minutesAway"`
	AccessibilitySafe bool      `json:"accessibilitySafe"`
}

type Alert struct {
	ID          string    `json:"id"`
	Title       string    `json:"title"`
	Description string    `json:"description"`
	RouteID     string    `json:"routeId,omitempty"`
	StationID   string    `json:"stationId,omitempty"`
	Severity    string    `json:"severity"`
	UpdatedAt   time.Time `json:"updatedAt"`
}

type EquipmentStatus struct {
	StationID   string    `json:"stationId"`
	StationName string    `json:"stationName"`
	Type        string    `json:"type"`
	Name        string    `json:"name"`
	Status      string    `json:"status"`
	UpdatedAt   time.Time `json:"updatedAt"`
}

type TripOption struct {
	ID                string    `json:"id"`
	Summary           string    `json:"summary"`
	DepartAt          time.Time `json:"departAt"`
	ArriveAt          time.Time `json:"arriveAt"`
	DurationMinutes   int       `json:"durationMinutes"`
	Transfers         int       `json:"transfers"`
	TransferRisk      string    `json:"transferRisk"`
	AccessibilitySafe bool      `json:"accessibilitySafe"`
	CrowdingForecast  string    `json:"crowdingForecast"`
}

type LeaveNowResponse struct {
	FromStopID      string    `json:"fromStopId"`
	ToStopID        string    `json:"toStopId"`
	ArrivalBy       time.Time `json:"arrivalBy"`
	LeaveAt         time.Time `json:"leaveAt"`
	BufferMinutes   int       `json:"bufferMinutes"`
	ReliabilityNote string    `json:"reliabilityNote"`
}

type Dashboard struct {
	UserID           string            `json:"userId"`
	FavoriteStops    []string          `json:"favoriteStops"`
	FavoriteRoutes   []string          `json:"favoriteRoutes"`
	NextArrivals     []Arrival         `json:"nextArrivals"`
	RelevantAlerts   []Alert           `json:"relevantAlerts"`
	EquipmentSummary []EquipmentStatus `json:"equipmentSummary"`
}
