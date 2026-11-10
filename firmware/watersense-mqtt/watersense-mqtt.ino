// WATERSENSE Wi-Fi/MQTT. ESP32-S3, GPIO4 MOSFET active HIGH, battery GPIO1, local button GPIO21.
// Automatic 15-second cycling from the hardware test is intentionally removed.
#include <WiFi.h>
#include <PubSubClient.h>
#include <Preferences.h>
#include <esp_timer.h>
#include <time.h>
#include "config.example.h"
#include "network_setup.h"
#include "watersense_logic.h"
#include "espnow_control.h"
#include "mqtt_wss.h"
WiFiClient net;
PubSubClient mqtt(net);
Preferences prefs;
NetworkSettings networkSettings{};
mist::State state{};
esp_timer_handle_t offTimer;
volatile bool timerExpired=false;
bool outputOn=false,remoteActive=false,batteryLow=true;
float batteryV=0;
uint32_t pulseStart=0,pulseDuration=0,lastBattery=0,lastStatus=0,lastConnect=0,lastDiag=0,lastButtonChange=0,lastLocalStart=0;
uint32_t sessionStart=0, sessionDuration=0, pauseStart=0;
int64_t sessionCooldown=mist::MIN_COOLDOWN_S;
bool localUsed=false,buttonRaw=HIGH,buttonStable=HIGH;
char activeCommand[96]="",lastAck[500]="",lastDoneId[96]="",lastDoneAck[500]="";
char commandTopic[100],ackTopic[100],statusTopic[100];
localLink::Pair sensorPeer{};
offline::Policy localPolicy{};
QueueHandle_t sensorInbox = nullptr;
bool wifiConfigured=false, joining=false, localSession=false, localLock=false, sensorFresh=false;
uint32_t wifiAttempt=0, localLockAt=0, localBlockMs=600000, lastSensor=0, sensorBoot=0, sensorSeq=0;
uint8_t consecutive=0, dangerCount=0;
void setPompa(bool on){outputOn=on;digitalWrite(PUMP_PIN,(on==PUMP_ACTIVE_HIGH)?HIGH:LOW);}
void timerOff(void*){digitalWrite(PUMP_PIN,PUMP_ACTIVE_HIGH?LOW:HIGH);timerExpired=true;}
void saveState(){prefs.putBytes("state",&state,sizeof(state));}
bool waterOk(){
#if WATER_OK_PIN >= 0
 return digitalRead(WATER_OK_PIN)==WATER_OK_LEVEL;
#else
 return true;
#endif
}
void readBattery(){uint32_t sum=0;for(int i=0;i<16;i++)sum+=analogReadMilliVolts(BATTERY_PIN);batteryV=(sum/16.f)/1000.f*BATTERY_RATIO;if(batteryV<5.f||batteryV<BATTERY_STOP_V)batteryLow=true;else if(batteryV>BATTERY_RESUME_V)batteryLow=false;}
void isoNow(char* out){time_t now=time(nullptr);tm utc;gmtime_r(&now,&utc);strftime(out,25,"%Y-%m-%dT%H:%M:%SZ",&utc);}
bool mqttConnected(){return networkSettings.port==443?secureMqtt::connected.load():mqtt.connected();}
void publishMqtt(const char* topic,const char* body){
 if(networkSettings.port==443)secureMqtt::publish(topic,body);
 else mqtt.publish(topic,body,true);
}
void ack(const char* id,const char* status,const char* reason,uint32_t duration=0){
 char at[25];isoNow(at);snprintf(lastAck,sizeof(lastAck),"{\"actuator_id\":\"%s\",\"command_id\":\"%s\",\"state\":\"%s\",\"reason\":\"%s\",\"duration_ms\":%lu,\"at\":\"%s\"}",networkSettings.id,id,status,reason,(unsigned long)duration,at);
 if(strcmp(status,"completed")==0||strcmp(status,"fault")==0){strlcpy(lastDoneId,id,sizeof(lastDoneId));strlcpy(lastDoneAck,lastAck,sizeof(lastDoneAck));}
 if(mqttConnected())publishMqtt(ackTopic,lastAck);
}
void publishStatus(){
 if(!mqttConnected())return;
 char at[25],body[840];isoNow(at);
 snprintf(body,sizeof(body),
          "{\"state\":\"online\",\"actuator_id\":\"%s\",\"output\":\"%s\",\"active_command_id\":\"%s\","
          "\"battery_v\":%.2f,\"battery_ok\":%s,\"water_ok\":%s,\"manual_off\":false,\"clock_synced\":%s,"
          "\"max_session_duration_ms\":%lu,\"session_burst_ms\":%lu,\"session_pause_ms\":%lu,"
          "\"session_active\":%s,\"manual_restart\":true,\"espnow_capable\":true,\"espnow_paired\":%s,\"espnow_fresh\":%s,"
          "\"espnow_policy_rev\":\"%s\",\"espnow_running\":%s,\"uptime_s\":%lu,\"at\":\"%s\"}",
          networkSettings.id,outputOn?"on":"off",activeCommand,batteryV,batteryLow?"false":"true",
          waterOk()?"true":"false",time(nullptr)>=mist::SYNCED_AFTER?"true":"false",
          (unsigned long)mist::MAX_SESSION_MS,(unsigned long)mist::SESSION_BURST_MS,
          (unsigned long)mist::SESSION_PAUSE_MS,
          sessionDuration?"true":"false",sensorInbox?"true":"false",sensorFresh?"true":"false",
          localPolicy.revision,localSession?"true":"false",(unsigned long)(millis()/1000),at);
 publishMqtt(statusTopic,body);lastStatus=millis();
}
void pumpOff(){
 esp_timer_stop(offTimer);timerExpired=false;
 setPompa(false);
}
void finishCommand(const char* status,const char* reason){
 pumpOff();
 if(!activeCommand[0])return;
 const uint32_t elapsed=millis()-(sessionDuration?sessionStart:pulseStart);
 if(sessionDuration){
  const time_t now=time(nullptr);
  if(now>=mist::SYNCED_AFTER){
   state.lastPulseEpoch=now;
   state.cooldownS=sessionCooldown;
   saveState();
  }
 }
 sessionDuration=0;
 if(localSession){localLockAt=millis();localSession=false;}
 ack(activeCommand,status,reason,elapsed);
 activeCommand[0]=0;
 remoteActive=false;
 publishStatus();
}
bool startBurst(uint32_t duration){
 pulseStart=millis();
 pulseDuration=duration;
 timerExpired=false;
 if(esp_timer_start_once(offTimer,(uint64_t)duration*1000)!=ESP_OK)return false;
 setPompa(true);
 return true;
}
void startCommand(const char* id,uint32_t duration,bool remote,const char* reason,bool session=false){
 strlcpy(activeCommand,id,sizeof(activeCommand));
 remoteActive=remote;
 sessionStart=millis();
 sessionDuration=session?duration:0;
 if(!startBurst(session?mist::sessionBurstDuration(duration):duration)){
  finishCommand("fault","timer_error");
  return;
 }
 ack(id,"accepted",reason,duration);
 publishStatus();
}
void updateCommand(){
 if(!activeCommand[0])return;
 if(batteryLow){finishCommand("fault","battery_low");return;}
 if(!waterOk()){finishCommand("fault","water_low");return;}
 if(localSession && millis()-lastSensor>=localLink::FRESH_MS){
  finishCommand("fault","sensor_link_lost");return;
 }
 if(remoteActive&&(WiFi.status()!=WL_CONNECTED||!mqttConnected())){
  finishCommand("fault","connection_lost");return;
 }
 const uint32_t now=millis();
 if(!sessionDuration){
  if(timerExpired||now-pulseStart>=pulseDuration)finishCommand("completed","timer");
  return;
 }
 const uint32_t remaining=mist::sessionRemaining(sessionStart,sessionDuration,now);
 if(!remaining){finishCommand("completed","session_timer");return;}
 if(outputOn&&(timerExpired||now-pulseStart>=pulseDuration)){
  pumpOff();
  pauseStart=now;
  publishStatus();
 }else if(!outputOn&&now-pauseStart>=mist::SESSION_PAUSE_MS){
  if(startBurst(mist::sessionBurstDuration(remaining)))publishStatus();
  else finishCommand("fault","timer_error");
 }
}
void receiveSensor(const esp_now_recv_info_t* info,const uint8_t* data,int length){
 if(!sensorInbox || !info || memcmp(info->src_addr,sensorPeer.mac,6) ||
    length!=sizeof(localLink::Reading))return;
 localLink::Reading reading{};
 memcpy(&reading,data,sizeof(reading));
 if(reading.magic==localLink::MAGIC)xQueueOverwrite(sensorInbox,&reading);
}
void applyLocalPolicy(const char* json,size_t length){
 JsonDocument doc;
 offline::Policy next{};
 if(deserializeJson(doc,json,length)||!offline::parse(doc.as<JsonObjectConst>(),next)||
    (wifiConfigured&&strcmp(next.actuator,networkSettings.id))){
  Serial.println("Profil ESP-NOW ditolak.");return;
 }
 if(!strcmp(next.revision,localPolicy.revision))return;
 if(prefs.putBytes("esp-policy",&next,sizeof(next))!=sizeof(next)){
  Serial.println("Profil ESP-NOW gagal disimpan.");return;
 }
 if(localSession)finishCommand("completed","policy_changed");
 localPolicy=next;
 sensorFresh=false;
 consecutive=dangerCount=0;
 Serial.printf("Profil ESP-NOW %s | node %s | %s\n",next.revision,next.node,next.enabled?"aktif":"nonaktif");
}
void localConsole(const char* line){
 if(!strcmp(line,"SETUP")){
  if(activeCommand[0]){Serial.println("Hentikan pompa sebelum membuka pengaturan.");return;}
  if(!prefs.putBool("wifi-setup",true)){Serial.println("Pengaturan tidak dapat dibuka.");return;}
  ESP.restart();
  return;
 }
 if(!strncmp(line,"POLICY ",7))applyLocalPolicy(line+7,strlen(line+7));
}
bool previousCooldown(uint32_t uptime){
 if(state.lastPulseEpoch<=0)return false;
 const time_t now=time(nullptr);
 return now>=mist::SYNCED_AFTER
  ? now-state.lastPulseEpoch<state.cooldownS
  : uptime<static_cast<uint32_t>(state.cooldownS)*1000;
}
void checkLocalSensor(){
 const uint32_t now=millis();
 if(localLock&&!activeCommand[0]&&now-localLockAt>=localBlockMs&&prefs.remove("esp-lock"))localLock=false;
 if(sensorFresh&&now-lastSensor>=localLink::FRESH_MS){
  sensorFresh=false;consecutive=dangerCount=0;
 }
 localLink::Reading reading{};
 if(!sensorInbox||xQueueReceive(sensorInbox,&reading,0)!=pdTRUE||!localLink::verify(sensorPeer,reading)||
    !memchr(reading.node,0,sizeof(reading.node))||!offline::sameNode(reading.node,localPolicy.node))return;
 if(reading.boot==sensorBoot&&static_cast<int32_t>(reading.sequence-sensorSeq)<=0)return;
 if(reading.boot!=sensorBoot){consecutive=dangerCount=0;sensorBoot=reading.boot;}
 sensorSeq=reading.sequence;
 if(!isfinite(reading.dust)||reading.dust<0||reading.dust>1000000){
  sensorFresh=false;consecutive=dangerCount=0;
  if(localSession)finishCommand("fault","invalid_sensor");
  return;
 }
 lastSensor=now;
 sensorFresh=true;
 if(!localPolicy.enabled||(wifiConfigured&&strcmp(localPolicy.actuator,networkSettings.id)))return;
 consecutive=reading.dust>=localPolicy.warning?min(3,consecutive+1):0;
 dangerCount=reading.dust>=localPolicy.danger?min(3,dangerCount+1):0;
 if(consecutive<3||activeCommand[0]||localLock||joining||batteryLow||!waterOk()||
    (localUsed&&now-lastLocalStart<600000)||previousCooldown(now))return;
 localBlockMs=localPolicy.cooldown;
 if(!prefs.putUInt("esp-lock",localBlockMs))return;
 localLock=true;
 localLockAt=now;
 localSession=true;
 sessionCooldown=localBlockMs/1000;
 char id[64];snprintf(id,sizeof(id),"local-esp-%lu",(unsigned long)now);
 const char* band=dangerCount>=3?"danger":"warning";
 Serial.printf("ESP-NOW %s | %s | %.1f ug/m3\n",reading.node,band,reading.dust);
 startCommand(id,localPolicy.duration,false,band,true);
}
void onMessage(char* topic,byte* payload,unsigned int length){
 if(strcmp(topic,commandTopic)!=0)return;
 JsonDocument incoming;
 if(!deserializeJson(incoming,payload,length)&&!strcmp(incoming["action"]|"","espnow_policy")){
  applyLocalPolicy(reinterpret_cast<const char*>(payload),length);return;
 }
 mist::Inputs inputs{networkSettings.id,(int64_t)time(nullptr),activeCommand[0]!=0,false,waterOk(),!batteryLow};
 auto d=mist::evaluate((const char*)payload,length,inputs,state);
 if(!d.accept){
  if(strcmp(d.reason,"duplicate")==0){
   if(activeCommand[0]&&strcmp(d.commandId,activeCommand)==0)ack(d.commandId,"accepted","duplicate_active",sessionDuration?sessionDuration:pulseDuration);
   else if(strcmp(d.commandId,lastDoneId)==0&&mqttConnected())publishMqtt(ackTopic,lastDoneAck);
   return;
  }
  if(d.commandId[0]&&strcmp(d.reason,"wrong_actuator")!=0){mist::rememberId(state,d.commandId);saveState();ack(d.commandId,"rejected",d.reason);}
  return;
 }
 if(!d.stop&&strcmp(d.status,"manual")!=0){
  if(localLock||localPolicy.local){
   ack(d.commandId,"rejected",localLock?"cooldown":"espnow_policy_active");return;
  }
  if(localUsed&&millis()-lastLocalStart<600000){mist::rememberId(state,d.commandId);saveState();ack(d.commandId,"rejected","cooldown");return;}
 }
 mist::rememberId(state,d.commandId);
 if(d.stop){state.lastStopEpoch=d.stopEpoch;saveState();finishCommand("completed","remote_stop");ack(d.commandId,"completed","remote_stop");publishStatus();return;}
 mist::rememberPulse(state,d,inputs.now);
 if(d.session){
  sessionCooldown=d.cooldownS;
  state.cooldownS+=d.durationMs/1000;
 }
 saveState();
 startCommand(d.commandId,d.durationMs,true,d.status,d.session);
}
void network(){
 if(networkSettings.port==443){
  static bool wasConnected=false;
  const bool connected=mqttConnected();
  if(connected&&!wasConnected){
   if(lastAck[0])publishMqtt(ackTopic,lastAck);
   publishStatus();
  }
  wasConnected=connected;
  if(secureMqtt::client){
   secureMqtt::Command command;
   if(connected&&xQueueReceive(secureMqtt::commands,&command,0)==pdTRUE)
    onMessage(commandTopic,command.data,command.length);
  }else if(!activeCommand[0]&&WiFi.status()==WL_CONNECTED&&time(nullptr)>=mist::SYNCED_AFTER&&
           millis()-lastConnect>=5000){
   lastConnect=millis();
   if(!secureMqtt::start(networkSettings,commandTopic,statusTopic))
    Serial.println("Klien MQTT WSS tidak dapat dimulai.");
  }
  return;
 }
 if(activeCommand[0])return;
 // begin() is called once in setup; the ESP32 core owns automatic Wi-Fi retries.
 // Repeated begin() while associating causes "sta is connecting, cannot set config".
 if(WiFi.status()!=WL_CONNECTED)return;
 if(mqttConnected()||(lastConnect&&millis()-lastConnect<5000))return;
 lastConnect=millis();char offline[100];snprintf(offline,sizeof(offline),"{\"state\":\"offline\",\"actuator_id\":\"%s\"}",networkSettings.id);
 // Allow a slower LAN handshake only while the pump is OFF.
 mqtt.setSocketTimeout(10);
 bool connected=mqtt.connect(networkSettings.id,networkSettings.id,networkSettings.mqttPassword,statusTopic,1,true,offline,true);
 mqtt.setSocketTimeout(1);lastConnect=millis();
 if(connected){
  mqtt.subscribe(commandTopic,1);if(lastAck[0])publishMqtt(ackTopic,lastAck);publishStatus();Serial.println("WATERSENSE MQTT terhubung");
 }else Serial.printf("MQTT belum terhubung: host=%s port=%u kode=%d\n",networkSettings.broker,networkSettings.port,mqtt.state());
}
void wifiRecovery(){
 if(!wifiConfigured)return;
 const uint32_t now=millis();
 if(WiFi.status()==WL_CONNECTED){joining=false;wifiAttempt=now;return;}
 if(joining&&now-wifiAttempt>=10000){
  WiFi.disconnect(false,false);
  joining=false;
  if(sensorInbox)esp_wifi_set_channel(sensorPeer.channel,WIFI_SECOND_CHAN_NONE);
 }else if(!joining&&!activeCommand[0]&&now-wifiAttempt>=60000){
  wifiAttempt=now;
  joining=true;
  WiFi.begin(networkSettings.ssid,networkSettings.wifiPassword);
 }
}
void diagnostics(){
 if(millis()-lastDiag<5000)return;
 lastDiag=millis();
 if(sensorInbox)Serial.printf("ESP-NOW %s | node %s | baterai %.2f V %s\n",
  sensorFresh?"menerima data":"menunggu data",localPolicy.node,batteryV,batteryLow?"belum siap":"siap");
 if(WiFi.status()!=WL_CONNECTED){Serial.printf("Wi-Fi belum terhubung: status=%d (1=SSID tidak ditemukan, 4=gagal koneksi, 6=terputus). Periksa Wi-Fi 2.4 GHz dan password.\n",(int)WiFi.status());return;}
 Serial.printf("Wi-Fi terhubung: IP=%s RSSI=%d dBm | MQTT=%s | NTP=%s | Baterai=%.2f V %s\n",WiFi.localIP().toString().c_str(),WiFi.RSSI(),mqttConnected()?"terhubung":"belum terhubung",time(nullptr)>=mist::SYNCED_AFTER?"siap":"menunggu",batteryV,batteryLow?"belum siap":"siap");
}
void localButton(){
 bool raw=digitalRead(BUTTON_PIN);
 if(raw!=buttonRaw){buttonRaw=raw;lastButtonChange=millis();}
 if(millis()-lastButtonChange<40||raw==buttonStable)return;
 buttonStable=raw;if(raw!=LOW)return;
 if(activeCommand[0]){finishCommand("completed","local_stop");return;}
 if(batteryLow||!waterOk())return;
 localUsed=true;lastLocalStart=millis();state.lastPulseEpoch=time(nullptr)>=mist::SYNCED_AFTER?time(nullptr):0;state.cooldownS=mist::MIN_COOLDOWN_S;saveState();
 char id[80];snprintf(id,sizeof(id),"local-%lu",(unsigned long)millis());startCommand(id,LOCAL_PULSE_MS,false,"local_button");
}
void setup(){
 digitalWrite(PUMP_PIN,PUMP_ACTIVE_HIGH?LOW:HIGH);pinMode(PUMP_PIN,OUTPUT);setPompa(false);pinMode(BUTTON_PIN,INPUT_PULLUP);
#if WATER_OK_PIN >= 0
 pinMode(WATER_OK_PIN,INPUT_PULLUP);
#endif
 Serial.begin(115200);analogSetPinAttenuation(BATTERY_PIN,ADC_11db);readBattery();
 esp_timer_create_args_t timerArgs={};timerArgs.callback=timerOff;timerArgs.name="pump-off";ESP_ERROR_CHECK(esp_timer_create(&timerArgs,&offTimer));
 prefs.begin("watersense-v2",false);if(prefs.getBytesLength("state")==sizeof(state))prefs.getBytes("state",&state,sizeof(state));if(state.next>=mist::RECENT_IDS)state.next=0;
 wifiConfigured=loadNetwork(prefs,networkSettings);
 const uint32_t heldSince=millis();
 while(digitalRead(BUTTON_PIN)==LOW&&millis()-heldSince<2000)delay(10);
 const bool paired=localLink::load(prefs,sensorPeer);
 const bool requested=prefs.getBool("wifi-setup",false);
 if(requested)prefs.remove("wifi-setup");
 if(digitalRead(BUTTON_PIN)==LOW||requested||(!paired&&!wifiConfigured)){
  configureNetwork(prefs,networkSettings);
 }else if(!paired){
  WiFi.mode(WIFI_STA);
  WiFi.begin(networkSettings.ssid,networkSettings.wifiPassword);
  const uint32_t connectSince=millis();
  while(WiFi.status()!=WL_CONNECTED&&millis()-connectSince<12000)delay(25);
  if(WiFi.status()!=WL_CONNECTED){
   WiFi.disconnect(false,false);
   configureNetwork(prefs,networkSettings);
  }
 }
 if(prefs.getBytesLength("esp-policy")==sizeof(localPolicy))prefs.getBytes("esp-policy",&localPolicy,sizeof(localPolicy));
 localBlockMs=prefs.getUInt("esp-lock",0);
 localLock=localBlockMs!=0;localLockAt=millis();
 snprintf(commandTopic,sizeof(commandTopic),"aerosense/actuators/%s/command",networkSettings.id);snprintf(ackTopic,sizeof(ackTopic),"aerosense/actuators/%s/ack",networkSettings.id);snprintf(statusTopic,sizeof(statusTopic),"aerosense/actuators/%s/status",networkSettings.id);
 WiFi.mode(WIFI_STA);WiFi.setSleep(false);WiFi.setAutoReconnect(false);
 if(paired&&esp_now_init()==ESP_OK&&localLink::add(sensorPeer)){
  esp_wifi_set_channel(sensorPeer.channel,WIFI_SECOND_CHAN_NONE);
  sensorInbox=xQueueCreate(1,sizeof(localLink::Reading));
  if(sensorInbox)esp_now_register_recv_cb(receiveSensor);
 }
 if(wifiConfigured){
  if(WiFi.status()!=WL_CONNECTED){
   wifiAttempt=millis();joining=true;
   WiFi.begin(networkSettings.ssid,networkSettings.wifiPassword);
  }
  configTime(0,0,"pool.ntp.org","time.google.com");
 }
 mqtt.setServer(networkSettings.broker,networkSettings.port);mqtt.setCallback(onMessage);mqtt.setBufferSize(1200);mqtt.setKeepAlive(15);mqtt.setSocketTimeout(1);
 Serial.printf("WATERSENSE | ESP-NOW STA MAC %s | %s\n",WiFi.macAddress().c_str(),sensorInbox?"paired":"unpaired");
}
void loop(){
 if(millis()-lastBattery>=100){lastBattery=millis();readBattery();}
 updateCommand();
 localLink::console(prefs,localConsole);
 checkLocalSensor();
 localButton();wifiRecovery();network();if(networkSettings.port!=443&&mqttConnected())mqtt.loop();if(millis()-lastStatus>=(outputOn?2000:15000))publishStatus();diagnostics();delay(5);
}
