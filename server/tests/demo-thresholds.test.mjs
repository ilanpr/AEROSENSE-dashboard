import test from "node:test";
import assert from "node:assert/strict";
import { demoRequest } from "../../src/demo/api.ts";
import { demoUser } from "../../src/demo/session.ts";

test("preview operators edit only valid rules while citizens remain read-only", async()=>{
  const viewer=demoUser("viewer"), operator=demoUser("operator");
  const options={method:"POST",body:JSON.stringify({node_id:"demo-sby-01",metric:"dust_ug_m3",high:45,danger_high:70,clear_below:35,unit:"µg/m³",cooldown_seconds:1800,enabled:true})};
  await assert.rejects(demoRequest("/v1/rules",options,viewer),/pengelola/);
  await demoRequest("/v1/rules",options,operator);
  assert.equal((await demoRequest("/v1/rules?node_id=demo-sby-01",{},operator)).rules[0].danger_high,70);
  assert.equal((await demoRequest("/v1/rules?node_id=demo-sby-02",{},operator)).rules[0].danger_high,60);
  assert.equal((await demoRequest("/v1/access",{},operator)).can_manage,true);
  assert.equal((await demoRequest("/v1/access",{},viewer)).can_manage,false);
  assert.equal((await demoRequest("/v1/history?node_id=demo-sby-01",{},operator)).detail,"model");
  assert.equal((await demoRequest("/v1/history?node_id=demo-sby-01",{},viewer)).detail,"simple");
  await assert.rejects(demoRequest("/v1/rules",{...options,body:JSON.stringify({...JSON.parse(options.body),danger_high:20})},operator),/ambang/);
});
