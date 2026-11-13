import test from "node:test";
import assert from "node:assert/strict";
import { guestChatRoutes } from "../api/guest-chat.mjs";

function setup(node) {
  const jobs = [];
  const out = {};
  const route = guestChatRoutes({
    one: async (table, q) =>
      table === "ae_nodes" ? node : jobs.find((j) => q.includes(j.id) && q.includes("owner_id=is.null")),
    filter: encodeURIComponent,
    enqueue: async (kind, key, body, owner = null) => {
      const j = { id: "11111111-2222-3333-4444-555555555555", kind, key, body, owner_id: owner, status: "pending" };
      jobs.push(j);
      return j;
    },
    rawBody: async (req) => req.body,
    send: (res, status, body) => Object.assign(out, { status, body }),
    rate: () => {},
  });
  const call = (method, path, body) =>
    route({ method, headers: {}, body: JSON.stringify(body) }, {}, new URL(path, "http://x"));
  return { jobs, out, call };
}

test("guest asks about a public node and reads the answer with its token", async () => {
  const { jobs, out, call } = setup({ id: "n1", public_read: true, enabled: true });
  assert.equal(await call("POST", "/v1/guest/chat", { text: "Udara bagaimana?", node_id: "n1" }), true);
  assert.equal(out.status, 202);
  const { id, token } = out.body;
  assert.equal(jobs[0].owner_id, null);
  assert.deepEqual(jobs[0].body.node_ids, ["n1"]);
  assert.equal(jobs[0].body.voice, false);
  assert.notEqual(jobs[0].body.guest_token, token); // only the hash is stored
  jobs[0].status = "done";
  jobs[0].result = { text: "Baik" };
  await call("GET", `/v1/guest/jobs?id=${id}&token=${token}`);
  assert.equal(out.status, 200);
  assert.equal(out.body.result.text, "Baik");
  await assert.rejects(call("GET", `/v1/guest/jobs?id=${id}&token=wrong`), { status: 404 });
});

test("guest cannot use a private or disabled node", async () => {
  for (const node of [{ id: "n1", public_read: false, enabled: true }, { id: "n1", public_read: true, enabled: false }, null]) {
    const { jobs, call } = setup(node);
    await assert.rejects(call("POST", "/v1/guest/chat", { text: "Hai", node_id: "n1" }), { status: 403 });
    assert.equal(jobs.length, 0);
  }
});

test("other paths pass through", async () => {
  const { call } = setup(null);
  assert.equal(await call("GET", "/v1/chat"), false);
});
