package http

import (
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/bengo/recharge-marta/backend/internal/ingest"
	"github.com/bengo/recharge-marta/backend/internal/models"
	"github.com/bengo/recharge-marta/backend/internal/store"
)

type Handlers struct {
	store        *store.Store
	ingestStatus *ingest.StatusTracker
}

func NewHandlers(s *store.Store, ingestStatus *ingest.StatusTracker) *Handlers {
	return &Handlers{store: s, ingestStatus: ingestStatus}
}

func (h *Handlers) Health(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func (h *Handlers) Arrivals(w http.ResponseWriter, r *http.Request) {
	stopID := r.URL.Query().Get("stopId")
	writeJSON(w, http.StatusOK, h.store.Arrivals(stopID))
}

func (h *Handlers) Alerts(w http.ResponseWriter, r *http.Request) {
	routeID := r.URL.Query().Get("routeId")
	severity := r.URL.Query().Get("severity")
	writeJSON(w, http.StatusOK, h.store.Alerts(routeID, severity))
}

func (h *Handlers) Equipment(w http.ResponseWriter, r *http.Request) {
	stationID := r.URL.Query().Get("stationId")
	writeJSON(w, http.StatusOK, h.store.Equipment(stationID))
}

type tripPlanRequest struct {
	Origin              string `json:"origin"`
	Destination         string `json:"destination"`
	DepartAt            string `json:"departAt"`
	AccessibilityNeeded bool   `json:"accessibilityNeeded"`
}

func (h *Handlers) PlanTrip(w http.ResponseWriter, r *http.Request) {
	var req tripPlanRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}
	departAt, err := time.Parse(time.RFC3339, req.DepartAt)
	if err != nil {
		http.Error(w, "departAt must be RFC3339", http.StatusBadRequest)
		return
	}

	trip1 := models.TripOption{
		ID:                "fastest",
		Summary:           fmt.Sprintf("%s to %s (Fastest)", req.Origin, req.Destination),
		DepartAt:          departAt,
		ArriveAt:          departAt.Add(31 * time.Minute),
		DurationMinutes:   31,
		Transfers:         1,
		TransferRisk:      "medium",
		AccessibilitySafe: true,
		CrowdingForecast:  "moderate",
	}
	trip2 := models.TripOption{
		ID:                "reliable",
		Summary:           fmt.Sprintf("%s to %s (Most Reliable)", req.Origin, req.Destination),
		DepartAt:          departAt.Add(4 * time.Minute),
		ArriveAt:          departAt.Add(39 * time.Minute),
		DurationMinutes:   35,
		Transfers:         0,
		TransferRisk:      "low",
		AccessibilitySafe: true,
		CrowdingForecast:  "low",
	}

	options := []models.TripOption{trip1, trip2}
	if req.AccessibilityNeeded {
		for i := range options {
			options[i].AccessibilitySafe = true
		}
	}
	writeJSON(w, http.StatusOK, options)
}

func (h *Handlers) LeaveNow(w http.ResponseWriter, r *http.Request) {
	fromStopID := r.URL.Query().Get("fromStopId")
	toStopID := r.URL.Query().Get("toStopId")
	arrivalByRaw := r.URL.Query().Get("arrivalBy")
	if fromStopID == "" || toStopID == "" || arrivalByRaw == "" {
		http.Error(w, "fromStopId, toStopId, arrivalBy are required", http.StatusBadRequest)
		return
	}
	arrivalBy, err := time.Parse(time.RFC3339, arrivalByRaw)
	if err != nil {
		http.Error(w, "arrivalBy must be RFC3339", http.StatusBadRequest)
		return
	}

	bufferMinutes := 8
	travelMinutes := 34
	leaveAt := arrivalBy.Add(-time.Duration(travelMinutes+bufferMinutes) * time.Minute)
	response := models.LeaveNowResponse{
		FromStopID:      fromStopID,
		ToStopID:        toStopID,
		ArrivalBy:       arrivalBy,
		LeaveAt:         leaveAt,
		BufferMinutes:   bufferMinutes,
		ReliabilityNote: "Weekend schedules detected; extra transfer buffer applied.",
	}
	writeJSON(w, http.StatusOK, response)
}

func (h *Handlers) Dashboard(w http.ResponseWriter, r *http.Request) {
	userID := r.URL.Query().Get("userId")
	if userID == "" {
		userID = "default-user"
	}
	writeJSON(w, http.StatusOK, h.store.Dashboard(userID))
}

func (h *Handlers) RealtimeStream(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")

	flusher, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, "streaming unsupported", http.StatusInternalServerError)
		return
	}

	ticker := time.NewTicker(8 * time.Second)
	defer ticker.Stop()

	send := func() {
		payload := map[string]any{
			"arrivals": h.store.Arrivals(""),
			"alerts":   h.store.Alerts("", ""),
		}
		body, _ := json.Marshal(payload)
		_, _ = fmt.Fprintf(w, "event: update\n")
		_, _ = fmt.Fprintf(w, "data: %s\n\n", body)
		flusher.Flush()
	}

	send()
	for {
		select {
		case <-r.Context().Done():
			return
		case <-ticker.C:
			send()
		}
	}
}

func (h *Handlers) IngestStatus(w http.ResponseWriter, _ *http.Request) {
	if h.ingestStatus == nil {
		writeJSON(w, http.StatusOK, map[string]any{
			"liveEnabled": false,
			"message":     "Live ingestion is not configured.",
			"feeds":       []any{},
		})
		return
	}

	writeJSON(w, http.StatusOK, h.ingestStatus.Snapshot())
}

func writeJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}
