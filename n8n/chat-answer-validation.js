const hub=$("Siapkan konteks hub Web").first().json;
const context=hub.context||[];
const direct=$("Periksa input Web").first().json.direct_route===true;
const refusal="Maaf, AERO-BOT hanya membantu pertanyaan tentang udara dan lingkungan. Silakan gunakan bahasa yang sopan.";
const allowed={dust_ug_m3:["Debu","µg/m³"],pm25_ug_m3:["PM2.5","µg/m³"],eco2_ppm:["eCO2","ppm"],tvoc_ppb:["TVOC","ppb"],temperature_c:["Suhu","°C"],humidity_pct:["Kelembapan","%"]};
const topics=["air_quality","pollution","waste","water","climate","ecosystems","greeting","weather","soil","fire","flood","earthquake","biodiversity"];
const clean=s=>String(s||"").replace(/[\r\n<>]/g," ").slice(0,100);
let result={answer:refusal,decision:"deny",provider_error:false};
try{
 let p;
 if(direct){
  p={decision:"allow",topic:"air_quality",answer:$("Ambil permintaan yang masuk").item.json.job.body?.presence===true?"Halo, selamat datang. Berikut pembacaan terakhir. Mari jaga udara di sekitar kita.":"Berikut pembacaan terakhir. Tetap jaga udara di sekitar kita.",readings:[],environment_refs:[]};
  for(const s of context)for(const metric of Object.keys(allowed)){
   if(p.readings.length>=8)break;
   if(s.quality?.invalid!==true&&Number.isFinite(s.metrics?.[metric])&&(metric!=="pm25_ug_m3"||s.pm25_validated))p.readings.push({node_id:s.node_id,metric,source:"measured"});
  }
  for(const s of context){const g=s.gru;if(p.readings.length<8&&g&&Object.hasOwn(allowed,g.target)&&Number.isFinite(g.value)&&s.quality?.invalid!==true&&(g.target!=="pm25_ug_m3"||s.pm25_validated))p.readings.push({node_id:s.node_id,metric:g.target,source:"gru"});}

  const air=(hub.environment||[]).filter(f=>f.category==="air_quality"&&!["forecast","historical"].includes(f.kind)&&Date.parse(f.valid_at)<=Date.now()+1800000&&Date.parse(f.fresh_until)>Date.now());
  const aqi=air.find(f=>/AQI US|US AQI/i.test(f.label)&&Number.isFinite(f.value)&&f.value>=0);
  p.environment_refs=[...(aqi?[aqi]:[]),...air.filter(f=>f!==aqi)].slice(0,3).map(f=>f.id);
  if(aqi){
   const condition=aqi.value<=50?"baik":aqi.value<=100?"sedang":aqi.value<=150?"kurang sehat bagi kelompok sensitif":aqi.value<=200?"tidak sehat":aqi.value<=300?"sangat tidak sehat":"berbahaya";
   p.answer=`Estimasi kualitas udara wilayah tergolong ${condition}. `+(p.readings.length?"Pembacaan sensor lokal juga tersedia sebagai informasi terpisah. ":"Pembacaan sensor lokal belum tersedia. ")+(aqi.value>100?"Kurangi aktivitas berat di luar, terutama bila sensitif terhadap polusi.":"Tetap hindari asap kendaraan dan pembakaran.");
  }else if(p.environment_refs.length)p.answer=p.readings.length?"Pembacaan sensor lokal dan estimasi polutan wilayah tersedia sebagai informasi terpisah. Indeks kualitas udara wilayah belum tersedia.":"Pembacaan sensor lokal belum tersedia. Estimasi polutan wilayah tersedia, tetapi indeks kualitas udaranya belum tersedia.";
 }else{
  const text=($json.candidates?.[0]?.content?.parts||[]).filter(p=>!p.thought).map(p=>p.text||"").join("").trim();
  if(!text)throw new Error("Respons Gemini kosong");
  p=JSON.parse(text);
 }
 if(!p||Array.isArray(p)||Object.keys(p).sort().join(",")!=="answer,decision,environment_refs,readings,topic"||!["allow","deny"].includes(p.decision)||typeof p.answer!=="string"||!Array.isArray(p.readings)||p.readings.length>8||!Array.isArray(p.environment_refs)||p.environment_refs.length>4)throw new Error("Format jawaban tidak valid");
 if(p.decision==="allow"){
  if(!topics.includes(p.topic)||!p.answer.trim()||p.answer.length>1000||/[0-9]|https?:|www\./i.test(p.answer))throw new Error("Isi jawaban tidak valid");
  // Only list where the information came from and when. No values, labels or links.
  const sources=new Map();const seen=new Set();
  const when=v=>{const d=Date.parse(v);return Number.isFinite(d)?new Date(d).toLocaleString("id-ID",{timeZone:"Asia/Jakarta",day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"})+" WIB":"";};
  const addSource=(name,time,stale)=>{const key=clean(name);if(!key)return;const t=Date.parse(time);const old=sources.get(key);if(!old||(Number.isFinite(t)&&t>old.t))sources.set(key,{t:Number.isFinite(t)?t:-1,label:when(time),stale:!!stale});};
  for(const ref of p.readings){
   if(!ref||Object.keys(ref).sort().join(",")!=="metric,node_id,source"||!Object.hasOwn(allowed,ref.metric)||!["measured","gru"].includes(ref.source))throw new Error("Referensi tidak valid");
   const s=context.find(s=>s.node_id===ref.node_id);
   if(!s||s.quality?.invalid===true||(ref.metric==="pm25_ug_m3"&&!s.pm25_validated))throw new Error("Sensor tidak diizinkan");
   const key=ref.node_id+":"+ref.metric+":"+ref.source;if(seen.has(key))throw new Error("Referensi duplikat");seen.add(key);
   const value=ref.source==="gru"?(s.gru?.target===ref.metric?s.gru.value:null):s.metrics?.[ref.metric];
   if(!Number.isFinite(value))throw new Error("Nilai sensor tidak tersedia");
   addSource("Sensor AEROSENSE "+(s.name||s.node_id),s.observed_at,s.stale);
  }
  for(const id of p.environment_refs){
   if(typeof id!=="string"||seen.has(id))throw new Error("Referensi lingkungan tidak valid");
   const f=hub.environment.find(f=>f.id===id);
   const national=f&&f.area_id==="indonesia"&&["news","monitoring_notification"].includes(f.kind)&&(hub.disaster_news||[]).some(n=>n.id===id&&n.source_url===f.source_url);
   if(!f||(!national&&f.area_id!==hub.environment_area?.id)||f.data_origin!=="external_api"||f.role!=="supplementary"||!Number.isFinite(Date.parse(f.fresh_until))||Date.parse(f.fresh_until)<=Date.now())throw new Error("Fakta lingkungan tidak tersedia");
   if(!(typeof f.value==="string"&&f.value.length>0)&&!Number.isFinite(f.value))throw new Error("Nilai lingkungan kosong");
   seen.add(id);
   addSource(f.source||"Sumber eksternal",f.valid_at,false);
  }
  const lines=[];
  if(sources.size)lines.push("","Sumber: "+[...sources].map(([name,v])=>name+(v.label?" ("+v.label+(v.stale?", data lama":"")+")":"")).join("; ")+".");
  else if(p.topic==="air_quality")lines.push("",context.some(s=>s.quality?.invalid===true)?"Pembacaan sensor ditandai tidak valid. Periksa sensor.":context.length?"Pembacaan lengkap tersedia di dashboard.":"Data sensor belum tersedia.");
  const answer=[p.answer.trim(),...lines].join("\n");
  if(answer.length>2000)throw new Error("Jawaban terlalu panjang");
  result={answer,decision:"allow",provider_error:false};
 }
}catch{result={answer:"",decision:"deny",provider_error:true};}
return {json:result};
