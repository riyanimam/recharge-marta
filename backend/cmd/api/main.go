package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"time"

	"github.com/bengo/recharge-marta/backend/internal/config"
	apihttp "github.com/bengo/recharge-marta/backend/internal/http"
	"github.com/bengo/recharge-marta/backend/internal/ingest"
	"github.com/bengo/recharge-marta/backend/internal/store"
)

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	s := store.NewStore()
	ingestConfig := config.LoadIngestConfig()
	var ingestStatus *ingest.StatusTracker
	if ingestConfig.Enabled() {
		log.Printf("live ingest enabled (interval=%s)", ingestConfig.PollInterval)
		ingestStatus = ingest.StartLivePolling(context.Background(), ingestConfig, s, log.Default())
	} else {
		log.Printf("live ingest disabled; running seeded simulator")
		s.StartBackgroundUpdates(15 * time.Second)
	}

	handler := apihttp.NewRouter(s, ingestStatus)
	server := &http.Server{
		Addr:              ":" + port,
		Handler:           handler,
		ReadHeaderTimeout: 5 * time.Second,
	}

	log.Printf("recharge-marta API listening on http://localhost:%s", port)
	if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		log.Fatal(err)
	}
}
