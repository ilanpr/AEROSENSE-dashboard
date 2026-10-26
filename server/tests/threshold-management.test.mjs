import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";

test("threshold writes enforce membership, write roles, validation and persistence", async () => {
  let role = "viewer", saved = null;
  const uid = "00000000-0000-4000-8000-000000000001";
  const mock = http.createServer(async (req, res) => {
    const url = new URL(req.url, "http://mock");
    let data = [];
    if (url.pathname === "/auth/v1/user") data = {id:uid};
    if (url.pathname === "/rest/v1/ae_nodes") data = [{id:url.searchParams.get("id") === "eq.foreign" ? "foreign" : "n1",location_id:url.searchParams.get("id") === "eq.foreign" ? "l2" : "l1",pm25_validated:false}];
    if (url.pathname === "/rest/v1/ae_members") data = url.searchParams.get("location_id") === "eq.l2" ? [] : [{user_id:uid,location_id:"l1",role}];
    if (url.pathname === "/rest/v1/ae_rules") {
      if (req.method === "POST") { let body="";for await (const chunk of req) body += chunk; saved={id:"rule-1",...JSON.parse(body)}; }
      data = saved ? [saved] : [];
    }
    res.writeHead(200,{"Content-Type":"application/json"});res.end(JSON.stringify(data));
  });
  await new Promise(r=>mock.listen(0,"127.0.0.1",r));
  Object.assign(process.env,{PORT:"0",SUPABASE_URL:"http://127.0.0.1:"+mock.address().port,SUPABASE_ANON_KEY:"public-test",SUPABASE_SERVICE_ROLE_KEY:"private-test",INTERNAL_API_KEY:"internal-test",DEVICE_KEYS_JSON:"{}",DISASTER_NEWS_ENABLED:"false"});
  const { server } = await import("../api/server.mjs");
  if (!server.listening) await new Promise(r=>server.once("listening",r));
  const base="http://127.0.0.1:"+server.address().port;
  const rule={node_id:"n1",metric:"dust_ug_m3",high:40,danger_high:60,clear_below:35,unit:"µg/m³",cooldown_seconds:1800,enabled:true};
  const post = (body, auth=true) => fetch(base+"/v1/rules",{method:"POST",headers:{"Content-Type":"application/json",...(auth?{Authorization:"Bearer valid"}:{})},body:JSON.stringify(body)});
  try {
    assert.equal((await post(rule,false)).status,401);
    for (role of ["viewer","auditor"]) assert.equal((await post(rule)).status,403);
    assert.equal(saved,null);
    role="operator";
    assert.equal((await post({...rule,node_id:"foreign"})).status,403);
    assert.equal((await post(rule)).status,200);
    assert.equal(saved.danger_high,60);
    const rows=await (await fetch(base+"/v1/rules?node_id=n1",{headers:{Authorization:"Bearer valid"}})).json();
    assert.equal(rows.rules[0].high,40);
    for(const invalid of [{danger_high:40},{clear_below:40},{cooldown_seconds:0},{high:null},{metric:"pm25_ug_m3"}]) assert.equal((await post({...rule,...invalid})).status,400);
    assert.equal(saved.high,40);
    assert.equal((await post({...rule,enabled:false})).status,200);
    assert.equal(saved.enabled,false);
    role="admin";
    assert.equal((await post({...rule,high:45,danger_high:70})).status,200);
    assert.equal(saved.danger_high,70);
  } finally {
    await new Promise(r=>server.close(r));await new Promise(r=>mock.close(r));
  }
});
