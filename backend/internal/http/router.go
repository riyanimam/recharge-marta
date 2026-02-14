package http

import (
	"net/http"

	"github.com/bengo/recharge-marta/backend/internal/ingest"
	"github.com/bengo/recharge-marta/backend/internal/store"
)

func NewRouter(s *store.Store, ingestStatus *ingest.StatusTracker) http.Handler {
	h := NewHandlers(s, ingestStatus)
	mux := http.NewServeMux()

	mux.HandleFunc("/health", h.Health)
	mux.HandleFunc("/api/v1/arrivals", h.Arrivals)
	mux.HandleFunc("/api/v1/alerts", h.Alerts)
	mux.HandleFunc("/api/v1/equipment", h.Equipment)
	mux.HandleFunc("/api/v1/trips/plan", h.PlanTrip)
	mux.HandleFunc("/api/v1/trips/leave-now", h.LeaveNow)
	mux.HandleFunc("/api/v1/dashboard", h.Dashboard)
	mux.HandleFunc("/api/v1/realtime/stream", h.RealtimeStream)
	mux.HandleFunc("/api/v1/ingest/status", h.IngestStatus)

	return withCORS(mux)
}

func withCORS(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
		w.Header().Set("Access-Control-Allow-Methods", "GET,POST,OPTIONS")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}
