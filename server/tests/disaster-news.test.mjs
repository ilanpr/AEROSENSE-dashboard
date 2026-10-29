import test from "node:test";
import assert from "node:assert/strict";
import { parseDisasterFeed, disasterNews, NEWS_SOURCES } from "../api/disaster-news.mjs";
const now = Date.parse("2026-10-18T06:00:00Z");
const at = new Date(now - 3600000).toUTCString();
const rss = items => `<rss xmlns:gdacs="https://www.gdacs.org"><channel>${items}</channel></rss>`;
const item = (country="IDN", date=at, link="https://www.gdacs.org/report.aspx?eventid=1") => `<item><title>Forest fire notification in Indonesia</title><link>${link}</link><pubDate>${date}</pubDate><gdacs:iso3>${country}</gdacs:iso3><gdacs:eventtype>WF</gdacs:eventtype><gdacs:severity unit="ha" value="6500">6500 ha</gdacs:severity><gdacs:population value="9000">9000</gdacs:population></item>`;

test("disaster feed keeps recent Indonesia events and distinguishes model area from confirmed impact", () => {
  const xml = rss(item()+item("MYS")+item("IDN",new Date(now-8*86400000).toUTCString())+item("IDN",new Date(now+86400000).toUTCString())+item("IDN",at,"javascript:alert(1)"));
  const result = parseDisasterFeed(xml,NEWS_SOURCES[0],now);
  assert.equal(result.length,1);
  assert.equal(result[0].country_code,"IDN");
  assert.equal(result[0].kind,"monitoring");
  assert.deepEqual(result[0].metrics,[{value:6500,unit:"ha",label:"Estimasi area GDACS"}]);
  assert(!JSON.stringify(result).includes("9000"));
  assert.throws(()=>parseDisasterFeed('<!DOCTYPE rss [<!ENTITY x "bad">]><rss/>',NEWS_SOURCES[0],now));
  assert.throws(()=>parseDisasterFeed('<rss><channel></rss>',NEWS_SOURCES[0],now));
});

test("ANTARA rejects foreign, ambiguous and unrelated headlines", () => {
  const xml = rss(["Banjir di Surabaya mulai surut","Banjir di India memburuk","Banjir meluas di sejumlah wilayah","Cuaca ekstrem di Australia dan Indonesia","Belajar kompos di Surabaya"].map((title,i)=>`<item><title>${title}</title><pubDate>${at}</pubDate><link>https://www.antaranews.com/berita/${i}</link></item>`).join(""));
  const result=parseDisasterFeed(xml,NEWS_SOURCES[1],now);
  assert.equal(result.length,1);
  assert.equal(result[0].location,"Surabaya");
});

test("recognized Indonesian regional fire headlines are not dropped",()=>{
  const title="BPBD Hulu Sungai Selatan Tangani Karhutla di Lahan Warga";
  const result=parseDisasterFeed(rss(`<item><title>${title}</title><pubDate>${at}</pubDate><link>https://www.antaranews.com/berita/1</link></item>`),NEWS_SOURCES[2],now);
  assert.equal(result.length,1);assert.equal(result[0].type,"Karhutla");
});

test("successful short RSS updates retain recent cached reports and outages remain explicit",async()=>{
  let rows=[],time=now,empty=false,offline=false;
  const news=disasterNews({clock:()=>time,db:async(_t,_q,method,body)=>{if(method==="POST"){rows=rows.filter(r=>r.provider!==body.provider).concat(body);return;}return structuredClone(rows);},fetcher:async url=>{if(offline)throw Error("offline");return new Response(rss(!empty&&url.includes("gdacs")?item():""));}});
  await news.refresh();empty=true;time+=20*60000;await news.refresh();
  assert.equal((await news.read()).items.length,1);
  time+=8*86400000;offline=true;
  const unavailable=await news.read();assert.equal(unavailable.status,"unavailable");assert.equal(unavailable.items.length,0);assert(unavailable.sources.every(s=>s.error));
});

test("shared refresh coalesces visitors, deduplicates links and keeps last success during outages", async () => {
  let rows=[], calls=0, time=now, fail=false;
  const db=async (_table,_q,method,body)=>{
    if(method==="POST") {rows=rows.filter(r=>r.provider!==body.provider).concat(body);return null;}
    return structuredClone(rows);
  };
  const news=disasterNews({db,clock:()=>time,fetcher:async url=>{calls++; if(fail)throw Error("offline");return new Response(url.includes("gdacs")?rss(item()+item()):rss(""));}});
  await Promise.all([news.refresh(),news.refresh(),news.refresh()]);
  assert.equal(calls,3);
  assert.equal((await news.read()).items.length,1);
  await news.refresh();assert.equal(calls,3);
  time+=2*3600000;fail=true;await news.refresh();
  const stale=await news.read();
  assert.equal(stale.items.length,1);
  assert.equal(stale.items[0].stale,true);
  assert(stale.sources.every(s=>s.error));
  time+=8*86400000;
  assert.deepEqual((await news.read()).items,[]);
});
