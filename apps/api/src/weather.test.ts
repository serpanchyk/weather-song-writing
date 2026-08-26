import assert from "node:assert/strict";
import test from "node:test";
import {
  OpenMeteoWeatherResolver,
  WeatherValidationError,
  selectWeatherSource,
} from "./weather.js";

const now = () => new Date("2026-08-25T12:00:00Z");
test("selects forecast, archive, and rejects unsupported weather dates", () => {
  assert.match(selectWeatherSource("2026-08-25", now()), /forecast/);
  assert.match(selectWeatherSource("2026-08-24", now()), /archive/);
  assert.throws(
    () => selectWeatherSource("2026-09-20", now()),
    WeatherValidationError,
  );
});
test("resolves a city and normalizes forecast weather", async () => {
  const urls: string[] = [];
  const fetcher: typeof fetch = async (url) => {
    urls.push(String(url));
    return String(url).includes("geocoding")
      ? Response.json({
          results: [
            {
              name: "Lviv",
              admin1: "Lviv",
              country: "Ukraine",
              latitude: 49.84,
              longitude: 24.03,
            },
          ],
        })
      : Response.json({
          timezone: "Europe/Kyiv",
          hourly: {
            time: ["2026-08-25T18:30"],
            temperature_2m: [19],
            apparent_temperature: [18],
            precipitation: [0.2],
            wind_speed_10m: [10],
            weather_code: [3],
          },
        });
  };
  const weather = await new OpenMeteoWeatherResolver(fetcher, now).resolve({
    location: { kind: "city", city: "Lviv" },
    localDateTime: "2026-08-25T18:30",
  });
  assert.equal(weather.displayLocation, "Lviv, Lviv, Ukraine");
  assert.equal(weather.weatherDescription, "Partly cloudy");
  assert.match(urls[1]!, /forecast/);
});
test("accepts coordinates directly and uses archive weather", async () => {
  const fetcher: typeof fetch = async (url) =>
    Response.json({
      timezone: "Europe/Kyiv",
      hourly: {
        time: ["2026-08-24T18:30"],
        temperature_2m: [19],
        apparent_temperature: [18],
        precipitation: [0],
        wind_speed_10m: [10],
        weather_code: [0],
      },
    });
  const weather = await new OpenMeteoWeatherResolver(fetcher, now).resolve({
    location: {
      kind: "coordinates",
      latitude: 49.84,
      longitude: 24.03,
      label: "Custom pin",
    },
    localDateTime: "2026-08-24T18:30",
  });
  assert.equal(weather.displayLocation, "Custom pin");
});
