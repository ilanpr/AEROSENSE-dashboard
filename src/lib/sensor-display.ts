import type { Alert, GruResult, LiveNode, Reading, SensorContext, SensorRule } from "../types/live.types.ts";

type SensorResponse = {
  nodes?: LiveNode[];
  readings?: Reading[];
  rules?: SensorRule[];
  alerts?: Alert[];
};

function withoutEco2<T>(values: Record<string, T>): Record<string, T> {
  if (!("eco2_ppm" in values)) return values;
  const visible = { ...values };
  delete visible.eco2_ppm;
  return visible;
}

function visibleModel(gru: GruResult | null) {
  if (!gru || (gru.target === "eco2_ppm" && gru.task !== "fault_detection")) return null;
  return {
    ...gru,
    ...(gru.estimates && { estimates: withoutEco2(gru.estimates) }),
    ...(gru.fault_scores && { fault_scores: withoutEco2(gru.fault_scores) }),
    ...(gru.thresholds && { thresholds: withoutEco2(gru.thresholds) }),
    ...(gru.suspect && { suspect: gru.suspect.filter((key) => key !== "eco2_ppm") }),
    ...(gru.target === "eco2_ppm" && { target: undefined, value: undefined }),
  };
}

function visibleReading<T extends Reading | SensorContext>(reading: T): T {
  const quality = reading.quality;
  const channels = quality && "channels" in quality ? quality.channels : null;
  return {
    ...reading,
    metrics: withoutEco2(reading.metrics),
    ...(channels !== null && typeof channels === "object" && {
      quality: { ...quality, channels: withoutEco2(channels as Record<string, unknown>) },
    }),
    ...("gru" in reading && { gru: visibleModel(reading.gru) }),
    ...("raw_metrics" in reading && reading.raw_metrics && {
      raw_metrics: withoutEco2(reading.raw_metrics),
    }),
  };
}

function visibleRuleOrAlert(item: { metric: string }) {
  return item.metric !== "eco2_ppm";
}

export function visibleSensorResponse(body: SensorResponse): SensorResponse {
  return {
    ...body,
    ...(body.nodes && {
      nodes: body.nodes.map((node) => ({
        ...node,
        latest: node.latest && visibleReading(node.latest),
        ...(node.rules && { rules: node.rules.filter(visibleRuleOrAlert) }),
      })),
    }),
    ...(body.readings && { readings: body.readings.map(visibleReading) }),
    ...(body.rules && { rules: body.rules.filter(visibleRuleOrAlert) }),
    ...(body.alerts && { alerts: body.alerts.filter(visibleRuleOrAlert) }),
  };
}
