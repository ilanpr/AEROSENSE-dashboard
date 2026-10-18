import test from 'node:test';
import assert from 'node:assert/strict';
import { DEMO_POINTS,demoNodes,demoHistory,demoEnvironment } from '../../src/demo/data.ts';
import { sensorSummary } from '../../src/lib/environment-presentation.ts';
import { demoRequest } from '../../src/demo/api.ts';
import { authenticateDemo, demoUser } from '../../src/demo/session.ts';
const distance=(a,b)=>{
  const rad=Math.PI/180,dlat=(b.latitude-a.latitude)*rad,dlon=(b.longitude-a.longitude)*rad;
  return 6371*2*Math.asin(Math.sqrt(Math.sin(dlat/2)**2+Math.cos(a.latitude*rad)*Math.cos(b.latitude*rad)*Math.sin(dlon/2)**2));
};
test('film demo keeps 16 Surabaya points about 2.5 km apart and preserves sensor semantics',()=>{
  assert.equal(DEMO_POINTS.length,16);
  assert.equal(new Set(DEMO_POINTS.map(n=>n.id)).size,16);
  for(let i=0;i<16;i++){
    const n=DEMO_POINTS[i];
    assert(n.latitude>-7.32&&n.latitude<-7.23&&n.longitude>112.70&&n.longitude<112.79);
    if(i%4<3)assert(Math.abs(distance(n,DEMO_POINTS[i+1])-2.5)<0.03);
    if(i<12)assert(Math.abs(distance(n,DEMO_POINTS[i+4])-2.5)<0.03);
  }
  const now=Date.now(),nodes=demoNodes('viewer',now);
  assert.equal(nodes.filter(n=>n.latest.stale).length,1);
  assert(nodes.every(n=>!n.pm25_validated&&!('pm25_ug_m3' in n.latest.metrics)));
  const labels = new Set(nodes.map(n=>sensorSummary(n).label));
  assert.deepEqual(labels,new Set(["Relatif bersih","Waspada","Bahaya","Data belum cukup"]));
  assert.equal(demoHistory(15,now)[0].observed_at,nodes[15].latest.observed_at);
  for(let i=0;i<16;i++){
    const env=demoEnvironment(i,now);
    assert.equal(env.area.latitude,nodes[i].latitude);
    assert.equal(env.area.longitude,nodes[i].longitude);
    assert(env.facts.every(f=>f.data_origin==='synthetic_demo'));
  }
});
test('demo citizen cannot open admin reports, and no fallback reaches production',async()=>{
  const citizen=authenticateDemo('warga@demo.aerosense.test','WargaDemo2026!');
  assert.equal(citizen.app_metadata.demo_role,'viewer');
  assert.throws(()=>authenticateDemo('warga@demo.aerosense.test','wrong'));
  assert.deepEqual(await demoRequest('/v1/access',{},citizen),{can_audit_esg:false});
  await assert.rejects(demoRequest('/v1/esg/report',{},citizen),/admin/);
  assert.equal((await demoRequest('/v1/esg/report',{},demoUser('admin'))).nodes.length,16);
  await assert.rejects(demoRequest('/v1/private-unknown',{},citizen),/produksi/);
  assert.equal((await demoRequest('/v1/dashboard',{},null)).nodes.length,16);
  assert.equal((await demoRequest('/v1/history?node_id=demo-sby-01',{},null)).readings.length,96);
  assert.equal((await demoRequest('/v1/environment?node_id=demo-sby-01',{},null)).area.latitude,DEMO_POINTS[0].latitude);
  await assert.rejects(demoRequest('/v1/esg/report',{},null),/Masuk/);
  await assert.rejects(demoRequest('/v1/alerts/ack',{method:'POST',body:'{"id":"x"}'},null),/Masuk/);
  await assert.rejects(demoRequest('/v1/chat',{method:'POST',body:'{"text":"cuaca"}'},null),/Masuk/);
  const job=await demoRequest('/v1/chat',{method:'POST',body:JSON.stringify({text:'cuaca Surabaya'})},citizen);
  assert.match((await demoRequest('/v1/jobs?id='+job.id,{},citizen)).result.text,/contoh/);
});
