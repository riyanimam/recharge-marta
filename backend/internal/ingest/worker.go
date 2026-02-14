package ingest

import (
	"context"
	"log"
	"time"

	"github.com/bengo/recharge-marta/backend/internal/config"
	"github.com/bengo/recharge-marta/backend/internal/models"
	"github.com/bengo/recharge-marta/backend/internal/store"
)

func StartLivePolling(ctx context.Context, cfg config.IngestConfig, s *store.Store, logger *log.Logger) *StatusTracker {
	client := NewMARTAClient(cfg, logger)
	status := NewStatusTracker(cfg)
	runOnce(client, s, logger, status)

	ticker := time.NewTicker(cfg.PollInterval)
	go func() {
		defer ticker.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				runOnce(client, s, logger, status)
			}
		}
	}()

	return status
}

func runOnce(client *MARTAClient, s *store.Store, logger *log.Logger, status *StatusTracker) {
	hasArrivals := false
	collectedAlerts := make([]models.Alert, 0)

	status.MarkAttempt("rail_arrivals")
	if arrivals, err := client.FetchArrivals(); err != nil {
		logger.Printf("live ingest arrivals failed: %v", err)
		status.MarkFailure("rail_arrivals", err)
	} else if len(arrivals) > 0 {
		s.ReplaceArrivals(arrivals)
		hasArrivals = true
		status.MarkSuccess("rail_arrivals", len(arrivals))
	} else {
		status.MarkSuccess("rail_arrivals", 0)
	}

	status.MarkAttempt("gtfsrt_alerts")
	if alerts, err := client.FetchAlerts(); err != nil {
		logger.Printf("live ingest alerts failed: %v", err)
		status.MarkFailure("gtfsrt_alerts", err)
	} else if len(alerts) > 0 {
		collectedAlerts = append(collectedAlerts, alerts...)
		status.MarkSuccess("gtfsrt_alerts", len(alerts))
	} else {
		status.MarkSuccess("gtfsrt_alerts", 0)
	}

	status.MarkAttempt("gtfsrt_trip_updates")
	if tripArrivals, tripAlerts, err := client.FetchTripUpdates(); err != nil {
		logger.Printf("live ingest trip updates failed: %v", err)
		status.MarkFailure("gtfsrt_trip_updates", err)
	} else {
		if !hasArrivals && len(tripArrivals) > 0 {
			s.ReplaceArrivals(tripArrivals)
		}
		if len(tripAlerts) > 0 {
			collectedAlerts = append(collectedAlerts, tripAlerts...)
		}
		status.MarkSuccess("gtfsrt_trip_updates", len(tripArrivals))
	}

	if len(collectedAlerts) > 0 {
		s.ReplaceAlerts(collectedAlerts)
	}

	status.MarkAttempt("gtfsrt_vehicle_positions")
	if vehicleCount, err := client.FetchVehicleCount(); err != nil {
		logger.Printf("live ingest vehicle feed failed: %v", err)
		status.MarkFailure("gtfsrt_vehicle_positions", err)
	} else if vehicleCount > 0 {
		logger.Printf("live ingest vehicle snapshot size: %d", vehicleCount)
		status.MarkSuccess("gtfsrt_vehicle_positions", vehicleCount)
	} else {
		status.MarkSuccess("gtfsrt_vehicle_positions", 0)
	}

	status.MarkAttempt("equipment")
	if equipment, err := client.FetchEquipment(); err != nil {
		logger.Printf("live ingest equipment failed: %v", err)
		status.MarkFailure("equipment", err)
	} else if len(equipment) > 0 {
		s.ReplaceEquipment(equipment)
		status.MarkSuccess("equipment", len(equipment))
	} else {
		status.MarkSuccess("equipment", 0)
	}
}
