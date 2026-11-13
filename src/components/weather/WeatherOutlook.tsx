import { Link } from "react-router-dom";
import {
  AlertTriangle,
  ArrowUpRight,
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudRainWind,
  CloudSun,
  Droplets,
  Moon,
  Sun,
  Thermometer,
  Tornado,
  Waves,
  Wind,
  type LucideIcon,
} from "lucide-react";
import { useLiveData } from "@/hooks/useLiveData";
import "@/styles/weather.css";
import type { WeatherOutlook as Outlook, Hazards } from "@/types/weather.types";

const ICONS: Record<string, LucideIcon> = {
  clear: Sun,
  partly: CloudSun,
  cloudy: Cloud,
  fog: CloudFog,
  drizzle: CloudDrizzle,
  rain: CloudRain,
  "heavy-rain": CloudRainWind,
  thunder: CloudLightning,
};
export function WeatherIcon({ icon, night = false, size = 22 }: { icon: string; night?: boolean; size?: number }) {
  const Icon = night && icon === "clear" ? Moon : ICONS[icon] || Cloud;
  return <Icon size={size} aria-hidden="true" className={`wx-icon wx-${icon}`} />;
}
const hour = (t: string) => t.slice(11, 16).replace(":", ".");
const dayName = (date: string, i: number) =>
  i === 0
    ? "Hari ini"
    : i === 1
      ? "Besok"
      : new Date(date + "T12:00:00+07:00").toLocaleDateString("id-ID", {
          weekday: "long",
          timeZone: "Asia/Jakarta",
        });
const num = (v: number | null | undefined) =>
  v == null ? "–" : String(Math.round(v * 10) / 10).replace(".", ",");

/** Weather now, next 24 hours, 7 days, warnings, and cyclones/earthquakes around Indonesia. */
export function WeatherOutlook({
  point,
  place,
  compact = false,
}: {
  point?: { latitude: number; longitude: number };
  place?: string;
  compact?: boolean;
}) {
  const path = point
    ? `/v1/weather?lat=${point.latitude.toFixed(3)}&lng=${point.longitude.toFixed(3)}`
    : null;
  const wx = useLiveData<Outlook>(path, 900000, false);
  const hz = useLiveData<Hazards>(compact ? null : "/v1/hazards", 600000, false);
  if (!point) return null;
  const o = wx.data;
  return (
    <section id="cuaca" className={`weather-outlook ${compact ? "is-compact" : ""}`} aria-labelledby="wx-title">
      <header className="wx-head">
        <div>
          <h2 id="wx-title">Cuaca &amp; prakiraan</h2>
          <p>
            {place ? `Sekitar ${place}` : "Sekitar lokasi acuan"} ·{" "}
            {o?.valid_at
              ? `diperbarui ${new Date(o.valid_at).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" })} WIB`
              : "memuat…"}
          </p>
        </div>
        {compact ? (
          <Link className="insight-text-link" to="/environment#cuaca">
            Prakiraan lengkap <ArrowUpRight size={15} />
          </Link>
        ) : (
          <Link
            className="insight-text-link"
            to={`/aerobot?question=${encodeURIComponent(`Bagaimana cuaca dan peluang hujan ${place ? "di sekitar " + place : "di sekitarku"} hari ini dan besok? Apa yang perlu saya siapkan?`)}`}
          >
            Tanya AERO-BOT <ArrowUpRight size={15} />
          </Link>
        )}
      </header>
      {wx.error && !o && <p className="live-notice">{wx.error}</p>}
      {!o && !wx.error && <div className="wx-skeleton" aria-busy="true" />}
      {o && (
        <>
          <div className={`wx-now wx-tone-${o.current.icon}`}>
            <WeatherIcon icon={o.current.icon} night={!o.current.is_day} size={compact ? 52 : 64} />
            <div className="wx-now-main">
              <strong>{num(o.current.temperature)}°</strong>
              <span>{o.current.label}</span>
              <small>Terasa {num(o.current.feels_like)}°</small>
            </div>
            <dl className="wx-now-facts">
              <div>
                <dt><Droplets size={15} aria-hidden="true" /> Kelembapan</dt>
                <dd>{num(o.current.humidity)}%</dd>
              </div>
              <div>
                <dt><Wind size={15} aria-hidden="true" /> Angin</dt>
                <dd>{num(o.current.wind)} km/jam</dd>
              </div>
              <div>
                <dt><CloudRain size={15} aria-hidden="true" /> Hujan hari ini</dt>
                <dd>{num(o.daily[0]?.rain_chance ?? 0)}%</dd>
              </div>
              {!compact && (
                <div>
                  <dt><Sun size={15} aria-hidden="true" /> UV maks</dt>
                  <dd>{num(o.daily[0]?.uv)}</dd>
                </div>
              )}
            </dl>
          </div>
          {o.alerts.length > 0 ? (
            <ul className="wx-alerts">
              {o.alerts.slice(0, compact ? 2 : 5).map((a) => (
                <li key={a.type} className={`is-${a.level}`}>
                  <AlertTriangle size={18} aria-hidden="true" />
                  <div>
                    <strong>{a.title}</strong>
                    <p>{a.text}</p>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="wx-calm">Tidak ada peringatan cuaca ekstrem dalam 24 jam ke depan.</p>
          )}
          <div className="wx-hours" aria-label="Prakiraan per jam">
            {o.hourly.slice(0, compact ? 8 : 24).map((h, i) => (
              <div key={h.time} className="wx-hour">
                <span>{i === 0 ? "Kini" : hour(h.time)}</span>
                <WeatherIcon icon={h.icon} night={+h.time.slice(11, 13) < 6 || +h.time.slice(11, 13) >= 18} />
                <strong>{num(h.temperature)}°</strong>
                <small className={(h.rain_chance ?? 0) >= 50 ? "is-wet" : ""}>
                  <Droplets size={11} aria-hidden="true" /> {num(h.rain_chance ?? 0)}%
                </small>
              </div>
            ))}
          </div>
          {!compact && <WeekList outlook={o} />}
          {!compact && <HazardList hazards={hz.data} />}
          <p className="wx-source">
            {o.source}. Model wilayah, bukan sensor AEROSENSE.
            {!compact && " Siklon tropis dari GDACS, gempa M5+ dari BMKG."}
          </p>
        </>
      )}
    </section>
  );
}

function WeekList({ outlook }: { outlook: Outlook }) {
  const lo = Math.min(...outlook.daily.map((d) => d.min ?? 99)),
    hi = Math.max(...outlook.daily.map((d) => d.max ?? -99));
  const pct = (v: number | null) => (v == null || hi === lo ? 0 : ((v - lo) / (hi - lo)) * 100);
  return (
    <div className="wx-week">
      <h3>7 hari ke depan</h3>
      <ul>
        {outlook.daily.map((d, i) => (
          <li key={d.date}>
            <span className="wx-day">{dayName(d.date, i)}</span>
            <WeatherIcon icon={d.icon} />
            <span className="wx-day-label">{d.label}</span>
            <span className={`wx-day-rain ${(d.rain_chance ?? 0) >= 50 ? "is-wet" : ""}`}>
              <Droplets size={12} aria-hidden="true" /> {num(d.rain_chance ?? 0)}%
            </span>
            <span className="wx-range">
              <small>{num(d.min)}°</small>
              <i>
                <b style={{ left: `${pct(d.min)}%`, right: `${100 - pct(d.max)}%` }} />
              </i>
              <small>{num(d.max)}°</small>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function HazardList({ hazards }: { hazards: Hazards | null }) {
  if (!hazards) return null;
  const quakes = [...(hazards.quakes || [])].sort((a, b) => b.magnitude - a.magnitude).slice(0, 3);
  return (
    <div className="wx-hazards">
      <h3>Siklon &amp; gempa di sekitar Indonesia</h3>
      <ul>
        {hazards.cyclones === null ? (
          <li className="is-muted"><Tornado size={18} aria-hidden="true" /> Data siklon belum tersedia.</li>
        ) : hazards.cyclones.length === 0 ? (
          <li className="is-calm"><Tornado size={18} aria-hidden="true" /> Tidak ada siklon tropis aktif di sekitar Indonesia.</li>
        ) : (
          hazards.cyclones.map((c) => (
            <li key={c.id} className={`is-${c.level}`}>
              <Tornado size={18} aria-hidden="true" />
              <div>
                <strong>Siklon tropis {c.name}</strong>
                <p>
                  Status {c.level} · {Math.abs(c.latitude).toFixed(1)}°{c.latitude < 0 ? "LS" : "LU"}{" "}
                  {c.longitude.toFixed(1)}°BT{c.severity ? ` · ${c.severity}` : ""}
                </p>
              </div>
            </li>
          ))
        )}
        {quakes.map((q) => (
          <li key={q.id} className={q.magnitude >= 6 ? "is-orange" : "is-green"}>
            <Waves size={18} aria-hidden="true" />
            <div>
              <strong>Gempa M{num(q.magnitude)} · {q.region}</strong>
              <p>
                {new Date(q.time).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" })} WIB · kedalaman {q.depth}
                {q.potential ? ` · ${q.potential}` : ""}
              </p>
            </div>
          </li>
        ))}
      </ul>
      <Link className="insight-text-link" to="/sensor-map">
        <Thermometer size={15} aria-hidden="true" /> Lihat hujan, awan, dan potensi petir di peta <ArrowUpRight size={15} />
      </Link>
    </div>
  );
}
