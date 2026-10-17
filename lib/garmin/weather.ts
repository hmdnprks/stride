import type { RunWeather } from "./types";

// Weather for one activity, from Garmin's own record of the nearest weather
// station at the start time, so no location leaves Garmin. Garmin reports
// imperial units (°F, mph) whatever the account's settings.

/* eslint-disable @typescript-eslint/no-explicit-any */

const num = (x: unknown) => (typeof x === "number" && Number.isFinite(x) ? x : null);
const celsius = (f: number | null) => (f === null ? null : Math.round(((f - 32) * 5) / 9 * 10) / 10);

export function mapWeather(w: any): RunWeather | null {
  const tempC = celsius(num(w?.temp));
  if (tempC === null) return null;
  const mph = num(w?.windSpeed);
  return {
    tempC,
    feelsLikeC: celsius(num(w?.apparentTemp)),
    dewPointC: celsius(num(w?.dewPoint)),
    humidityPct: num(w?.relativeHumidity),
    windKph: mph === null ? null : Math.round(mph * 1.609),
    desc: typeof w?.weatherTypeDTO?.desc === "string" ? w.weatherTypeDTO.desc : null,
    station: typeof w?.weatherStationDTO?.name === "string" ? w.weatherStationDTO.name : null,
  };
}

/** "32°C, feels like 35°C" style summary for one run. */
export function weatherLine(w: RunWeather) {
  const feels = w.feelsLikeC !== null && Math.abs(w.feelsLikeC - w.tempC) >= 1 ? `, feels like ${Math.round(w.feelsLikeC)}°C` : "";
  return `${Math.round(w.tempC)}°C${feels}`;
}
