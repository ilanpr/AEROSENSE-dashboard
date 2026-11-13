export interface WeatherHour {
  time: string;
  temperature: number | null;
  rain_chance: number | null;
  rain: number | null;
  code: number | null;
  cape: number | null;
  gust: number | null;
  is_day?: boolean | null;
  label: string;
  icon: string;
}
export interface WeatherDay {
  date: string;
  code: number | null;
  label: string;
  icon: string;
  max: number | null;
  min: number | null;
  rain: number | null;
  rain_chance: number | null;
  gust: number | null;
  uv: number | null;
}
export interface WeatherAlert {
  type: string;
  level: "warning" | "danger";
  title: string;
  text: string;
}
export interface WeatherOutlook {
  latitude: number;
  longitude: number;
  source: string;
  valid_at: string | null;
  current: {
    temperature: number | null;
    feels_like: number | null;
    humidity: number | null;
    rain: number | null;
    cloud: number | null;
    wind: number | null;
    wind_direction: number | null;
    gust: number | null;
    is_day: boolean;
    code: number | null;
    label: string;
    icon: string;
  };
  hourly: WeatherHour[];
  day_hours?: WeatherHour[];
  daily: WeatherDay[];
  alerts: WeatherAlert[];
}
export interface Cyclone {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  level: string;
  severity: string;
  updated_at: string | null;
  url: string | null;
}
export interface Quake {
  id: string;
  latitude: number;
  longitude: number;
  magnitude: number;
  depth: string;
  region: string;
  potential: string;
  time: string;
}
export interface Hazards {
  cyclones: Cyclone[] | null;
  quakes: Quake[] | null;
  sources: string[];
  updated_at: string;
}
