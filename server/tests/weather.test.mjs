import test from "node:test";
import assert from "node:assert/strict";
import { parseForecast, parseCyclones, parseQuakes, weatherFacts, weatherService, weatherLabel } from "../api/weather.mjs";

const now = Date.parse("2026-11-13T03:20:00Z"); // 10.20 WIB
const hours = Array.from({ length: 48 }, (_, i) => {
  const d = new Date(Date.parse("2026-11-13T00:00:00Z") + i * 3600000);
  return d.toISOString().slice(0, 13) + ":00";
});
const forecast = {
  latitude: -7.25,
  longitude: 112.75,
  current: { time: "2026-11-13T10:15", temperature_2m: 31.4, apparent_temperature: 35.2, relative_humidity_2m: 66, precipitation: 0, weather_code: 2, cloud_cover: 40, wind_speed_10m: 12, wind_direction_10m: 90, wind_gusts_10m: 25, is_day: 1 },
  hourly: {
    time: hours,
    temperature_2m: hours.map((_, i) => 26 + (i % 24) / 3),
    precipitation_probability: hours.map((_, i) => (i >= 14 && i <= 17 ? 80 : 10)),
    precipitation: hours.map((_, i) => (i === 15 ? 12 : 0)),
    weather_code: hours.map((_, i) => (i === 15 ? 95 : 2)),
    cape: hours.map(() => 400),
    wind_gusts_10m: hours.map(() => 30),
  },
  daily: {
    time: ["2026-11-13", "2026-11-14", "2026-11-15", "2026-11-16"],
    weather_code: [95, 61, 3, 0],
    temperature_2m_max: [33, 32, 31, 32],
    temperature_2m_min: [25, 25, 24, 25],
    precipitation_sum: [14, 6, 0, 0],
    precipitation_probability_max: [80, 60, 20, 5],
    wind_gusts_10m_max: [40, 30, 25, 20],
    uv_index_max: [9, 7, 6, 8],
  },
};

test("forecast starts at the current local hour and explains warnings", () => {
  const o = parseForecast(forecast, now);
  assert.equal(o.hourly.length, 24);
  assert.equal(o.hourly[0].time, "2026-11-13T10:00");
  assert.equal(o.current.label, "Berawan sebagian");
  assert.equal(o.daily[0].label, "Hujan petir");
  const types = o.alerts.map((a) => a.type);
  assert.deepEqual(types, ["thunder", "heavy_rain", "uv"]);
  assert.match(o.alerts[0].text, /15\.00 WIB/);
});

test("labels cover thunderstorm codes", () => {
  assert.equal(weatherLabel(99).icon, "thunder");
  assert.equal(weatherLabel(123).label, "Tidak diketahui");
});

test("cyclones near Indonesia only, quakes from the last week", () => {
  const geo = {
    features: [
      { geometry: { coordinates: [118, -14] }, properties: { eventtype: "TC", eventid: 1, name: "SEROJA", alertlevel: "Orange", iscurrent: "true", todate: "2026-11-13T00:00:00" } },
      { geometry: { coordinates: [-60, 20] }, properties: { eventtype: "TC", eventid: 2, name: "ATLANTIC", iscurrent: "true" } },
      { geometry: { coordinates: [118, -14] }, properties: { eventtype: "EQ", eventid: 3 } },
    ],
  };
  const tc = parseCyclones(geo, now);
  assert.equal(tc.length, 1);
  assert.equal(tc[0].level, "orange");
  const eq = parseQuakes(
    { Infogempa: { gempa: [
      { DateTime: "2026-11-12T20:00:00+00:00", Coordinates: "-8.1,113.2", Magnitude: "5.3", Kedalaman: "10 km", Wilayah: "Selatan Jawa Timur", Potensi: "Tidak berpotensi tsunami" },
      { DateTime: "2026-10-01T20:00:00+00:00", Coordinates: "-8.1,113.2", Magnitude: "6.0" },
    ] } },
    now,
  );
  assert.equal(eq.length, 1);
  assert.equal(eq[0].magnitude, 5.3);
});

test("AERO-BOT gets forecast, coming days and warnings as facts", () => {
  const o = parseForecast(forecast, now);
  const area = { id: "n1", name: "ITS", latitude: -7.28, longitude: 112.79 };
  const facts = weatherFacts(o, { cyclones: [], quakes: [{ latitude: -8.1, longitude: 113.2, magnitude: 5.3, depth: "10 km", region: "Selatan Jawa Timur", potential: "Tidak berpotensi tsunami" }] }, area, now);
  assert.equal(facts.length, 3);
  assert.match(facts[0].value, /Hujan berpeluang turun mulai 14\.00 WIB/);
  assert.match(facts[1].value, /peluang hujan 60%/);
  assert.match(facts[2].value, /Potensi hujan petir/);
  assert.match(facts[2].value, /Gempa M5\.3/);
  for (const f of facts) assert.equal(f.data_origin, "external_api");
  const calm = weatherFacts(null, { cyclones: [], quakes: [] }, area, now);
  assert.match(calm[0].value, /Tidak ada peringatan/);
});

test("service caches by ~5 km and survives a failed hazard source", async () => {
  let calls = 0;
  const svc = weatherService({
    now: () => now,
    request: async (url) => {
      calls++;
      if (url.includes("open-meteo")) return forecast;
      if (url.includes("gdacs")) throw new Error("down");
      return { Infogempa: { gempa: [] } };
    },
  });
  await svc.outlook(-7.2501, 112.7501);
  await svc.outlook(-7.2499, 112.7499);
  assert.equal(calls, 1);
  const hz = await svc.hazards();
  assert.equal(hz.cyclones, null);
  assert.deepEqual(hz.quakes, []);
});
