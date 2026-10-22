function prepareHubContext(base, cacheResult, now=Date.now()) {
 const area=cacheResult.environment_area;
 const permittedNodes=new Set(Array.isArray(base.node_ids)?base.node_ids:[]);
 const validArea=area&&area.coordinate_source==="robot_node"&&typeof area.source_node_id==="string"&&permittedNodes.has(area.source_node_id)&&area.id===`node_${area.source_node_id}`&&Number.isFinite(area.latitude)&&Math.abs(area.latitude)<=90&&Number.isFinite(area.longitude)&&Math.abs(area.longitude)<=180;
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
  let selected=[...fresh];
  if(wanted.includes("air_quality")){
   const current=f=>!["forecast","historical"].includes(f.kind)&&Number.isFinite(Date.parse(f.valid_at))&&Date.parse(f.valid_at)<=now+1800000;
   selected=selected.filter(f=>f.category!=="air_quality"||current(f));
   const priority=f=>f.category!=="air_quality"?4:/AQI US|US AQI/i.test(f.label)?0:/PM2[.,]?5/i.test(f.label)?1:/PM10/i.test(f.label)?2:3;
   selected.sort((a,b)=>priority(a)-priority(b)||(Date.parse(b.valid_at)||0)-(Date.parse(a.valid_at)||0));
  }
  if(q.includes("besok")){
   const tomorrow=new Date(now+86400000+7*3600000).toISOString().slice(0,10);
   selected.sort((a,b)=>Number(String(b.label).includes(tomorrow))-Number(String(a.label).includes(tomorrow)));
  }
  // Keywords prioritize facts, but never hide other categories from the model.
  selected.sort((a,b)=>Number(wanted.includes(b.category))-Number(wanted.includes(a.category)));
  for(const f of selected.slice(0,8))if(!seen.has(f.id)){seen.add(f.id);available.push(f);}
 }
 // Round-robin categories so a large weather feed cannot crowd out air or earthquake facts.
 const groups=Map.groupBy(available,f=>f.category),balanced=[];
 for(let i=0;balanced.length<21&&i<8;i++)for(const facts of groups.values())if(facts[i]&&balanced.length<21)balanced.push(facts[i]);
 return {json:{...base,environment_area:validArea?{id:area.id,source_node_id:area.source_node_id,name:area.name,latitude:area.latitude,longitude:area.longitude,coordinate_source:area.coordinate_source,timezone:area.timezone}:null,environment:[...balanced,...(base.disaster_news||[])].slice(0,24),environment_status:statuses,environment_scope:"Kabar bencana berlabel Indonesia mencakup nasional dan tidak membuktikan kejadian pada titik robot. Data lingkungan lainnya mengikuti koordinat node yang diizinkan dan terpisah dari pembacaan sensor AEROSENSE. Lokasi stasiun eksternal hanya diketahui bila penyedia menyertakannya; grid model bukan lokasi sensor.",hub_at:new Date(now).toISOString()}};
}
return prepareHubContext($("Muat konteks terbaru Web").first().json,$json);
