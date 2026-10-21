import { readFile, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
const code = await readFile(new URL("../n8n/robot-interaction.js", import.meta.url), "utf8");
const nodes = [];
const add = (name, type, parameters, position, typeVersion = 1) => nodes.push({ id: randomUUID(), name, type: `n8n-nodes-base.${type}`, typeVersion, position, parameters });
add("Dipanggil workflow robot", "executeWorkflowTrigger", { inputSource: "passthrough" }, [0, 100], 1.1);
add("Uji simulasi tanpa perangkat", "manualTrigger", {}, [0, 360]);
add("Contoh event interaksi", "code", { jsCode: `const now=Date.now();
const base={robot_id:"aerobot-01",observed_at:new Date(now).toISOString(),quiet:false};
return [
 {event_id:"test-wake",event:"presence",state:"sleep"},
 {event_id:"test-repeat",event:"presence",state:"awake"},
 {event_id:"test-listen",event:"wakeword",state:"awake"},
 {event_id:"test-think",event:"question",state:"listening"},
 {event_id:"test-answer",event:"answer",state:"thinking",job_id:"job-example",active_job_id:"job-example",audio_ready:true,answer_expression:"concerned",text:"Kurangi paparan asap dan periksa kondisi sekitar."},
 {event_id:"test-follow-up",event:"audio_finished",state:"speaking",job_id:"job-example",active_job_id:"job-example"},
 {event_id:"test-sleep",event:"idle_timeout",state:"awake",last_interaction_at:new Date(now-180000).toISOString()}
].map(value=>({json:{...base,...value}}));` }, [240, 360], 2);
add("Rencanakan wake dan ekspresi", "code", { mode: "runOnceForEachItem", jsCode: code }, [500, 160], 2);
add("Transisi diizinkan", "if", { conditions: { options: { caseSensitive: true, leftValue: "", typeValidation: "strict", version: 2 }, conditions: [{ id: randomUUID(), leftValue: "={{ $json.execute }}", rightValue: true, operator: { type: "boolean", operation: "true", singleValue: true } }], combinator: "and" }, options: {} }, [760, 160], 2.2);
add("Rencana untuk caller", "noOp", {}, [1020, 80]);
add("Event ditahan", "noOp", {}, [1020, 300]);
add("Kontrak interaksi robot", "stickyNote", { content: "## AEROSENSE · Robot wake dan ekspresi · DRAFT\nSensor infrared memberi indikasi objek/kehadiran, bukan memastikan manusia.\n\nSleep → waking (mata tertutup, membuka, berkedip, senyum) → sapaan Gemini → mendengarkan → berpikir → berbicara → pertanyaan lanjutan → sleep setelah idle 120 detik.\n\n- Uji manual hanya membuat rencana; tidak memakai mic/speaker atau mengirim perintah perangkat.\n- dispatch=false: caller harus mengantrekan secara idempotent dengan command_id dan TTL.\n- State/event harus baru (30 detik), job jawaban/ACK harus cocok. Presence saat sudah bangun ditahan; cooldown sapaan 120 detik.\n- Audio dan animasi disinkronkan agent lokal berdasarkan playback/ACK. Jangan memakai node Wait sebagai timer animasi atau mengirim tiap frame ke n8n.\n- Jawaban memakai expression allowlist neutral/happy/concerned, default neutral; bukan happy untuk semua jawaban.\n- Planner belum terhubung ke worker produksi. Pengambilan konteks, Gemini/TTS dan API robot yang sudah ada dipakai oleh caller saat integrasi.\n- Tidak menyimpan rekaman atau log per-frame di Supabase.", width: 740, height: 460 }, [210, -430]);
const connections = {};
const link = (from, to, branch = 0) => { connections[from] ??= { main: [] }; connections[from].main[branch] ??= []; connections[from].main[branch].push({ node: to, type: "main", index: 0 }); };
link("Dipanggil workflow robot", "Rencanakan wake dan ekspresi");
link("Uji simulasi tanpa perangkat", "Contoh event interaksi");
link("Contoh event interaksi", "Rencanakan wake dan ekspresi");
link("Rencanakan wake dan ekspresi", "Transisi diizinkan");
link("Transisi diizinkan", "Rencana untuk caller");
link("Transisi diizinkan", "Event ditahan", 1);
await writeFile(new URL("../n8n/robot-interaction.workflow.json", import.meta.url), JSON.stringify({ name: "AEROSENSE | Robot wake dan ekspresi", active: false, nodes, connections, settings: { executionOrder: "v1", executionTimeout: 30 }, pinData: {}, tags: [] }, null, 2) + "\n");
console.log("Prepared inactive robot interaction planner; no device dispatch.");
