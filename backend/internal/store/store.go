package store

import (
	"math/rand"
	"sync"
	"time"

	"github.com/bengo/recharge-marta/backend/internal/models"
)

type Store struct {
	mu        sync.RWMutex
	arrivals  []models.Arrival
	alerts    []models.Alert
	equipment []models.EquipmentStatus
}

func NewStore() *Store {
	now := time.Now()
	return &Store{
		arrivals: []models.Arrival{
			{RouteID: "RED", RouteName: "Red Line", StopID: "MID", StopName: "Midtown", Destination: "North Springs", PredictedAt: now.Add(3 * time.Minute), MinutesAway: 3, AccessibilitySafe: true},
			{RouteID: "GOLD", RouteName: "Gold Line", StopID: "MID", StopName: "Midtown", Destination: "Doraville", PredictedAt: now.Add(6 * time.Minute), MinutesAway: 6, AccessibilitySafe: true},
			{RouteID: "109", RouteName: "Monroe Drive", StopID: "ARTS", StopName: "Arts Center", Destination: "Lindbergh", PredictedAt: now.Add(5 * time.Minute), MinutesAway: 5, AccessibilitySafe: true},
		},
		alerts: []models.Alert{
			{ID: "a1", Title: "Weekend Single-Tracking", Description: "Red/Gold lines have reduced frequency this weekend.", RouteID: "RED", Severity: "medium", UpdatedAt: now.Add(-15 * time.Minute)},
			{ID: "a2", Title: "Faregate Construction", Description: "Multiple station faregates temporarily closed.", Severity: "low", UpdatedAt: now.Add(-35 * time.Minute)},
		},
		equipment: []models.EquipmentStatus{
			{StationID: "MID", StationName: "Midtown", Type: "elevator", Name: "Elevator A", Status: "operational", UpdatedAt: now.Add(-5 * time.Minute)},
			{StationID: "FIV", StationName: "Five Points", Type: "escalator", Name: "Escalator C", Status: "out_of_service", UpdatedAt: now.Add(-2 * time.Minute)},
		},
	}
}

func (s *Store) StartBackgroundUpdates(interval time.Duration) {
	ticker := time.NewTicker(interval)
	go func() {
		for range ticker.C {
			s.mu.Lock()
			now := time.Now()
			for i := range s.arrivals {
				delta := rand.Intn(3) - 1
				next := s.arrivals[i].MinutesAway + delta
				if next < 1 {
					next = rand.Intn(6) + 2
				}
				s.arrivals[i].MinutesAway = next
				s.arrivals[i].PredictedAt = now.Add(time.Duration(next) * time.Minute)
			}
			s.mu.Unlock()
		}
	}()
}

func (s *Store) Arrivals(stopID string) []models.Arrival {
	s.mu.RLock()
	defer s.mu.RUnlock()
	if stopID == "" {
		return cloneArrivals(s.arrivals)
	}
	filtered := make([]models.Arrival, 0)
	for _, a := range s.arrivals {
		if a.StopID == stopID {
			filtered = append(filtered, a)
		}
	}
	return filtered
}

func (s *Store) Alerts(routeID, severity string) []models.Alert {
	s.mu.RLock()
	defer s.mu.RUnlock()
	filtered := make([]models.Alert, 0)
	for _, a := range s.alerts {
		if routeID != "" && a.RouteID != routeID {
			continue
		}
		if severity != "" && a.Severity != severity {
			continue
		}
		filtered = append(filtered, a)
	}
	return filtered
}

func (s *Store) Equipment(stationID string) []models.EquipmentStatus {
	s.mu.RLock()
	defer s.mu.RUnlock()
	if stationID == "" {
		return cloneEquipment(s.equipment)
	}
	filtered := make([]models.EquipmentStatus, 0)
	for _, e := range s.equipment {
		if e.StationID == stationID {
			filtered = append(filtered, e)
		}
	}
	return filtered
}

func (s *Store) Dashboard(userID string) models.Dashboard {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return models.Dashboard{
		UserID:           userID,
		FavoriteStops:    []string{"MID", "ARTS"},
		FavoriteRoutes:   []string{"RED", "109"},
		NextArrivals:     cloneArrivals(s.arrivals),
		RelevantAlerts:   append([]models.Alert(nil), s.alerts...),
		EquipmentSummary: cloneEquipment(s.equipment),
	}
}

func (s *Store) ReplaceArrivals(arrivals []models.Arrival) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.arrivals = append([]models.Arrival(nil), arrivals...)
}

func (s *Store) ReplaceAlerts(alerts []models.Alert) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.alerts = append([]models.Alert(nil), alerts...)
}

func (s *Store) ReplaceEquipment(items []models.EquipmentStatus) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.equipment = append([]models.EquipmentStatus(nil), items...)
}

func cloneArrivals(arrivals []models.Arrival) []models.Arrival {
	return append([]models.Arrival(nil), arrivals...)
}

func cloneEquipment(items []models.EquipmentStatus) []models.EquipmentStatus {
	return append([]models.EquipmentStatus(nil), items...)
}
