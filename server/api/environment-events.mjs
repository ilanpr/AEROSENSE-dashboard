// Self-contained so the exact parser can also run inside the n8n Code node.
export function normalizeHazardEvents(provider, data, area, now = Date.now(), radiusKm = provider === "firms" ? 50 : 300) {
  const clean = v => String(v ?? "").replace(/[<>\r\n\u0000-\u001f]/g, " ").trim().slice(0, 180);
  const number = v => v == null || String(v).trim() === "" ? NaN : Number(String(v).trim().replace(",", "."));
  const coordinate = (lat, lon) => Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180;
  const distance = (lat, lon) => {
    const rad = Math.PI / 180, h = Math.sin((lat-area.latitude)*rad/2)**2 + Math.cos(area.latitude*rad)*Math.cos(lat*rad)*Math.sin((lon-area.longitude)*rad/2)**2;
    return 6371*2*Math.asin(Math.sqrt(Math.min(1,Math.max(0,h))));
  };
  if (!["firms", "bmkg_quake"].includes(provider) || !coordinate(area.latitude, area.longitude)) throw Error("Area kejadian tidak valid");
  const fire = provider === "firms", maxAge = (fire ? 1 : 7)*86400000, limit = fire ? 200 : 30;
  const rows = fire ? data : data?.Infogempa?.gempa;
  if (!Array.isArray(rows)) throw Error("Skema kejadian berubah");
  const byId = new Map();
  for (const row of rows) {
    const xy = fire ? [row.latitude, row.longitude] : String(row.Coordinates ?? "").split(",");
    const latitude = number(xy[0]), longitude = number(xy[1]);
    if (!coordinate(latitude, longitude)) continue;
    const clock = String(row.acq_time ?? "").padStart(4,"0");
    const observed = fire ? (/^\d{4}$/.test(clock) ? `${row.acq_date}T${clock.slice(0,2)}:${clock.slice(2)}:00Z` : "") : row.DateTime;
    const time = Date.parse(observed);
    if (!Number.isFinite(time) || time > now || time < now-maxAge) continue;
    const distance_km = distance(latitude, longitude);
    if (distance_km > radiusKm) continue;
    const magnitude = number(row.Magnitude);
    if (!fire && (!Number.isFinite(magnitude) || magnitude < 0 || magnitude > 10.5)) continue;
    const observed_at = new Date(time).toISOString();
    const satellite = fire ? clean(row.satellite) : null;
    const id = `${provider}:${observed_at}:${latitude}:${longitude}:${satellite || ""}`;
    const depth = number(String(row.Kedalaman ?? "").replace(/\s*km\s*$/i,""));
    byId.set(id, {
      id, area_id:area.id, provider, category:fire?"fire":"earthquake", latitude, longitude,
      observed_at, fetched_at:new Date(now).toISOString(), fresh_until:new Date(now+7200000).toISOString(), distance_km,
      title:fire?"Titik panas satelit":clean(row.Wilayah)||"Episenter gempa BMKG",
      source:fire?"NASA FIRMS / VIIRS":"BMKG", source_url:fire?"https://firms.modaps.eosdis.nasa.gov/":"https://data.bmkg.go.id/gempabumi/",
      coordinate_kind:fire?"satellite_pixel_center":"epicenter", data_origin:"external_api", role:"supplementary",
      reference:{latitude:area.latitude,longitude:area.longitude},
      ...(fire?{satellite,confidence:({l:"low",n:"nominal",h:"high",low:"low",nominal:"nominal",high:"high"})[String(row.confidence).toLowerCase()]||null}
        :{magnitude,depth_km:Number.isFinite(depth)&&depth>=0?depth:null,felt:clean(row.Dirasakan)||null,potential:clean(row.Potensi)||null}),
    });
  }
  const all = [...byId.values()].sort((a,b)=>Date.parse(b.observed_at)-Date.parse(a.observed_at)||a.distance_km-b.distance_km);
  return {events:all.slice(0,limit),coverage:{radius_km:radiusKm,window_hours:fire?24:168,matched_count:all.length,returned_count:Math.min(all.length,limit),truncated:all.length>limit,feed:fire?"VIIRS 24 jam":"Daftar terakhir gempa M5+ BMKG; bukan seluruh gempa"}};
}

export function readEventLayers(rows, area, now = Date.now()) {
  const layers = [], events = new Map();
  for (const provider of ["firms", "bmkg_quake"]) {
    const row = rows.find(r=>r.provider===provider && r.request_latitude===area.latitude && r.request_longitude===area.longitude);
    const radius = provider === "firms" ? 50 : 300;
    const clean = v=>String(v??"").replace(/[<>\r\n\u0000-\u001f]/g," ").slice(0,180);
    let count=0;
    for (const e of (Array.isArray(row?.payload?.events)?row.payload.events:[]).slice(0,provider==="firms"?200:30)) {
      if (e.area_id!==area.id || e.provider!==provider || e.category!==(provider==="firms"?"fire":"earthquake") || e.reference?.latitude!==area.latitude || e.reference?.longitude!==area.longitude) continue;
      if (!Number.isFinite(e.latitude)||!Number.isFinite(e.longitude)||Math.abs(e.latitude)>90||Math.abs(e.longitude)>180) continue;
      if (!Number.isFinite(Date.parse(e.observed_at))||Date.parse(e.observed_at)>now||Date.parse(e.observed_at)<now-(provider==="firms"?1:7)*86400000) continue;
      if (!Number.isFinite(Date.parse(e.fetched_at))||Date.parse(e.fetched_at)>now+300000) continue;
      const point = normalizeHazardEvents(provider,provider==="firms"?[{latitude:e.latitude,longitude:e.longitude,acq_date:e.observed_at.slice(0,10),acq_time:e.observed_at.slice(11,16).replace(":",""),satellite:e.satellite,confidence:e.confidence}]:{Infogempa:{gempa:[{Coordinates:`${e.latitude},${e.longitude}`,DateTime:e.observed_at,Magnitude:e.magnitude,Kedalaman:e.depth_km,Wilayah:e.title,Dirasakan:e.felt,Potensi:e.potential}]}},area,now,radius).events[0];
      if (!point) continue;
      events.set(point.id,{...point,title:clean(point.title),fetched_at:e.fetched_at,fresh_until:new Date(Date.parse(e.fetched_at)+7200000).toISOString(),stale:now-Date.parse(e.fetched_at)>=7200000}); count++;
    }
    layers.push({provider,category:provider==="firms"?"fire":"earthquake",radius_km:radius,available:row?.payload?.status==="available"&&Array.isArray(row.payload?.events),last_attempt_at:row?.last_attempt_at||null,last_error:row?.last_error?"Pembaruan sumber belum berhasil":null,event_count:count,truncated:row?.payload?.event_coverage?.truncated===true});
  }
  return {events:[...events.values()],event_layers:layers};
}
