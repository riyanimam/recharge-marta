package config

import (
	"os"
	"strconv"
	"time"
)

type IngestConfig struct {
	PollInterval        time.Duration
	RailArrivalsURL     string
	GTFSRTAlertsURL     string
	GTFSRTVehicleURL    string
	GTFSRTTripUpdateURL string
	EquipmentStatusURL  string
	APIKey              string
}

func LoadIngestConfig() IngestConfig {
	return IngestConfig{
		PollInterval:        readDuration("MARTA_POLL_INTERVAL", 30*time.Second),
		RailArrivalsURL:     os.Getenv("MARTA_RAIL_ARRIVALS_URL"),
		GTFSRTAlertsURL:     os.Getenv("MARTA_GTFSRT_ALERTS_URL"),
		GTFSRTVehicleURL:    os.Getenv("MARTA_GTFSRT_VEHICLE_URL"),
		GTFSRTTripUpdateURL: os.Getenv("MARTA_GTFSRT_TRIPUPDATE_URL"),
		EquipmentStatusURL:  os.Getenv("MARTA_EQUIPMENT_STATUS_URL"),
		APIKey:              os.Getenv("MARTA_API_KEY"),
	}
}

func (c IngestConfig) Enabled() bool {
	return c.RailArrivalsURL != "" || c.GTFSRTAlertsURL != "" || c.GTFSRTVehicleURL != "" || c.GTFSRTTripUpdateURL != "" || c.EquipmentStatusURL != ""
}

func readDuration(key string, fallback time.Duration) time.Duration {
	value := os.Getenv(key)
	if value == "" {
		return fallback
	}
	if secs, err := strconv.Atoi(value); err == nil && secs > 0 {
		return time.Duration(secs) * time.Second
	}
	if d, err := time.ParseDuration(value); err == nil {
		return d
	}
	return fallback
}
