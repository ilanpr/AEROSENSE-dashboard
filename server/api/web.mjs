import {
  summarizeEnvironment,
  orderEnvironmentFacts,
} from "./environment-insights.mjs";
import { publicMonitoring } from "./public-monitoring.mjs";
const reportScope = {
  type: "ambient_monitoring",
  assurance_status: "not_assured",
  source_attribution: "not_determined",
  max_readings_per_node: 288,
  excludes: ["esg_rating", "regulatory_compliance", "corporate_emissions_inventory"],
};
// Browser routes share the ae_ tables and the existing authorization checks.
export function webRoutes({ db, one, user, member, send, filter, env }) {
  return async (req, res, url) => {
    const path = url.pathname;
    if (await publicMonitoring({ db, one, send, filter, readEnvironment }, req, res, url)) return true;
    if (req.method !== "GET") return false;
    if (path === "/v1/config") {
      send(res, 200, {
        supabase_url: env.SUPABASE_URL,
        supabase_publishable_key: env.SUPABASE_ANON_KEY,
        robot_id: env.WEB_ROBOT_ID || null,
      });
      return true;
    }
    if (path === "/v1/environment") {
      const nodeId = url.searchParams.get("node_id");
      if (!nodeId || !/^[a-zA-Z0-9_-]{1,40}$/.test(nodeId)) {
        send(res, 400, {error:"Pilih titik robot terlebih dahulu"});
        return true;
      }
      const account = await user(req);
      const node = await member(account, nodeId);
      send(res, 200, await readEnvironment({db, one, node}));
      return true;
    }
    if (
      ![
        "/v1/dashboard",
        "/v1/rules",
        "/v1/subscriptions",
        "/v1/robots",
        "/v1/access",
        "/v1/esg/report",
      ].includes(path)
    )
      return false;
    const u = await user(req),
      memberships = await db("ae_members", "user_id=eq." + filter(u.id)),
      nodes = [];
    const admins = memberships.filter((m) => m.role === "admin");
    if (path === "/v1/access") {
      send(res, 200, { can_audit_esg: admins.length > 0 });
      return true;
    }
    if (path === "/v1/esg/report" && !admins.length)
      throw Object.assign(new Error("Laporan lingkungan hanya tersedia untuk admin."), {
        status: 403,
      });
    for (const m of path === "/v1/esg/report" ? admins : memberships) {
      const found = await db(
        "ae_nodes",
        "location_id=eq." + filter(m.location_id) + "&enabled=eq.true",
      );
      nodes.push(...found.map((n) => ({ ...n, role: m.role })));
    }
    if (path === "/v1/dashboard" || path === "/v1/esg/report") {
      const requested = url.searchParams.get("node_id");
      if (path === "/v1/esg/report" && requested) {
        if (!nodes.some((n) => n.id === requested))
          throw Object.assign(
            new Error("Anda bukan admin untuk lokasi node ini."),
            { status: 403 },
          );
        const readings = await db(
          "ae_readings",
          "node_id=eq." +
            filter(requested) +
            "&order=observed_at.desc&limit=288",
        );
        send(res, 200, { readings, report_scope: reportScope });
        return true;
      }
      const data = await Promise.all(
        nodes.map(async (n) => ({
          ...n,
          latest:
            (await one("ae_sensor_context", "node_id=eq." + filter(n.id))) ??
            null,
        })),
      );
      data.sort(
        (a, b) =>
          Number(!!a.latest?.stale || !a.latest?.reading_id) -
            Number(!!b.latest?.stale || !b.latest?.reading_id) ||
          (Date.parse(b.latest?.observed_at) || 0) -
            (Date.parse(a.latest?.observed_at) || 0),
      );
      send(res, 200, {
        nodes: data,
        refreshed_at: new Date().toISOString(),
        ...(path === "/v1/esg/report" ? { report_scope: reportScope } : {}),
      });
      return true;
    }
    if (path === "/v1/robots") {
      const robots = [];
      for (const n of nodes)
        robots.push(
          ...(await db(
            "ae_robots",
            "node_id=eq." + filter(n.id) + "&enabled=eq.true",
          )),
        );
      send(res, 200, { robots });
      return true;
    }
    if (path === "/v1/subscriptions") {
      const rows = await db(
          "ae_subscriptions",
          "user_id=eq." + filter(u.id) + "&active=eq.true",
        ),
        ids = new Set(nodes.map((n) => n.id));
      send(res, 200, {
        subscriptions: rows
          .filter((r) => ids.has(r.node_id))
          .map((r) => ({
            node_id: r.node_id,
            phone: r.phone,
            opted_in_at: r.opted_in_at,
          })),
      });
      return true;
    }
    const nodeId = url.searchParams.get("node_id");
    await member(u, nodeId);
    send(res, 200, {
      rules: await db("ae_rules", "node_id=eq." + filter(nodeId)),
    });
    return true;
  };
}

// Public environmental context follows the authorized robot node point.
export async function readEnvironment({db, one, node}, now = Date.now()) {
  if (!node?.enabled || !Number.isFinite(node.latitude) || !Number.isFinite(node.longitude))
    throw Object.assign(new Error("Titik node belum memiliki koordinat valid"), {status:503});
  const area = await one("ae_environment_areas", "source_node_id=eq." + encodeURIComponent(node.id) + "&enabled=eq.true");
  if (!area || area.latitude !== node.latitude || area.longitude !== node.longitude)
    throw Object.assign(new Error("Cache lokasi node belum siap; tunggu pembaruan hub berikutnya"), {status:503});
  const providersAllowed = new Set(["openmeteo_weather","openmeteo_air","openmeteo_flood","soilgrids","firms","bmkg_quake","bmkg_weather","iqair"]);
  const categoriesAllowed = new Set(["weather","air_quality","soil","soil_profile","fire","earthquake","flood"]);
  const rows = await db("ae_environment_area_cache", "area_id=eq." + encodeURIComponent(area.id));
  const providers = rows.filter(c => providersAllowed.has(c.provider)).map(c => ({
    provider:c.provider, last_attempt_at:c.last_attempt_at, refresh_after:c.refresh_after,
    last_error:c.last_error ? "Pembaruan sumber belum berhasil" : null,
    request_latitude:c.request_latitude, request_longitude:c.request_longitude,
    facts:orderEnvironmentFacts(c.request_latitude === area.latitude && c.request_longitude === area.longitude
      ? (Array.isArray(c.payload?.facts) ? c.payload.facts : []).filter(f => categoriesAllowed.has(f.category) && f.area_id === area.id && f.reference?.latitude === area.latitude && f.reference?.longitude === area.longitude).map(f => ({...f,stale:!Number.isFinite(Date.parse(f.fresh_until)) || Date.parse(f.fresh_until) < now})) : [],now),
  }));
  const facts = orderEnvironmentFacts(providers.flatMap(p=>p.facts),now);
  return {area,node:{id:node.id,name:node.name},providers,facts,insights:summarizeEnvironment(facts,now),summary_method:"rules-v1",fetched_at:new Date(now).toISOString()};
}
