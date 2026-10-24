// Build-time only. A URL parameter can never enable demo access in production.
export const DEMO_MODE = import.meta.env.MODE === "demo";
