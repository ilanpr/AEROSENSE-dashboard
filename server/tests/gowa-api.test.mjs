import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { createHmac } from "node:crypto";
test("GOWA signed inbox deduplicates; sender enforces opt-out and does not retry unknown deliveries", async () => {
  const jobs = [], receipts = [];
  let sends = 0, gatewayMode = "ok", active = true;
  const mock = http.createServer(async(req,res)=>{
    let raw=""; for await (const chunk of req) raw += chunk;
    const p = raw ? JSON.parse(raw) : null, url = new URL(req.url,"http://local");
    let result=[];
    if (url.pathname === "/send/message") {
      sends++;
      if (gatewayMode === "unknown") {res.writeHead(503);res.end("{}");return;}
      result={code:"SUCCESS",results:{message_id:"GOWA-"+sends}};
    }
    if (url.pathname === "/rest/v1/ae_contacts") result=[{phone:"628222222222"}];
    if (url.pathname === "/rest/v1/ae_subscriptions") result=active?[{user_id:"u1",node_id:"n1"}]:[];
    if (url.pathname === "/rest/v1/ae_nodes") result=[{id:"n1",location_id:"l1",enabled:true}];
    if (url.pathname === "/rest/v1/ae_members") result=[{user_id:"u1",location_id:"l1"}];
    if (url.pathname === "/rest/v1/ae_jobs") {
      const rows=jobs.filter(j=>(!url.searchParams.has("id")||"eq."+j.id===url.searchParams.get("id"))&&
        (!url.searchParams.has("dedupe_key")||"eq."+j.dedupe_key===url.searchParams.get("dedupe_key")));
      if(req.method==="POST") {
        if(jobs.some(j=>j.dedupe_key===p.dedupe_key)) result=[];
        else {const j={id:"inbox-"+jobs.length,...p};jobs.push(j);result=[j];}
      } else if(req.method==="PATCH") {rows.forEach(j=>Object.assign(j,p));result=rows;}
      else if (url.searchParams.get("kind")==="eq.wa_send") result=rows.filter(j=>j.kind==="wa_send"&&j.status==="done"&&j.result?.provider==="gowa"&&
        "eq."+j.body.phone===url.searchParams.get("body->>phone")).slice(-1);
      else result=rows;
    }
    if (url.pathname === "/rest/v1/rpc/ae_stage") {Object.assign(jobs.find(j=>j.id===p.p_id).stage,p.p_stage);result=true;}
    if (url.pathname === "/rest/v1/rpc/ae_finish") {Object.assign(jobs.find(j=>j.id===p.p_id),{status:"done",result:p.p_result});result=true;}
    if (url.pathname === "/rest/v1/rpc/ae_retry") result=true;
    if (url.pathname === "/rest/v1/rpc/ae_gowa_receipt") {receipts.push(p);result=null;}
    res.writeHead(200,{"Content-Type":"application/json"});res.end(JSON.stringify(result));
  });
  await new Promise(r=>mock.listen(0,"127.0.0.1",r));
  const upstream="http://127.0.0.1:"+mock.address().port;
  Object.assign(process.env,{PORT:"0",DISASTER_NEWS_ENABLED:"false",SUPABASE_URL:upstream,SUPABASE_ANON_KEY:"anon-test",
    SUPABASE_SERVICE_ROLE_KEY:"service-test",INTERNAL_API_KEY:"internal-test",DEVICE_KEYS_JSON:"{}",WHATSAPP_PROVIDER:"gowa",
    GOWA_DEVICE_JID:"628111111111@s.whatsapp.net",GOWA_DEVICE_ID:"aerosense",GOWA_BASIC_AUTH:"aerosense:testing",
    GOWA_WEBHOOK_SECRET:"webhook-test",GOWA_BASE_URL:upstream});
  const {server}=await import("../api/server.mjs");
  if(!server.listening) await new Promise(r=>server.once("listening",r));
  const base="http://127.0.0.1:"+server.address().port;
  const post=(path,body,headers={})=>fetch(base+path,{method:"POST",headers:{"Content-Type":"application/json",...headers},body:JSON.stringify(body)});
  const inbound={event:"message",device_id:process.env.GOWA_DEVICE_JID,payload:{id:"ABC123",chat_id:"628222222222@s.whatsapp.net",
    from:"628222222222@s.whatsapp.net",is_from_me:false,timestamp:new Date().toISOString(),body:"STOP"}};
  const signed=body=>({"x-hub-signature-256":"sha256="+createHmac("sha256","webhook-test").update(JSON.stringify(body)).digest("hex")});
  const auth={"x-aerosense-internal-key":"internal-test"};
  const job=(id,stage={})=>{const j={id,kind:"wa_send",status:"running",lease_token:"lease-"+id,lease_until:new Date(Date.now()+60000).toISOString(),
    stage,body:{phone:"628222222222",text:"Peringatan uji",alert_id:"a1",node_id:"n1"}};jobs.push(j);return {id,lease_token:j.lease_token};};
  try {
    assert.equal((await post("/webhooks/gowa",inbound)).status,401);
    for(let i=0;i<2;i++) assert.equal((await post("/webhooks/gowa",inbound,signed(inbound))).status,200);
    assert.equal(jobs.length,1);assert.equal(jobs[0].body.message.text.body,"STOP");
    const greet={...inbound,payload:{...inbound.payload,id:"HELLO1",body:"Halo"}};
    assert.equal((await post("/webhooks/gowa",greet,signed(greet))).status,200);
    assert.equal(jobs.at(-1).body.message.interactive.list_reply.id,"ae:menu");
    jobs.push({id:"previous-menu",kind:"wa_send",status:"done",body:{phone:"628222222222",interactive:{action:{buttons:[{reply:{id:"ae:node:n1",title:"Node satu"}}]}}},result:{provider:"gowa"}});
    jobs.push({id:"someone-else-menu",kind:"wa_send",status:"done",body:{phone:"628999999999",interactive:{action:{buttons:[{reply:{id:"ae:node:private-other",title:"Other"}}]}}},result:{provider:"gowa"}});
    const number={...inbound,payload:{...inbound.payload,id:"NUMBER1",body:"1"}};
    assert.equal((await post("/webhooks/gowa",number,signed(number))).status,200);
    assert.equal(jobs.at(-1).body.message.interactive.list_reply.id,"ae:node:n1");
    const good=await post("/internal/whatsapp/gowa-send",job("good"),auth);
    assert.equal((await good.json()).result.provider_id,"GOWA-1");assert.equal(sends,1);assert.equal(receipts[0].p_status,"sent");
    active=false;
    const opted=await post("/internal/whatsapp/gowa-send",job("opted"),auth);
    assert.equal((await opted.json()).result.skipped,"Opt-out");assert.equal(sends,1);
    active=true;gatewayMode="unknown";
    const unknown=await post("/internal/whatsapp/gowa-send",job("unknown"),auth);
    assert.equal((await unknown.json()).delivery_unknown,true);assert.equal(sends,2);
    const recovered=await post("/internal/whatsapp/gowa-send",job("recovered",{gowa_attempt:"previous"}),auth);
    assert.equal((await recovered.json()).delivery_unknown,true);assert.equal(sends,2);
    const saved=await post("/internal/whatsapp/gowa-send",job("saved",{provider_id:"GOWA-saved"}),auth);
    assert.equal((await saved.json()).result.provider_id,"GOWA-saved");assert.equal(sends,2);
    const ack={...inbound,event:"message.ack",payload:{chat_id:inbound.payload.chat_id,ids:["GOWA-1"],receipt_type:"read"}};
    assert.equal((await post("/webhooks/gowa",ack,signed(ack))).status,200);
    assert.equal(receipts.at(-1).p_status,"read");
    assert.equal((await post("/internal/whatsapp/native-event",{event:{}},auth)).status,400);
  } finally {await new Promise(r=>server.close(r));await new Promise(r=>mock.close(r));}
});
