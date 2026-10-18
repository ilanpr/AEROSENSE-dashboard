import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { normalizeHazardEvents, readEventLayers } from "../api/environment-events.mjs";
const now=Date.parse("2026-10-18T07:00:00Z");
const area={id:"node_test",latitude:-7.25,longitude:112.75};
const fire={latitude:"-7.26",longitude:"112.76",acq_date:"2026-10-18",acq_time:"0600",satellite:"N",confidence:"h"};
test("FIRMS keeps coordinates of every valid nearby detection, deduplicates and bounds the cache",()=>{
  const data=[fire,{...fire,longitude:"112.77"},fire,{...fire,latitude:""},{...fire,longitude:"999"},{...fire,acq_time:"0900"},{...fire,acq_date:"2026-10-15"}];
  const result=normalizeHazardEvents("firms",data,area,now,50);
  assert.equal(result.events.length,2);
  assert.equal(result.events[0].confidence,"high");
  assert.equal(result.events[0].coordinate_kind,"satellite_pixel_center");
  const many=normalizeHazardEvents("firms",Array.from({length:250},(_,i)=>({...fire,longitude:112.75+i/10000})),area,now,50);
  assert.equal(many.events.length,200);assert.equal(many.coverage.matched_count,250);assert(many.coverage.truncated);
});
test("BMKG keeps structured epicenters, magnitude and depth, rejecting missing coordinates or old events",()=>{
  const quake={Coordinates:"-7.5,112.8",DateTime:"2026-10-18T06:00:00Z",Magnitude:"5.2",Kedalaman:"12 km",Wilayah:"Surabaya",Potensi:"Tidak berpotensi tsunami"};
  const result=normalizeHazardEvents("bmkg_quake",{Infogempa:{gempa:[quake,{...quake,Coordinates:""},{...quake,DateTime:"2026-10-01T00:00:00Z"}]}},area,now,300);
  assert.equal(result.events.length,1);assert.equal(result.events[0].magnitude,5.2);assert.equal(result.events[0].depth_km,12);assert.equal(result.events[0].coordinate_kind,"epicenter");
});
test("API does not return events from old coordinates or renew stale observations",()=>{
  const parsed=normalizeHazardEvents("firms",[fire],area,now,50);
  const row={provider:"firms",request_latitude:area.latitude,request_longitude:area.longitude,payload:{...parsed,status:"available"}};
  assert.equal(readEventLayers([row],area,now).events.length,1);
  assert.equal(readEventLayers([row],area,now+3*3600000).events[0].stale,true);
  assert.equal(readEventLayers([row],{...area,latitude:-7.3},now).events.length,0);
  assert.equal(readEventLayers([{...row,payload:{...row.payload,events:[{...parsed.events[0],source_url:"javascript:bad()",latitude:NaN}]}}],area,now).events.length,0);
});
test("the n8n normalizer preserves the same event list and zero-event coverage",async()=>{
  const code=await readFile(new URL("../../n8n/environment-normalizer.js",import.meta.url),"utf8");
  const run=new Function("response","request","now",code.slice(0,code.lastIndexOf("\nreturn normalizeResponse("))+"\nreturn normalizeResponse(response,request,now);");
  const request={provider:"firms",source:"NASA FIRMS",source_url:"https://firms.modaps.eosdis.nasa.gov/",radius_km:50,ttl:3600,targets:[area]};
  const result=run({statusCode:200,body:"latitude,longitude,acq_date,acq_time,satellite,confidence\n-7.26,112.76,2026-10-18,0600,N,h\n-7.27,112.77,2026-10-18,0600,N,n"},request,now).json.entries[0];
  assert(result.ok);assert.equal(result.payload.events.length,2);
  assert.equal(result.payload.facts.find(f=>f.category==="fire").value,2);
  assert.equal(result.payload.insights.find(i=>i.category==="fire")?.available,true);
  const empty=run({statusCode:200,body:"latitude,longitude,acq_date,acq_time\n"},request,now).json.entries[0];
  assert(empty.ok);assert.deepEqual(empty.payload.events,[]);assert.equal(empty.payload.facts[0].value,0);
  assert.equal(empty.payload.insights.find(i=>i.category==="fire")?.available,true);
});
