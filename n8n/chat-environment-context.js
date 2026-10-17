function prepareHubContext(base, cacheResult, now=Date.now()) {
 const area=cacheResult.environment_area;
 const validArea=area&&area.id==="surabaya"&&Math.abs(area.latitude-(-7.24917))<0.00001&&Math.abs(area.longitude-112.75083)<0.00001&&typeof area.id==="string"&&Number.isFinite(area.latitude)&&Math.abs(area.latitude)<=90&&Number.isFinite(area.longitude)&&Math.abs(area.longitude)<=180;
 const q=String(base.text||"").toLowerCase(),wanted=[];
 if(/cuaca|hujan|angin|panas|suhu|lembap|uv|weather|rain|besok/.test(q))wanted.push("weather");
 if(/tanah|soil|ph\b|lempung|subur/.test(q))wanted.push("soil","soil_profile");
 if(/udara|polusi|pm2|aqi|asap|air quality/.test(q))wanted.push("air_quality");
 if(/kebakaran|hotspot|titik panas|api\b|fire/.test(q))wanted.push("fire");
 if(/banjir|sungai|debit|flood/.test(q))wanted.push("flood");
 if(/gempa|tsunami|earthquake/.test(q))wanted.push("earthquake");
 const available=[],statuses=[],seen=new Set();
 if(validArea)for(const card of cacheResult.environment_cache||[]){
  if(card.area_id!==area.id || card.provider==="gbif")continue;
  const same=card.request_latitude===area.latitude&&card.request_longitude===area.longitude;
  const facts=Array.isArray(card.payload?.facts)?card.payload.facts:[];
  const fresh=same?facts.filter(f=>f.area_id===area.id&&f.data_origin==="external_api"&&f.role==="supplementary"&&f.reference?.latitude===area.latitude&&f.reference?.longitude===area.longitude&&Date.parse(f.fresh_until)>now&&(typeof f.value==="string"?f.value.trim().length>0:Number.isFinite(f.value))):[];
  statuses.push({area_id:area.id,provider:card.provider,status:!same?"location_changed":card.last_error?"provider_error":fresh.length?"available":facts.length?"stale":"unavailable",last_fetch:card.payload?.fetched_at||null});
  let selected=fresh.filter(f=>!wanted.length||wanted.includes(f.category));
  if(q.includes("besok")){
   const tomorrow=new Date(now+86400000+7*3600000).toISOString().slice(0,10);
   selected.sort((a,b)=>Number(String(b.label).includes(tomorrow))-Number(String(a.label).includes(tomorrow)));
  }
  for(const f of selected.slice(0,wanted.length?8:4))if(!seen.has(f.id)){seen.add(f.id);available.push(f);}
 }
 return {json:{...base,environment_area:validArea?{id:area.id,name:area.name,latitude:area.latitude,longitude:area.longitude,coordinate_source:area.coordinate_source,timezone:area.timezone}:null,environment:[...available.slice(0,21),...(base.disaster_news||[])].slice(0,24),environment_status:statuses,environment_scope:"Kabar bencana berlabel Indonesia mencakup nasional dan tidak membuktikan kejadian di Surabaya. Data lingkungan lainnya memakai acuan Surabaya. Terpisah dari sensor AEROSENSE dan izin node. Acuan kota Surabaya bukan GPS pengguna atau robot; lokasi stasiun eksternal hanya diketahui bila penyedia menyertakannya. Grid model bukan lokasi sensor. Jangan gabungkan nilainya dengan pembacaan lokal atau menganggap kota lain sama.",hub_at:new Date(now).toISOString()}};
}
return prepareHubContext($("Muat konteks terbaru Web").first().json,$json);