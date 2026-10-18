import type { LiveNode, Reading, EnvironmentFact, EnvironmentResponse, Alert } from "../types/live.types";

export const DEMO_NOTICE = "Data simulasi untuk pengambilan video, bukan hasil pengukuran lapangan atau kondisi terkini Surabaya.";
// Fixed synthetic deployment points across urban Surabaya, with irregular spacing.
const demoCoordinates = [
  [-7.2309,112.7227],[-7.2518,112.7083],[-7.2374,112.7486],[-7.2472,112.7802],
  [-7.2677,112.7282],[-7.2729,112.7541],[-7.2594,112.7705],[-7.2824,112.7896],
  [-7.2891,112.7148],[-7.3048,112.7366],[-7.2926,112.7642],[-7.3144,112.7861],
  [-7.3222,112.7162],[-7.3273,112.7549],[-7.2713,112.6901],[-7.3351,112.7798],
];
export const DEMO_POINTS = demoCoordinates.map(([latitude,longitude],i) => ({
  id:`demo-sby-${String(i+1).padStart(2,"0")}`,
  name:`Surabaya ${String(i+1).padStart(2,"0")}`,
  latitude,longitude,
}));
const round = (v:number, places=1) => Number(v.toFixed(places));
const iso = (v:number) => new Date(v).toISOString();
export function demoHistory(index:number, now=Date.now()): Reading[] {
  const end=Math.floor(now/60000)*60000-(index===15?45:1)*60000;
  return Array.from({length:96},(_,j)=>{
    const at=end-j*15*60000;
    const hour=new Date(at+7*3600000).getUTCHours();
    const daylight=Math.sin((hour-8)*Math.PI/12);
    const wave=Math.sin(j*0.29+index*0.8);
    const bump=[4,7,10].includes(index)?11*Math.exp(-Math.pow((j-4)/5,2)):0;
    const metrics={
      temperature_c:round(28.4+2.5*daylight+(index%4)*0.3+wave*0.15),
      humidity_pct:round(74-8*daylight-(index%3)*1.2-wave),
      tvoc_ppb:Math.round(95+index*6+14*wave+bump*3),
      eco2_ppm:Math.round(460+index*12+18*wave+bump*2),
      dust_ug_m3:round(22+index*1.3+3*wave+bump+([10,13].includes(index)?28:[4,7].includes(index)?10:0)),
    };
    return {id:`${DEMO_POINTS[index].id}-${j}`,node_id:DEMO_POINTS[index].id,
      observed_at:iso(at),metrics,raw_metrics:{...metrics,dust_ug_m3:round(metrics.dust_ug_m3+0.6*Math.cos(j*0.6))},
      gru:{target:"dust_ug_m3",value:round(metrics.dust_ug_m3+0.9*Math.sin(j*0.2+index)),model_version:"demo-illustration-not-inference",horizon_seconds:0},
      processing:{data_origin:"synthetic_demo",note:DEMO_NOTICE},
    };
  });
}
export function demoNodes(role="viewer",now=Date.now()):LiveNode[] {
  return DEMO_POINTS.map((p,i)=>{
    const reading=demoHistory(i,now)[0];
    const stale=i===15;
    return {...p,location_id:"demo-surabaya",gateway_id:`demo-gateway-${1+Math.floor(i/8)}`,
      pm25_validated:false,calibration_version:null,role,rules:demoRules(i,now),
      latest:{node_id:p.id,name:p.name,reading_id:reading.id,
        observed_at:reading.observed_at,
        received_at:iso(Date.parse(reading.observed_at)+1500),
        metrics:reading.metrics,gru:reading.gru,stale,pm25_validated:false,
        quality:{data_origin:"synthetic_demo",note:DEMO_NOTICE,...(stale?{reason:"Contoh keterlambatan kiriman"}:{})},
      },
    };
  });
}
export function demoRules(index:number,now=Date.now()) {
  const value=demoHistory(index,now)[0].metrics.dust_ug_m3!;
  return [{id:`demo-rule-${index}`,metric:"dust_ug_m3",high:40,danger_high:60,clear_below:35,
    unit:"µg/m³",cooldown_seconds:1800,enabled:true,active:value>=40,
    note:"Ambang skenario demo, bukan baku mutu atau kategori kesehatan."}];
}
export function demoAlerts(index:number,now=Date.now()):Alert[] {
  if(index<8 && ![4,7].includes(index))return [];
  return [{id:`demo-alert-${index}`,node_id:DEMO_POINTS[index].id,metric:"dust_ug_m3",
    value:round(42+index*1.2),threshold:40,unit:"µg/m³",created_at:iso(now-22*60000),
    acknowledged_at:index%3===0?iso(now-15*60000):null,
  }];
}
export function demoEnvironment(index:number,now=Date.now()):EnvironmentResponse {
  const point=DEMO_POINTS[index], areaId=`demo-area-${point.id}`;
  const valid=iso(now-5*60000),until=iso(now+3600000);
  const specs:[string,string,number|string,string,string,string][]=[
    ["weather","Suhu udara",31.2,"°C","model","Open-Meteo · simulasi"],
    ["weather","Kelembapan udara",68,"%","model","Open-Meteo · simulasi"],
    ["weather","Kecepatan angin",11.5,"km/jam","model","Open-Meteo · simulasi"],
    ["weather","Arah angin",110,"°","model","Open-Meteo · simulasi"],
    ["weather","Kode kondisi cuaca (WMO)",2,"","model","Open-Meteo · simulasi"],
    ["air_quality","Estimasi PM2.5 wilayah",18.6,"µg/m³","model","CAMS / Open-Meteo · simulasi"],
    ["air_quality","Estimasi AQI US wilayah, bukan ISPU",68,"indeks US AQI","model","CAMS / Open-Meteo · simulasi"],
    ["soil","Estimasi kadar air tanah 0–1 cm",0.29,"m³/m³","model","Open-Meteo · simulasi"],
    ["soil","Estimasi suhu tanah 0 cm",30.6,"°C","model","Open-Meteo · simulasi"],
    ["fire","Jumlah titik panas pada feed satelit 24 jam",0,"titik","satellite","FIRMS · simulasi"],
    ["flood","Prakiraan debit sungai",17.8,"m³/s","forecast","GloFAS / Open-Meteo · simulasi"],
    ["earthquake","Cakupan hasil gempa BMKG","Tidak ada entri pada daftar M5+ dalam radius skenario.","","event","BMKG · simulasi"],
  ];
  const facts:EnvironmentFact[]=specs.map(([category,label,value,unit,kind,source],i)=>({
    id:`${areaId}-fact-${i}`,area_id:areaId,category,label,value,unit,kind,source,
    source_url:category==="fire"?"https://firms.modaps.eosdis.nasa.gov/":category==="earthquake"?"https://data.bmkg.go.id/gempabumi/":"https://open-meteo.com/",
    valid_at:kind==="forecast"?iso(now+3600000):valid,fresh_until:until,stale:false,
    spatial_context:`Surabaya · titik simulasi ${point.latitude}, ${point.longitude}. ${DEMO_NOTICE}`,
    data_origin:"synthetic_demo",
  }));
  const summary:[string,string,string,string,string][]=[
    ["weather","Terasa hangat","Pilih tempat teduh saat beraktivitas di luar.","warm","current"],
    ["air_quality","Udara wilayah kategori sedang","Pantau perubahan udara sebelum aktivitas luar yang lama.","notice","current"],
    ["soil","Tanah permukaan cukup lembap","Sesuaikan penyiraman dengan kondisi tanah di lokasi.","calm","current"],
    ["fire","Tidak ada deteksi pada skenario ini","Ketiadaan deteksi satelit belum menjamin tidak ada kebakaran.","calm","monitoring"],
    ["flood","Pantau kondisi sungai setempat","Prakiraan debit tidak menentukan banjir pada rumah atau jalan tertentu.","neutral","forecast"],
    ["earthquake","Tidak ada entri pada skenario ini","Ikuti informasi resmi BMKG jika merasakan guncangan.","neutral","reference"],
  ];
  return {
    area:{id:areaId,name:`Surabaya · ${point.name}`,latitude:point.latitude,longitude:point.longitude,coordinate_source:"synthetic_robot_node"},
    facts,providers:[{provider:"synthetic_demo",last_attempt_at:valid,last_error:null,refresh_after:until,facts}],
    insights:summary.map(([category,title,action,tone,period])=>({category,title,body:DEMO_NOTICE,action,tone,period,
      available:true,fact_ids:facts.filter(f=>f.category===category).map(f=>f.id),valid_at:facts.find(f=>f.category===category)?.valid_at||valid,
      fresh_until:until,method:"scripted-demo"})),
    summary_method:"scripted-demo-not-live-api",fetched_at:iso(now),
  };
}
