import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("worker context follows an authorized robot node and keeps national news separate", async () => {
  const now=Date.now();
  const code=await readFile(new URL("../../n8n/chat-environment-context.js",import.meta.url),"utf8");
  const area={id:"node_node1",source_node_id:"node1",coordinate_source:"robot_node",latitude:-7.1,longitude:112.1};
  const fact={id:"air",category:"air_quality",area_id:area.id,data_origin:"external_api",role:"supplementary",reference:area,fresh_until:new Date(now+3600000).toISOString(),value:54};
  const news={id:"news-1",area_id:"indonesia",kind:"news",fresh_until:new Date(now+3600000).toISOString(),value:"Kabar bencana Indonesia",source_url:"https://www.antaranews.com/berita/1",data_origin:"external_api",role:"supplementary",category:"fire",source:"ANTARA",valid_at:new Date(now).toISOString()};
  fact.valid_at=new Date(now).toISOString();fact.kind="regional";
  const base={text:"Berita karhutla Indonesia dan kualitas udara",node_ids:["node1"],context:[],disaster_news:[news]};
  const result=new Function("$json","$",code)({environment_area:area,environment_cache:[
    {area_id:area.id,provider:"openmeteo_air",request_latitude:area.latitude,request_longitude:area.longitude,payload:{facts:[fact,{...fact,id:"old",fresh_until:new Date(now-1).toISOString()}]}},
    {area_id:area.id,provider:"legacy",request_latitude:area.latitude,request_longitude:area.longitude,payload:{facts:[{...fact,id:"legacy",category:"biodiversity"}]}}
  ]},()=>({first:()=>({json:base})})).json;
  assert.deepEqual(result.environment.map(x=>x.id),["air","news-1"]);
  assert.deepEqual(result.context,[]);
  assert.equal(result.environment_area.id,"node_node1");
  const validation=await readFile(new URL("../../n8n/chat-answer-validation.js",import.meta.url),"utf8");
  const model={candidates:[{content:{parts:[{text:JSON.stringify({decision:"allow",topic:"fire",answer:"Berikut kabar dari sumber yang tersedia.",readings:[],environment_refs:["news-1"]})}]}}]};
  const lookup=name=>({first:()=>({json:name==="Siapkan konteks hub Web"?result:{direct_route:false}})});
  const answer=new Function("$json","$",validation)(model,lookup).json;
  assert.equal(answer.decision,"allow");
  assert.match(answer.answer,/Sumber: ANTARA \(/);
  assert.doesNotMatch(answer.answer,/https?:|antaranews\.com/);
  const forged={...result,disaster_news:[]};
  const deny=new Function("$json","$",validation)(model,name=>({first:()=>({json:name==="Siapkan konteks hub Web"?forged:{direct_route:false}})})).json;
  assert.equal(deny.decision,"deny");
});

test("air questions include current API evidence even when local sensor readings exist", async () => {
  const now=Date.now(),valid_at=new Date(now).toISOString(),fresh_until=new Date(now+3600000).toISOString();
  const area={id:"node_node1",source_node_id:"node1",coordinate_source:"robot_node",latitude:-7.1,longitude:112.1};
  const fact={id:"aqi",label:"Estimasi AQI US wilayah, bukan ISPU",category:"air_quality",area_id:area.id,data_origin:"external_api",role:"supplementary",reference:area,valid_at,fresh_until,kind:"regional",value:122,source:"Open-Meteo"};
  const sensor={node_id:"node1",name:"Titik uji",observed_at:valid_at,stale:false,metrics:{dust_ug_m3:22},quality:{}};
  const code=await readFile(new URL("../../n8n/chat-environment-context.js",import.meta.url),"utf8");
  const cache={environment_area:area,environment_cache:[{area_id:area.id,provider:"openmeteo_air",request_latitude:area.latitude,request_longitude:area.longitude,payload:{facts:[{...fact,id:"future",kind:"forecast",valid_at:new Date(now+86400000).toISOString()},{...fact,id:"pm",label:"Estimasi PM2.5 wilayah"},fact]}}]};
  const result=new Function("$json","$",code)(cache,()=>({first:()=>({json:{text:"Bagaimana kondisi udara di sekitar?",node_ids:["node1"],context:[sensor]}})})).json;
  assert.deepEqual(result.environment.map(f=>f.id),["aqi","pm"]);
  const validation=await readFile(new URL("../../n8n/chat-answer-validation.js",import.meta.url),"utf8");
  const answer=new Function("$json","$",validation)({},name=>({first:()=>({json:name==="Siapkan konteks hub Web"?result:{direct_route:true}}),item:{json:{job:{body:{}}}}})).json;
  assert.equal(answer.decision,"allow");
  assert.match(answer.answer,/kurang sehat bagi kelompok sensitif/);
  assert.match(answer.answer,/Sensor AEROSENSE Titik uji/);
  assert.match(answer.answer,/Open-Meteo/);
  assert.doesNotMatch(answer.answer,/https?:/);
});

test("Hub planner only polls active robot-node points and skips fresh provider caches", async () => {
  const code=await readFile(new URL("../../n8n/environment-planner.js",import.meta.url),"utf8");
  const area={id:"node_node1",source_node_id:"node1",coordinate_source:"robot_node",enabled:true,latitude:-7.1,longitude:112.1};
  const run=(input,settings={})=>new Function("$input","$",code)({first:()=>({json:input})},()=>({first:()=>({json:settings})}));
  const jobs=run({areas:[area,{...area,id:"not-a-node"},{...area,id:"node_other",latitude:0}],cache:[]});
  assert.equal(jobs.length,5);
  assert(jobs.every(j=>!['gbif','soilgrids'].includes(j.json.provider)));
  assert(jobs.every(j=>j.json.targets.every(a=>a.id===area.id&&a.latitude===area.latitude)));
  assert.equal(run({areas:[area],cache:jobs.map(j=>({area_id:area.id,provider:j.json.provider,request_latitude:area.latitude,request_longitude:area.longitude,refresh_after:new Date(Date.now()+86400000).toISOString()}))}).length,0);
  assert.equal(run({areas:[area],cache:jobs.map(j=>({area_id:area.id,provider:j.json.provider,request_latitude:area.latitude,request_longitude:area.longitude,refresh_after:new Date(Date.now()+15000).toISOString()}))}).length,5);
});
