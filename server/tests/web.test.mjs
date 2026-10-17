import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";

test("web API separates public cache, authorized sensor data, and owner-only chat results", async () => {
  const uid = "00000000-0000-4000-8000-000000000001",
    other = "00000000-0000-4000-8000-000000000002";
  const area = {
    id: "node_n1",
    source_node_id: "n1",
    name: "Node asli",
    latitude: -7.1,
    longitude: 112.1,
    enabled: true,
  };
  const fact = {
    id: "air-1",
    area_id: area.id,
    reference: { latitude: area.latitude, longitude: area.longitude },
    category: "air_quality",
    label: "Estimasi PM2.5 wilayah",
    value: 12,
    unit: "µg/m³",
    fresh_until: new Date(Date.now() - 1000).toISOString(),
  };
  const cache = [
    {
      area_id: area.id,
      provider: "openmeteo_air",
      request_latitude: area.latitude,
      request_longitude: area.longitude,
      payload: {
        facts: [fact, { ...fact, id: "foreign", area_id: "elsewhere" }],
      },
    },
    {
      area_id: area.id,
      provider: "openmeteo_weather",
      request_latitude: 0,
      request_longitude: 0,
      payload: { facts: [fact] },
    },
  ];
  const node = {
    id: "n1",
    name: "Sensor asli",
    latitude: -7.1,
    longitude: 112.1,
    location_id: "L1",
    enabled: true,
  };
  const job = {
    id: "job-own",
    kind: "web_chat",
    owner_id: uid,
    status: "done",
    body: { node_ids: ["n1"] },
    result: { text: "Jawaban dari worker" },
  };
  let contextReads = 0;
  let memberRole = "viewer";
  const mock = http.createServer(async (req, res) => {
    const url = new URL(req.url, "http://x");
    let output = [];
    if (url.pathname === "/auth/v1/user") {
      if (req.headers.authorization !== "Bearer valid") {
        res.writeHead(401);
        res.end("{}");
        return;
      }
      output = { id: uid };
    }
    if (url.pathname === "/rest/v1/ae_members")
      output =
        url.searchParams.get("location_id") === "eq.L2"
          ? []
          : [{ user_id: uid, location_id: "L1", role: memberRole }];
    if (url.pathname === "/rest/v1/ae_nodes")
      output =
        url.searchParams.get("id") === "eq.n2"
          ? [{ id: "n2", location_id: "L2" }]
          : [node];
    if (url.pathname === "/rest/v1/ae_sensor_context") {
      contextReads++;
      output = [
        {
          node_id: "n1",
          reading_id: null,
          observed_at: null,
          stale: true,
          metrics: {},
          gru: null,
        },
      ];
    }
    if (url.pathname === "/rest/v1/ae_environment_areas")
      output = url.searchParams.get("source_node_id") === "eq.n1" ? [area] : [];
    if (url.pathname === "/rest/v1/ae_environment_area_cache")
      output = url.searchParams.get("area_id") === "eq.node_n1" ? cache : [];
    if (url.pathname === "/rest/v1/ae_disaster_news_cache") output = [{
      provider:"gdacs", last_success_at:new Date().toISOString(), last_error:null,
      items:[{id:"idn",country_code:"IDN",url:"https://www.gdacs.org/report.aspx?eventid=1",published_at:new Date().toISOString(),title:"Indonesia",metrics:[]}],
    }];
    if (url.pathname === "/rest/v1/ae_jobs") {
      const candidate =
        url.searchParams.get("id") === "eq.job-own"
          ? job
          : { ...job, id: "foreign-job", owner_id: other };
      output =
        url.searchParams.get("owner_id") === "eq." + candidate.owner_id
          ? [candidate]
          : [];
    }
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(output));
  });
  await new Promise((r) => mock.listen(0, "127.0.0.1", r));
  Object.assign(process.env, {
    PORT: "0",
    SUPABASE_URL: "http://127.0.0.1:" + mock.address().port,
    SUPABASE_ANON_KEY: "public-test",
    SUPABASE_SERVICE_ROLE_KEY: "private-test",
    INTERNAL_API_KEY: "internal-test",
    DEVICE_KEYS_JSON: "{}",
    WEB_ORIGINS: "https://aerosense.me",
    DISASTER_NEWS_ENABLED: "false",
  });
  const { server } = await import("../api/server.mjs");
  if (!server.listening) await new Promise((r) => server.once("listening", r));
  const base = "http://127.0.0.1:" + server.address().port,
    auth = { headers: { Authorization: "Bearer valid" } };
  try {
    const config = await (await fetch(base + "/v1/config")).json();
    assert.equal(config.supabase_publishable_key, "public-test");
    assert(!JSON.stringify(config).includes("private-test"));
    assert(!JSON.stringify(config).includes("internal-test"));
    const publicResponse = await fetch(base + "/v1/environment?node_id=n1", auth);
    assert.equal(publicResponse.status, 200);
    assert.equal(publicResponse.headers.get("cache-control"), "no-store");
    const hub = await publicResponse.json();
    assert.equal(hub.node.id, "n1");
    assert.equal(hub.area.id, "node_n1");
    assert.equal(hub.providers[0].facts.length, 1);
    assert.equal(hub.providers[0].facts[0].stale, true);
    assert.deepEqual(hub.providers[1].facts, []);
    assert.equal(contextReads, 0);
    const news = await (await fetch(base + "/v1/disasters")).json();
    assert.equal(news.scope,"Indonesia");
    assert.equal(news.items[0].country_code,"IDN");
    assert(!JSON.stringify(news).includes("private-test"));
    assert.equal(
      (await fetch(base + "/v1/environment?node_id=n2", auth)).status,
      403,
    );
    assert.equal(
      (await fetch(base + "/v1/environment?node_id=bad%26filter", auth)).status,
      400,
    );
    assert.equal((await fetch(base + "/v1/environment?node_id=n1")).status, 401);
    assert.equal((await fetch(base + "/v1/dashboard")).status, 401);
    const dash = await (await fetch(base + "/v1/dashboard", auth)).json();
    assert.equal(dash.nodes[0].latitude, -7.1);
    assert.equal(dash.nodes[0].role, "viewer");
    assert.equal(dash.nodes[0].latest.reading_id, null);
    assert.equal((await fetch(base + "/v1/esg/report")).status, 401);
    for (const role of ["viewer", "operator", "auditor"]) {
      memberRole = role;
      assert.equal(
        (await (await fetch(base + "/v1/access", auth)).json()).can_audit_esg,
        false,
      );
      assert.equal((await fetch(base + "/v1/esg/report", auth)).status, 403);
    }
    memberRole = "admin";
    assert.equal(
      (await (await fetch(base + "/v1/access", auth)).json()).can_audit_esg,
      true,
    );
    assert.equal((await fetch(base + "/v1/esg/report", auth)).status, 200);
    assert.equal(
      (await fetch(base + "/v1/esg/report?node_id=n2", auth)).status,
      403,
    );
    memberRole = "viewer";
    assert.equal((await fetch(base + "/v1/esg/report", auth)).status, 403);
    assert.equal(
      (await fetch(base + "/v1/rules?node_id=n2", auth)).status,
      403,
    );
    const answer = await (
      await fetch(base + "/v1/jobs?id=job-own", auth)
    ).json();
    assert.equal(answer.result.text, "Jawaban dari worker");
    assert.equal(
      (await fetch(base + "/v1/jobs?id=foreign-job", auth)).status,
      404,
    );
    assert.equal(
      (
        await fetch(base + "/v1/config", {
          headers: { Origin: "https://untrusted.example" },
        })
      ).status,
      403,
    );
  } finally {
    await new Promise((r) => server.close(r));
    await new Promise((r) => mock.close(r));
  }
});
