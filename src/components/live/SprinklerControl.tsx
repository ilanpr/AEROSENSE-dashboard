import { useState } from 'react';
import { Droplets, Square, Radio, Loader2 } from 'lucide-react';
import { useLiveData } from '@/hooks/useLiveData';
import { api } from '@/services/api';
import { MonitoringSelect } from '@/components/shared/MonitoringSelect';
import './sprinkler-control.css';
type Command={id:string;action:'pulse'|'stop';state:string;reason?:string;issued_at:string;expires_at:string};
type Actuator={id:string;name:string;enabled:boolean;online:boolean;can_run:boolean;max_duration_ms:number;next_run_at?:string;status:{output?:string;active_command_id?:string;battery_v?:number;battery_ok?:boolean};commands:Command[]};
const labels:Record<string,string>={queued:'Menunggu pengiriman',dispatching:'Mengirim ke perangkat',published:'Menunggu balasan ESP32',accepted:'Perintah berjalan',completed:'Selesai',rejected:'Ditolak perangkat',fault:'Dihentikan pengaman',expired:'Balasan belum diterima',cancelled:'Dibatalkan',stopped:'Dihentikan'};
function SprinklerCard({actuator:a,canManage}:{actuator:Actuator;canManage:boolean}){
 const [seconds,setSeconds]=useState('3'),[busy,setBusy]=useState(false),[stopping,setStopping]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[confirm,setConfirm]=useState(false),[pending,setPending]=useState<Command|null>(null);
 const latest=a.commands[0];
 const command=latest&&(!pending||Date.parse(latest.issued_at)>=Date.parse(pending.issued_at))?latest:pending;
 const active=command&&['queued','dispatching','published','accepted'].includes(command.state)&&Date.parse(command.expires_at)>Date.now();
 async function send(action:'pulse'|'stop'){
  if(action==='stop')setStopping(true);else setBusy(true);setError('');setNotice('');
  try{const result=await api.post<{command:Command}>('/v1/actuators/commands',{actuator_id:a.id,action,duration_ms:action==='stop'?0:Number(seconds)*1000,request_id:crypto.randomUUID()});setPending(previous=>!previous||Date.parse(result.command.issued_at)>=Date.parse(previous.issued_at)?result.command:previous);setConfirm(false);setNotice(action==='stop'?'Perintah berhenti dikirim. Menunggu konfirmasi perangkat.':'Perintah masuk antrean. Status akan diperbarui dari ESP32.');}
  catch(e){setError(e instanceof Error?e.message:'Perintah belum dapat dikirim.');}
  finally{if(action==='stop')setStopping(false);else setBusy(false);}
 }
 return <article className="sprinkler-card">
  <div className="sprinkler-card-heading"><div className="sprinkler-device-icon"><Droplets size={24} aria-hidden="true"/></div><div><h3>{a.name}</h3><p>WATERSENSE · {a.id}</p></div><span className={'sprinkler-connection '+(a.online?'online':'')}><Radio size={14} aria-hidden="true"/>{a.online?'Terhubung':'Offline'}</span></div>
  <dl className="sprinkler-facts"><div><dt>Perangkat</dt><dd>{a.enabled?'Kontrol diaktifkan':'Belum diaktifkan admin'}</dd></div><div><dt>Baterai</dt><dd>{a.online&&typeof a.status.battery_v==='number'?`${a.status.battery_v.toFixed(1)} V`:'Belum tersedia'}</dd></div><div><dt>Keluaran ESP32</dt><dd>{a.online?(a.status.output==='on'?'Aktif':'Mati'):'Belum terkonfirmasi'}</dd></div></dl>
  <div className="sprinkler-command-status" role="status" aria-live="polite"><strong>{command?labels[command.state]||command.state:'Siap menerima perintah'}</strong><span>{!a.online?'Periksa Wi-Fi dan daya WATERSENSE.':a.next_run_at&&Date.parse(a.next_run_at)>Date.now()?`Jeda operasi sampai ${new Date(a.next_run_at).toLocaleTimeString('id-ID')}.`:'Durasi dibatasi dan pompa berhenti otomatis.'}</span></div>
  {canManage?<><label className="sprinkler-duration">Durasi penyemprotan<MonitoringSelect label={'Durasi '+a.name} value={seconds} onValueChange={v=>{setSeconds(v);setConfirm(false);}} options={Array.from({length:Math.floor(a.max_duration_ms/1000)},(_,i)=>({value:String(i+1),label:`${i+1} detik`}))}/></label>
   <div className="sprinkler-actions"><button className="live-button" disabled={busy||!a.can_run||!!active} onClick={()=>setConfirm(true)}><Droplets size={16} aria-hidden="true"/>Aktifkan sprinkler</button><button className="sprinkler-stop" disabled={stopping} onClick={()=>void send('stop')}><Square size={16} aria-hidden="true"/>Hentikan</button></div>
   {confirm&&<div className="sprinkler-confirm"><p>Aktifkan <strong>{a.name}</strong> selama <strong>{seconds} detik</strong>?</p><div><button className="live-button" disabled={busy||!a.can_run} onClick={()=>void send('pulse')}>{busy?<Loader2 size={16} className="animate-spin"/>:null}Ya, aktifkan</button><button className="live-button secondary" disabled={busy} onClick={()=>setConfirm(false)}>Batal</button></div></div>}
  </>:<p className="sprinkler-readonly">Kontrol memerlukan penugasan admin atau pengelola pada lokasi ini.</p>}
  {notice&&<p className="sprinkler-notice" role="status">{notice}</p>}{error&&<p className="threshold-error" role="alert">{error}</p>}
 </article>;
}
export function SprinklerControl({nodeId}:{nodeId:string}){
 const data=useLiveData<{actuators:Actuator[];can_manage:boolean}>(`/v1/actuators?node_id=${encodeURIComponent(nodeId)}`,2000);
 return <section className="sprinkler-section" aria-labelledby="sprinkler-heading"><header><div><h2 id="sprinkler-heading">Kendali sprinkler</h2><p>Aktifkan WATERSENSE pada area yang menjadi tanggung jawab Anda.</p></div><Droplets size={26} aria-hidden="true"/></header>
 {data.loading&&!data.data?<p role="status">Memeriksa perangkat…</p>:data.error?<div role="alert"><p>{data.error}</p><button className="live-button secondary" onClick={data.refresh}>Coba kembali</button></div>:!data.data?.actuators.length?<div className="sprinkler-empty"><Droplets size={24} aria-hidden="true"/><div><h3>Belum ada sprinkler di titik ini</h3><p>Admin dapat mendaftarkan WATERSENSE pada lokasi yang dilayani. Tidak semua titik sensor memerlukan sprinkler.</p></div></div>:<div className="sprinkler-list">{data.data.actuators.map(a=><SprinklerCard key={a.id} actuator={a} canManage={data.data!.can_manage}/>)}</div>}
 </section>;
}
