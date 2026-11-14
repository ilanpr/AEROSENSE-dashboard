#include "watersense_logic.h"
#include <cassert>
#include <iostream>
#include <string>
std::string payload(const char* id="run-1",const char* action="pulse",int duration=3000,const char* issued="2026-10-27T00:00:00Z",const char* expires="2026-10-27T00:00:30Z"){
 return std::string("{\"version\":1,\"command_id\":\"")+id+"\",\"actuator_id\":\"mist-01\",\"status\":\"manual\",\"action\":\""+action+"\",\"duration_ms\":"+std::to_string(duration)+",\"cooldown_ms\":600000,\"issued_at\":\""+issued+"\",\"expires_at\":\""+expires+"\"}";
}
int main(){
 int64_t now;assert(mist::parseIsoUtc("2026-10-27T00:00:05Z",now));mist::State state{};mist::Inputs input{"mist-01",now,false,false,true,true};
 auto check=[&](const std::string&s){return mist::evaluate(s.data(),s.size(),input,state);};
 assert(check(payload()).accept);
 for(const int duration : {1800000,2700000,3600000}){
  const auto session=check(payload("session","session",duration));
  assert(session.accept&&session.session&&session.durationMs==(uint32_t)duration);
 }
 assert(!check(payload("session","session",10000)).accept);
 assert(!check(payload("session","session",3600001)).accept);
 input.pulseActive=true;
 assert(std::string(check(payload("paused","session",1800000)).reason)=="pulse_active");
 assert(check(payload("stop-pause","stop",0)).accept);
 input.pulseActive=false;
 assert(mist::sessionRemaining(100,1800000,1790100)==10000);
 assert(mist::sessionRemaining(100,1800000,1800100)==0);
 assert(mist::SESSION_PAUSE_MS==3000);
 assert(mist::sessionBurstDuration(1800000)==120000);
 assert(mist::sessionBurstDuration(3000)==3000);
 assert(mist::sessionRemaining(UINT32_MAX-49,1800000,50)==1799900);
 for(const char* band : {"warning","danger"}){
  auto message=payload("automatic");
  message.replace(message.find("\"status\":\"manual\""),17,std::string("\"status\":\"")+band+"\"");
  const auto automatic=check(message);
  assert(automatic.accept&&std::string(automatic.status)==band);
  input.actuatorId="mist-02";assert(std::string(check(message).reason)=="wrong_actuator");input.actuatorId="mist-01";
 }
 assert(!check(payload("long","pulse",11000)).accept);
 input.batteryOk=false;assert(std::string(check(payload()).reason)=="battery_low");input.batteryOk=true;
 input.pulseActive=true;assert(std::string(check(payload()).reason)=="pulse_active");
 // STOP must still work while running and without NTP, water or sufficient battery.
 input.now=0;input.batteryOk=false;input.waterOk=false;auto stop=check(payload("stop-1","stop",0));assert(stop.accept&&stop.stop&&stop.stopEpoch>mist::SYNCED_AFTER);
 state.lastStopEpoch=stop.stopEpoch;input={"mist-01",now,false,false,true,true};assert(std::string(check(payload()).reason)=="stopped_before_delivery");
 state={};mist::rememberId(state,"run-1");assert(std::string(check(payload()).reason)=="duplicate");
 state={};state.lastPulseEpoch=now-10;state.cooldownS=600;
 assert(check(payload("manual-restart","session",1800000)).accept);
 auto automatic=payload("automatic-cooldown");
 automatic.replace(automatic.find("\"status\":\"manual\""),17,"\"status\":\"danger\"");
 assert(std::string(check(automatic).reason)=="cooldown");
 assert(check(payload("stop-2","stop",0)).accept);
 // Explicit test mode bypasses even an old persisted cooldown, but keeps other gates.
 input.testNoCooldown=true;auto testRun=check(automatic);assert(testRun.accept&&testRun.cooldownS==0);
 input.pulseActive=true;assert(std::string(check(payload("busy-test")).reason)=="pulse_active");input.pulseActive=false;
 input.batteryOk=false;assert(std::string(check(payload("battery-test")).reason)=="battery_low");input.batteryOk=true;
 assert(std::string(check(payload("long-test","pulse",11000)).reason)=="invalid_duration");
 mist::rememberId(state,"automatic-cooldown");assert(std::string(check(automatic).reason)=="duplicate");input.testNoCooldown=false;
 state={};input.now=now+31;assert(std::string(check(payload()).reason)=="expired");input.now=0;assert(std::string(check(payload()).reason)=="clock_not_synced");
 std::cout<<"PASS: pulse and session durations, timer wrap, stop, battery, dedup, TTL, clock and cooldown\n";
}
