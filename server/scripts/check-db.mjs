const env = process.env;
if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY)
  throw new Error("Supabase configuration missing");
const tables = [
  "ae_jobs",
  "ae_sensor_context",
  "ae_robots",
  "ae_commands",
  "ae_environment_areas",
  "ae_environment_area_cache",
  "ae_disaster_news_cache",
];
let failed = false;
for (const table of tables) {
  try {
    const response = await fetch(
      env.SUPABASE_URL.replace(/\/$/, "") +
        "/rest/v1/" +
        table +
        "?select=*&limit=0",
      {
        headers: {
          apikey: env.SUPABASE_SERVICE_ROLE_KEY,
          Authorization: "Bearer " + env.SUPABASE_SERVICE_ROLE_KEY,
        },
        signal: AbortSignal.timeout(15000),
      },
    );
    console.log(table + ": HTTP " + response.status);
    if (!response.ok) failed = true;
  } catch {
    console.log(table + ": connection failed");
    failed = true;
  }
}
process.exitCode = failed ? 1 : 0;
