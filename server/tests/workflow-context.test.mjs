import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("worker context follows an authorized robot node and keeps national news separate", async () => {
  const now=Date.now();
  const code=await readFile(new URL("../../n8n/chat-environment-context.js",import.meta.url),"utf8");
  const area={id:"node_node1",source_node_id:"node1",coordinate_source:"robot_node",latitude:-7.1,longitude:112.1};
  const fact={id:"air",category:"air_quality",area_id:area.id,data_origin:"external_api",role:"supplementary",reference:area,fresh_until:new Date(now+3600000).toISOString(),value:54};
  const news={id:"news-1",area_id:"indonesia",kind:"news",fresh_until:new Date(now+3600000).toISOString(),value:"Kabar bencana Indonesia",source_url:"https://www.antaranews.com/berita/1",data_origin:"external_api",role:"supplementary",category:"fire",source:"ANTARA",valid_at:new Date(now).toISOString()};
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
  assert.match(answer.answer,/Indonesia:/);
  assert.match(answer.answer,/antaranews.com/);
  const forged={...result,disaster_news:[]};
  const deny=new Function("$json","$",validation)(model,name=>({first:()=>({json:name==="Siapkan konteks hub Web"?forged:{direct_route:false}})})).json;
  assert.equal(deny.decision,"deny");
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
