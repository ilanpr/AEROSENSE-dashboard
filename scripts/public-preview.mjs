// Fixed public providers only. No Supabase credentials, user data, or private APIs.
import { readFile } from "node:fs/promises";
import { disasterNews } from "../server/api/disaster-news.mjs";
import { readEventLayers } from "../server/api/environment-events.mjs";
import { DEMO_POINTS } from "../src/demo/data.ts";
import { summarizeEnvironment } from "../server/api/environment-insights.mjs";

export async function publicPreview() {
  const code = await readFile(new URL("../n8n/environment-normalizer.js",import.meta.url),"utf8");
  const normalize = new Function("response","request","now",code.slice(0,code.lastIndexOf("\nreturn normalizeResponse("))+"\nreturn normalizeResponse(response,request,now);");
  let rows=[];
  const news=disasterNews({db:async(_table,_q,method,body)=>{if(method==="POST"){rows=rows.filter(r=>r.provider!==body.provider).concat(body);return null;}return structuredClone(rows);}});
  const feeds=[
    {provider:"firms",url:"https://firms.modaps.eosdis.nasa.gov/data/active_fire/viirs/csv/SUOMI_VIIRS_C2_SouthEast_Asia_24h.csv",source:"NASA FIRMS / VIIRS",source_url:"https://firms.modaps.eosdis.nasa.gov/",radius_km:50,ttl:3600},
    {provider:"bmkg_quake",url:"https://data.bmkg.go.id/DataMKG/TEWS/gempaterkini.json",source:"BMKG",source_url:"https://data.bmkg.go.id/gempabumi/",radius_km:300,ttl:3600},
  ];
  const snapshots=new Map(), flights=new Map();
  async function fetchFeed(feed) {
    const old=snapshots.get(feed.provider);
    if(old?.retryAfter>Date.now())return old;
    if(flights.has(feed.provider))return flights.get(feed.provider);
    const flight=(async()=>{
      let value;
      try {
        const r=await fetch(feed.url,{signal:AbortSignal.timeout(15000),redirect:"error"});
        if(!r.ok)throw Error("Source unavailable");
        let size=0;const chunks=[];
        for await(const chunk of r.body){size+=chunk.length;if(size>8000000)throw Error("Feed too large");chunks.push(chunk);}
        const text=Buffer.concat(chunks).toString("utf8");
        value={body:feed.provider==="firms"?text:JSON.parse(text),at:Date.now(),error:null,retryAfter:Date.now()+15*60000};
      }catch{value={...old,error:"Sumber belum berhasil diperbarui",retryAfter:Date.now()+5*60000};}
      snapshots.set(feed.provider,value);return value;
    })().finally(()=>flights.delete(feed.provider));
    flights.set(feed.provider,flight);return flight;
  }
  return async function read(url) {
    if(url.pathname==="/demo-public/disasters")return news.read();
    if(url.pathname!=="/demo-public/environment")return null;
    const node=DEMO_POINTS.find(n=>n.id===url.searchParams.get("node_id"));
    if(!node)throw Object.assign(Error("Node demo tidak ditemukan"),{status:404});
    const area={...node,id:`demo-area-${node.id}`};
    const cache=await Promise.all(feeds.map(async feed=>{
      const snapshot=await fetchFeed(feed);
      const entry=normalize({statusCode:snapshot.body?200:503,body:snapshot.body},{...feed,targets:[area]},snapshot.at||Date.now()).json.entries[0];
      return {...entry,last_attempt_at:new Date().toISOString(),last_error:snapshot.error||entry.last_error};
    }));
    const facts=cache.flatMap(c=>c.payload.facts);
    return {...readEventLayers(cache,area),facts,insights:summarizeEnvironment(facts).filter(i=>["fire","earthquake"].includes(i.category)),providers:cache.map(c=>({provider:c.provider,last_attempt_at:c.last_attempt_at,last_error:c.last_error,refresh_after:c.refresh_after,facts:c.payload.facts})),fetched_at:new Date().toISOString()};
  };
}
