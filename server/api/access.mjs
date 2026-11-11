// Who may see what. Shared by the browser API routes and the public routes.
//   tamu (no account) and viewer (warga): simple history, no model data, no exports
//   operator: model details, history export, alert review and threshold settings
//   auditor: model details and the ESG report, read only
//   admin: everything, including the ESG report
export const ROLE_RANK = { viewer: 1, auditor: 2, operator: 3, admin: 4 };

export const canViewModel = (role) => ["operator", "admin", "auditor"].includes(role);
export const canAuditEsg = (role) => ["admin", "auditor"].includes(role);
export const canManage = (role) => ["operator", "admin"].includes(role);

export function highestRole(memberships = []) {
  return memberships.reduce(
    (best, m) => ((ROLE_RANK[m.role] || 0) > (ROLE_RANK[best] || 0) ? m.role : best),
    null,
  );
}

// Corrected readings only: no raw sensor input, model output or processing details.
export const simpleReading = (r) => ({
  id: r.id,
  node_id: r.node_id,
  observed_at: r.observed_at,
  metrics: r.metrics ?? {},
  quality: { invalid: r.quality?.invalid === true },
});

const denied = () => Object.assign(new Error("Akses lokasi tidak diizinkan"), { status: 403 });

// Access to one node. An assigned member gets the role of that location. With allowPublic, any signed-in
// account may READ a node its admin published (public_read) as a viewer: no assignment needed.
// Writes always need an operator or admin membership.
export async function nodeAccess(
  { one, filter },
  userId,
  nodeId,
  { write = false, allowPublic = false } = {},
) {
  const n = await one("ae_nodes", "id=eq." + filter(nodeId));
  const m =
    n &&
    (await one("ae_members", "user_id=eq." + userId + "&location_id=eq." + filter(n.location_id)));
  if (m && (!write || canManage(m.role))) return Object.assign(n, { member_role: m.role });
  if (!m && !write && allowPublic && n?.public_read === true && n.enabled === true)
    return Object.assign(n, { member_role: "viewer", public_access: true });
  throw denied();
}

// What a non-member may see of a published node: no gateway, location or internal fields.
export const PUBLIC_NODE_FIELDS = ["id", "name", "latitude", "longitude", "pm25_validated"];
