/** Node operational status */
export type NodeStatus = "online" | "offline" | "warning" | "critical";

/** Air quality index levels based on PRD Sec. 5 */
export type AirQualityLevel = "good" | "moderate" | "unhealthy" | "hazardous";

/** AI Soft-Sensing estimation data */
export interface AIEstimation {
  rawValue?: number;
  estimatedValue: number;
  correction: number;
  confidence: number; // 0-100 percentage
}

/** Complete reading for a node at a specific timestamp */
export interface NodeReading {
  id: string;
  nodeId: string;
  pm25: number; // µg/m³
  tvoc: number; // ppb
  eco2: number; // ppm
  temperature: number; // °C
  humidity: number; // %
  aqi: number;
  quality: AirQualityLevel;
  timestamp: string;

  // AI Estimation metrics for parameters that might be estimated
  estimations?: {
    eco2?: AIEstimation;
    tvoc?: AIEstimation;
  };
}

/** Node device information */
export interface Node {
  id: string;
  name: string;
  location: {
    lat: number;
    lng: number;
    address: string;
  };
  status: NodeStatus;
  lastReading?: NodeReading;
  batteryLevel?: number; // 0-100
  uptime: number; // percentage
  latency: number; // ms
  createdAt: string;
  updatedAt: string;
}

/** Data query parameters */
export interface NodeQueryParams {
  page?: number;
  limit?: number;
  status?: NodeStatus;
  search?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

/** Helper to get citizen-friendly category, label, and colors from AQI value */
export function getAqiCategory(aqi: number): {
  level: "good" | "moderate" | "warning" | "critical";
  label: string;
  color: string;
  bg: string;
} {
  if (aqi <= 50) {
    return { level: "good", label: "Baik", color: "#19A679", bg: "#E6FAEF" };
  }
  if (aqi <= 100) {
    return { level: "moderate", label: "Sedang", color: "#BB8823", bg: "#FFF2DC" };
  }
  if (aqi <= 150) {
    return { level: "warning", label: "Perlu perhatian", color: "#EF7454", bg: "#FFF0E9" };
  }
  return { level: "critical", label: "Kritis", color: "#E34C26", bg: "#FFEBE5" };
}
