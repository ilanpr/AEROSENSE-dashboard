const pick = (row, keys) => Object.fromEntries(keys.filter(k => row?.[k] !== undefined).map(k => [k, row[k]]));
const metricKeys = ["dust_ug_m3", "pm25_ug_m3", "eco2_ppm", "tvoc_ppb", "temperature_c", "humidity_pct"];
const metrics = row => pick(row, metricKeys);
const gru = row => row ? pick(row, ["target", "value", "model_version", "horizon_seconds"]) : null;
const context = row => row ? {
  ...pick(row, ["node_id", "name", "reading_id", "observed_at", "received_at", "stale", "pm25_validated"]),
  metrics: metrics(row.metrics), gru: gru(row.gru), quality: { invalid: row.quality?.invalid === true },
} : null;
const allowed = new Set(["dashboard", "nodes", "history", "rules", "alerts", "environment"]);

// Only nodes explicitly published by their operator are visible without an account.
export async function publicMonitoring({ db, one, send, filter, readEnvironment }, req, res, url) {
  const resource = url.pathname.slice("/v1/public/".length);
  if (!url.pathname.startsWith("/v1/public/")) return false;
  if (req.method !== "GET" || !allowed.has(resource)) {
    send(res, 404, { error: "Not found" }); return true;
  }
  const id = url.searchParams.get("node_id");
  if (!["dashboard", "nodes"].includes(resource) && (!id || !/^[a-zA-Z0-9_-]{1,40}$/.test(id))) {
    send(res, 400, { error: "Pilih node publik terlebih dahulu" }); return true;
  }
  const nodes = (await db("ae_nodes", "public_read=eq.true&enabled=eq.true" + (id ? "&id=eq." + filter(id) : "")))
    .filter(n => n.public_read === true && n.enabled === true && (!id || n.id === id));
  if (["dashboard", "nodes"].includes(resource)) {
    const allRules = nodes.length ? await db("ae_rules", "node_id=in.(" + nodes.map(n=>filter(n.id)).join(",") + ")") : [];
    const data = await Promise.all(nodes.map(async n => ({
      ...pick(n, ["id", "name", "latitude", "longitude", "pm25_validated"]), role: "guest",
      rules: allRules.filter(r=>r.node_id===n.id).map(r => pick(r,["metric","high","danger_high","clear_below","enabled","active","unit"])),
      latest: context(await one("ae_sensor_context", "node_id=eq." + filter(n.id))),
    })));
    data.sort((a,b) => Number(!a.latest?.reading_id || !!a.latest?.stale) - Number(!b.latest?.reading_id || !!b.latest?.stale)
      || (Date.parse(b.latest?.observed_at) || 0) - (Date.parse(a.latest?.observed_at) || 0));
    send(res, 200, { nodes: data, refreshed_at: new Date().toISOString() }); return true;
  }
  const node = nodes[0];
  if (!node) { send(res, 404, { error: "Node publik tidak ditemukan" }); return true; }
  if (resource === "environment") {
    const data = await readEnvironment({ db, one, node });
    send(res, 200, { ...data, area: pick(data.area, ["id", "name", "latitude", "longitude", "coordinate_source"]) });
    return true;
  }
  const fields = {
    history: ["id", "node_id", "observed_at"],
    rules: ["metric", "high", "danger_high", "clear_below", "enabled", "active", "unit"],
    alerts: ["id", "node_id", "metric", "value", "threshold", "unit", "created_at", "acknowledged_at"],
  }[resource];
  const table = { history: "ae_readings", rules: "ae_rules", alerts: "ae_alerts" }[resource];
  const suffix = resource === "history" ? "&order=observed_at.desc&limit=288" : resource === "alerts" ? "&order=created_at.desc&limit=100" : "";
  const rows = await db(table, "node_id=eq." + filter(id) + suffix);
  send(res, 200, { [resource === "history" ? "readings" : resource]: rows.map(row => ({
    ...pick(row, fields), ...(resource === "history" ? { metrics: metrics(row.metrics), raw_metrics: metrics(row.raw_metrics), gru: gru(row.gru) } : {}),
  })) });
  return true;
}
