// Ringkasan singkat dari fakta yang masih berlaku. Tidak memakai Gemini.
/* oxlint-disable no-control-regex */
function summarizeEnvironment(facts, now = Date.now()) {
  const time = (f) => Date.parse(f.valid_at || f.fetched_at || "") || 0;
  const day = (t) => new Date(t + 7 * 3600000).toISOString().slice(0, 10);
  const fresh = facts.filter(
    (f) => !f.stale && Date.parse(f.fresh_until) > now,
  );
  const current = fresh
    .filter(
      (f) =>
        !["forecast", "historical", "event", "static_model"].includes(f.kind) &&
        (f.valid_at
          ? time(f) > 0 && time(f) <= now + 1800000
          : f.kind === "satellite"),
    )
    .sort((a, b) => time(b) - time(a));
  const match = (list, category, pattern) =>
    list.find(
      (f) =>
        f.category === category &&
        pattern.test(f.label) &&
        typeof f.value === "number" &&
        Number.isFinite(f.value),
    );
  const out = [];
  function add(
    category,
    title,
    body,
    action,
    used = [],
    tone = "neutral",
    period = "current",
  ) {
    out.push({
      category,
      title,
      body,
      action,
      tone,
      period,
      available: used.length > 0,
      fact_ids: used.map((f) => f.id),
      valid_at: used[0]?.valid_at || null,
      fresh_until:
        used
          .map((f) => f.fresh_until)
          .filter(Boolean)
          .sort()[0] || null,
      method: "rules-v1",
    });
  }
  const temp = match(current, "weather", /^Suhu udara$/i);
  const rain = match(current, "weather", /Presipitasi interval/i);
  const today = fresh
    .filter(
      (f) => f.kind === "forecast" && f.valid_at && day(time(f)) === day(now),
    )
    .sort((a, b) => time(a) - time(b));
  const chance = match(today, "weather", /peluang presipitasi/i);
  if (rain && rain.value > 0)
    add(
      "weather",
      "Ada hujan dalam estimasi cuaca",
      "Model wilayah menunjukkan hujan pada interval terbaru.",
      "Siapkan payung sebelum keluar.",
      [rain, ...(temp ? [temp] : [])],
      "notice",
    );
  else if (temp)
    add(
      "weather",
      temp.value >= 32
        ? "Cuaca cenderung panas"
        : temp.value >= 26
          ? "Cuaca cenderung hangat"
          : "Cuaca cenderung sejuk",
      chance && chance.value >= 60
        ? "Prakiraan hari ini juga menunjukkan peluang hujan."
        : `Suhu wilayah diperkirakan sekitar ${Math.round(temp.value)}°C. Kondisi di tiap lokasi bisa berbeda.`,
      chance && chance.value >= 60
        ? "Bawa payung untuk berjaga-jaga."
        : temp.value >= 26
          ? "Pilih tempat teduh saat beraktivitas di luar."
          : "Sesuaikan pakaian agar tetap nyaman.",
      [temp, ...(chance ? [chance] : [])],
      temp.value >= 32 ? "warm" : "calm",
    );
  else if (chance)
    add(
      "weather",
      "Ada prakiraan untuk hari ini",
      "Pembacaan cuaca saat ini belum tersedia.",
      chance.value >= 60
        ? "Siapkan payung; ada peluang hujan."
        : "Lihat prakiraan sebelum beraktivitas.",
      [chance],
      "neutral",
      "forecast",
    );
  else
    add(
      "weather",
      "Cuaca terbaru belum tersedia",
      "Kami belum punya data yang cukup baru untuk merangkum cuaca.",
      "Coba perbarui beberapa saat lagi.",
    );
  const aqi = match(current, "air_quality", /(AQI US|US AQI)/i);
  if (aqi && aqi.value >= 0) {
    const bands = [
      [
        50,
        "Kualitas udara diperkirakan baik",
        "Kategori baik menurut indeks US AQI wilayah.",
        "Tetap pilih rute yang jauh dari asap kendaraan.",
        "calm",
      ],
      [
        100,
        "Kualitas udara diperkirakan sedang",
        "Udara mungkin kurang nyaman bagi orang yang sangat sensitif.",
        "Perhatikan kenyamanan saat beraktivitas di luar.",
        "notice",
      ],
      [
        150,
        "Udara kurang sehat bagi kelompok sensitif",
        "Anak-anak, lansia, dan orang dengan gangguan pernapasan perlu lebih berhati-hati.",
        "Kurangi aktivitas berat di luar bila Anda sensitif.",
        "warning",
      ],
      [
        200,
        "Udara diperkirakan tidak sehat",
        "Polusi dapat berdampak pada lebih banyak orang.",
        "Kurangi aktivitas berat atau lama di luar ruang.",
        "warning",
      ],
      [
        300,
        "Udara diperkirakan sangat tidak sehat",
        "Tingkat polusi wilayah memerlukan perhatian lebih.",
        "Pindahkan kegiatan luar ruang ke dalam bila memungkinkan.",
        "danger",
      ],
      [
        Infinity,
        "Udara diperkirakan berbahaya",
        "Indeks polusi wilayah berada pada kategori tertinggi.",
        "Hindari aktivitas luar ruang dan ikuti arahan resmi.",
        "danger",
      ],
    ];
    const [, title, body, action, tone] = bands.find(
      ([max]) => aqi.value <= max,
    );
    add("air_quality", title, body, action, [aqi], tone);
  } else
    add(
      "air_quality",
      "Kondisi udara belum dapat disimpulkan",
      "Indeks kualitas udara terbaru belum tersedia.",
      "Rincian polutan yang tersedia tetap bisa dilihat.",
    );
  const soil = match(current, "soil", /kadar air tanah/i);
  const profile = fresh.filter((f) => f.category === "soil_profile");
  if (soil)
    add(
      "soil",
      "Kenali kondisi tanah permukaan",
      "Estimasi kadar air tanah tersedia untuk lapisan paling atas.",
      "Cek tanah langsung sebelum menentukan kebutuhan siram.",
      [soil],
      "calm",
    );
  else if (profile.length)
    add(
      "soil",
      "Profil tanah tersedia sebagai acuan",
      "Peta sifat tanah memberi gambaran umum, bukan kondisi tanah saat ini.",
      "Gunakan pengukuran setempat untuk keputusan perawatan.",
      profile.slice(0, 2),
      "neutral",
      "reference",
    );
  else
    add(
      "soil",
      "Tanah belum memiliki pembaruan",
      "Belum ada estimasi tanah terbaru untuk area ini.",
      "Cek kondisi tanah langsung bila diperlukan.",
    );
  const fire = match(current, "fire", /Jumlah titik panas/i);
  if (fire)
    add(
      "fire",
      fire.value > 0
        ? "Ada titik panas pada pantauan satelit"
        : "Tidak ada titik panas dalam hasil satelit",
      "Cakupan pantauan adalah feed 24 jam pada radius yang ditetapkan.",
      fire.value > 0
        ? "Cek lokasi dan informasi resmi. Titik panas belum tentu kebakaran."
        : "Hasil ini bukan jaminan tidak ada kebakaran.",
      [fire],
      fire.value > 0 ? "warning" : "neutral",
      "monitoring",
    );
  else
    add(
      "fire",
      "Pantauan titik panas belum tersedia",
      "Feed satelit untuk area ini belum diperbarui.",
      "Gunakan informasi resmi untuk memeriksa kejadian.",
    );
  const river = match(
    fresh
      .filter(
        (f) =>
          f.kind === "forecast" &&
          time(f) >= now &&
          time(f) <= now + 48 * 3600000,
      )
      .sort((a, b) => time(a) - time(b)),
    "flood",
    /debit sungai/i,
  );
  if (river)
    add(
      "flood",
      "Ada prakiraan aliran sungai",
      "Model memperkirakan debit sungai di grid sekitar wilayah.",
      "Lihat peringatan resmi untuk memastikan risiko banjir.",
      [river],
      "neutral",
      "forecast",
    );
  else
    add(
      "flood",
      "Prakiraan sungai belum tersedia",
      "Belum ada prakiraan debit untuk hari ini.",
      "Pantau informasi resmi bila hujan meningkat.",
    );
  const quakes = fresh.filter((f) => f.category === "earthquake");
  if (quakes.length)
    add(
      "earthquake",
      "Lihat catatan gempa dari BMKG",
      "Daftar ini memuat catatan M5+ yang tercakup di sekitar area.",
      "Buka rincian untuk waktu kejadian dan informasi resminya.",
      quakes.slice(0, 2),
      "neutral",
      "reference",
    );
  else
    add(
      "earthquake",
      "Catatan gempa belum diperbarui",
      "Data yang tersedia belum cukup baru untuk ditampilkan.",
      "Cek BMKG untuk informasi kejadian terkini.",
    );
  const species = fresh.filter((f) => f.category === "biodiversity");
  if (species.length)
    add(
      "biodiversity",
      "Kenali ragam hayati sekitar",
      "Ada catatan pengamatan spesies dari kawasan ini.",
      "Jelajahi catatannya; ini bukan pemantauan satwa saat ini.",
      species.slice(0, 3),
      "calm",
      "reference",
    );
  else
    add(
      "biodiversity",
      "Catatan hayati belum tersedia",
      "Belum ada catatan spesies yang sesuai area.",
      "Catatan pengamatan akan tampil saat sumber tersedia.",
    );
  return out;
}
function normalizeResponse(response, request, now = Date.now()) {
  const fetched_at=new Date(now).toISOString();
  const clean=v=>String(v??'').replace(/[<>\r\n\u0000-\u001f]/g,' ').trim().slice(0,180);
  const iso=v=>{
    if(v===null||v===undefined||v==='')return null;
    if(typeof v==='number')return Number.isFinite(v)?new Date(v*1000).toISOString():null;
    const s=String(v).replace(/^(\d{4}-\d\d-\d\d) (\d\d:\d\d:\d\d)$/, '$1T$2');
    const naive=/^\d{4}-\d\d-\d\dT\d\d:\d\d(?::\d\d)?$/.test(s);
    const offset=request.provider.startsWith('openmeteo_')&&Number.isFinite(d?.utc_offset_seconds)?d.utc_offset_seconds:0;
    const t=Date.parse(naive?s+'Z':s)-(naive?offset*1000:0);
    return Number.isFinite(t)?new Date(t).toISOString():null;
  };
  const distance=(a,b,c,d)=>{const r=x=>x*Math.PI/180;const h=Math.sin(r(c-a)/2)**2+Math.cos(r(a))*Math.cos(r(c))*Math.sin(r(d-b)/2)**2;return 6371*2*Math.asin(Math.sqrt(Math.min(1,h)));};
  function csv(text){let rows=[],row=[],cell='',quoted=false;for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;}else if(c===','&&!quoted){row.push(cell);cell='';}else if(c==='\n'&&!quoted){row.push(cell.replace(/\r$/,''));rows.push(row);row=[];cell='';}else cell+=c;}if(cell||row.length){row.push(cell);rows.push(row);}const header=rows.shift()||[];if(!header.includes('latitude')||!header.includes('acq_date'))throw Error('Skema CSV FIRMS berubah');return rows.filter(r=>r.length===header.length).map(r=>Object.fromEntries(header.map((k,i)=>[k,r[i]])));}
  let d=response.body??response;
  let error=null;
  try {
    if(response.error || (response.statusCode && response.statusCode>=400))throw Error('Provider tidak tersedia');
    if(typeof d==='string' && request.provider!=='firms')d=JSON.parse(d);
    if(d?.status==='fail'||d?.error)throw Error('Provider menolak permintaan');
    if(request.provider==='firms')d=csv(typeof d==='string'?d:String(d?.data||''));
  }catch{error='Permintaan gagal atau format respons tidak sesuai';}
  const sourceError=error;
  const entries=[];
  for(const n of request.targets||[]){
    error=sourceError;
    const facts=[];
    const reference={id:n.id,name:clean(n.name||n.id),latitude:n.latitude,longitude:n.longitude,coordinate_source:n.coordinate_source||'configured_reference',timezone:n.timezone||'Asia/Jakarta'};
    let provider_coordinates=null, distance_km=null;
    const coordinate=(lat,lon)=>Number.isFinite(lat)&&Number.isFinite(lon)&&Math.abs(lat)<=90&&Math.abs(lon)<=180;
    let spatial_context=`Wilayah sekitar ${clean(n.name||n.id)}`;
    if(coordinate(d?.latitude,d?.longitude)){provider_coordinates={latitude:d.latitude,longitude:d.longitude,kind:'model_grid'};distance_km=distance(n.latitude,n.longitude,d.latitude,d.longitude);spatial_context+=`; pusat grid model ${d.latitude}, ${d.longitude}, sekitar ${distance_km.toFixed(1)} km dari acuan robot`;}
    const maxGridDistance={openmeteo_weather:50,openmeteo_air:100,openmeteo_flood:25}[request.provider];
    if(!error&&maxGridDistance&&(!provider_coordinates||distance_km>maxGridDistance))error='Grid penyedia tidak cocok dengan area acuan robot';
    const add=(key,category,label,value,unit,valid_at,kind,max_age=21600,extra={})=>{
      if(value===null||value===undefined||(typeof value==='number'&&!Number.isFinite(value)))return;
      if(!['string','number'].includes(typeof value))return;
      if(typeof value==='number' && category!=='weather' && category!=='soil' && value<0)return;
      const valid=iso(valid_at);
      if(['model','regional'].includes(kind)&&['weather','soil','air_quality'].includes(category)&&(!valid||Date.parse(valid)>now+1800000))return;
      if(valid && Date.parse(valid)>now+8*86400000)return;
      const historical=['soil_profile','biodiversity','earthquake','fire'].includes(category);
      const fresh_until=new Date(historical||!valid?now+max_age*1000:Date.parse(valid)+max_age*1000).toISOString();
      facts.push({id:`${request.provider}:${n.id}:${key}:${valid||'static'}`,area_id:n.id,provider:request.provider,category,label:clean(label),value:typeof value==='number'?value:clean(value),unit:clean(unit),valid_at:valid,fresh_until,source:request.source,source_url:request.source_url,kind,spatial_context,data_origin:'external_api',role:'supplementary',reference,provider_coordinates,provider_location_known:provider_coordinates!==null,distance_km,...extra});
    };
    if(!error)try{
      if(request.provider==='openmeteo_weather'){
        if(!d.current||!d.hourly)throw Error('Data cuaca kosong');
        const labels={temperature_2m:['Suhu udara','°C'],relative_humidity_2m:['Kelembapan udara','%'],precipitation:['Presipitasi interval saat ini','mm'],wind_speed_10m:['Kecepatan angin','km/jam']};
        for(const [k,[label,unit]] of Object.entries(labels))add(k,'weather',label,d.current[k],unit,d.current.time,'model');
        const hi=d.hourly.time.findLastIndex(t=>Date.parse(iso(t))<=now);
        if(hi>=0){add('soil_t','soil','Estimasi suhu tanah permukaan',d.hourly.soil_temperature_0cm?.[hi],'°C',d.hourly.time[hi],'model');add('soil_m','soil','Estimasi kadar air tanah 0–1 cm',d.hourly.soil_moisture_0_to_1cm?.[hi],'m³/m³',d.hourly.time[hi],'model');}
        const daily={temperature_2m_max:['Prakiraan suhu maksimum','°C'],temperature_2m_min:['Prakiraan suhu minimum','°C'],precipitation_sum:['Prakiraan total presipitasi','mm'],precipitation_probability_max:['Prakiraan peluang presipitasi maksimum','%'],uv_index_max:['Prakiraan indeks UV maksimum','']};
        for(let i=0;i<(d.daily?.time||[]).length;i++)for(const [k,[label,unit]]of Object.entries(daily))add(k+i,'weather',`${label} (hari WIB ${d.daily.time[i]})`,d.daily[k]?.[i],unit,d.daily.time[i]+'T23:59:59','forecast',10800);
      }else if(request.provider==='openmeteo_air'){
        if(!d.current)throw Error('Data polutan kosong');
        const labels={pm2_5:'Estimasi PM2.5 wilayah',pm10:'Estimasi PM10 wilayah',carbon_monoxide:'Estimasi CO wilayah',nitrogen_dioxide:'Estimasi NO₂ wilayah',sulphur_dioxide:'Estimasi SO₂ wilayah',ozone:'Estimasi ozon wilayah',us_aqi:'Estimasi AQI US wilayah, bukan ISPU'};
        for(const[k,label]of Object.entries(labels))add(k,'air_quality',label,d.current[k],k==='us_aqi'?'indeks US AQI':'µg/m³',d.current.time,'model',21600);
      }else if(request.provider==='openmeteo_flood'){
        if(!d.daily?.time)throw Error('Data debit kosong');
        for(let i=0;i<d.daily.time.length;i++)add('discharge'+i,'flood',`Prakiraan debit sungai grid sekitar 5 km (hari UTC ${d.daily.time[i]})`,d.daily.river_discharge?.[i],'m³/s',d.daily.time[i]+'T23:59:59Z','forecast',86400);
      }else if(request.provider==='soilgrids'){
        if(!Array.isArray(d.properties?.layers))throw Error('Data sifat tanah kosong');
        const labels={phh2o:'Estimasi pH tanah 0–5 cm',soc:'Estimasi karbon organik tanah 0–5 cm',clay:'Estimasi fraksi lempung 0–5 cm',sand:'Estimasi fraksi pasir 0–5 cm'};
        for(const layer of d.properties.layers){const raw=layer.depths?.[0]?.values?.mean,factor=layer.unit_measure?.d_factor;if(labels[layer.name]&&Number.isFinite(raw)&&Number.isFinite(factor)&&factor>0)add(layer.name,'soil_profile',labels[layer.name],raw/factor,layer.name==='phh2o'?'pH':layer.unit_measure.target_units,null,'static_model',2592000,{spatial_context:spatial_context+'; estimasi peta tanah sekitar 250 m'});}
      }else if(request.provider==='iqair'){
        if(d.status!=='success'||!d.data?.current?.pollution)throw Error('Data IQAir kosong');
        const p=d.data.current.pollution,c=d.data;
        const xy=c.location?.coordinates;
        if(Array.isArray(xy)&&coordinate(xy[1],xy[0])){provider_coordinates={latitude:xy[1],longitude:xy[0],kind:'provider_reported_location'};distance_km=distance(n.latitude,n.longitude,xy[1],xy[0]);if(distance_km>100)throw Error('Lokasi IQAir terlalu jauh dari robot');}
        spatial_context=`Kota terdekat IQAir: ${clean(c.city)}, ${clean(c.state)}; lokasi titik pengamatan sebenarnya belum tentu diketahui, bukan sensor AEROSENSE`;
        add('aqius','air_quality','AQI US wilayah dari IQAir',p.aqius,'indeks US AQI',p.ts,'regional',21600);
        const names={p2:'PM2.5',p1:'PM10',o3:'Ozon',n2:'NO₂',s2:'SO₂',co:'CO'};
        if(names[p.mainus])add('main','air_quality','Polutan utama menurut indeks IQAir',names[p.mainus],'',p.ts,'regional',21600);
      }else if(request.provider==='bmkg_weather'){
        const forecasts=(d.data||[]).flatMap(x=>(x.cuaca||[]).flat()).filter(x=>iso(x.utc_datetime)).sort((a,b)=>Date.parse(iso(a.utc_datetime))-Date.parse(iso(b.utc_datetime)));
        const upcoming=forecasts.filter(x=>Date.parse(iso(x.utc_datetime))>=now-3*3600000).slice(0,5);
        if(!upcoming.length)throw Error('Prakiraan BMKG tidak tersedia');
        spatial_context=`Desa/kelurahan BMKG: ${clean(d.lokasi?.desa||'')} ${clean(d.lokasi?.kecamatan||'')}`;
        for(let i=0;i<upcoming.length;i++){const x=upcoming[i];add('weather'+i,'weather','Prakiraan kondisi cuaca BMKG',x.weather_desc,'',x.utc_datetime,'forecast',10800);add('temp'+i,'weather','Prakiraan suhu BMKG',x.t,'°C',x.utc_datetime,'forecast',10800);add('humidity'+i,'weather','Prakiraan kelembapan BMKG',x.hu,'%',x.utc_datetime,'forecast',10800);}
      }else if(request.provider==='firms'){
        const rows=d.map(x=>({...x,lat:Number(x.latitude),lon:Number(x.longitude),at:iso(x.acq_date+'T'+String(x.acq_time).padStart(4,'0').slice(0,2)+':'+String(x.acq_time).padStart(4,'0').slice(2)+':00Z')})).filter(x=>x.at&&now-Date.parse(x.at)<=86400000&&Date.parse(x.at)<=now&&Number.isFinite(x.lat)&&Number.isFinite(x.lon));
        const nearby=rows.filter(x=>distance(n.latitude,n.longitude,x.lat,x.lon)<=request.radius_km).sort((a,b)=>Date.parse(b.at)-Date.parse(a.at));
        spatial_context=`Dalam radius ${request.radius_km} km dari ${clean(n.name||n.id)}; feed satelit 24 jam`;
        add('hotspots','fire','Jumlah titik panas yang tercantum pada feed satelit 24 jam, bukan jumlah kebakaran terkonfirmasi',nearby.length,'titik',null,'satellite',7200);
        if(nearby[0]){const x=nearby[0];add('latest','fire','Titik panas satelit terbaru dalam hasil',`koordinat ${x.lat}, ${x.lon}; confidence ${clean(x.confidence)}; jarak ${distance(n.latitude,n.longitude,x.lat,x.lon).toFixed(1)} km`,'',x.at,'satellite',7200,{provider_coordinates:{latitude:x.lat,longitude:x.lon,kind:'satellite_detection'},provider_location_known:true,distance_km:distance(n.latitude,n.longitude,x.lat,x.lon)});}
      }else if(request.provider==='bmkg_quake'){
        const rows=d.Infogempa?.gempa;if(!Array.isArray(rows))throw Error('Data gempa kosong');
        const mapped=rows.map(x=>{const[lat,lon]=String(x.Coordinates||'').split(',').map(Number);return {...x,distance_km:distance(n.latitude,n.longitude,lat,lon)};}).filter(x=>Number.isFinite(x.distance_km));
        const near=mapped.filter(x=>x.distance_km<=request.radius_km).slice(0,2);
        for(let i=0;i<near.length;i++){const x=near[i];add('quake'+i,'earthquake','Catatan BMKG dari daftar gempa M5+ sekitar lokasi',`${clean(x.Wilayah)}; magnitudo ${clean(x.Magnitude)}; kedalaman ${clean(x.Kedalaman)}; jarak sekitar ${x.distance_km.toFixed(0)} km; informasi potensi: ${clean(x.Potensi)}`,'',x.DateTime,'event',7200);}
        if(!near.length)add('coverage','earthquake','Cakupan hasil gempa BMKG',`Tidak ada entri dalam radius ${request.radius_km} km pada daftar M5+ yang diambil; ini tidak mencakup semua gempa`,'',null,'event',7200);
      }else if(request.provider==='gbif'){
        if(!Array.isArray(d.results))throw Error('Data biodiversitas kosong');
        for(let i=0;i<d.results.length;i++){const x=d.results[i];if(!coordinate(x.decimalLatitude,x.decimalLongitude)||distance(n.latitude,n.longitude,x.decimalLatitude,x.decimalLongitude)>30||!x.scientificName||!/^\d+$/.test(String(x.key)))continue;add('occurrence'+i,'biodiversity','Contoh catatan spesies GBIF, bukan keberadaan saat ini',`${clean(x.scientificName)}; tanggal observasi ${clean(x.eventDate||x.year||'tidak tersedia')}`,'',null,'historical',604800,{provider_coordinates:{latitude:x.decimalLatitude,longitude:x.decimalLongitude,kind:'historical_record'},provider_location_known:true,distance_km:distance(n.latitude,n.longitude,x.decimalLatitude,x.decimalLongitude),record_url:`https://www.gbif.org/occurrence/${x.key}`,license:clean(x.license)});}
      }else throw Error('Provider tidak dikenal');
    }catch{error='Data provider kosong atau skemanya tidak sesuai';}
    const ok=!error&&facts.length>0;
    entries.push({area_id:n.id,provider:request.provider,ok,request_latitude:n.latitude,request_longitude:n.longitude,payload:{reference,data_origin:'external_api',role:'supplementary',source:request.source,source_url:request.source_url,fetched_at,facts:ok?facts:[],insights:summarizeEnvironment(ok?facts:[],now).filter(i=>i.available),summary_method:'rules-v1',status:ok?'available':'unavailable'},refresh_after:new Date(now+(ok?request.ttl:3600)*1000).toISOString(),last_error:ok?null:error||'Tidak ada nilai yang tersedia untuk koordinat ini'});
  }
  return {json:{entries}};
}
return normalizeResponse($json,$("Rencanakan pengambilan API").item.json);