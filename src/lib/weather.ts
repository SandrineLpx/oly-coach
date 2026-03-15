// Weather integration using Open-Meteo (free, no API key required)

export interface DailyForecast {
  date: string;
  tempHighC: number;
  tempLowC: number;
  tempHighF: number;
  tempLowF: number;
  precipitationProbability: number;
  windSpeedKmh: number;
  weatherCode: number;
  outdoorSuitable: boolean;
}

export interface OutdoorThresholds {
  maxPrecipPct: number;
  minTempC: number;
  maxWindKmh: number;
}

const DEFAULT_THRESHOLDS: OutdoorThresholds = {
  maxPrecipPct: 40,
  minTempC: 4, // ~39°F
  maxWindKmh: 40, // ~25 mph
};

function celsiusToFahrenheit(c: number): number {
  return Math.round(c * 9 / 5 + 32);
}

const WEATHER_DESCRIPTIONS: Record<number, string> = {
  0: 'Clear',
  1: 'Mostly clear',
  2: 'Partly cloudy',
  3: 'Overcast',
  45: 'Fog',
  48: 'Rime fog',
  51: 'Light drizzle',
  53: 'Drizzle',
  55: 'Heavy drizzle',
  61: 'Light rain',
  63: 'Rain',
  65: 'Heavy rain',
  71: 'Light snow',
  73: 'Snow',
  75: 'Heavy snow',
  80: 'Light showers',
  81: 'Showers',
  82: 'Heavy showers',
  95: 'Thunderstorm',
};

export function getWeatherDescription(code: number): string {
  return WEATHER_DESCRIPTIONS[code] || 'Unknown';
}

export function isOutdoorSuitable(
  forecast: DailyForecast,
  thresholds: OutdoorThresholds = DEFAULT_THRESHOLDS,
): boolean {
  return (
    forecast.precipitationProbability <= thresholds.maxPrecipPct &&
    forecast.tempHighC >= thresholds.minTempC &&
    forecast.windSpeedKmh <= thresholds.maxWindKmh
  );
}

export async function fetchWeeklyForecast(
  lat: number,
  lon: number,
  thresholds: OutdoorThresholds = DEFAULT_THRESHOLDS,
): Promise<DailyForecast[]> {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,windspeed_10m_max,weathercode&timezone=auto&forecast_days=7`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Weather API error: ${response.status}`);
  }

  const data = await response.json();
  const daily = data.daily;

  const forecasts: DailyForecast[] = [];
  for (let i = 0; i < daily.time.length; i++) {
    const tempHighC = Math.round(daily.temperature_2m_max[i]);
    const tempLowC = Math.round(daily.temperature_2m_min[i]);
    const precipitationProbability = daily.precipitation_probability_max[i] ?? 0;
    const windSpeedKmh = Math.round(daily.windspeed_10m_max[i] ?? 0);
    const weatherCode = daily.weathercode[i] ?? 0;

    const forecast: DailyForecast = {
      date: daily.time[i],
      tempHighC,
      tempLowC,
      tempHighF: celsiusToFahrenheit(tempHighC),
      tempLowF: celsiusToFahrenheit(tempLowC),
      precipitationProbability,
      windSpeedKmh,
      weatherCode,
      outdoorSuitable: false,
    };
    forecast.outdoorSuitable = isOutdoorSuitable(forecast, thresholds);
    forecasts.push(forecast);
  }

  return forecasts;
}

export function formatTemp(highC: number, lowC: number): string {
  return `${highC}°C (${celsiusToFahrenheit(highC)}°F)`;
}

export function formatForecastShort(f: DailyForecast): string {
  const desc = getWeatherDescription(f.weatherCode);
  return `${f.tempHighC}°C, ${desc}, ${f.precipitationProbability}% rain`;
}
