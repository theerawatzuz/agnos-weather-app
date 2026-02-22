import "dotenv/config";
import type { WeatherResponse } from "../types/weather.js";
import { pool } from "./pool.js";

type LocRow = {
  id: string;
  lat: number;
  lon: number;
};

async function fetchWeather(lat: number, lon: number) {
  const apiUrl = process.env.WEATHER_API_URL!;
  const apiKey = process.env.WEATHER_API_KEY!;
  const q = `${lat},${lon}`;

  const url = `${apiUrl}?key=${apiKey}&q=${encodeURIComponent(q)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`WeatherAPI ${res.status}: ${await res.text()}`);
  return (await res.json()) as WeatherResponse;
}

async function upsertObservation(locationId: string, data: WeatherResponse) {
  const observedAt = new Date(data.current.last_updated_epoch * 1000);

  await pool.query(
    `
    INSERT INTO weather_observations (
      location_id, observed_at,
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
    ON CONFLICT (location_id, observed_at) DO UPDATE SET
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
      locationId,
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
      data,
    ],
  );
}

async function main() {
  const { rows } = await pool.query<LocRow>(
    "SELECT id, lat, lon FROM locations ORDER BY id",
  );

  for (const loc of rows) {
    const data = await fetchWeather(loc.lat, loc.lon);
    await upsertObservation(loc.id, data);
    console.log(`[ok] saved ${loc.id} @ ${data.current.last_updated}`);
  }

  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
