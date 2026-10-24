import test from "node:test";
import assert from "node:assert/strict";
import { publicMonitoring } from "../api/public-monitoring.mjs";

test("guest monitoring publishes only opted-in nodes and strips private fields", async () => {
  const nodes = [
    { id:"public",name:"Surabaya",public_read:true,enabled:true,latitude:-7.27,longitude:112.75,gateway_id:"private-gateway",location_id:"private-location" },
    { id:"private",name:"Private",public_read:false,enabled:true },
    { id:"disabled",name:"Disabled",public_read:true,enabled:false },
  ];
  const calls = [];
  const deps = {
    filter:encodeURIComponent,
    db:async (table, query) => {
      calls.push([table,query]);
      if (table === "ae_nodes") return nodes;
      if (table === "ae_rules") return [{node_id:"public",metric:"dust_ug_m3",high:40,danger_high:60,clear_below:35,enabled:true,active:false,unit:"µg/m³",internal_key:"private-rule"}];
      return [{id:"r1",node_id:"public",metrics:{dust_ug_m3:23,secret:999},raw_metrics:{dust_ug_m3:24},processing:{private:true},acknowledged_by:"user-secret",phone:"123"}];
    },
    one:async () => ({reading_id:"r1",metrics:{dust_ug_m3:23,secret:999},quality:{secret:true},internal_key:"hidden",stale:false}),
    send:(_res,status,data) => { deps.result={status,data}; },
  };
  const request = async (path,method="GET") => {
    assert.equal(await publicMonitoring(deps,{method},{},new URL(path,"http://test")),true);
    return deps.result;
  };
  const dash = await request("/v1/public/dashboard");
  assert.equal(dash.status,200);
  assert.deepEqual(dash.data.nodes.map(n=>n.id),["public"]);
  assert.equal(dash.data.nodes[0].role,"guest");
  assert.equal(dash.data.nodes[0].rules[0].danger_high,60);
  assert.equal(dash.data.nodes[0].rules[0].internal_key,undefined);
  assert(!JSON.stringify(dash).includes("private"));
  assert.deepEqual(dash.data.nodes[0].latest.metrics,{dust_ug_m3:23});
  assert(calls.some(([table,q])=>table==="ae_nodes"&&q.includes("public_read=eq.true&enabled=eq.true")));
  assert.equal((await request("/v1/public/history?node_id=private")).status,404);
  assert.equal((await request("/v1/public/history?node_id=bad%26filter")).status,400);
  const history=await request("/v1/public/history?node_id=public");
  assert.equal(history.data.readings[0].processing,undefined);
  assert.deepEqual(history.data.readings[0].metrics,{dust_ug_m3:23});
  assert.equal(history.data.readings[0].raw_metrics,undefined);
  assert.equal(history.data.readings[0].gru,undefined);
  assert.equal(history.data.detail,"simple");
  assert(calls.some(([table,q])=>table==="ae_readings"&&q.endsWith("&order=observed_at.desc&limit=288")));
  const alerts=await request("/v1/public/alerts?node_id=public");
  assert.equal(alerts.data.alerts[0].acknowledged_by,undefined);
  assert.equal((await request("/v1/public/alerts/ack","POST")).status,404);
  assert.equal((await request("/v1/public/esg/report")).status,404);
});
