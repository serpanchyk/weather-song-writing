import type {
  LocationInput,
  WeatherMomentInput,
  WeatherSummary,
} from "@weather-song-writing/contracts";

const GEOCODING_URL = "https://geocoding-api.open-meteo.com/v1/search";
const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";
const ARCHIVE_URL = "https://archive-api.open-meteo.com/v1/archive";
const MAX_FORECAST_DAYS = 16;
const EARLIEST_ARCHIVE_DATE = "1940-01-01";

export class WeatherValidationError extends Error {}
export class WeatherServiceError extends Error {}

export class OpenMeteoWeatherResolver {
  constructor(
    private readonly fetcher: typeof fetch = fetch,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async resolve(input: WeatherMomentInput): Promise<WeatherSummary> {
    const date = input.localDateTime.slice(0, 10);
    const source = selectWeatherSource(date, this.now());
    const location = await this.resolveLocation(input.location);
    const params = new URLSearchParams({
      latitude: String(location.latitude),
      longitude: String(location.longitude),
      timezone: "auto",
      hourly:
        "temperature_2m,apparent_temperature,precipitation,wind_speed_10m,weather_code",
      start_date: date,
      end_date: date,
    });
    const response = await requestJson(this.fetcher, `${source}?${params}`);
    const hourly = readHourly(response, input.localDateTime);
    return {
      displayLocation: location.displayLocation,
      latitude: location.latitude,
      longitude: location.longitude,
      localDateTime: input.localDateTime,
      timezone: stringAt(response, "timezone") ?? "auto",
      temperatureCelsius: numberAt(hourly.temperature_2m),
      apparentTemperatureCelsius: numberAt(hourly.apparent_temperature),
      precipitationMm: numberAt(hourly.precipitation),
      windSpeedKph: numberAt(hourly.wind_speed_10m),
      weatherDescription: weatherCodeDescription(numberAt(hourly.weather_code)),
    };
  }

  private async resolveLocation(
    location: LocationInput,
  ): Promise<{ latitude: number; longitude: number; displayLocation: string }> {
    if (location.kind === "coordinates")
      return {
        latitude: location.latitude,
        longitude: location.longitude,
        displayLocation:
          location.label ??
          `${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}`,
      };
    const params = new URLSearchParams({
      name: location.city,
      count: "1",
      language: "en",
      format: "json",
    });
    const response = await requestJson(
      this.fetcher,
      `${GEOCODING_URL}?${params}`,
    );
    const result =
      isRecord(response) && Array.isArray(response.results)
        ? response.results[0]
        : undefined;
    if (
      !isRecord(result) ||
      typeof result.latitude !== "number" ||
      typeof result.longitude !== "number"
    )
      throw new WeatherValidationError(
        "City could not be resolved to a location.",
      );
    const parts = [result.name, result.admin1, result.country].filter(
      (item): item is string => typeof item === "string" && item.length > 0,
    );
    return {
      latitude: result.latitude,
      longitude: result.longitude,
      displayLocation: parts.join(", "),
    };
  }
}

export function selectWeatherSource(date: string, now: Date): string {
  const today = isoDate(now);
  const latestForecast = new Date(`${today}T00:00:00Z`);
  latestForecast.setUTCDate(latestForecast.getUTCDate() + MAX_FORECAST_DAYS);
  if (date >= today && date <= isoDate(latestForecast)) return FORECAST_URL;
  if (date >= EARLIEST_ARCHIVE_DATE && date < today) return ARCHIVE_URL;
  throw new WeatherValidationError(
    `Weather is available from ${EARLIEST_ARCHIVE_DATE} through ${isoDate(latestForecast)}.`,
  );
}

async function requestJson(
  fetcher: typeof fetch,
  url: string,
): Promise<unknown> {
  let response: Response;
  try {
    response = await fetcher(url);
  } catch {
    throw new WeatherServiceError(
      "Weather service is temporarily unavailable.",
    );
  }
  if (!response.ok)
    throw new WeatherServiceError(
      "Weather service is temporarily unavailable.",
    );
  return response.json();
}

function readHourly(
  response: unknown,
  localDateTime: string,
): Record<string, unknown> {
  if (
    !isRecord(response) ||
    !isRecord(response.hourly) ||
    !Array.isArray(response.hourly.time)
  )
    throw new WeatherServiceError("Weather service returned incomplete data.");
  const index = response.hourly.time.indexOf(localDateTime);
  if (index === -1)
    throw new WeatherServiceError(
      "Weather service returned no data for the selected time.",
    );
  return Object.fromEntries(
    Object.entries(response.hourly).map(([key, value]) => [
      key,
      Array.isArray(value) ? value[index] : undefined,
    ]),
  );
}
function stringAt(value: unknown, key: string): string | null {
  return isRecord(value) && typeof value[key] === "string" ? value[key] : null;
}
function numberAt(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}
function weatherCodeDescription(code: number | null): string {
  if (code === null) return "Unknown conditions";
  if (code === 0) return "Clear sky";
  if ([1, 2, 3].includes(code)) return "Partly cloudy";
  if ([45, 48].includes(code)) return "Fog";
  if ([51, 53, 55, 56, 57].includes(code)) return "Drizzle";
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return "Rain";
  if ([71, 73, 75, 77, 85, 86].includes(code)) return "Snow";
  if ([95, 96, 99].includes(code)) return "Thunderstorm";
  return "Mixed weather";
}
