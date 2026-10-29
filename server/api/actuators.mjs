import { canManage } from './access.mjs';
const idPattern=/^[a-z0-9-]{1,40}$/;
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const fail=(message,status=400)=>{throw Object.assign(Error(message),{status});};
export function actuatorView(a,commands=[],now=Date.now()) {
 const online=a.status?.state==='online'&&Number.isFinite(Date.parse(a.last_seen_at))&&now-Date.parse(a.last_seen_at)<45000;
 return {...a,online,commands:commands.map(c=>({...c,state:['queued','dispatching','published','accepted'].includes(c.state)&&Date.parse(c.expires_at)<now?'expired':c.state})),can_run:!!(a.enabled&&online&&a.status?.clock_synced===true&&a.status?.battery_ok===true&&a.status?.water_ok===true&&!a.status?.manual_off&&a.status?.output!=='on'&&(!a.next_run_at||Date.parse(a.next_run_at)<=now))};
}
export function actuatorRoutes({db,one,rpc,user,member,send,filter,rawBody,rate,env,equal}) {
 return async(req,res,url)=>{
  const path=url.pathname;
  if(path.startsWith('/internal/actuators/')) {
   if(req.method!=='POST')fail('Metode tidak diizinkan',405);
   if(!equal(req.headers['x-aerosense-internal-key'],env.INTERNAL_API_KEY))fail('Unauthorized',401);
   const p=JSON.parse((await rawBody(req,6000)).toString()||'{}');
   if(path==='/internal/actuators/claim'){send(res,200,{commands:await rpc('actuator_claim')});return true;}
   if(path==='/internal/actuators/published'){
    if(!uuid.test(p.id)||!uuid.test(p.token))fail('Identitas dispatch tidak valid');
    send(res,200,{updated:await rpc('actuator_published',{p_id:p.id,p_token:p.token})});return true;
   }
   if(path==='/internal/actuators/event'){
    const match=/^aerosense\/actuators\/([a-z0-9-]{1,40})\/(ack|status)$/.exec(p.topic||'');
    const body=typeof p.message==='string'?JSON.parse(p.message):p.message;
    if(!match||!body||typeof body!=='object'||Array.isArray(body)||body.actuator_id!==match[1])fail('Topik dan perangkat tidak cocok');
    if(!(await one('ae_actuators','id=eq.'+filter(match[1]))))fail('Sprinkler belum terdaftar',404);
    if(match[2]==='ack'){
     if(!uuid.test(body.command_id)) {send(res,200,{ignored:'non_web_command'});return true;}
     if(!['accepted','completed','rejected','fault'].includes(body.state))fail('Status ACK tidak valid');
     send(res,200,{updated:await rpc('actuator_ack',{p_actuator:match[1],p_id:body.command_id,p_state:body.state,p_reason:String(body.reason||'').slice(0,100)})});return true;
    }
    if(!['online','offline'].includes(body.state))fail('Status perangkat tidak valid');
    const now=Date.now(),at=Date.parse(body.at);
    if(body.state==='online'&&(!Number.isFinite(at)||now-at>45000||at>now+5000)){send(res,200,{ignored:'stale_status'});return true;}
    const status={state:body.state,output:body.output==='on'?'on':'off',clock_synced:body.clock_synced===true,battery_ok:body.battery_ok===true,water_ok:body.water_ok===true,manual_off:body.manual_off===true,active_command_id:typeof body.active_command_id==='string'?body.active_command_id.slice(0,96):null,battery_v:Number.isFinite(body.battery_v)?body.battery_v:null};
    await db('ae_actuators','id=eq.'+filter(match[1]),'PATCH',{status,last_seen_at:new Date(now).toISOString()});
    send(res,200,{updated:true});return true;
   }
   fail('Not found',404);
  }
  if(!['/v1/actuators','/v1/actuators/commands'].includes(path))return false;
  const account=await user(req);
  if(path==='/v1/actuators'&&req.method==='GET'){
   const nodeId=url.searchParams.get('node_id');
   if(!nodeId||!/^[a-zA-Z0-9_-]{1,40}$/.test(nodeId))fail('Pilih lokasi sensor');
   const node=await member(account,nodeId);
   const rows=await db('ae_actuators','node_id=eq.'+filter(nodeId)+'&order=name.asc');
   const actuators=[];
   for(const a of rows){const commands=await db('ae_actuator_commands','actuator_id=eq.'+filter(a.id)+'&order=issued_at.desc&limit=5');actuators.push(actuatorView(a,commands));}
   send(res,200,{actuators,can_manage:canManage(node.member_role)});return true;
  }
  if(path==='/v1/actuators/commands'&&req.method==='POST'){
   const p=JSON.parse(await rawBody(req,4000));
   if(!idPattern.test(p.actuator_id)||!uuid.test(p.request_id)||!['pulse','stop'].includes(p.action))fail('Perintah sprinkler tidak valid');
   const a=await one('ae_actuators','id=eq.'+filter(p.actuator_id));
   if(!a)fail('Sprinkler tidak ditemukan',404);
   await member(account,a.node_id,true);
   rate('sprinkler:'+account.id,p.action==='stop'?60:12);
   const duration=p.action==='stop'?0:p.duration_ms;
   if(!Number.isInteger(duration)||duration<0||duration>Math.min(a.max_duration_ms,10000)||(p.action==='pulse'&&duration<1000))fail('Durasi harus 1–10 detik dan sesuai batas perangkat');
   let command;
   try {command=await rpc('actuator_enqueue',{p_user:account.id,p_actuator:a.id,p_action:p.action,p_duration:duration,p_request:p.request_id});}
   catch(err){if(err.status===400)fail('Perintah ditolak. Periksa kesiapan perangkat, jeda operasi, dan izin lokasi.',409);throw err;}
   send(res,202,{command});return true;
  }
  fail('Metode tidak diizinkan',405);
 };
}
