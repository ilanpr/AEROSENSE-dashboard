import test from "node:test";
import assert from "node:assert/strict";
import { webRoutes } from "../api/web.mjs";
import { canViewModel, canAuditEsg, canManage, highestRole, simpleReading } from "../api/access.mjs";

test("roles: what each account type may see", () => {
  assert.equal(highestRole([{ role: "viewer" }, { role: "auditor" }]), "auditor");
  assert.equal(highestRole([{ role: "auditor" }, { role: "admin" }]), "admin");
  assert.equal(highestRole([]), null);
  assert.deepEqual(["viewer", "operator", "auditor", "admin"].map(canViewModel), [false, true, true, true]);
  assert.deepEqual(["viewer", "operator", "auditor", "admin"].map(canAuditEsg), [false, false, true, true]);
  assert.deepEqual(["viewer", "operator", "auditor", "admin"].map(canManage), [false, true, false, true]);
  const simple = simpleReading({ id: "r", node_id: "n", observed_at: "t", metrics: { dust_ug_m3: 1 }, raw_metrics: { dust_ug_m3: 2 },
    gru: { value: 3 }, processing: { x: 1 }, raw_payload: "secret", quality: { invalid: false, clock_source: "sensor" } });
  assert.deepEqual(simple, { id: "r", node_id: "n", observed_at: "t", metrics: { dust_ug_m3: 1 }, quality: { invalid: false } });
});

function routes(memberships) {
  const nodes = { l1: [{ id: "n1", location_id: "l1", enabled: true }], l2: [{ id: "n2", location_id: "l2", enabled: true }] };
  let sent;
  const route = webRoutes({
    db: async (table, q) => {
      if (table === "ae_members") return memberships;
      if (table === "ae_nodes") return nodes[q.match(/location_id=eq\.(\w+)/)?.[1]] || [];
      if (table === "ae_rules") return [];
      if (table === "ae_readings") return [{ id: "r1", metrics: {}, raw_metrics: {}, gru: { value: 1 } }];
      return [];
    },
    one: async () => ({ node_id: "n1", reading_id: "r1", gru: { target: "dust_ug_m3", value: 20 } }),
    user: async () => ({ id: "u1" }),
    member: async () => ({}),
    send: (_res, status, body) => { sent = { status, body }; },
    filter: v => encodeURIComponent(v),
    env: {},
  });
  return async path => {
    sent = undefined;
    try { await route({ method: "GET" }, {}, new URL("http://t" + path)); }
    catch (error) { sent = { status: error.status, body: { error: error.message } }; }
    return sent;
  };
}

test("/v1/access and the ESG report follow the roles; model output is hidden from warga", async () => {
  const warga = routes([{ role: "viewer", location_id: "l1" }]);
  assert.deepEqual((await warga("/v1/access")).body, { role: "viewer", can_audit_esg: false, can_view_model: false, can_manage: false });
  assert.equal((await warga("/v1/esg/report")).status, 403);
  assert.equal((await warga("/v1/dashboard")).body.nodes[0].latest.gru, null);

  const auditor = routes([{ role: "auditor", location_id: "l1" }, { role: "viewer", location_id: "l2" }]);
  assert.deepEqual((await auditor("/v1/access")).body, { role: "auditor", can_audit_esg: true, can_view_model: true, can_manage: false });
  const report = await auditor("/v1/esg/report");
  assert.equal(report.status, 200);
  assert.deepEqual(report.body.nodes.map(n => n.id), ["n1"]);         // only the location they audit
  assert.equal((await auditor("/v1/esg/report?node_id=n2")).status, 403);
  assert.equal((await auditor("/v1/esg/report?node_id=n1")).status, 200);
  const dash = (await auditor("/v1/dashboard")).body.nodes;
  assert.equal(dash.find(n => n.id === "n1").latest.gru.value, 20);
  assert.equal(dash.find(n => n.id === "n2").latest.gru, null);

  const operator = routes([{ role: "operator", location_id: "l1" }]);
  assert.deepEqual((await operator("/v1/access")).body, { role: "operator", can_audit_esg: false, can_view_model: true, can_manage: true });
  assert.equal((await operator("/v1/esg/report")).status, 403);
});
