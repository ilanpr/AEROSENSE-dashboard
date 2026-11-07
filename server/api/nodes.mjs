import { canManage } from "./access.mjs";

const idPattern = /^[a-zA-Z0-9_-]{1,40}$/;
const fail = (message, status = 400) => Object.assign(new Error(message), { status });

export function nodeRoutes({ db, user, send, filter, rawBody, rate, devices }) {
  return async (req, res, url) => {
    const options = url.pathname === "/v1/nodes/registration";
    const create = url.pathname === "/v1/nodes" && req.method === "POST";
    if (!options && !create) return false;
    if (options && req.method !== "GET") throw fail("Metode tidak diizinkan.", 405);
    const account = await user(req);
    const memberships = (await db("ae_members", "user_id=eq." + filter(account.id))).filter((m) =>
      canManage(m.role),
    );
    if (!memberships.length) throw fail("Hanya pengelola lokasi yang dapat menambah node.", 403);
    const gateways = Object.entries(devices)
      .filter(([, d]) => d.type === "gateway")
      .map(([id]) => id);
    if (options) {
      const nodes = await db(
        "ae_nodes",
        "select=name,location_id&location_id=in.(" +
          memberships.map((m) => filter(m.location_id)).join(",") +
          ")",
      );
      send(res, 200, {
        locations: memberships.map((m) => ({
          id: m.location_id,
          name: nodes.find((n) => n.location_id === m.location_id)?.name || m.location_id,
          can_publish: m.role === "admin",
        })),
        gateways,
      });
      return true;
    }
    rate("node-create:" + account.id, 12);
    const p = JSON.parse((await rawBody(req, 4000)).toString());
    const membership = memberships.find((m) => m.location_id === p?.location_id);
    if (!membership) throw fail("Anda tidak dapat menambah node pada lokasi ini.", 403);
    if (
      typeof p.id !== "string" ||
      !idPattern.test(p.id) ||
      typeof p.name !== "string" ||
      !p.name.trim() ||
      p.name.trim().length > 100 ||
      !gateways.includes(p.gateway_id) ||
      !Number.isFinite(p.latitude) ||
      p.latitude < -90 ||
      p.latitude > 90 ||
      !Number.isFinite(p.longitude) ||
      p.longitude < -180 ||
      p.longitude > 180 ||
      typeof p.public_read !== "boolean"
    )
      throw fail("Periksa identitas, gateway, dan koordinat node.");
    if (p.public_read && membership.role !== "admin")
      throw fail("Publikasi lokasi hanya dapat dilakukan admin.", 403);
    let rows;
    try {
      rows = await db("ae_nodes", "", "POST", {
        id: p.id,
        name: p.name.trim(),
        location_id: membership.location_id,
        gateway_id: p.gateway_id,
        latitude: p.latitude,
        longitude: p.longitude,
        enabled: true,
        public_read: p.public_read,
        pm25_validated: false,
      });
    } catch (error) {
      if (error.status === 409) throw fail("ID node sudah digunakan. Pilih ID lain.", 409);
      throw error;
    }
    send(res, 201, { node: rows[0] });
    return true;
  };
}
