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
 assert(!check(payload("long","pulse",11000)).accept);
 input.batteryOk=false;assert(std::string(check(payload()).reason)=="battery_low");input.batteryOk=true;
 input.pulseActive=true;assert(std::string(check(payload()).reason)=="pulse_active");
 // STOP must still work while running and without NTP, water or sufficient battery.
 input.now=0;input.batteryOk=false;input.waterOk=false;auto stop=check(payload("stop-1","stop",0));assert(stop.accept&&stop.stop&&stop.stopEpoch>mist::SYNCED_AFTER);
 state.lastStopEpoch=stop.stopEpoch;input={"mist-01",now,false,false,true,true};assert(std::string(check(payload()).reason)=="stopped_before_delivery");
 state={};mist::rememberId(state,"run-1");assert(std::string(check(payload()).reason)=="duplicate");
 state={};state.lastPulseEpoch=now-10;state.cooldownS=600;assert(std::string(check(payload()).reason)=="cooldown");assert(check(payload("stop-2","stop",0)).accept);
 state={};input.now=now+31;assert(std::string(check(payload()).reason)=="expired");input.now=0;assert(std::string(check(payload()).reason)=="clock_not_synced");
 std::cout<<"PASS: manual pulse, stop while blocked, stop barrier, duration, battery, dedup, TTL, clock, cooldown\n";
}
