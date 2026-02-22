# Weather Ingest Service

ดึงข้อมูลสภาพอากาศจาก WeatherAPI และเก็บลง PostgreSQL

## Setup

1. ติดตั้ง dependencies:

```bash
npm install
```

2. ตั้งค่า `.env`:

```env
WEATHER_API_URL=https://api.weatherapi.com/v1/current.json
WEATHER_API_KEY=your_api_key
WEATHER_LOCATION=osaka
WEATHER_Q=34.6937,135.5023

PGHOST=localhost
PGPORT=5432
PGDATABASE=weather
PGUSER=postgres
PGPASSWORD=postgres
```

3. Start database:

```bash
cd ../db
docker-compose up -d
```

4. Run migration:

```bash
npm run migrate
```

5. Run ingest:

```bash
npm run dev
```

## Docker

Build และ push image:

```bash
./build-and-push.sh <your-dockerhub-username>
```

Run container:

```bash
docker run --rm \
  -e WEATHER_API_URL=https://api.weatherapi.com/v1/current.json \
  -e WEATHER_API_KEY=your_key \
  -e WEATHER_LOCATION=osaka \
  -e WEATHER_Q=34.6937,135.5023 \
  -e PGHOST=host.docker.internal \
  -e PGPORT=5432 \
  -e PGDATABASE=weather \
  -e PGUSER=postgres \
  -e PGPASSWORD=postgres \
  <your-username>/weather-ingest:latest
```
