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

  if(!p.readings.length){
   p.environment_refs=(hub.environment||[]).filter(f=>f.category==="air_quality").slice(0,3).map(f=>f.id);
   if(p.environment_refs.length)p.answer="Pembacaan sensor lokal belum tersedia. Berikut data kualitas udara wilayah sebagai pendamping.";
  }
 }else{
  const text=($json.candidates?.[0]?.content?.parts||[]).filter(p=>!p.thought).map(p=>p.text||"").join("").trim();
  if(!text)throw new Error("Respons Gemini kosong");
  p=JSON.parse(text);
 }
 if(!p||Array.isArray(p)||Object.keys(p).sort().join(",")!=="answer,decision,environment_refs,readings,topic"||!["allow","deny"].includes(p.decision)||typeof p.answer!=="string"||!Array.isArray(p.readings)||p.readings.length>8||!Array.isArray(p.environment_refs)||p.environment_refs.length>4)throw new Error("Format jawaban tidak valid");
 if(p.decision==="allow"){
  if(!topics.includes(p.topic)||!p.answer.trim()||p.answer.length>1000||/[0-9]|https?:|www\./i.test(p.answer))throw new Error("Isi jawaban tidak valid");
  // Short, readable lines: value, source name and time only. No links; sources are named.
  const sensorLines=[],envLines=[],newsLines=[];const seen=new Set();
  const short=s=>{const t=String(s||"").replace(/[\r\n<>]/g," ").replace(/\s+/g," ").trim();return t.length>90?t.slice(0,87).trim()+"…":t;};
  const when=v=>{const d=Date.parse(v);return Number.isFinite(d)?new Date(d).toLocaleString("id-ID",{timeZone:"Asia/Jakarta",day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"})+" WIB":"";};
  for(const ref of p.readings){
   if(!ref||Object.keys(ref).sort().join(",")!=="metric,node_id,source"||!Object.hasOwn(allowed,ref.metric)||!["measured","gru"].includes(ref.source))throw new Error("Referensi tidak valid");
   const s=context.find(s=>s.node_id===ref.node_id);
   if(!s||s.quality?.invalid===true||(ref.metric==="pm25_ug_m3"&&!s.pm25_validated))throw new Error("Sensor tidak diizinkan");
   const key=ref.node_id+":"+ref.metric+":"+ref.source;if(seen.has(key))throw new Error("Referensi duplikat");seen.add(key);
   const value=ref.source==="gru"?(s.gru?.target===ref.metric?s.gru.value:null):s.metrics?.[ref.metric];
   if(!Number.isFinite(value))throw new Error("Nilai sensor tidak tersedia");
   const name=allowed[ref.metric][0]+(ref.source==="gru"?" (perkiraan GRU)":"");
   sensorLines.push("• "+clean(s.name||s.node_id)+": "+name+" "+value+" "+allowed[ref.metric][1]+" · "+(when(s.observed_at)||"waktu belum tersedia")+(s.stale?" (data lama)":""));
  }
  const kinds={monitoring_notification:"pantauan model",model:"model",forecast:"prakiraan",satellite:"satelit",static_model:"perkiraan"};
  for(const id of p.environment_refs){
   if(typeof id!=="string"||seen.has(id))throw new Error("Referensi lingkungan tidak valid");
   const f=hub.environment.find(f=>f.id===id);
   const national=f&&f.area_id==="indonesia"&&["news","monitoring_notification"].includes(f.kind)&&(hub.disaster_news||[]).some(n=>n.id===id&&n.source_url===f.source_url);
   if(!f||(!national&&f.area_id!==hub.environment_area?.id)||f.data_origin!=="external_api"||f.role!=="supplementary"||!Number.isFinite(Date.parse(f.fresh_until))||Date.parse(f.fresh_until)<=Date.now())throw new Error("Fakta lingkungan tidak tersedia");
   if(!(typeof f.value==="string"&&f.value.length>0)&&!Number.isFinite(f.value))throw new Error("Nilai lingkungan kosong");
   seen.add(id);
   const label=short(String(f.label||"").replace(/^Kabar bencana Indonesia\s*·\s*/i,""));
   const source=[clean(f.source),kinds[f.kind]].filter(Boolean).join(", ");
   const meta=[source,when(f.valid_at)].filter(Boolean).join(" · ");
   (national?newsLines:envLines).push("• "+(label?label+": ":"")+short(f.value)+(f.unit?" "+clean(f.unit):"")+(meta?" · "+meta:""));
  }
  const lines=[];
  if(sensorLines.length)lines.push("","Data sensor:",...sensorLines);
  if(envLines.length)lines.push("","Data lingkungan"+(hub.environment_area?.name?" sekitar "+clean(hub.environment_area.name):"")+":",...envLines);
  if(newsLines.length)lines.push("","Berita nasional:",...newsLines);
  if(!lines.length&&p.topic==="air_quality")lines.push("",context.some(s=>s.quality?.invalid===true)?"Pembacaan tersedia tetapi ditandai tidak valid. Periksa sensor.":context.length?"Pembacaan lengkap tersedia di dashboard.":"Data sensor belum tersedia.");
  const answer=[p.answer.trim(),...lines].join("\n");
  if(answer.length>2000)throw new Error("Jawaban terlalu panjang");
  result={answer,decision:"allow",provider_error:false};
 }
}catch{result={answer:"",decision:"deny",provider_error:true};}
return {json:result};