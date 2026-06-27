import { Router, type IRouter } from "express";
import { GetWeatherQueryParams, GetWeatherResponse } from "@workspace/api-zod";

const router: IRouter = Router();

const DEFAULT_LATITUDE = 55.7558;
const DEFAULT_LONGITUDE = 37.6173;

interface NominatimAddress {
  city?: string;
  town?: string;
  village?: string;
  county?: string;
}

interface NominatimResponse {
  address?: NominatimAddress;
}

async function getCityName(lat: number, lon: number): Promise<string | null> {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=10`,
      {
        headers: {
          "User-Agent": "SmartHomePanel/1.0",
          "Accept-Language": "ru",
        },
      }
    );
    if (!response.ok) return null;
    const data = (await response.json()) as NominatimResponse;
    return (
      data?.address?.city ||
      data?.address?.town ||
      data?.address?.village ||
      data?.address?.county ||
      null
    );
  } catch {
    return null;
  }
}

interface OpenMeteoCurrentUnits {
  temperature_2m?: string;
}

interface OpenMeteoCurrent {
  temperature_2m?: number;
  relative_humidity_2m?: number;
  weather_code?: number;
  wind_speed_10m?: number;
}

interface OpenMeteoHourly {
  precipitation_probability?: number[];
  time?: string[];
}

interface OpenMeteoResponse {
  current?: OpenMeteoCurrent;
  current_units?: OpenMeteoCurrentUnits;
  hourly?: OpenMeteoHourly;
}

router.get("/weather", async (req, res): Promise<void> => {
  const parsed = GetWeatherQueryParams.safeParse(req.query);
  const lat =
    parsed.success && parsed.data.latitude != null
      ? parsed.data.latitude
      : DEFAULT_LATITUDE;
  const lon =
    parsed.success && parsed.data.longitude != null
      ? parsed.data.longitude
      : DEFAULT_LONGITUDE;

  try {
    const weatherUrl =
      `https://api.open-meteo.com/v1/forecast` +
      `?latitude=${lat}&longitude=${lon}` +
      `&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m` +
      `&hourly=precipitation_probability` +
      `&forecast_days=1` +
      `&timezone=auto`;

    const [weatherResp, city] = await Promise.all([
      fetch(weatherUrl),
      getCityName(lat, lon),
    ]);

    if (!weatherResp.ok) {
      req.log.warn({ status: weatherResp.status }, "Open-Meteo API error");
      res.status(502).json({ error: "Failed to fetch weather data" });
      return;
    }

    const weatherData = (await weatherResp.json()) as OpenMeteoResponse;

    const result = {
      current: {
        temperature_2m: weatherData.current?.temperature_2m ?? 0,
        relative_humidity_2m: weatherData.current?.relative_humidity_2m ?? 0,
        weather_code: weatherData.current?.weather_code ?? 0,
        wind_speed_10m: weatherData.current?.wind_speed_10m ?? 0,
        precipitation_probability:
          weatherData.hourly?.precipitation_probability?.[0] ?? null,
      },
      hourly: weatherData.hourly
        ? {
            precipitation_probability:
              weatherData.hourly.precipitation_probability ?? [],
            time: weatherData.hourly.time ?? [],
          }
        : undefined,
      city,
      latitude: lat,
      longitude: lon,
    };

    res.json(GetWeatherResponse.parse(result));
  } catch (err) {
    req.log.error({ err }, "Failed to fetch weather");
    res.status(502).json({ error: "Failed to fetch weather data" });
  }
});

export default router;
