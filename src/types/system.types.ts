export interface SystemUser {
  id: string;
  name: string;
  email: string;
  role: "admin" | "operator" | "auditor";
  status: "active" | "inactive";
  lastLogin?: string;
}

export interface ThresholdConfig {
  parameter: string; // e.g., 'PM2.5'
  warningLevel: number;
  criticalLevel: number;
  unit: string;
}

export interface MQTTConfig {
  brokerUrl: string;
  port: number;
  clientId: string;
  status: "connected" | "disconnected" | "reconnecting";
}
