package ingest

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"math"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/MobilityData/gtfs-realtime-bindings/golang/gtfs"
	"github.com/bengo/recharge-marta/backend/internal/config"
	"github.com/bengo/recharge-marta/backend/internal/models"
	"google.golang.org/protobuf/proto"
)

type MARTAClient struct {
	httpClient *http.Client
	cfg        config.IngestConfig
	logger     *log.Logger
}

func NewMARTAClient(cfg config.IngestConfig, logger *log.Logger) *MARTAClient {
	return &MARTAClient{
		httpClient: &http.Client{Timeout: 10 * time.Second},
		cfg:        cfg,
		logger:     logger,
	}
}

func (c *MARTAClient) FetchArrivals() ([]models.Arrival, error) {
	if c.cfg.RailArrivalsURL == "" {
		return nil, nil
	}

	body, err := c.fetchBody(c.cfg.RailArrivalsURL)
	if err != nil {
		return nil, err
	}

	var rows []map[string]any
	if err := json.Unmarshal(body, &rows); err != nil {
		return nil, fmt.Errorf("decode rail arrivals: %w", err)
	}

	now := time.Now()
	arrivals := make([]models.Arrival, 0, len(rows))
	for _, row := range rows {
		routeID := strings.ToUpper(readAnyString(row, "LINE", "line", "route_id"))
		routeName := routeID + " Line"
		if routeID == "" {
			routeID = strings.ToUpper(readAnyString(row, "ROUTE", "route"))
			routeName = routeID
		}
		stationName := readAnyString(row, "STATION", "station", "stop_name")
		if stationName == "" {
			continue
		}

		minutesAway := parseMinutes(row)
		predictedAt := now.Add(time.Duration(minutesAway) * time.Minute)
		if eventTime := readAnyString(row, "EVENT_TIME", "event_time", "predicted_at"); eventTime != "" {
			if parsed, ok := parseTimestamp(eventTime); ok {
				predictedAt = parsed
				delta := int(math.Round(parsed.Sub(now).Minutes()))
				if delta > 0 {
					minutesAway = delta
				}
			}
		}

		arrivals = append(arrivals, models.Arrival{
			RouteID:           routeID,
			RouteName:         routeName,
			StopID:            stopIDFromName(stationName),
			StopName:          stationName,
			Destination:       readAnyString(row, "DESTINATION", "destination", "trip_headsign"),
			PredictedAt:       predictedAt,
			MinutesAway:       max(1, minutesAway),
			AccessibilitySafe: true,
		})
	}

	return arrivals, nil
}

func (c *MARTAClient) FetchAlerts() ([]models.Alert, error) {
	if c.cfg.GTFSRTAlertsURL == "" {
		return nil, nil
	}
	feed, err := c.fetchGTFSRealtime(c.cfg.GTFSRTAlertsURL)
	if err != nil {
		return nil, err
	}

	alerts := make([]models.Alert, 0, len(feed.Entity))
	for _, entity := range feed.Entity {
		if entity.GetAlert() == nil {
			continue
		}
		alert := entity.GetAlert()

		routeID := ""
		stationID := ""
		if len(alert.InformedEntity) > 0 {
			routeID = alert.InformedEntity[0].GetRouteId()
			stationID = alert.InformedEntity[0].GetStopId()
		}

		alerts = append(alerts, models.Alert{
			ID:          entity.GetId(),
			Title:       firstTranslation(alert.GetHeaderText()),
			Description: firstTranslation(alert.GetDescriptionText()),
			RouteID:     routeID,
			StationID:   stationID,
			Severity:    severityFromEffect(alert.GetEffect()),
			UpdatedAt:   time.Now(),
		})
	}

	return alerts, nil
}

func (c *MARTAClient) FetchTripUpdates() ([]models.Arrival, []models.Alert, error) {
	if c.cfg.GTFSRTTripUpdateURL == "" {
		return nil, nil, nil
	}

	feed, err := c.fetchGTFSRealtime(c.cfg.GTFSRTTripUpdateURL)
	if err != nil {
		return nil, nil, err
	}

	now := time.Now()
	arrivals := make([]models.Arrival, 0)
	alerts := make([]models.Alert, 0)
	seenAlerts := make(map[string]struct{})

	for _, entity := range feed.Entity {
		tripUpdate := entity.GetTripUpdate()
		if tripUpdate == nil {
			continue
		}

		routeID := strings.ToUpper(tripUpdate.GetTrip().GetRouteId())
		routeName := routeID
		if routeName != "" {
			routeName += " Line"
		}
		destination := tripUpdate.GetTrip().GetTripId()

		for _, stopUpdate := range tripUpdate.StopTimeUpdate {
			arrivalTime := stopUpdate.GetArrival().GetTime()
			if arrivalTime == 0 {
				arrivalTime = stopUpdate.GetDeparture().GetTime()
			}
			if arrivalTime == 0 {
				continue
			}

			predictedAt := time.Unix(arrivalTime, 0)
			minutesAway := int(math.Ceil(predictedAt.Sub(now).Minutes()))
			if minutesAway < 1 {
				continue
			}

			stopID := strings.ToUpper(stopUpdate.GetStopId())
			arrivals = append(arrivals, models.Arrival{
				RouteID:           routeID,
				RouteName:         routeName,
				StopID:            stopID,
				StopName:          stopID,
				Destination:       destination,
				PredictedAt:       predictedAt,
				MinutesAway:       minutesAway,
				AccessibilitySafe: true,
			})

			delay := stopUpdate.GetArrival().GetDelay()
			if delay == 0 {
				delay = stopUpdate.GetDeparture().GetDelay()
			}
			if delay >= 300 {
				alertID := fmt.Sprintf("trip-delay-%s-%s", routeID, stopID)
				if _, exists := seenAlerts[alertID]; exists {
					continue
				}
				seenAlerts[alertID] = struct{}{}
				alerts = append(alerts, models.Alert{
					ID:          alertID,
					Title:       "Significant Trip Delay",
					Description: fmt.Sprintf("Route %s has delays of %d minutes near stop %s.", routeID, delay/60, stopID),
					RouteID:     routeID,
					StationID:   stopID,
					Severity:    "medium",
					UpdatedAt:   now,
				})
			}
		}
	}

	return arrivals, alerts, nil
}

func (c *MARTAClient) FetchVehicleCount() (int, error) {
	if c.cfg.GTFSRTVehicleURL == "" {
		return 0, nil
	}

	feed, err := c.fetchGTFSRealtime(c.cfg.GTFSRTVehicleURL)
	if err != nil {
		return 0, err
	}

	count := 0
	for _, entity := range feed.Entity {
		if entity.GetVehicle() != nil {
			count++
		}
	}
	return count, nil
}

func (c *MARTAClient) FetchEquipment() ([]models.EquipmentStatus, error) {
	if c.cfg.EquipmentStatusURL == "" {
		return nil, nil
	}

	body, err := c.fetchBody(c.cfg.EquipmentStatusURL)
	if err != nil {
		return nil, err
	}

	var rows []map[string]any
	if err := json.Unmarshal(body, &rows); err != nil {
		return nil, fmt.Errorf("decode equipment status: %w", err)
	}

	items := make([]models.EquipmentStatus, 0, len(rows))
	now := time.Now()
	for _, row := range rows {
		stationID := strings.ToUpper(readAnyString(row, "stationId", "station_id", "STATION_ID"))
		stationName := readAnyString(row, "stationName", "station_name", "STATION")
		name := readAnyString(row, "name", "asset_name", "ASSET")
		typ := strings.ToLower(readAnyString(row, "type", "equipment_type", "TYPE"))
		status := normalizeStatus(readAnyString(row, "status", "STATUS", "state"))
		if stationName == "" || name == "" {
			continue
		}
		if typ == "" {
			typ = "elevator"
		}
		if stationID == "" {
			stationID = stopIDFromName(stationName)
		}
		items = append(items, models.EquipmentStatus{
			StationID:   stationID,
			StationName: stationName,
			Type:        typ,
			Name:        name,
			Status:      status,
			UpdatedAt:   now,
		})
	}

	return items, nil
}

func (c *MARTAClient) fetchBody(rawURL string) ([]byte, error) {
	endpoint, err := url.Parse(rawURL)
	if err != nil {
		return nil, fmt.Errorf("invalid url %q: %w", rawURL, err)
	}
	if c.cfg.APIKey != "" {
		q := endpoint.Query()
		if q.Get("apikey") == "" {
			q.Set("apikey", c.cfg.APIKey)
			endpoint.RawQuery = q.Encode()
		}
	}

	req, err := http.NewRequest(http.MethodGet, endpoint.String(), nil)
	if err != nil {
		return nil, err
	}
	res, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer res.Body.Close()

	if res.StatusCode >= 400 {
		return nil, fmt.Errorf("upstream status %d", res.StatusCode)
	}
	body, err := io.ReadAll(res.Body)
	if err != nil {
		return nil, err
	}
	if len(body) == 0 {
		return nil, errors.New("empty upstream response")
	}
	return body, nil
}

func (c *MARTAClient) fetchGTFSRealtime(rawURL string) (*gtfs.FeedMessage, error) {
	body, err := c.fetchBody(rawURL)
	if err != nil {
		return nil, err
	}
	feed := &gtfs.FeedMessage{}
	if err := proto.Unmarshal(body, feed); err != nil {
		return nil, fmt.Errorf("decode gtfs-rt feed: %w", err)
	}
	return feed, nil
}

func severityFromEffect(effect gtfs.Alert_Effect) string {
	switch effect {
	case gtfs.Alert_NO_SERVICE, gtfs.Alert_STOP_MOVED:
		return "high"
	case gtfs.Alert_SIGNIFICANT_DELAYS, gtfs.Alert_DETOUR:
		return "medium"
	default:
		return "low"
	}
}

func firstTranslation(text *gtfs.TranslatedString) string {
	if text == nil || len(text.Translation) == 0 {
		return "Service alert"
	}
	content := strings.TrimSpace(text.Translation[0].GetText())
	if content == "" {
		return "Service alert"
	}
	return content
}

func parseMinutes(row map[string]any) int {
	if raw := readAnyString(row, "WAITING_SECONDS", "waiting_seconds"); raw != "" {
		if secs, err := strconv.Atoi(raw); err == nil && secs >= 0 {
			return max(1, secs/60)
		}
	}
	if raw := readAnyString(row, "WAITING_TIME", "waiting_time", "minutes"); raw != "" {
		rawUpper := strings.ToUpper(raw)
		if rawUpper == "BRD" || rawUpper == "ARR" {
			return 1
		}
		raw = strings.TrimSuffix(raw, " min")
		if mins, err := strconv.Atoi(strings.TrimSpace(raw)); err == nil && mins >= 0 {
			return max(1, mins)
		}
	}
	return 5
}

func parseTimestamp(input string) (time.Time, bool) {
	layouts := []string{time.RFC3339, "1/2/2006 3:04:05 PM", "2006-01-02 15:04:05"}
	for _, layout := range layouts {
		if t, err := time.Parse(layout, input); err == nil {
			return t, true
		}
	}
	return time.Time{}, false
}

func readAnyString(row map[string]any, keys ...string) string {
	for _, key := range keys {
		if value, ok := row[key]; ok {
			switch cast := value.(type) {
			case string:
				return strings.TrimSpace(cast)
			case float64:
				return strconv.Itoa(int(cast))
			case int:
				return strconv.Itoa(cast)
			}
		}
	}
	return ""
}

func normalizeStatus(value string) string {
	normalized := strings.ToLower(strings.TrimSpace(value))
	switch normalized {
	case "operational", "up", "available", "in_service":
		return "operational"
	default:
		return "out_of_service"
	}
}

func stopIDFromName(name string) string {
	name = strings.ToUpper(strings.TrimSpace(name))
	if len(name) >= 3 {
		return name[:3]
	}
	return name
}
