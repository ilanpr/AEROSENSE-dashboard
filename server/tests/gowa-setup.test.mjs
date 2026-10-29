import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scripts = fileURLToPath(new URL("../scripts/", import.meta.url));
const bash = process.platform === "win32" ? "C:/Program Files/Git/bin/bash.exe" : "bash";
const shellPath = value => value.replace(/\\/g, "/").replace(/^([A-Za-z]):/, (_, drive) => "/" + drive.toLowerCase());
function run(command, args, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {env:{...process.env,...env},stdio:["ignore","pipe","pipe"]});
    let stdout="",stderr="";
    child.stdout.on("data",d=>stdout+=d);child.stderr.on("data",d=>stderr+=d);
    child.once("error",reject);child.once("close",code=>resolve({code,stdout,stderr}));
  });
}
test("GOWA recovery creates an absent device from null registry and preserves an existing slot", async () => {
  let devices=null, creates=0, mode="ok";
  const requests=[];
  const mock=http.createServer(async(req,res)=>{
    requests.push(req.method+" "+req.url);
    assert.equal(req.headers.authorization,"Basic "+Buffer.from("aerosense:"+"a".repeat(48)).toString("base64"));
    if(mode==="broken") {res.writeHead(500);res.end('{"message":"private upstream details"}');return;}
    if(mode==="malformed") {res.writeHead(200);res.end('{"code":"SUCCESS","results":{}}');return;}
    // Reproduce v9.6.0's generic 500 for the missing-slot detail route.
    if(req.url!=="/devices") {res.writeHead(500);res.end("{}");return;}
    if(req.method==="POST") {
      let body="";for await(const chunk of req)body+=chunk;
      assert.deepEqual(JSON.parse(body),{device_id:"aerosense"});
      creates++; devices=[{id:"aerosense",jid:"",state:"disconnected"}];
      res.end(JSON.stringify({code:"SUCCESS",results:devices[0]}));return;
    }
    res.end(JSON.stringify({code:"SUCCESS",results:devices}));
  });
  await new Promise(r=>mock.listen(0,"127.0.0.1",r));
  const env={GOWA_BASE_URL:"http://127.0.0.1:"+mock.address().port,GOWA_DEVICE_ID:"aerosense",GOWA_BASIC_AUTH:"aerosense:"+"a".repeat(48)};
  const ensure=()=>run(process.execPath,[path.join(scripts,"ensure-gowa-device.mjs")],env);
  const temp=await fs.mkdtemp(path.join(os.tmpdir(),"aerosense-gowa-recovery-"));
  try {
    const created=await ensure();assert.equal(created.code,0,created.stderr);assert.match(created.stdout,/created/);assert.equal(creates,1);
    const existing=await ensure();assert.equal(existing.code,0,existing.stderr);assert.match(existing.stdout,/existing/);assert.equal(creates,1);
    assert.equal(requests.some(r=>r.includes("/devices/aerosense")),false);
    mode="broken";
    const broken=await ensure();assert.equal(broken.code,1);assert.match(broken.stderr,/HTTP 500/);assert.doesNotMatch(broken.stderr,/private upstream details/);assert.equal(creates,1);
    mode="malformed";
    const malformed=await ensure();assert.equal(malformed.code,1);assert.match(malformed.stderr,/Invalid GOWA device list/);assert.equal(creates,1);
    // Exercise the actual recovery entrypoint. It must not run compose up/rebuild or regenerate secrets.
    mode="ok";
    const target=path.join(temp,"aerosense-api");await fs.mkdir(path.join(target,"scripts"),{recursive:true});
    for(const name of ["ensure-gowa-device.mjs","wait-api.sh","setup-gowa.sh"])
      await fs.copyFile(path.join(scripts,name),path.join(target,"scripts",name));
    const credentials="GOWA_BASIC_AUTH="+env.GOWA_BASIC_AUTH+"\nGOWA_WEBHOOK_SECRET="+"b".repeat(64)+"\n";
    await fs.writeFile(path.join(target,".env.gowa"),credentials);await fs.writeFile(path.join(target,".env"),"original-environment\n");
    await fs.writeFile(path.join(target,"compose.gowa.yaml"),"services: {}\n");
    const resume=await run(bash,["-c",`curl() { printf '%s' '{"status":"ok"}'; }
export -f curl
docker() { [[ "$*" == 'compose exec -T aerosense-api node --input-type=module' ]] || return 97; "$NODE_TEST_RUNTIME" --input-type=module; }
source "$SETUP_SCRIPT" resume`],{...env,HOME:shellPath(temp),NODE_TEST_RUNTIME:shellPath(process.execPath),SETUP_SCRIPT:shellPath(path.join(target,"scripts/setup-gowa.sh"))});
    assert.equal(resume.code,0,resume.stderr);assert.match(resume.stdout,/GOWA ready/);assert.equal(creates,1);
    assert.equal(await fs.readFile(path.join(target,".env.gowa"),"utf8"),credentials);
    assert.equal(await fs.readFile(path.join(target,".env"),"utf8"),"original-environment\n");
  } finally {await new Promise(r=>mock.close(r));await fs.rm(temp,{recursive:true,force:true});}
});

test("API readiness recovers from reset and rejects unavailable or HTML health responses", async () => {
  const temp=await fs.mkdtemp(path.join(os.tmpdir(),"aerosense-health-"));
  const counter=path.join(temp,"calls");
  const invocation=`curl() {
  calls=0; [[ ! -f "$HEALTH_COUNTER" ]] || read -r calls < "$HEALTH_COUNTER";
  calls=$((calls+1)); printf '%s\\n' "$calls" > "$HEALTH_COUNTER";
  [[ "$HEALTH_MODE" != down ]] || return 7;
  if [[ "$HEALTH_MODE" == reset && "$calls" == 1 ]]; then return 56; fi
  if [[ "$HEALTH_MODE" == html ]]; then printf '<html>frontend</html>'; else printf '%s' '{"status":"ok"}'; fi
}
source "$WAIT_SCRIPT" http://127.0.0.1:8080/health "$HEALTH_ATTEMPTS"`;
  const check=(mode,attempts)=>run(bash,["-c",invocation],{HEALTH_MODE:mode,HEALTH_ATTEMPTS:String(attempts),HEALTH_COUNTER:shellPath(counter),WAIT_SCRIPT:shellPath(path.join(scripts,"wait-api.sh"))});
  try {
    const recovered=await check("reset",2);assert.equal(recovered.code,0,recovered.stderr);assert.deepEqual(JSON.parse(recovered.stdout),{status:"ok"});
    assert.equal((await fs.readFile(counter,"utf8")).trim(),"2");
    for(const mode of ["html","down"]) {
      const failed=await check(mode,1);assert.equal(failed.code,1);assert.match(failed.stderr,/API belum siap/);
    }
  } finally {await fs.rm(temp,{recursive:true,force:true});}
});
