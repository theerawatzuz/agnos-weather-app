# Weather Ingest API

Simple weather data ingestion service for testing observability stack (Prometheus, Loki, Tempo, Grafana).

## Endpoints

### Health Checks

- `GET /health` - Liveness probe (always returns alive)
- `GET /ready` - Readiness probe (checks database connection)

### Weather Data

- `GET /get-weather` - Fetch current weather data (passthrough)
- `POST /ingest` - Fetch weather data and save to database

### Observability

- `GET /metrics` - Prometheus metrics endpoint

## Features

- Structured JSON logging (compatible with Loki)
- Prometheus metrics (request counts, durations)
- OpenTelemetry tracing (sends to Tempo)
- Auto-increment Docker image versioning
- GitOps deployment via ArgoCD

## Environment Variables

```bash
# Weather API
WEATHER_API_URL=https://api.weatherapi.com/v1/current.json
WEATHER_API_KEY=your_api_key
WEATHER_LOCATION=osaka
WEATHER_Q=34.6937,135.5023

# Database
PGHOST=localhost
PGPORT=5432
PGDATABASE=weather
PGUSER=postgres
PGPASSWORD=postgres

# Observability
LOG_LEVEL=info
TEMPO_URL=http://tempo:3100/v1/traces
```

## Development

```bash
npm install
npm run build
npm start
```

## Docker

```bash
docker build -t weather-ingest .
docker run -p 3000:3000 --env-file .env weather-ingest
```
