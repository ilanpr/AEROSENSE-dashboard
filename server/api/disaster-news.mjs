import { XMLParser, XMLValidator } from "fast-xml-parser";
import { createHash } from "node:crypto";

const MINUTE = 60000;
const DAY = 86400000;
export const NEWS_SOURCES = [
  { id: "gdacs", name: "GDACS", url: "https://www.gdacs.org/xml/rss.xml" },
  { id: "antara_humaniora", name: "ANTARA", url: "https://www.antaranews.com/rss/humaniora.xml" },
  { id: "antara_terkini", name: "ANTARA", url: "https://www.antaranews.com/rss/terkini.xml" },
];
export const HELP_LINKS = [
  { title: "Bantu lewat PMI", text: "Dukung bantuan kemanusiaan lewat kanal resmi.", url: "https://donasi.pmi.or.id/donation/monetary/donate-now" },
  { title: "Ikuti arahan BNPB", text: "Cek pembaruan dan koordinasi relawan sebelum turun ke lokasi.", url: "https://www.bnpb.go.id/" },
];
const parser = new XMLParser({ ignoreAttributes: false, parseTagValue: false, processEntities: true });
const array = x => Array.isArray(x) ? x : x ? [x] : [];
const text = x => String(typeof x === "object" ? x?.["#text"] || "" : x || "")
  .replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim().slice(0, 240);
const recent = (t, now) => Number.isFinite(Date.parse(t)) && Date.parse(t) <= now + 30 * MINUTE && Date.parse(t) >= now - 7 * DAY;
function safeLink(value, provider) {
  try {
    const u = new URL(text(value));
    const hosts = provider === "gdacs" ? ["www.gdacs.org", "gdacs.org"] : ["www.antaranews.com", "antaranews.com"];
    return u.protocol === "https:" && hosts.includes(u.hostname) && !u.username && !u.password ? u.href : null;
  } catch { return null; }
}
const domestic = /\b(indonesia|aceh|sumat(?:e)?ra|sumut|sumbar|sumsel|riau|jambi|bengkulu|lampung|bangka|belitung|jakarta|banten|jawa|jatim|jateng|jabar|yogyakarta|kalimantan|kaltim|kalteng|kalbar|kalsel|kaltara|sulawesi|sulsel|sulteng|sulut|sultra|sulbar|gorontalo|bali|nusa tenggara|ntb|ntt|maluku|papua|surabaya|semarang|bandung|bogor|bekasi|depok|tangerang|medan|padang|palembang|pekanbaru|pontianak|palangkaraya|palangka raya|samarinda|balikpapan|banjarmasin|makassar|manado|palu|kendari|denpasar|mataram|kupang|ambon|ternate|jayapura|merauke|banda aceh|solok|agam|lumajang|malang|jember|banyuwangi|banyumas|cilacap|garut|sukabumi|cianjur|buleleng|lombok|sumbawa|flores|sikka|pesisir selatan|tanah datar|kapuas|ketapang|kubu raya|mempawah|sambas|sintang|sanggau|kotawaringin|seruyan|pulang pisau|barito|berau|kutai|penajam|bengkalis|pelalawan|siak|indragiri|rokan|dumai)\b/i;
const foreign = /\b(amerika|china|tiongkok|filipina|thailand|vietnam|myanmar|jepang|australia|india|pakistan|nepal|bangladesh|turki|rusia|ukraina|portugal|spanyol|yunani|kanada|malaysia|singapura|kamboja|taiwan|korea|sri lanka)\b/i;
function typeOf(title) {
  if (/karhutla|kebakaran hutan|kebakaran lahan|forest fire/i.test(title)) return "Karhutla";
  if (/banjir|flood/i.test(title)) return "Banjir";
  if (/longsor|landslide/i.test(title)) return "Longsor";
  if (/gempa|earthquake/i.test(title)) return "Gempa";
  if (/erupsi|letusan|volcan/i.test(title)) return "Erupsi";
  if (/kekeringan|drought/i.test(title)) return "Kekeringan";
  if (/puting beliung|angin kencang|cuaca ekstrem|badai|cyclone/i.test(title)) return "Cuaca ekstrem";
  return null;
}

export function parseDisasterFeed(xml, source, now = Date.now()) {
  if (Buffer.byteLength(xml) > 1500000 || /<!DOCTYPE|<!ENTITY/i.test(xml)) throw new Error("Feed tidak valid");
  if (XMLValidator.validate(xml) !== true) throw new Error("XML tidak valid");
  const document = parser.parse(xml);
  if (!document?.rss?.channel) throw new Error("Format feed berubah");
  return array(document.rss.channel.item).flatMap(item => {
    const title = text(item.title), url = safeLink(item.link, source.id);
    const published = item["gdacs:datemodified"] || item.pubDate;
    if (!url || !recent(published, now)) return [];
    const metrics = [];
    let type = typeOf(title), location = "Indonesia", kind = "news";
    if (source.id === "gdacs") {
      if (text(item["gdacs:iso3"]) !== "IDN") return [];
      type = ({ WF: "Karhutla", EQ: "Gempa", FL: "Banjir", VO: "Erupsi", TC: "Cuaca ekstrem", DR: "Kekeringan" })[text(item["gdacs:eventtype"])];
      if (!type) return [];
      kind = "monitoring";
      const severity = item["gdacs:severity"];
      const value = Number(severity?.["@_value"]);
      if (Number.isFinite(value) && value >= 0 && value < 1e9) {
        if (type === "Karhutla" && severity?.["@_unit"] === "ha") metrics.push({ value, unit: "ha", label: "Estimasi area GDACS" });
        if (type === "Gempa" && severity?.["@_unit"] === "M") metrics.push({ value, unit: "M", label: "Magnitudo" });
      }
    } else {
      // Conservative headline matching: ambiguous or foreign news is not shown.
      if (!type || !domestic.test(title) || foreign.test(title)) return [];
      location = title.match(domestic)?.[0] || "Indonesia";
      const damage = title.match(/rumah rusak.*?(\d+)\s+unit/i);
      if (damage) metrics.push({value:Number(damage[1]),unit:"unit",label:"Rumah rusak, menurut judul sumber"});
    }
    return [{
      id: createHash("sha256").update(url).digest("hex").slice(0, 24),
      title: kind === "monitoring" ? `${type} dalam pantauan GDACS` : title,
      original_title: title, url, source: source.name, source_url: source.url,
      published_at: new Date(Date.parse(published)).toISOString(),
      event_started_at: Number.isFinite(Date.parse(item["gdacs:fromdate"])) && Date.parse(item["gdacs:fromdate"]) <= now ? new Date(Date.parse(item["gdacs:fromdate"])).toISOString() : null,
      kind, type, location, country_code: "IDN", metrics,
    }];
  }).slice(0, 40);
}

async function download(source, fetcher) {
  const r = await fetcher(source.url, { signal: AbortSignal.timeout(12000), redirect: "error", headers: { Accept: "application/rss+xml, application/xml, text/xml", "User-Agent": "AEROSENSE/1.0" } });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  let size = 0; const chunks = [];
  for await (const chunk of r.body) {
    size += chunk.length;
    if (size > 1500000) throw new Error("Feed terlalu besar");
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}

export function disasterNews({ db, fetcher = fetch, clock = Date.now }) {
  let flight;
  async function refresh() {
    if (flight) return flight;
    flight = (async () => {
      const previous = await db("ae_disaster_news_cache");
      await Promise.all(NEWS_SOURCES.map(async source => {
        const old = previous.find(x => x.provider === source.id);
        if (Date.parse(old?.refresh_after) > clock()) return;
        let items = old?.items || [], error = null, success = old?.last_success_at || null;
        try {
          items = parseDisasterFeed(await download(source, fetcher), source, clock());
          success = new Date(clock()).toISOString();
        } catch { error = "Sumber belum berhasil diperbarui"; }
        await db("ae_disaster_news_cache", "on_conflict=provider", "POST", {
          provider: source.id, items, last_attempt_at: new Date(clock()).toISOString(),
          last_success_at: success, refresh_after: new Date(clock() + 15 * MINUTE).toISOString(), last_error: error,
        }, "resolution=merge-duplicates,return=minimal");
      }));
    })().finally(() => { flight = null; });
    return flight;
  }
  async function read() {
    let rows = await db("ae_disaster_news_cache");
    if (!rows.length) { await refresh(); rows = await db("ae_disaster_news_cache"); }
    const byUrl = new Map();
    for (const row of rows.filter(r => NEWS_SOURCES.some(s => s.id === r.provider))) {
      for (const item of row.items || []) {
        if (!recent(item.published_at, clock()) || item.country_code !== "IDN" || !safeLink(item.url, row.provider)) continue;
        if (!byUrl.has(item.url) || Date.parse(item.published_at) > Date.parse(byUrl.get(item.url).published_at))
          byUrl.set(item.url, { ...item, fresh_until: row.last_success_at ? new Date(Date.parse(row.last_success_at) + 60 * MINUTE).toISOString() : null, stale: !row.last_success_at || clock() - Date.parse(row.last_success_at) > 60 * MINUTE });
      }
    }
    return {
      scope: "Indonesia", items: [...byUrl.values()].sort((a,b) => Number(a.kind === "monitoring") - Number(b.kind === "monitoring") || Date.parse(b.published_at) - Date.parse(a.published_at)).slice(0, 24),
      sources: rows.map(r => ({ name: NEWS_SOURCES.find(s=>s.id===r.provider)?.name || r.provider, last_success_at: r.last_success_at, error: r.last_error })),
      help: HELP_LINKS, fetched_at: new Date(clock()).toISOString(),
    };
  }
  return { read, refresh };
}
