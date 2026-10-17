function planRequests(input, settings, now = Date.now()) {
  const nodes = (input.areas || []).filter(n => n.id === 'surabaya' && Math.abs(n.latitude - (-7.24917)) < 0.00001 && Math.abs(n.longitude - 112.75083) < 0.00001 && Number.isFinite(n.latitude) && Number.isFinite(n.longitude) && Math.abs(n.latitude) <= 90 && Math.abs(n.longitude) <= 180);
  const cache = input.cache || [];
  const planned = [];
  const due = (provider, n) => !cache.some(c => c.provider === provider && c.area_id === n.id && Date.parse(c.refresh_after) > now && c.request_latitude === n.latitude && c.request_longitude === n.longitude);
  const put = (provider, source, source_url, ttl, targets, url, extra = {}) => {
    if (targets.length) planned.push({json:{provider,source,source_url,ttl,targets,url,...extra}});
  };
  for (const n of nodes) {
    const lat=n.latitude,lon=n.longitude,coords=`latitude=${lat}&longitude=${lon}`;
    if(due('openmeteo_weather',n)) put('openmeteo_weather','Open-Meteo / model cuaca','https://open-meteo.com/en/docs',3600,[n],`https://api.open-meteo.com/v1/forecast?${coords}&current=temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m,weather_code&hourly=soil_temperature_0cm,soil_moisture_0_to_1cm&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,uv_index_max&forecast_days=2&timezone=Asia%2FJakarta`);
    if(due('openmeteo_air',n)) put('openmeteo_air','Open-Meteo / CAMS global','https://open-meteo.com/en/docs/air-quality-api',10800,[n],`https://air-quality-api.open-meteo.com/v1/air-quality?${coords}&domains=cams_global&current=pm2_5,pm10,carbon_monoxide,nitrogen_dioxide,sulphur_dioxide,ozone,us_aqi&forecast_days=1&timezone=Asia%2FJakarta`);
    if(due('openmeteo_flood',n)) put('openmeteo_flood','Open-Meteo / GloFAS','https://open-meteo.com/en/docs/flood-api',86400,[n],`https://flood-api.open-meteo.com/v1/flood?${coords}&daily=river_discharge&forecast_days=3`);
    if(settings.soilgrids_enabled===true && due('soilgrids',n)) put('soilgrids','ISRIC SoilGrids','https://isric.org/explore/soilgrids',2592000,[n],`https://rest.isric.org/soilgrids/v2.0/properties/query?lon=${lon}&lat=${lat}&property=phh2o&property=soc&property=clay&property=sand&depth=0-5cm&value=mean`);
    const adm4=settings.bmkg_adm4_by_area?.[n.id];
    if(typeof adm4==='string' && /^\d{2}\.\d{2}\.\d{2}\.\d{4}$/.test(adm4) && due('bmkg_weather',n)) put('bmkg_weather','BMKG','https://data.bmkg.go.id/prakiraan-cuaca/',21600,[n],`https://api.bmkg.go.id/publik/prakiraan-cuaca?adm4=${adm4}`);
    if(settings.iqair_enabled===true && due('iqair',n)) put('iqair','IQAir / AirVisual','https://www.iqair.com/',7200,[n],`https://api.airvisual.com/v2/nearest_city?lat=${lat}&lon=${lon}`);
  }
  put('firms','NASA FIRMS / VIIRS','https://firms.modaps.eosdis.nasa.gov/',3600,nodes.filter(n=>due('firms',n)), 'https://firms.modaps.eosdis.nasa.gov/data/active_fire/viirs/csv/SUOMI_VIIRS_C2_SouthEast_Asia_24h.csv', {radius_km:50});
  put('bmkg_quake','BMKG','https://data.bmkg.go.id/gempabumi/',3600,nodes.filter(n=>due('bmkg_quake',n)), 'https://data.bmkg.go.id/DataMKG/TEWS/gempaterkini.json', {radius_km:300});
  return planned;
}
return planRequests($input.first().json, $("Pengaturan Hub Lingkungan").first().json);