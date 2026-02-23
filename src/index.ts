import "./tracing.js";
import "dotenv/config";
import Fastify from "fastify";
import promClient from "prom-client";
import type { WeatherResponse } from "./types/weather.js";
import { pool } from "./db/pool.js";

const fastify = Fastify({ logger: true });

// Setup Prometheus metrics
const register = new promClient.Registry();
promClient.collectDefaultMetrics({ register });

// Custom metrics
const weatherFetchCounter = new promClient.Counter({
  name: "weather_fetch_total",
  help: "Total number of weather fetch attempts",
  labelNames: ["status"],
  registers: [register],
});

const weatherFetchDuration = new promClient.Histogram({
  name: "weather_fetch_duration_seconds",
  help: "Duration of weather fetch operations",
  registers: [register],
});

async function fetchWeather() {
  const end = weatherFetchDuration.startTimer();
  try {
    const apiUrl = process.env.WEATHER_API_URL!;
    const apiKey = process.env.WEATHER_API_KEY!;
    const q = process.env.WEATHER_Q!;

    const url = `${apiUrl}?key=${apiKey}&q=${encodeURIComponent(q)}`;
    const res = await fetch(url);
    if (!res.ok)
      throw new Error(`WeatherAPI ${res.status}: ${await res.text()}`);
    const data = (await res.json()) as WeatherResponse;

    fastify.log.info({
      msg: "Weather data received",
      location: data.location.name,
      region: data.location.region,
      country: data.location.country,
      temp_c: data.current.temp_c,
      feelslike_c: data.current.feelslike_c,
      condition: data.current.condition.text,
      humidity: data.current.humidity,
      wind_kph: data.current.wind_kph,
      last_updated: data.current.last_updated,
    });

    weatherFetchCounter.inc({ status: "success" });
    return data;
  } catch (error) {
    weatherFetchCounter.inc({ status: "error" });
    throw error;
  } finally {
    end();
  }
}

async function saveWeather(data: WeatherResponse) {
  // Use current time for continuous timeline, store API time in raw data
  const observedAt = new Date(); // Use ingestion time for continuous data
  const location = process.env.WEATHER_LOCATION!;

  await pool.query(
    `
    INSERT INTO weather_observations (
      location, observed_at,
      temp_c, feelslike_c, humidity, pressure_mb, precip_mm,
      wind_kph, wind_degree, wind_dir, gust_kph,
      cloud, uv, vis_km, is_day,
      condition_text, condition_code, condition_icon,
      raw
    )
    VALUES (
      $1, $2,
      $3, $4, $5, $6, $7,
      $8, $9, $10, $11,
      $12, $13, $14, $15,
      $16, $17, $18,
      $19
    )
    ON CONFLICT (location, observed_at) DO UPDATE SET
      temp_c=EXCLUDED.temp_c,
      feelslike_c=EXCLUDED.feelslike_c,
      humidity=EXCLUDED.humidity,
      pressure_mb=EXCLUDED.pressure_mb,
      precip_mm=EXCLUDED.precip_mm,
      wind_kph=EXCLUDED.wind_kph,
      wind_degree=EXCLUDED.wind_degree,
      wind_dir=EXCLUDED.wind_dir,
      gust_kph=EXCLUDED.gust_kph,
      cloud=EXCLUDED.cloud,
      uv=EXCLUDED.uv,
      vis_km=EXCLUDED.vis_km,
      is_day=EXCLUDED.is_day,
      condition_text=EXCLUDED.condition_text,
      condition_code=EXCLUDED.condition_code,
      condition_icon=EXCLUDED.condition_icon,
      raw=EXCLUDED.raw
    `,
    [
      location,
      observedAt,
      data.current.temp_c,
      data.current.feelslike_c,
      data.current.humidity,
      data.current.pressure_mb,
      data.current.precip_mm,
      data.current.wind_kph,
      data.current.wind_degree,
      data.current.wind_dir,
      data.current.gust_kph,
      data.current.cloud,
      data.current.uv,
      data.current.vis_km,
      data.current.is_day,
      data.current.condition.text,
      data.current.condition.code,
      data.current.condition.icon,
      JSON.stringify(data),
    ],
  );
}

// Health check endpoints
fastify.get("/health", async (request, reply) => {
  return { status: "alive" };
});

fastify.get("/ready", async (request, reply) => {
  try {
    await pool.query("SELECT 1");
    return { status: "ready", database: "connected" };
  } catch (error) {
    reply.code(503);
    return {
      status: "not ready",
      database: "disconnected",
      error: String(error),
    };
  }
});

// Prometheus metrics endpoint
fastify.get("/metrics", async (request, reply) => {
  reply.type("text/plain");
  return register.metrics();
});

// Get weather data endpoint (passthrough)
fastify.get("/get-weather", async (request, reply) => {
  try {
    fastify.log.info({ msg: "GET /get-weather called" });
    const data = await fetchWeather();
    return data;
  } catch (error) {
    fastify.log.error({ err: error, msg: "Failed to fetch weather data" });
    reply.code(500);
    return { status: "error", message: String(error) };
  }
});

// Ingest weather data endpoint
fastify.post("/ingest", async (request, reply) => {
  try {
    fastify.log.info({ msg: "POST /ingest called" });
    const data = await fetchWeather();
    await saveWeather(data);
    fastify.log.info({ msg: "Weather data saved to database" });
    return {
      status: "success",
      location: data.location.name,
      temp_c: data.current.temp_c,
      condition: data.current.condition.text,
      observed_at: data.current.last_updated,
    };
  } catch (error) {
    fastify.log.error({ err: error, msg: "Failed to ingest weather data" });
    reply.code(500);
    return { status: "error", message: String(error) };
  }
});

// Start server
const start = async () => {
  try {
    const port = Number(process.env.PORT) || 3000;
    const host = process.env.HOST || "0.0.0.0";
    await fastify.listen({ port, host });

    fastify.log.info({ msg: "Server started successfully", port, host });

    // Heartbeat log (every 30 seconds)
    const intervalMs = 30 * 1000;
    setInterval(() => {
      fastify.log.info({
        msg: "still alive",
        timestamp: new Date().toISOString(),
      });
    }, intervalMs);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
