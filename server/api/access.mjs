// Who may see what. Shared by the browser API routes and the public routes.
//   tamu (no account) and viewer (warga): simple history, no model data, no exports
//   operator: model details, history export, alert review and threshold settings
//   auditor: model details and the ESG report, read only
//   admin: everything, including the ESG report
export const ROLE_RANK = { viewer: 1, auditor: 2, operator: 3, admin: 4 };

export const canViewModel = role => ["operator", "admin", "auditor"].includes(role);
export const canAuditEsg = role => ["admin", "auditor"].includes(role);
export const canManage = role => ["operator", "admin"].includes(role);

export function highestRole(memberships = []) {
  return memberships.reduce((best, m) => (ROLE_RANK[m.role] || 0) > (ROLE_RANK[best] || 0) ? m.role : best, null);
}

// Corrected readings only: no raw sensor input, model output or processing details.
export const simpleReading = r => ({
  id: r.id,
  node_id: r.node_id,
  observed_at: r.observed_at,
  metrics: r.metrics ?? {},
  quality: { invalid: r.quality?.invalid === true },
});
