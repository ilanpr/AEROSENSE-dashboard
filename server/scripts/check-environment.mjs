import { readFile } from "node:fs/promises";
import { readEnvironment } from "../api/web.mjs";
const base="http://127.0.0.1:"+(process.env.PORT||8080);
async function read(path) {
  const r=await fetch(base+path,{signal:AbortSignal.timeout(20000)});
  if(!r.ok)throw Error(`${path}: HTTP ${r.status}`);
  return r.json();
}
try {
  const revision=JSON.parse(await readFile(new URL("../api/deployment-revision.json",import.meta.url),"utf8").catch(()=>"{}"));
  console.log("revision:",revision.commit||"not_tagged");
  console.log("health:",(await read("/health")).status);
  const dashboard=await read("/v1/public/dashboard");
  console.log("public_nodes:",dashboard.nodes.length);
  if(dashboard.nodes[0]) {
    const env=await read("/v1/public/environment?node_id="+encodeURIComponent(dashboard.nodes[0].id));
    if(!Array.isArray(env.events)||!Array.isArray(env.event_layers))throw Error("Backend belum memakai kontrak koordinat kejadian terbaru");
    console.log("event_layers:",JSON.stringify(env.event_layers));
    console.log("events:",env.events.length);
  }else {
    console.log("public_nodes: none published; checking private cache without changing publication");
    async function db(table,query) {
      const r=await fetch(process.env.SUPABASE_URL.replace(/\/$/,"")+"/rest/v1/"+table+"?"+query,{
        headers:{apikey:process.env.SUPABASE_SERVICE_ROLE_KEY,Authorization:"Bearer "+process.env.SUPABASE_SERVICE_ROLE_KEY},signal:AbortSignal.timeout(20000),
      });
      if(!r.ok)throw Error(`${table}: HTTP ${r.status}`);
      return r.json();
    }
    const one=async(table,query)=>(await db(table,query+"&limit=1"))[0]||null;
    const node=await one("ae_nodes","enabled=eq.true&order=id.asc");
    if(!node)throw Error("Tidak ada node aktif untuk memeriksa cache lingkungan");
    const env=await readEnvironment({db,one,node});
    console.log("internal_cache_probe:",JSON.stringify({node_id:node.id,event_layers:env.event_layers,events:env.events.length}));
  }
  const news=await read("/v1/disasters");
  console.log("news:",JSON.stringify({status:news.status,items:news.items.length,karhutla:news.items.filter(i=>i.type==="Karhutla").length,sources:news.sources}));
} catch(error) {console.error(error.message);process.exitCode=1;}
