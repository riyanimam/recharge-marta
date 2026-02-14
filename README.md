# Recharge MARTA

Responsive and accessible Nuxt 3 / Vue 3 commuter web app + Go backend for realtime transit workflows:

- Smart arrivals
- Personalized alerts
- Accessibility equipment status
- Connection-safe trip planning
- Leave-now calculator
- Realtime updates via Server-Sent Events (SSE)

## Project Structure

```
recharge-marta/
	backend/   # Go API server
	frontend/  # Nuxt 3 / Vue 3 web app
```

## Requirements

- Go 1.23+
- Node.js 20+
- pnpm 10+

## Run Backend

```bash
cd backend
go run ./cmd/api
```

Backend runs on `http://localhost:8080` by default.

### Enable Live MARTA Feeds

1. Copy `backend/.env.example` to your shell environment (or set vars directly).
2. Set at least one live source URL:
	- `MARTA_RAIL_ARRIVALS_URL` (JSON)
	- `MARTA_GTFSRT_TRIPUPDATE_URL` (GTFS-RT protobuf)
	- `MARTA_GTFSRT_VEHICLE_URL` (GTFS-RT protobuf)
	- `MARTA_GTFSRT_ALERTS_URL` (GTFS-RT protobuf, optional)
	- `MARTA_EQUIPMENT_STATUS_URL` (JSON)
3. Optional: set `MARTA_API_KEY` (auto-appended as `apikey` if missing).
4. Start backend with those environment variables.

Known MARTA endpoints:

- Rail realtime arrivals (JSON): `https://developerservices.itsmarta.com:18096/itsmarta/railrealtimearrivals/developerservices/traindata`
- Vehicle positions (protobuf): `https://gtfs-rt.itsmarta.com/TMGTFSRealTimeWebService/vehicle`
- Trip updates (protobuf): `https://gtfs-rt.itsmarta.com/TMGTFSRealTimeWebService/tripupdate`

If clicking GTFS-RT links downloads a `.pb` file, that is expected: GTFS-RT uses Protocol Buffers binary format.

When no live source is configured, backend uses seeded demo data.

## Run Frontend (Nuxt 3)

```bash
cd frontend
pnpm install
pnpm dev
```

Nuxt frontend runs on `http://localhost:3000` by default and calls the backend at `http://localhost:8080`.

## Run Tests

```bash
cd frontend
pnpm test
```

## Useful API Endpoints

- `GET /health`
- `GET /api/v1/arrivals?stopId=MID`
- `GET /api/v1/alerts?routeId=RED`
- `GET /api/v1/equipment?stationId=MID`
- `POST /api/v1/trips/plan`
- `GET /api/v1/trips/leave-now?fromStopId=MID&toStopId=AIRPORT&arrivalBy=2026-02-13T23:30:00Z`
- `GET /api/v1/dashboard?userId=commuter-1`
- `GET /api/v1/realtime/stream`
- `GET /api/v1/ingest/status`

## Accessibility + UX Notes

- Semantic sections and headings
- Keyboard focus support and skip link
- High-contrast mode with stronger borders and bolder text
- Reduced motion mode (disables all transitions and animations)
- Adjustable text size (default / large / extra-large)
- Light, dark, and system color schemes
- Multi-language support (English, Spanish, Korean, Chinese, French)
- Mobile-first responsive grid
- Clear error states and status summaries
- User preferences persisted in localStorage

## Next Recommended Enhancements

- Persist user favorites and saved commutes
- Expand GTFS / GTFS-RT ingestion to vehicle positions and trip updates
- Add push notifications for leave-now and transfer risk
- Integrate map visualization (MapLibre)
- Add auth, rate limiting, and observability
