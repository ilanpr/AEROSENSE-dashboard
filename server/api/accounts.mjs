// Accounts: profile, role requests and their review by the AEROSENSE team, plus address search for sign-up.
// A new account is always a warga. Asking for a role never grants it; only ae_review_role_request does.
const fail = (message, status = 400) => Object.assign(new Error(message), { status });
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const REQUESTABLE_ROLES = ["operator", "auditor", "admin"];

const text = (v, max) =>
  typeof v === "string"
    ? v
        .normalize("NFKC")
        .replace(/[\u0000-\u001f\u007f<>]/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, max) || null
    : null;

// Indonesian numbers are stored as 62…; a leading 0 becomes 62.
export function normalizePhone(v) {
  if (v === undefined || v === null || v === "") return null;
  const digits = String(v).replace(/[\s().-]/g, "").replace(/^\+/, "");
  const id = digits.startsWith("0") ? "62" + digits.slice(1) : digits;
  if (!/^[0-9]{8,15}$/.test(id)) throw fail("Nomor telepon tidak valid. Contoh: 0812 3456 7890.");
  return id;
}

export function cleanProfile(p = {}, email = null) {
  const name = text(p.full_name ?? p.name, 80);
  if (name && name.length < 2) throw fail("Nama minimal 2 karakter.");
  const lat = p.latitude === null || p.latitude === undefined || p.latitude === "" ? null : Number(p.latitude);
  const lon =
    p.longitude === null || p.longitude === undefined || p.longitude === "" ? null : Number(p.longitude);
  if ((lat === null) !== (lon === null)) throw fail("Titik alamat belum lengkap.");
  if (lat !== null && (!Number.isFinite(lat) || Math.abs(lat) > 90 || !Number.isFinite(lon) || Math.abs(lon) > 180))
    throw fail("Titik alamat tidak valid.");
  return {
    email: typeof email === "string" ? email.slice(0, 254) : null,
    full_name: name,
    organization: text(p.organization, 120),
    phone: normalizePhone(p.phone),
    address: text(p.address, 240),
    latitude: lat,
    longitude: lon,
  };
}

function cleanRequest(p = {}) {
  if (!REQUESTABLE_ROLES.includes(p.requested_role)) throw fail("Pilih peran yang ingin diajukan.");
  return {
    requested_role: p.requested_role,
    organization: text(p.organization, 120),
    note: text(p.note, 500),
  };
}

const view = (r) =>
  r && {
    id: r.id,
    requested_role: r.requested_role,
    status: r.status,
    organization: r.organization,
    note: r.note,
    location_id: r.location_id,
    granted_role: r.granted_role,
    review_note: r.review_note,
    created_at: r.created_at,
    reviewed_at: r.reviewed_at,
  };

export function accountRoutes({ db, one, rpc, user, send, filter, rawBody, rate, request, now = Date.now }) {
  const geoCache = new Map();
  const isStaff = async (id) => !!(await one("ae_staff", "user_id=eq." + filter(id)));
  const body = async (req, max = 4000) => JSON.parse((await rawBody(req, max)).toString() || "{}");

  // First signed-in visit: turn the sign-up form (stored in user_metadata) into a profile and request.
  async function ensureProfile(u) {
    let profile = await one("ae_profiles", "user_id=eq." + filter(u.id));
    if (profile) return profile;
    const meta = u.user_metadata?.profile || {};
    let clean;
    try {
      clean = cleanProfile({ ...meta, full_name: meta.full_name || u.user_metadata?.name }, u.email);
    } catch {
      clean = cleanProfile({ full_name: u.user_metadata?.name }, u.email);
    }
    [profile] = await db(
      "ae_profiles",
      "on_conflict=user_id",
      "POST",
      { user_id: u.id, ...clean },
      "resolution=ignore-duplicates,return=representation",
    );
    profile ??= await one("ae_profiles", "user_id=eq." + filter(u.id));
    if (REQUESTABLE_ROLES.includes(meta.requested_role)) {
      const existing = await one("ae_role_requests", "user_id=eq." + filter(u.id));
      if (!existing)
        await db("ae_role_requests", "", "POST", {
          user_id: u.id,
          ...cleanRequest({ ...meta, organization: meta.organization }),
        }).catch(() => null);
    }
    return profile;
  }

  return async (req, res, url) => {
    const path = url.pathname;

    // Address search for the sign-up map. No account needed; results are coarse public places.
    if (path === "/v1/geocode" && req.method === "GET") {
      const q = text(url.searchParams.get("q"), 160);
      if (!q || q.length < 3) throw fail("Ketik minimal 3 huruf alamat.");
      const ip = String(req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "").split(",")[0];
      rate("geo:" + ip, 20);
      const key = q.toLowerCase();
      const hit = geoCache.get(key);
      if (hit && hit.until > now()) return send(res, 200, { results: hit.results }), true;
      const rows = await request(
        "https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&countrycodes=id&accept-language=id&q=" +
          encodeURIComponent(q),
        { headers: { "User-Agent": "AEROSENSE/1.0 (+https://aerosense.me)" }, timeout: 8000 },
      ).catch(() => {
        throw fail("Pencarian alamat sedang tidak tersedia. Isi alamat secara manual.", 503);
      });
      const results = (Array.isArray(rows) ? rows : [])
        .map((r) => ({ label: text(r.display_name, 240), latitude: Number(r.lat), longitude: Number(r.lon) }))
        .filter((r) => r.label && Number.isFinite(r.latitude) && Number.isFinite(r.longitude));
      if (geoCache.size > 300) geoCache.clear();
      geoCache.set(key, { results, until: now() + 3600000 });
      send(res, 200, { results });
      return true;
    }

    if (!["/v1/me", "/v1/me/profile", "/v1/me/role-request", "/v1/role-requests"].includes(path) &&
        !path.startsWith("/v1/role-requests/"))
      return false;
    const u = await user(req);

    if (path === "/v1/me" && req.method === "GET") {
      const profile = await ensureProfile(u);
      const [memberships, requests, staff] = await Promise.all([
        db("ae_members", "user_id=eq." + filter(u.id) + "&select=location_id,role"),
        db("ae_role_requests", "user_id=eq." + filter(u.id) + "&order=created_at.desc&limit=1"),
        isStaff(u.id),
      ]);
      send(res, 200, {
        profile: profile && { ...profile, user_id: undefined },
        memberships,
        role_request: view(requests[0]) || null,
        is_staff: staff,
      });
      return true;
    }

    if (path === "/v1/me/profile" && req.method === "PUT") {
      rate("profile:" + u.id, 10);
      const clean = cleanProfile(await body(req), u.email);
      const [profile] = await db(
        "ae_profiles",
        "on_conflict=user_id",
        "POST",
        { user_id: u.id, ...clean, updated_at: new Date(now()).toISOString() },
        "resolution=merge-duplicates,return=representation",
      );
      send(res, 200, { profile: { ...profile, user_id: undefined } });
      return true;
    }

    if (path === "/v1/me/role-request" && req.method === "POST") {
      rate("role-request:" + u.id, 5, 3600000);
      const clean = cleanRequest(await body(req));
      if (await one("ae_role_requests", "user_id=eq." + filter(u.id) + "&status=eq.pending"))
        throw fail("Permintaan peran Anda masih diverifikasi tim AEROSENSE.", 409);
      const [row] = await db("ae_role_requests", "", "POST", { user_id: u.id, ...clean });
      send(res, 201, { role_request: view(row) });
      return true;
    }

    if (path === "/v1/me/role-request" && req.method === "DELETE") {
      await db(
        "ae_role_requests",
        "user_id=eq." + filter(u.id) + "&status=eq.pending",
        "PATCH",
        { status: "cancelled" },
      );
      send(res, 200, { cancelled: true });
      return true;
    }

    // Review queue: AEROSENSE team only. Contact details never reach location admins of other partners.
    if (!(await isStaff(u.id))) throw fail("Verifikasi peran hanya untuk tim AEROSENSE.", 403);

    if (path === "/v1/role-requests" && req.method === "GET") {
      const status = ["pending", "approved", "rejected"].includes(url.searchParams.get("status"))
        ? url.searchParams.get("status")
        : "pending";
      const rows = await db(
        "ae_role_requests",
        "status=eq." + status + "&order=created_at.asc&limit=100",
      );
      const ids = [...new Set(rows.map((r) => r.user_id))];
      const profiles = ids.length
        ? await db("ae_profiles", "user_id=in.(" + ids.map(filter).join(",") + ")")
        : [];
      const nodes = await db("ae_nodes", "select=location_id,name&order=location_id");
      const locations = [...new Map(nodes.map((n) => [n.location_id, n.location_id])).keys()].map(
        (id) => ({ id, nodes: nodes.filter((n) => n.location_id === id).map((n) => n.name) }),
      );
      send(res, 200, {
        requests: rows.map((r) => {
          const p = profiles.find((x) => x.user_id === r.user_id) || {};
          return {
            ...view(r),
            applicant: {
              name: p.full_name,
              email: p.email,
              phone: p.phone,
              organization: p.organization,
              address: p.address,
            },
          };
        }),
        locations,
      });
      return true;
    }

    const id = path.slice("/v1/role-requests/".length);
    if (req.method === "POST" && uuid.test(id)) {
      rate("review:" + u.id, 60);
      const p = await body(req);
      if (!["approve", "reject"].includes(p.action)) throw fail("Pilih setujui atau tolak.");
      if (p.action === "approve") {
        if (!/^[a-zA-Z0-9_-]{2,40}$/.test(p.location_id || "")) throw fail("Pilih atau tulis ID lokasi.");
        if (!["viewer", "operator", "auditor", "admin"].includes(p.role)) throw fail("Pilih peran.");
      }
      const result = await rpc("review_role_request", {
        p_request: id,
        p_staff: u.id,
        p_action: p.action,
        p_location: p.location_id || null,
        p_role: p.role || null,
        p_note: text(p.note, 500) || "",
      }).catch(() => {
        throw fail("Permintaan tidak ditemukan atau sudah diproses.", 409);
      });
      send(res, 200, { result });
      return true;
    }
    return false;
  };
}
