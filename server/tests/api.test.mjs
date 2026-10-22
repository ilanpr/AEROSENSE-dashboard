import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { createHmac } from "node:crypto";
test("HTTP API enforces user/device boundaries and durably accepts signed Meta messages", async () => {
  const jobs = [];
  const u = "00000000-0000-4000-8000-000000000001";
  const nodes = [
    {
      id: "n1",
      gateway_id: "g1",
      location_id: "L1",
      enabled: true,
      latitude: -7,
      longitude: 112,
    },
    {
      id: "n2",
      gateway_id: "g2",
      location_id: "L2",
      enabled: true,
      latitude: -6,
      longitude: 111,
    },
  ];
  const mock = http.createServer(async (req, res) => {
    const url = new URL(req.url, "http://x");
    let raw = "";
    for await (const c of req) raw += c;
    const p = raw ? JSON.parse(raw) : null;
    let output = [];
    if (url.pathname === "/auth/v1/user") {
      if (req.headers.authorization !== "Bearer valid") {
        res.writeHead(401);
        res.end("{}");
        return;
      }
      output = { id: u };
    }
    if (url.pathname === "/rest/v1/ae_nodes")
      output = nodes.filter(
        (n) =>
          (!url.searchParams.get("id") ||
            url.searchParams.get("id") === "eq." + n.id) &&
          (!url.searchParams.get("location_id") ||
            url.searchParams.get("location_id") === "eq." + n.location_id),
      );
    if (url.pathname === "/rest/v1/ae_members")
      output =
        !url.searchParams.get("location_id") ||
        url.searchParams.get("location_id") === "eq.L1"
          ? [{ user_id: u, location_id: "L1", role: "admin" }]
          : [];
    if (url.pathname === "/rest/v1/ae_jobs") {
      if (req.method === "POST") {
        const exists = jobs.find((j) => j.dedupe_key === p.dedupe_key);
        if (exists) output = [];
        else {
          const row = { id: "job-" + jobs.length, ...p, status: "pending" };
          jobs.push(row);
          output = [row];
        }
      } else
        output = jobs.filter(
          (j) =>
            (!url.searchParams.get("dedupe_key") ||
              url.searchParams.get("dedupe_key") === "eq." + j.dedupe_key) &&
            (!url.searchParams.get("id") ||
              url.searchParams.get("id") === "eq." + j.id),
        );
    }
    if (url.pathname === "/rest/v1/ae_rules" && req.method === "POST") output = [p];
    if (url.pathname === "/rest/v1/rpc/ae_ingest")
      output = { reading_id: "r1", duplicate: false };
    if (url.pathname === "/rest/v1/rpc/ae_stage") {
      const j = jobs.find((j) => j.id === p.p_id);
      Object.assign(j.stage, p.p_stage);
      output = true;
    }
    if (url.pathname === "/rest/v1/rpc/ae_finish") {
      const j = jobs.find((j) => j.id === p.p_id);
      j.status = "done";
      j.result = p.p_result;
      output = true;
    }
    if (url.pathname === "/rest/v1/rpc/ae_retry") output = true;
    if (url.pathname === "/rest/v1/ae_robots")
      output =
        url.searchParams.get("id") === "eq.robot-test"
          ? [{ id: "robot-test", node_id: "n1", enabled: true }]
          : [];
    if (url.pathname === "/rest/v1/ae_contacts")
      output = [
        { phone: "628123456789", last_inbound_at: new Date().toISOString() },
      ];
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(output));
  });
  await new Promise((resolve) => mock.listen(0, "127.0.0.1", resolve));
  Object.assign(process.env, {
    DISASTER_NEWS_ENABLED: "false",
    PORT: "0",
    SUPABASE_URL: "http://127.0.0.1:" + mock.address().port,
    SUPABASE_ANON_KEY: "anon-test",
    SUPABASE_SERVICE_ROLE_KEY: "service-test",
    INTERNAL_API_KEY: "internal-test",
    DEVICE_KEYS_JSON: JSON.stringify({
      g1: { type: "gateway", key: "gateway-test" },
    }),
    WHATSAPP_APP_SECRET: "meta-test",
    WHATSAPP_PHONE_NUMBER_ID: "phone-id",
    WHATSAPP_VERIFY_TOKEN: "verify-test",
    WEB_ORIGINS: "",
  });
  const { server } = await import("../api/server.mjs");
  if (!server.listening)
    await new Promise((resolve) => server.once("listening", resolve));
  const base = "http://127.0.0.1:" + server.address().port;
  const post = (path, p, headers = {}) =>
    fetch(base + path, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(p),
    });
  try {
    assert.equal((await fetch(base + "/v1/nodes")).status, 401);
    const ruleBody = {node_id:"n1",metric:"dust_ug_m3",high:40,clear_below:35,danger_high:60,unit:"µg/m³",cooldown_seconds:1800,enabled:true};
    const ruleAuth = {Authorization:"Bearer valid"};
    const previousGeminiKey = process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY;
    const unavailableVoice = await post("/v1/voice/speak", {test:true}, ruleAuth);
    if (previousGeminiKey !== undefined) process.env.GEMINI_API_KEY = previousGeminiKey;
    assert.equal(unavailableVoice.status,503);
    assert.match((await unavailableVoice.json()).error,/Suara AERO-BOT belum diaktifkan/);

    const savedRule = await post("/v1/rules",ruleBody,ruleAuth);
    assert.equal(savedRule.status,200);
    assert.equal((await savedRule.json())[0].danger_high,60);
    for (const danger_high of [35,40,"60"]) assert.equal((await post("/v1/rules",{...ruleBody,danger_high},ruleAuth)).status,400);

    assert.equal(
      (
        await fetch(base + "/v1/robot/state?robot_id=missing", {
          headers: { Authorization: "Bearer valid" },
        })
      ).status,
      404,
    );
    assert.equal(
      (
        await post(
          "/v1/robot/touch",
          { robot_id: "missing" },
          { Authorization: "Bearer valid" },
        )
      ).status,
      404,
    );
    assert.equal(
      (
        await fetch(base + "/v1/robot/commands", {
          headers: { Authorization: "Bearer valid" },
        })
      ).status,
      401,
    );
    const authorized = await fetch(base + "/v1/nodes", {
      headers: { Authorization: "Bearer valid" },
    });
    assert.deepEqual(
      (await authorized.json()).nodes.map((n) => n.id),
      ["n1"],
    );
    const touchHeaders = {
      Authorization: "Bearer valid",
      "Idempotency-Key": "touch-test",
    };
    const touch = {
      robot_id: "robot-test",
      text: "Bagaimana kondisi lingkungan?",
    };
    assert.equal(
      (await post("/v1/robot/touch", touch, touchHeaders)).status,
      202,
    );
    assert.equal(
      (await post("/v1/robot/touch", touch, touchHeaders)).status,
      202,
    );
    assert.equal(jobs.filter((j) => j.kind === "robot_chat").length, 1);
    assert.equal(jobs.find((j) => j.kind === "robot_chat").owner_id, u);
    assert.equal(
      (
        await fetch(base + "/v1/latest?node_id=n2", {
          headers: { Authorization: "Bearer valid" },
        })
      ).status,
      403,
    );
    const p = {
      node_id: "n1",
      boot_id: "abc",
      sequence: 0,
      observed_at: new Date().toISOString(),
      metrics: { eco2_ppm: 650 },
    };
    const headers = { "X-Device-Id": "g1", "X-Device-Key": "gateway-test" };
    assert.equal((await post("/v1/telemetry", p, headers)).status, 200);
    assert.equal(
      (await post("/v1/telemetry", { ...p, node_id: "n2" }, headers)).status,
      403,
    );
    assert.equal(
      (
        await post(
          "/v1/telemetry",
          { ...p, metrics: { eco2_ppm: "650" } },
          headers,
        )
      ).status,
      400,
    );
    assert.equal(
      (await post("/internal/claim", { kind: "web_chat" })).status,
      401,
    );
    const chat = { text: "Bagaimana mengurangi polusi udara?", node_id: "n1" },
      auth = { Authorization: "Bearer valid", "Idempotency-Key": "question-1" };
    assert.equal((await post("/v1/chat", chat, auth)).status, 202);
    assert.equal((await post("/v1/chat", chat, auth)).status, 202);
    assert.equal(jobs.filter((j) => j.kind === "web_chat").length, 1);
    const webhook = {
      object: "whatsapp_business_account",
      entry: [
        {
          changes: [
            {
              value: {
                metadata: { phone_number_id: "phone-id" },
                messages: [
                  {
                    id: "wa-id",
                    from: "628123456789",
                    timestamp: String(Math.floor(Date.now() / 1000)),
                    type: "text",
                    text: { body: "Bagaimana menjaga lingkungan?" },
                  },
                ],
              },
            },
          ],
        },
      ],
    };
    const raw = JSON.stringify(webhook);
    const signature =
      "sha256=" + createHmac("sha256", "meta-test").update(raw).digest("hex");
    assert.equal(
      (
        await post("/webhooks/whatsapp", webhook, {
          "X-Hub-Signature-256": signature,
        })
      ).status,
      200,
    );
    assert.equal(
      (
        await post("/webhooks/whatsapp", webhook, {
          "X-Hub-Signature-256": signature,
        })
      ).status,
      200,
    );
    assert.equal(jobs.filter((j) => j.kind === "wa_inbox").length, 1);
    assert.equal(
      (
        await post("/webhooks/whatsapp", webhook, {
          "X-Hub-Signature-256": "sha256=bad",
        })
      ).status,
      401,
    );
    const verified = await fetch(
      base +
        "/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=verify-test&hub.challenge=123",
    );
    assert.equal(await verified.text(), "123");
    const internal = { "X-Aerosense-Internal-Key": "internal-test" };
    assert.equal(
      (
        await post("/internal/whatsapp/native-event", {
          event: webhook.entry[0].changes[0].value,
        })
      ).status,
      401,
    );
    assert.equal(
      (
        await post(
          "/internal/whatsapp/native-event",
          { event: webhook.entry[0].changes[0].value },
          internal,
        )
      ).status,
      200,
    );
    assert.equal(jobs.filter((j) => j.kind === "wa_inbox").length, 1);
    function leasedJob(kind, text) {
      const j = {
        id: "leased-" + jobs.length,
        lease_token: "lease-test",
        lease_until: new Date(Date.now() + 300000).toISOString(),
        status: "running",
        kind,
        body: { text, node_ids: ["n1"], phone: "628123456789" },
        stage: {},
      };
      jobs.push(j);
      return { id: j.id, lease_token: j.lease_token };
    }
    const q = leasedJob("web_chat", "Bagaimana mengurangi polusi?");
    assert.equal(
      (
        await post(
          "/internal/chat/native-context",
          { ...q, lease_token: "invalid" },
          internal,
        )
      ).status,
      400,
    );
    const context = await post("/internal/chat/native-context", q, internal);
    assert.deepEqual((await context.json()).node_ids, ["n1"]);
    let gate = await post(
      "/internal/chat/native-gate",
      { ...q, decision: "allow" },
      internal,
    );
    assert.equal((await gate.json()).permitted, true);
    let refreshed = await post(
      "/internal/chat/native-refresh",
      {
        ...q,
        context: [
          {
            node_id: "n1",
            reading_id: "latest-1",
            observed_at: new Date().toISOString(),
            metrics: { dust_ug_m3: 24 },
            gru: { model_version: "v1", value: 25 },
          },
        ],
      },
      internal,
    );
    assert.equal((await refreshed.json()).context[0].reading_id, "latest-1");
    assert.equal(
      (
        await post(
          "/internal/chat/native-refresh",
          { ...q, context: [{ node_id: "n2" }] },
          internal,
        )
      ).status,
      400,
    );
    let answer = await post(
      "/internal/chat/native-answer",
      { ...q, decision: "deny", answer: "Unsupported measurement" },
      internal,
    );
    assert.match((await answer.json()).answer, /lingkungan/i);
    const result = await post("/internal/chat/native-deliver", q, internal);
    assert.equal((await result.json()).result.denied, true);
    const curse = leasedJob("web_chat", "fuck");
    await post("/internal/chat/native-context", curse, internal);
    gate = await post(
      "/internal/chat/native-gate",
      { ...curse, decision: "allow" },
      internal,
    );
    assert.equal((await gate.json()).permitted, true);
    answer = await post(
      "/internal/chat/native-answer",
      { ...curse, decision: "deny", answer: "" },
      internal,
    );
    assert.match((await answer.json()).answer, /lingkungan/i);
    const deniedResult = await post(
      "/internal/chat/native-deliver",
      curse,
      internal,
    );
    assert.equal((await deniedResult.json()).result.denied, true);
    const malformed = leasedJob("web_chat", "Bagaimana kondisi udara?");
    await post("/internal/chat/native-context", malformed, internal);
    gate = await post(
      "/internal/chat/native-gate",
      { ...malformed, decision: "yes" },
      internal,
    );
    assert.equal((await gate.json()).permitted, false);
    const sendJob = leasedJob("wa_send", "");
    jobs.at(-1).body.text = "Kondisi udara berubah.";
    const ready = await post(
      "/internal/whatsapp/native-send",
      sendJob,
      internal,
    );
    assert.equal((await ready.json()).payload.type, "text");
    assert.equal(
      (
        await post(
          "/internal/whatsapp/native-send",
          { ...sendJob, complete: true },
          internal,
        )
      ).status,
      400,
    );
    const sent = await post(
      "/internal/whatsapp/native-send",
      { ...sendJob, complete: true, provider_id: "wamid.test" },
      internal,
    );
    assert.equal((await sent.json()).result.provider_id, "wamid.test");
  } finally {
    await new Promise((r) => server.close(r));
    await new Promise((r) => mock.close(r));
  }
});
