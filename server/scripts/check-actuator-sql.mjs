// Optional SQL integration check: set PGLITE_MODULE to an installed @electric-sql/pglite/dist/index.js.
import {pathToFileURL} from 'node:url';
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const {PGlite}=await import(pathToFileURL(process.env.PGLITE_MODULE).href);
const db=new PGlite();
try{
 await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;create table auth.users(id uuid primary key);
  create table ae_nodes(id text primary key,location_id text,enabled boolean default true,pm25_validated boolean default false);
  create table ae_members(user_id uuid,location_id text,role text);
  create table ae_rules(node_id text,metric text,enabled boolean,high float8,danger_high float8);
  create table ae_readings(id uuid default gen_random_uuid(),node_id text,observed_at timestamptz,metrics jsonb,quality jsonb default '{}',boot_id text default 'real-boot');`);
 await db.exec(await readFile(new URL('../supabase/012_manual_sprinkler.sql',import.meta.url),'utf8'));
 await db.exec(await readFile(new URL('../supabase/014_watersense_auto_and_map.sql',import.meta.url),'utf8'));
 await db.exec(await readFile(new URL('../supabase/015_watersense_sessions.sql',import.meta.url),'utf8'));
 await db.exec(await readFile(new URL('../supabase/016_watersense_espnow.sql',import.meta.url),'utf8'));
 await db.exec(await readFile(new URL('../supabase/017_watersense_manual_restart.sql',import.meta.url),'utf8'));
 const owner='11111111-1111-4111-8111-111111111111',viewer='22222222-2222-4222-8222-222222222222';
 await db.query('insert into auth.users values ($1),($2)',[owner,viewer]);
 await db.exec(`insert into ae_nodes(id,location_id) values('n1','loc1'),('n2','loc2');`);
 await db.query(`insert into ae_members values($1,'loc1','operator'),($2,'loc1','viewer')`,[owner,viewer]);
 await db.exec(`insert into ae_actuators(id,node_id,name,enabled,last_seen_at,status) values('mist-01','n1','Utara',true,now(),'{"state":"online","output":"off","clock_synced":true,"battery_ok":true,"water_ok":true}');`);
 let number=0;const request=()=>`aaaaaaaa-aaaa-4aaa-8aaa-${String(++number).padStart(12,'0')}`;
 const enqueue=async(user,action,duration,key=request())=>(await db.query('select ae_actuator_enqueue($1,$2,$3,$4,$5) as command',[user,'mist-01',action,duration,key])).rows[0].command;
 await assert.rejects(enqueue(viewer,'pulse',3000),/Akses pengelola/);
 await assert.rejects(enqueue(owner,'pulse',11000),/Durasi/);
 const key=request(),first=await enqueue(owner,'pulse',3000,key),same=await enqueue(owner,'pulse',3000,key);assert.equal(first.id,same.id);
 await assert.rejects(enqueue(owner,'pulse',3000),/jeda operasi/);
 const claimed=(await db.query('select ae_actuator_claim() as commands')).rows[0].commands;assert.equal(claimed.length,1);assert.equal(claimed[0].payload.status,'manual');assert.equal(claimed[0].payload.command_id,first.id);
 await db.query('select ae_actuator_ack($1,$2,$3,$4)',['mist-01',first.id,'accepted','manual']);
 // ACK can arrive before the publish callback; the callback must never regress accepted -> published.
 const published=(await db.query('select ae_actuator_published($1,$2) as changed',[first.id,claimed[0].token])).rows[0].changed;assert.equal(published,false);
 const stop=await enqueue(owner,'stop',0);await db.query('select ae_actuator_ack($1,$2,$3,$4)',['mist-01',stop.id,'completed','remote_stop']);
 assert.equal((await db.query('select state from ae_actuator_commands where id=$1',[first.id])).rows[0].state,'stopped');
 await db.query('select ae_actuator_ack($1,$2,$3,$4)',['mist-01',first.id,'accepted','late']);assert.equal((await db.query('select state from ae_actuator_commands where id=$1',[first.id])).rows[0].state,'stopped');
 await db.exec(`update ae_actuators set next_run_at=null,last_seen_at=now()-interval '2 minutes';`);await assert.rejects(enqueue(owner,'pulse',3000),/offline/);
 await db.exec(`update ae_actuators set last_seen_at=now(),status=jsonb_set(status,'{battery_ok}','false');`);await assert.rejects(enqueue(owner,'pulse',3000),/baterai/);
 await db.exec(`update ae_actuators set status=jsonb_set(status,'{battery_ok}','true');`);
 await assert.rejects(enqueue(owner,'session',2700000),/belum mendukung/);
 await db.exec(`update ae_actuators set status=status||'{"max_session_duration_ms":3600000}'::jsonb;`);
 await assert.rejects(enqueue(owner,'session',10000),/Durasi sesi/);
 const session=await enqueue(owner,'session',2700000);
 const [dispatched]=(await db.query('select ae_actuator_claim() as commands')).rows[0].commands;
 assert.equal(dispatched.payload.action,'session');
 assert.equal(dispatched.payload.duration_ms,2700000);
 assert.ok(Date.parse(dispatched.payload.expires_at)-Date.parse(dispatched.payload.issued_at)<=30000);
 const ack=async(id,status)=>(await db.query('select ae_actuator_ack($1,$2,$3,$4) as ok',['mist-01',id,status,'manual'])).rows[0].ok;
 assert.equal(await ack(session.id,'accepted'),true);
 assert.equal(await ack(session.id,'accepted'),false);
 const active=(await db.query('select state,expires_at from ae_actuator_commands where id=$1',[session.id])).rows[0];
 assert.equal(active.state,'accepted');
 assert.ok(Date.parse(active.expires_at)-Date.parse(session.issued_at)>=2700000);
 await db.exec(`update ae_actuators set next_run_at=null,status=status||'{"session_active":true}'::jsonb;`);
 await assert.rejects(enqueue(owner,'pulse',3000),/perintah berjalan/);
 const sessionStop=await enqueue(owner,'stop',0);
 assert.equal(await ack(sessionStop.id,'completed'),true);
 assert.equal((await db.query('select state from ae_actuator_commands where id=$1',[session.id])).rows[0].state,'stopped');
 assert.ok((await db.query("select next_run_at>now()+interval '9 minutes' as reserved from ae_actuators")).rows[0].reserved);
 await db.exec(`update ae_actuators set status=status||'{"session_active":false,"manual_restart":true}'::jsonb;`);
 const restarted=await enqueue(owner,'session',1800000);
 await assert.rejects(enqueue(owner,'pulse',1000),/perintah berjalan/);
 const stopRestarted=await enqueue(owner,'stop',0);
 await assert.rejects(enqueue(owner,'pulse',1000),/perintah berjalan/);
 assert.equal(await ack(stopRestarted.id,'completed'),true);
 const pulseAfterStop=await enqueue(owner,'pulse',1000);
 assert.equal(pulseAfterStop.state,'queued');
 assert.equal((await db.query('select state from ae_actuator_commands where id=$1',[restarted.id])).rows[0].state,'cancelled');
 await db.exec('set role authenticated');await assert.rejects(db.query('select * from ae_actuators'),/permission denied/);await assert.rejects(db.query('select ae_actuator_claim()'),/permission denied/);await db.exec('reset role');
 await db.exec(`
  delete from ae_actuator_commands;
  update ae_actuators set auto_metric='dust_ug_m3',next_run_at=null,
   status=jsonb_set(status,'{session_active}','false');
  insert into ae_rules values('n1','dust_ug_m3',true,40,80);
  insert into ae_readings(node_id,observed_at,metrics)
   select 'n1',now()-make_interval(secs=>delay),jsonb_build_object('dust_ug_m3',85)
   from unnest(array[5,305,605]) delay;
 `);
 await db.query('select ae_actuator_schedule_auto()');
 assert.equal((await db.query("select state from ae_actuator_commands where trigger_band='danger'")).rows[0].state,'queued');
 await db.exec("update ae_actuators set espnow_auto=true,next_run_at=null");
 await db.query('select ae_actuator_schedule_auto()');
 assert.deepEqual((await db.query("select state from ae_actuator_commands where trigger_band='danger'")).rows,[{state:'cancelled'}]);
 console.log('PASS: SQL migration, role/RLS, duration, atomic queue, stop, ACK, and ESP-NOW cloud arbitration.');
}finally{await db.close();}
