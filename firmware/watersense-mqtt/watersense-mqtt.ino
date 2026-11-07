// WATERSENSE Wi-Fi/MQTT. ESP32-S3, GPIO4 MOSFET active HIGH, battery GPIO1, local button GPIO21.
// Automatic 15-second cycling from the hardware test is intentionally removed.
#include <WiFi.h>
#include <PubSubClient.h>
#include <Preferences.h>
#include <esp_timer.h>
#include <time.h>
#include "config.h"
#include "watersense_logic.h"
WiFiClient net;
PubSubClient mqtt(net);
Preferences prefs;
mist::State state{};
esp_timer_handle_t offTimer;
volatile bool timerExpired=false;
bool outputOn=false,remoteActive=false,batteryLow=true;
float batteryV=0;
uint32_t pulseStart=0,pulseDuration=0,lastBattery=0,lastStatus=0,lastConnect=0,lastWifi=0,lastButtonChange=0,lastLocalStart=0;
bool localUsed=false,buttonRaw=HIGH,buttonStable=HIGH;
char activeCommand[96]="",lastAck[500]="",lastDoneId[96]="",lastDoneAck[500]="";
char commandTopic[100],ackTopic[100],statusTopic[100];
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
void ack(const char* id,const char* status,const char* reason,uint32_t duration=0){
 char at[25];isoNow(at);snprintf(lastAck,sizeof(lastAck),"{\"actuator_id\":\"%s\",\"command_id\":\"%s\",\"state\":\"%s\",\"reason\":\"%s\",\"duration_ms\":%lu,\"at\":\"%s\"}",ACTUATOR_ID,id,status,reason,(unsigned long)duration,at);
 if(strcmp(status,"completed")==0||strcmp(status,"fault")==0){strlcpy(lastDoneId,id,sizeof(lastDoneId));strlcpy(lastDoneAck,lastAck,sizeof(lastDoneAck));}
 if(mqtt.connected())mqtt.publish(ackTopic,lastAck,true);
}
void publishStatus(){
 if(!mqtt.connected())return;
 char at[25],body[650];isoNow(at);
 snprintf(body,sizeof(body),"{\"state\":\"online\",\"actuator_id\":\"%s\",\"output\":\"%s\",\"active_command_id\":\"%s\",\"battery_v\":%.2f,\"battery_ok\":%s,\"water_ok\":%s,\"manual_off\":false,\"clock_synced\":%s,\"uptime_s\":%lu,\"at\":\"%s\"}",ACTUATOR_ID,outputOn?"on":"off",activeCommand,batteryV,batteryLow?"false":"true",waterOk()?"true":"false",time(nullptr)>=mist::SYNCED_AFTER?"true":"false",(unsigned long)(millis()/1000),at);
 mqtt.publish(statusTopic,body,true);lastStatus=millis();
}
void stopPulse(const char* status,const char* reason){
 esp_timer_stop(offTimer);timerExpired=false;
 if(!outputOn){setPompa(false);return;}
 setPompa(false);ack(activeCommand,status,reason,millis()-pulseStart);activeCommand[0]=0;remoteActive=false;publishStatus();
}
void startPulse(const char* id,uint32_t duration,bool remote){
 strlcpy(activeCommand,id,sizeof(activeCommand));pulseStart=millis();pulseDuration=duration;remoteActive=remote;timerExpired=false;
 // Independent ESP timer forces the GPIO OFF even if a network call stalls the main loop.
 esp_timer_stop(offTimer);if(esp_timer_start_once(offTimer,(uint64_t)duration*1000)!=ESP_OK){setPompa(false);ack(id,"fault","timer_error");return;}setPompa(true);ack(id,"accepted",remote?"manual":"local_button",duration);publishStatus();
}
void onMessage(char* topic,byte* payload,unsigned int length){
 if(strcmp(topic,commandTopic)!=0)return;
 mist::Inputs inputs{ACTUATOR_ID,(int64_t)time(nullptr),outputOn,false,waterOk(),!batteryLow};
 auto d=mist::evaluate((const char*)payload,length,inputs,state);
 if(!d.accept){
  if(strcmp(d.reason,"duplicate")==0){
   if(outputOn&&strcmp(d.commandId,activeCommand)==0)ack(d.commandId,"accepted","duplicate_active",pulseDuration);
   else if(strcmp(d.commandId,lastDoneId)==0&&mqtt.connected())mqtt.publish(ackTopic,lastDoneAck,true);
   return;
  }
  if(d.commandId[0]&&strcmp(d.reason,"wrong_actuator")!=0){mist::rememberId(state,d.commandId);saveState();ack(d.commandId,"rejected",d.reason);}
  return;
 }
 if(!d.stop&&localUsed&&millis()-lastLocalStart<600000){mist::rememberId(state,d.commandId);saveState();ack(d.commandId,"rejected","cooldown");return;}
 mist::rememberId(state,d.commandId);
 if(d.stop){state.lastStopEpoch=d.stopEpoch;saveState();stopPulse("completed","remote_stop");setPompa(false);ack(d.commandId,"completed","remote_stop");publishStatus();return;}
 mist::rememberPulse(state,d,inputs.now);saveState();startPulse(d.commandId,d.durationMs,true);
}
void network(){
 if(outputOn)return; // Reconnect calls can block; keep them out of an active pulse.
 if(WiFi.status()!=WL_CONNECTED){if(millis()-lastWifi>=10000||lastWifi==0){lastWifi=millis();WiFi.begin(WIFI_SSID,WIFI_PASSWORD);}return;}
 if(mqtt.connected()||(lastConnect&&millis()-lastConnect<5000))return;
 lastConnect=millis();const char* offline="{\"state\":\"offline\",\"actuator_id\":\"" ACTUATOR_ID "\"}";
 if(mqtt.connect(ACTUATOR_ID,ACTUATOR_ID,MQTT_PASSWORD,statusTopic,1,true,offline,true)){
  mqtt.subscribe(commandTopic,1);if(lastAck[0])mqtt.publish(ackTopic,lastAck,true);publishStatus();Serial.println("WATERSENSE MQTT terhubung");
 }
}
void localButton(){
 bool raw=digitalRead(BUTTON_PIN);
 if(raw!=buttonRaw){buttonRaw=raw;lastButtonChange=millis();}
 if(millis()-lastButtonChange<40||raw==buttonStable)return;
 buttonStable=raw;if(raw!=LOW)return;
 if(outputOn){stopPulse("completed","local_stop");return;}
 if(batteryLow||!waterOk()||(localUsed&&millis()-lastLocalStart<600000))return;
 if(time(nullptr)>=mist::SYNCED_AFTER&&state.lastPulseEpoch>0&&time(nullptr)-state.lastPulseEpoch<state.cooldownS)return;
 localUsed=true;lastLocalStart=millis();state.lastPulseEpoch=time(nullptr)>=mist::SYNCED_AFTER?time(nullptr):0;state.cooldownS=mist::MIN_COOLDOWN_S;saveState();
 char id[80];snprintf(id,sizeof(id),"local-%lu",(unsigned long)millis());startPulse(id,LOCAL_PULSE_MS,false);
}
void setup(){
 digitalWrite(PUMP_PIN,PUMP_ACTIVE_HIGH?LOW:HIGH);pinMode(PUMP_PIN,OUTPUT);setPompa(false);pinMode(BUTTON_PIN,INPUT_PULLUP);
#if WATER_OK_PIN >= 0
 pinMode(WATER_OK_PIN,INPUT_PULLUP);
#endif
 Serial.begin(115200);analogSetPinAttenuation(BATTERY_PIN,ADC_11db);readBattery();
 esp_timer_create_args_t timerArgs={};timerArgs.callback=timerOff;timerArgs.name="pump-off";ESP_ERROR_CHECK(esp_timer_create(&timerArgs,&offTimer));
 prefs.begin("watersense-v2",false);if(prefs.getBytesLength("state")==sizeof(state))prefs.getBytes("state",&state,sizeof(state));if(state.next>=mist::RECENT_IDS)state.next=0;
 snprintf(commandTopic,sizeof(commandTopic),"aerosense/actuators/%s/command",ACTUATOR_ID);snprintf(ackTopic,sizeof(ackTopic),"aerosense/actuators/%s/ack",ACTUATOR_ID);snprintf(statusTopic,sizeof(statusTopic),"aerosense/actuators/%s/status",ACTUATOR_ID);
 WiFi.mode(WIFI_STA);WiFi.setAutoReconnect(true);configTime(0,0,"pool.ntp.org","time.google.com");mqtt.setServer(MQTT_HOST,MQTT_PORT);mqtt.setCallback(onMessage);mqtt.setBufferSize(1200);mqtt.setKeepAlive(15);mqtt.setSocketTimeout(1);network();
 Serial.println("WATERSENSE siap. Pompa OFF; siklus tes otomatis dinonaktifkan.");
}
void loop(){
 if(millis()-lastBattery>=100){lastBattery=millis();readBattery();}
 if(outputOn){if(timerExpired||millis()-pulseStart>=pulseDuration)stopPulse("completed","timer");else if(batteryLow)stopPulse("fault","battery_low");else if(!waterOk())stopPulse("fault","water_low");else if(remoteActive&&(WiFi.status()!=WL_CONNECTED||!mqtt.connected()))stopPulse("fault","connection_lost");}
 localButton();network();if(mqtt.connected())mqtt.loop();if(millis()-lastStatus>=(outputOn?2000:15000))publishStatus();delay(5);
}
