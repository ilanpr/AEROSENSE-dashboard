import test from "node:test";
import assert from "node:assert/strict";
import { nodeRoutes } from "../api/nodes.mjs";

test("node registration scopes locations, hides keys and preserves original readings", async () => {
  let role = "operator",
    saved,
    sent;
  let payload = {
    id: "node-02",
    name: "Gerbang Timur",
    location_id: "its",
    gateway_id: "gateway-01",
    latitude: -7.28,
    longitude: 112.79,
    public_read: false,
  };
  const route = nodeRoutes({
    user: async () => ({ id: "owner" }),
    filter: encodeURIComponent,
    devices: {
      "gateway-01": { type: "gateway", key: "secret" },
      "robot-01": { type: "robot", key: "other-secret" },
    },
    db: async (table, query, method, body) => {
      if (table === "ae_members") return [{ location_id: "its", role }];
      assert.equal(table, "ae_nodes");
      if (method === "POST") {
        saved = body;
        return [body];
      }
      return [{ name: "Node 1 ITS", location_id: "its" }];
    },
    rawBody: async () => Buffer.from(JSON.stringify(payload)),
    rate: () => {},
    send: (_res, status, body) => {
      sent = { status, body };
    },
  });
  const run = (method, path = "/v1/nodes") => route({ method }, {}, new URL("http://test" + path));
  await run("GET", "/v1/nodes/registration");
  assert.deepEqual(sent.body.gateways, ["gateway-01"]);
  assert(!JSON.stringify(sent).includes("secret"));
  await run("POST");
  assert.equal(sent.status, 201);
  assert.equal(saved.pm25_validated, false);
  assert.equal(saved.public_read, false);
  assert(!Object.hasOwn(saved, "metrics"));
  payload.location_id = "unassigned";
  await assert.rejects(run("POST"), { status: 403 });
  payload.location_id = "its";
  payload.public_read = true;
  await assert.rejects(run("POST"), { status: 403 });
  role = "admin";
  await run("POST");
  assert.equal(saved.public_read, true);
  payload.latitude = 91;
  await assert.rejects(run("POST"), { status: 400 });
  payload.latitude = -7;
  payload.gateway_id = "robot-01";
  await assert.rejects(run("POST"), { status: 400 });
  role = "viewer";
  await assert.rejects(run("POST"), { status: 403 });
});
