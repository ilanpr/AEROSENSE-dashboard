// Imported as a Code node. The ESP32 must independently enforce TTL, dedup and cooldown.
function decideMist(config, snapshot, previous = {}, now = Date.now()) {
 const stop = reason => ({publish:false,reason,node_id:config.node_id,actuator_id:config.actuator_id,dry_run:config.dry_run});
 const id = /^[a-zA-Z0-9_-]{1,40}$/;
 if(!id.test(config.node_id)||!id.test(config.actuator_id))return stop("invalid_mapping");
 if(!["dust_ug_m3","pm25_ug_m3"].includes(config.metric))return stop("unsupported_metric");
 if(!snapshot.node?.enabled||snapshot.node.id!==config.node_id)return stop("node_unavailable");
 if(config.metric==="pm25_ug_m3"&&snapshot.node.pm25_validated!==true)return stop("pm25_not_validated");
 const rule=snapshot.rule;
 if(!rule?.enabled||rule.node_id!==config.node_id||rule.metric!==config.metric||!Number.isFinite(rule.high)||!Number.isFinite(rule.danger_high)||!Number.isFinite(rule.clear_below)||rule.clear_below>=rule.high||rule.danger_high<=rule.high)return stop("rule_not_ready");
 if(!Number.isInteger(config.confirm_readings)||config.confirm_readings<3||config.confirm_readings>10||!Number.isFinite(config.max_age_seconds)||config.max_age_seconds<10||config.max_age_seconds>300)return stop("invalid_confirmation_config");
 if(!Number.isInteger(config.cooldown_seconds)||config.cooldown_seconds<60||config.cooldown_seconds>86400)return stop("invalid_cooldown");
 if(![config.warning_seconds,config.danger_seconds].every(v=>Number.isInteger(v)&&v>=1&&v<=10)||config.danger_seconds<config.warning_seconds)return stop("invalid_duration");
 const readings=(snapshot.readings||[]).slice(0,config.confirm_readings);
 if(readings.length!==config.confirm_readings)return stop("insufficient_readings");
 const times=readings.map(r=>Date.parse(r.observed_at));
 if(readings.some((r,i)=>r.node_id!==config.node_id||typeof r.id!=="string"||r.quality?.invalid===true||!Number.isFinite(r.metrics?.[config.metric])||r.metrics[config.metric]<0||!Number.isFinite(times[i])||times[i]>now+5000||now-times[i]>config.max_age_seconds*1000))return stop("stale_or_invalid_reading");
 if(new Set(readings.map(r=>r.id)).size!==readings.length||times.some((t,i)=>i>0&&t>=times[i-1]))return stop("duplicate_or_unordered_readings");
 const values=readings.map(r=>r.metrics[config.metric]);
 if(!values.every(v=>v>=rule.high))return stop(values[0]<=rule.clear_below?"clear":"awaiting_confirmation");
 const status=values.every(v=>v>=rule.danger_high)?"danger":"warning";
 const reading=readings[0];
 if(previous.reading_id===reading.id)return stop("already_sent");
 if(Number.isFinite(previous.sent_at)&&now-previous.sent_at<config.cooldown_seconds*1000)return stop("cooldown");
 const command={version:1,command_id:`mist:${config.actuator_id}:${reading.id}`,actuator_id:config.actuator_id,node_id:config.node_id,reading_id:reading.id,metric:config.metric,status,action:"pulse",duration_ms:(status==="danger"?config.danger_seconds:config.warning_seconds)*1000,cooldown_ms:config.cooldown_seconds*1000,issued_at:new Date(now).toISOString(),expires_at:new Date(now+30000).toISOString()};
 return {publish:config.enabled===true&&config.dry_run===false,dry_run:config.dry_run!==false,reason:config.enabled!==true?"disabled":config.dry_run!==false?"dry_run":"ready",node_id:config.node_id,actuator_id:config.actuator_id,topic:`aerosense/actuators/${config.actuator_id}/command`,command};
}
const config=$("Pasangan node dan sprinkler").item.json;
const state=$getWorkflowStaticData("global");
return {json:decideMist(config,$json,state[config.actuator_id])};
