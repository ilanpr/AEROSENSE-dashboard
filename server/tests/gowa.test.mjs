import test from "node:test";
import assert from "node:assert/strict";
import { normalizeGowa, sendGowa, gowaText, gowaChoiceIds, phoneFromJid } from "../api/gowa.mjs";
const env = { GOWA_DEVICE_JID: "628111111111@s.whatsapp.net", GOWA_DEVICE_ID: "aerosense", GOWA_BASIC_AUTH: "aerosense:testing", GOWA_BASE_URL: "http://gowa:3000" };
const message = (body = "kondisi") => ({ event: "message", device_id: env.GOWA_DEVICE_JID, session_id: "aerosense", payload: {
  id: "3EB123", chat_id: "628222222222@s.whatsapp.net", from: "628222222222@s.whatsapp.net",
  timestamp: new Date().toISOString(), is_from_me: false, body,
} });
test("GOWA accepts only current private messages from the bound account", () => {
  assert.equal(normalizeGowa(message(), env).phone, "628222222222");
  for (const patch of [{is_from_me:true}, {chat_id:"123@g.us"}, {chat_id:"123@lid"}, {timestamp:"bad"},
    {timestamp:new Date(Date.now()-86400001).toISOString()}, {timestamp:new Date(Date.now()+600000).toISOString()}, {id:"bad.id"},
    {from:"628333333333@s.whatsapp.net"}]) assert.equal(normalizeGowa({...message(),payload:{...message().payload,...patch}},env),null);
  assert.equal(normalizeGowa({...message(),device_id:"628444444444@s.whatsapp.net"},env),null);
  assert.equal(normalizeGowa({...message(),session_id:"other"},env),null);
  assert.equal(normalizeGowa(message(),{...env,GOWA_DEVICE_JID:""}),null);
  assert.equal(phoneFromJid("123456789@lid"),null);
});
test("Pairing and STOP remain text; typed menu options reach existing n8n handlers", () => {
  for (const text of ["DAFTAR abcdef0123456789","BERHENTI","STOP"]) {
    const m = normalizeGowa(message(text),env).message;
    assert.equal(m.type,"text"); assert.equal(m.text.body,text);
  }
  for (const [text,id] of [["node Surabaya-01","ae:node:Surabaya-01"],["notifikasi nonaktif","ae:disable"],["lokasi 2","ae:nodes:1"]])
    assert.equal(normalizeGowa(message(text),env).message.interactive.list_reply.id,id);
  assert.equal(gowaText({text:"Pilih node",interactive:{action:{sections:[{rows:[{id:"ae:node:n1",title:"Node satu"}]}]}}}),"Pilih node\n\n*1*  Node satu\n\nBalas angka *1* untuk memilih.\n*0* untuk menu.");
});
test("Greetings discover the menu without a keyword; numbers follow the last shown menu", () => {
  for (const text of ["Halo", "Hai AERO-BOT!", "Selamat pagi", "Mulai", "0", "99"])
    assert.equal(normalizeGowa(message(text),env).message.interactive.list_reply.id,"ae:menu");
  assert.equal(normalizeGowa(message("1"),env).message.interactive.list_reply.id,"ae:latest");
  const body={text:"Pilih lokasi",interactive:{action:{sections:[{rows:[{id:"ae:node:n1",title:"Surabaya 01"},{id:"ae:node:n2",title:"Surabaya 02"}]}]}}};
  const ids=gowaChoiceIds(body);
  assert.equal(normalizeGowa(message("2"),env,Date.now(),ids).message.interactive.list_reply.id,"ae:node:n2");
  assert.equal(normalizeGowa(message("3"),env,Date.now(),ids).message.interactive.list_reply.id,"ae:menu");
  assert.equal(normalizeGowa(message("Apa penyebab polusi udara?"),env).message.type,"text");
  assert.deepEqual(gowaChoiceIds({interactive:{action:{buttons:[{reply:{id:"not-a-command",title:"Bad"}}]}}}),[]);
});
test("Main menu is compact, numbered and includes a way back; alerts keep their original text", () => {
  const ids=["latest","nodes","history","chart","summary","chat","settings"];
  const body={text:"Old verbose welcome",interactive:{action:{sections:[{rows:ids.map(id=>({id:"ae:"+id,title:id}))}]}}};
  const text=gowaText(body);
  assert.match(text,/^\*AEROSENSE\*/);assert.match(text,/\*7\*  Notifikasi/);assert.doesNotMatch(text,/Old verbose|Ketik:|kondisi: kondisi/);
  assert.equal(text.split("\n").length,13);
  assert.equal(gowaText({text:"Sensor waspada",alert_id:"a1"}),"Sensor waspada");
});
test("GOWA receipts reject groups/unknown states and cap batches", () => {
  const ack = {...message(),event:"message.ack",payload:{chat_id:message().payload.chat_id,ids:["3EB123"],receipt_type:"read"}};
  assert.equal(normalizeGowa(ack,env).status,"read");
  for (const patch of [{receipt_type:"sent"},{ids:Array(101).fill("3EB123")},{chat_id:"123@g.us"}])
    assert.equal(normalizeGowa({...ack,payload:{...ack.payload,...patch}},env),null);
});
test("Private LID receipts use GOWA's resolved phone sender without accepting groups or unresolved LIDs", () => {
  const ack = {...message(),event:"message.ack",payload:{chat_id:"123456789012345@lid",from:"628222222222@s.whatsapp.net",ids:["3EB123"],receipt_type:"delivered"}};
  assert.equal(normalizeGowa(ack,env).phone,"628222222222");
  for (const patch of [{chat_id:"123456789@g.us"},{from:"123456789012345@lid"},{from:null}])
    assert.equal(normalizeGowa({...ack,payload:{...ack.payload,...patch}},env),null);
  assert.equal(normalizeGowa({...ack,event:"message",payload:{...ack.payload,...message().payload,chat_id:ack.payload.chat_id}},env),null);
});
test("GOWA uses Basic auth and device header; ambiguous sends are not definitive failures", async () => {
  const id = await sendGowa({phone:"628222222222",text:"Uji"},env,async(url,options)=>{
    assert.equal(url.pathname,"/send/message"); assert.equal(options.redirect,"error");
    assert.equal(options.headers["X-Device-Id"],"aerosense");
    assert.equal(options.headers.Authorization,"Basic " + Buffer.from(env.GOWA_BASIC_AUTH).toString("base64"));
    assert.deepEqual(JSON.parse(options.body),{phone:"628222222222@s.whatsapp.net",message:"Uji\n\nKetik *0* untuk menu."});
    return new Response(JSON.stringify({code:"SUCCESS",results:{message_id:"3EB456"}}));
  });
  assert.equal(id,"3EB456");
  await assert.rejects(sendGowa({phone:"628222222222",text:"x"},env,async()=>new Response("",{status:503})),e=>e.definitive===false);
  await assert.rejects(sendGowa({phone:"628222222222",text:"x"},env,async()=>new Response("",{status:401})),e=>e.definitive===true);
  await assert.rejects(sendGowa({phone:"628222222222",text:"x"},env,async()=>new Response("{}")),/acknowledgement missing/);
});
