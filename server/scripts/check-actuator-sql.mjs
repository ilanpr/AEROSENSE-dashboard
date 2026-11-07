// Optional SQL integration check: set PGLITE_MODULE to an installed @electric-sql/pglite/dist/index.js.
import {pathToFileURL} from 'node:url';
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const {PGlite}=await import(pathToFileURL(process.env.PGLITE_MODULE).href);
const db=new PGlite();
try{
 await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;create table auth.users(id uuid primary key);create table ae_nodes(id text primary key,location_id text);create table ae_members(user_id uuid,location_id text,role text);`);
 await db.exec(await readFile(new URL('../supabase/012_manual_sprinkler.sql',import.meta.url),'utf8'));
 const owner='11111111-1111-4111-8111-111111111111',viewer='22222222-2222-4222-8222-222222222222';
 await db.query('insert into auth.users values ($1),($2)',[owner,viewer]);
 await db.exec(`insert into ae_nodes values('n1','loc1'),('n2','loc2');`);
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
 await db.exec('set role authenticated');await assert.rejects(db.query('select * from ae_actuators'),/permission denied/);await assert.rejects(db.query('select ae_actuator_claim()'),/permission denied/);await db.exec('reset role');
 console.log('PASS: SQL migration, role/RLS, duration, atomic queue reservation, idempotency, stop, ACK ordering, stale heartbeat, battery gate.');
}finally{await db.close();}
