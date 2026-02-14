package ingest

import (
	"sync"
	"time"

	"github.com/bengo/recharge-marta/backend/internal/config"
)

type FeedStatus struct {
	Name        string    `json:"name"`
	URL         string    `json:"url,omitempty"`
	Enabled     bool      `json:"enabled"`
	Healthy     bool      `json:"healthy"`
	LastAttempt time.Time `json:"lastAttempt,omitempty"`
	LastSuccess time.Time `json:"lastSuccess,omitempty"`
	LastError   string    `json:"lastError,omitempty"`
	Records     int       `json:"records"`
}

type IngestStatus struct {
	LiveEnabled bool         `json:"liveEnabled"`
	PollSeconds int          `json:"pollSeconds"`
	Feeds       []FeedStatus `json:"feeds"`
}

type StatusTracker struct {
	mu          sync.RWMutex
	liveEnabled bool
	pollSeconds int
	feeds       map[string]FeedStatus
}

func NewStatusTracker(cfg config.IngestConfig) *StatusTracker {
	feeds := map[string]FeedStatus{
		"rail_arrivals": {
			Name:    "rail_arrivals",
			URL:     cfg.RailArrivalsURL,
			Enabled: cfg.RailArrivalsURL != "",
		},
		"gtfsrt_alerts": {
			Name:    "gtfsrt_alerts",
			URL:     cfg.GTFSRTAlertsURL,
			Enabled: cfg.GTFSRTAlertsURL != "",
		},
		"gtfsrt_trip_updates": {
			Name:    "gtfsrt_trip_updates",
			URL:     cfg.GTFSRTTripUpdateURL,
			Enabled: cfg.GTFSRTTripUpdateURL != "",
		},
		"gtfsrt_vehicle_positions": {
			Name:    "gtfsrt_vehicle_positions",
			URL:     cfg.GTFSRTVehicleURL,
			Enabled: cfg.GTFSRTVehicleURL != "",
		},
		"equipment": {
			Name:    "equipment",
			URL:     cfg.EquipmentStatusURL,
			Enabled: cfg.EquipmentStatusURL != "",
		},
	}

	return &StatusTracker{
		liveEnabled: cfg.Enabled(),
		pollSeconds: int(cfg.PollInterval.Seconds()),
		feeds:       feeds,
	}
}

func (s *StatusTracker) MarkAttempt(name string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	feed, ok := s.feeds[name]
	if !ok {
		return
	}
	feed.LastAttempt = time.Now()
	s.feeds[name] = feed
}

func (s *StatusTracker) MarkSuccess(name string, records int) {
	s.mu.Lock()
	defer s.mu.Unlock()
	feed, ok := s.feeds[name]
	if !ok {
		return
	}
	now := time.Now()
	feed.Healthy = true
	feed.LastAttempt = now
	feed.LastSuccess = now
	feed.LastError = ""
	feed.Records = records
	s.feeds[name] = feed
}

func (s *StatusTracker) MarkFailure(name string, err error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	feed, ok := s.feeds[name]
	if !ok {
		return
	}
	feed.Healthy = false
	feed.LastAttempt = time.Now()
	if err != nil {
		feed.LastError = err.Error()
	}
	s.feeds[name] = feed
}

func (s *StatusTracker) Snapshot() IngestStatus {
	s.mu.RLock()
	defer s.mu.RUnlock()

	feeds := make([]FeedStatus, 0, len(s.feeds))
	for _, feed := range s.feeds {
		feeds = append(feeds, feed)
	}

	return IngestStatus{
		LiveEnabled: s.liveEnabled,
		PollSeconds: s.pollSeconds,
		Feeds:       feeds,
	}
}
