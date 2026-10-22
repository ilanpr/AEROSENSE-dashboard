import type { User } from "@supabase/supabase-js";
import { DEMO_POINTS, DEMO_NOTICE, demoNodes, demoHistory, demoEnvironment, demoRules, demoAlerts } from "./data.ts";
import { getDemoUser } from "./session.ts";
import type { EnvironmentResponse } from "../types/live.types.ts";

async function publicData(path:string,signal?:AbortSignal|null) {
  const response=await fetch(path,{signal:signal??AbortSignal.timeout(20000)});
  if(!response.ok)throw Error("Sumber publik belum tersedia.");
  return response.json();
}

const jobs = new Map<string,{id:string;status:string;result:{text:string;denied:boolean}}>();
const acknowledgements = new Set<string>();
export async function demoRequest(endpoint:string, options:RequestInit={}, account:User|null=getDemoUser()):Promise<unknown> {
  if(options.signal?.aborted)throw new DOMException("Aborted","AbortError");
  const url=new URL(endpoint,"https://demo.invalid"),p=url.pathname;
  const post=options.method && options.method!=="GET";
  const body=options.body?JSON.parse(String(options.body)):{};
  if(p==="/v1/disasters")return publicData("/demo-public/disasters",options.signal);
  const publicReads = new Set(["/v1/dashboard","/v1/nodes","/v1/history","/v1/rules","/v1/alerts","/v1/environment"]);
  if(!account && (post || !publicReads.has(p)))throw new Error("Masuk dengan akun warga atau administrator.");
  const role=account?.app_metadata.demo_role==="admin"?"admin":"viewer";
  const index=DEMO_POINTS.findIndex(n=>n.id===(url.searchParams.get("node_id")||body.node_id));
  const nodes=demoNodes(role);
  if(p==="/v1/access")return {can_audit_esg:role==="admin"};
  if((p==="/v1/dashboard"||p==="/v1/nodes") && !post)return {nodes,refreshed_at:new Date().toISOString()};
  if(p==="/v1/esg/report"){
    if(role!=="admin")throw new Error("Laporan lingkungan memerlukan akses administrator.");
    const report_scope={type:"synthetic_demo",assurance_status:"not_assured",source_attribution:"not_determined",max_readings_per_node:288,note:DEMO_NOTICE};
    if(url.searchParams.has("node_id")){
      if(index<0)throw new Error("Lokasi sensor tidak ditemukan.");
      return {readings:demoHistory(index),report_scope};
    }
    return {nodes,report_scope,refreshed_at:new Date().toISOString()};
  }
  if(p==="/v1/history"||p==="/v1/rules"||p==="/v1/alerts"||p==="/v1/environment"){
    if(index<0)throw new Error("Pilih lokasi sensor di Surabaya.");
    if(post)throw new Error("Aturan pada data simulasi bersifat hanya baca.");
    if(p==="/v1/history")return {readings:demoHistory(index)};
    if(p==="/v1/rules")return {rules:demoRules(index)};
    if(p==="/v1/alerts")return {alerts:demoAlerts(index).map(a=>acknowledgements.has(a.id)?{...a,acknowledged_at:new Date().toISOString()}:a)};
    const base=demoEnvironment(index);
    const keep=(category:string)=>!["fire","earthquake"].includes(category);
    try {
      const live=await publicData(`/demo-public/environment?node_id=${encodeURIComponent(DEMO_POINTS[index].id)}`,options.signal) as EnvironmentResponse;
      return {...base,events:live.events,event_layers:live.event_layers,facts:[...base.facts.filter(f=>keep(f.category)),...live.facts],insights:[...base.insights.filter(i=>keep(i.category)),...live.insights],providers:[...base.providers,...live.providers],fetched_at:live.fetched_at};
    }catch {
      return {...base,events:[],event_layers:[],facts:base.facts.filter(f=>keep(f.category)),insights:base.insights.map(i=>keep(i.category)?i:{...i,available:false,title:"Sumber publik belum tersedia",action:"Coba perbarui kembali.",fact_ids:[]})};
    }
  }
  if(p==="/v1/alerts/ack"){
    if(role!=="admin")throw new Error("Peninjauan peringatan memerlukan akses administrator.");
    acknowledgements.add(body.id);return {ok:true};
  }
  if(p==="/v1/robots")return {robots:[]};
  if(p==="/v1/subscriptions")return {subscriptions:[]};
  if(p==="/v1/whatsapp/pair")throw new Error("WhatsApp tidak mengirim pesan pada mode demo.");
  if(p==="/v1/chat" && post){
    const text=String(body.text||"").toLowerCase();
    const nodeIndex=Math.max(0,index),node=nodes[nodeIndex];
    const m=node.latest!.metrics;
    let answer="Saya dapat membantu menjelaskan kualitas udara, cuaca, dan kondisi lingkungan. Pilih lokasi sensor sebagai acuan pertanyaan Anda.";
    if(/cuaca|hujan|panas/.test(text))answer="Dalam skenario Surabaya, suhu wilayah 31,2 °C, kelembapan 68%, dan angin 11,5 km/jam. Terasa hangat. Pilih tempat teduh saat beraktivitas di luar. Ini contoh informasi wilayah, terpisah dari sensor lokal.";
    else if(/tanah|siram/.test(text))answer="Pada skenario ini, kadar air tanah permukaan diperkirakan 29% volume dan suhu tanah 30,6 °C. Periksa tanah di lokasi sebelum menyiram. Data ini simulasi model wilayah, bukan hasil pengujian tanah.";
    else if(/karhutla|kebakaran|bencana/.test(text))answer="Buka Hub lingkungan atau Peta sensor untuk melihat feed publik terbaru beserta waktu dan sumbernya. Titik panas satelit belum berarti kebakaran terkonfirmasi. Bantuan dapat disalurkan lewat kanal resmi PMI. Lihat pembaruan kejadian beserta waktu dan sumbernya di Hub lingkungan.";
    else if(/esg|emisi|industri|karbon/.test(text))answer="Pembacaan di sekitar industri membantu pemeriksaan kondisi udara. Data ini belum menetapkan asal pencemar, jumlah emisi, atau kepatuhan ESG. eCO₂ sensor berbeda dari CO₂e inventaris gas rumah kaca. Gunakan laporan pemantauan sebagai bahan koordinasi dengan pengelola lingkungan.";
    else if(/udara|sensor|node|debu|kondisi/.test(text))answer=`Contoh pembacaan ${node.name}: debu optik ${m.dust_ug_m3} µg/m³, eCO₂ ${m.eco2_ppm} ppm, dan suhu ${m.temperature_c} °C. ${Number(m.dust_ug_m3)>=40?"Debu melewati ambang skenario. Periksa kondisi lokasi dan perangkat.":"Debu berada di bawah ambang skenario."} Debu optik belum disebut PM2.5 tervalidasi. Data wilayah tambahan: US AQI 68.`;
    const id=crypto.randomUUID();
    jobs.set(id,{id,status:"done",result:{text:"Jawaban contoh · "+answer,denied:false}});
    return {id,status:"pending"};
  }
  if(p==="/v1/jobs"){
    const job=jobs.get(url.searchParams.get("id")||"");
    if(!job)throw new Error("Pertanyaan demo tidak ditemukan; kirim ulang.");
    return job;
  }
  throw new Error("Tindakan ini tidak tersedia pada data simulasi.");
}
