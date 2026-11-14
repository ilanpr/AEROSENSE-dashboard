export type AlertSeverity = "critical" | "warning" | "info";
export type AlertStatus = "active" | "acknowledged" | "resolved";

export interface Alert {
  id: string;
  timestamp: string;
  nodeId: string;
  nodeName: string;
  sensor: string; // e.g., 'PM2.5', 'TVOC', 'System'
  severity: AlertSeverity;
  description: string;
  status: AlertStatus;
  value?: number;
  threshold?: number;
  aiExplanation?: string; // Explanation if AI detected anomaly
}
