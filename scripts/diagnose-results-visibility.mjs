// Read-only diagnostic for "my manager sent my results but I can't see them".
//
// Employee visibility of a manager review hangs off exactly one nullable column:
// ManagerAssessment.resultsSentAt. When My Reviews shows a cycle card that reads
// "Pending Manager Review" for a review that was definitely sent, the row the
// summary API returns has resultsSentAt = NULL. There are only two ways that
// happens, and this script tells them apart:
//
//   Cause A — the review was unlocked for editing and never re-sent. The audit
//     trail shows assessment.send followed by assessment.unlock with no later
//     send. The original send timestamp is in that audit row.
//   Cause B — more than one ManagerAssessment row exists for the cycle+employee
//     (the unique key includes managerId, so a manager change creates a second
//     row) and the unordered findFirst in the summary API returns the blank one.
//
// SELECT only — this script never writes.
//
// Usage:
//   DATABASE_URL=... node scripts/diagnose-results-visibility.mjs \
//     --employee someone@example.com [--cycle 2026-05]
import { neon } from "@neondatabase/serverless";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL not set.");
  process.exit(1);
}

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const employeeRef = arg("employee");
const cycleRef = arg("cycle", "2026-05");

if (!employeeRef) {
  console.error("Missing --employee <email or user id>. Optional: --cycle YYYY-MM (default 2026-05).");
  process.exit(1);
}

const [cycleYear, cycleMonth] = cycleRef.split("-").map(Number);
if (!cycleYear || !cycleMonth) {
  console.error(`Could not parse --cycle "${cycleRef}". Expected YYYY-MM, e.g. 2026-05.`);
  process.exit(1);
}

const sql = neon(url);
const fmt = (d) => (d ? new Date(d).toISOString() : "—");

const [employee] = await sql`
  SELECT id, name, email, "managerId", "isActive"
  FROM "User"
  WHERE email = ${employeeRef} OR id = ${employeeRef}
  LIMIT 1
`;
if (!employee) {
  console.error(`No user matches "${employeeRef}".`);
  process.exit(1);
}

const currentManager = employee.managerId
  ? (await sql`SELECT id, name, "isActive" FROM "User" WHERE id = ${employee.managerId}`)[0]
  : null;

console.log(`\nEmployee   ${employee.name} <${employee.email}>  ${employee.id}`);
console.log(`Active     ${employee.isActive}`);
console.log(
  `Manager    ${currentManager ? `${currentManager.name} (${currentManager.id})${currentManager.isActive ? "" : " — INACTIVE"}` : "none assigned"}`
);

// A cycle can be a legacy monthly row (month set, quarter null) or a quarterly
// one; check both readings of the requested period.
const quarter = Math.floor((cycleMonth - 1) / 3) + 1;
const cycles = await sql`
  SELECT id, month, quarter, year, status, "createdAt"
  FROM "AssessmentCycle"
  WHERE year = ${cycleYear} AND (month = ${cycleMonth} OR quarter = ${quarter})
  ORDER BY "createdAt"
`;

console.log(`\n── Cycles matching ${cycleRef} (month ${cycleMonth} or Q${quarter} ${cycleYear}) ──`);
if (cycles.length === 0) {
  console.log("NONE. The cycle row itself is gone — assessments cascade-delete with it.");
  process.exit(0);
}
for (const c of cycles) {
  const label = c.quarter ? `Q${c.quarter} ${c.year}` : `month ${c.month} ${c.year}`;
  console.log(`  ${c.id}  ${label}  status=${c.status}  created=${fmt(c.createdAt)}`);
}

for (const cycle of cycles) {
  const label = cycle.quarter ? `Q${cycle.quarter} ${cycle.year}` : `${cycle.year}-${String(cycle.month).padStart(2, "0")}`;
  console.log(`\n═══ ${label}  (${cycle.id}) ═══`);

  const [self] = await sql`
    SELECT id, "submittedAt" FROM "SelfAssessment"
    WHERE "cycleId" = ${cycle.id} AND "employeeId" = ${employee.id}
  `;
  console.log(
    `\nSelf-assessment: ${self ? `${self.id}  submittedAt=${fmt(self.submittedAt)}` : "no row"}`
  );

  const rows = await sql`
    SELECT ma.id, ma."managerId", u.name AS manager_name, u."isActive" AS manager_active,
           ma."submittedAt", ma."resultsSentAt", ma.performance,
           ma."meetingStatus", ma."createdAt", ma."updatedAt"
    FROM "ManagerAssessment" ma
    LEFT JOIN "User" u ON u.id = ma."managerId"
    WHERE ma."cycleId" = ${cycle.id} AND ma."employeeId" = ${employee.id}
    ORDER BY ma."createdAt"
  `;

  console.log(`\nManager assessment rows: ${rows.length}`);
  for (const r of rows) {
    console.log(`  ${r.id}`);
    console.log(`    manager      ${r.manager_name} (${r.managerId})${r.manager_active ? "" : " — INACTIVE"}`);
    console.log(`    submittedAt  ${fmt(r.submittedAt)}`);
    console.log(`    resultsSent  ${fmt(r.resultsSentAt)}`);
    console.log(`    performance  ${r.performance ?? "—"}   meetingStatus=${r.meetingStatus}`);
    console.log(`    created      ${fmt(r.createdAt)}   updated=${fmt(r.updatedAt)}`);
  }

  if (rows.length === 0) {
    console.log("\n  → No manager assessment exists for this cycle. Nothing was ever sent,");
    console.log("    or the row was removed (deleting a user wipes every review they wrote).");
    continue;
  }

  // One query per row id — array binding differs between drivers, and this
  // script has to be right the first time against production data.
  const logs = [];
  for (const row of rows) {
    const entries = await sql`
      SELECT al.id, al.action, al.summary, al."entityId", al."createdAt", u.name AS actor_name
      FROM "AuditLog" al
      LEFT JOIN "User" u ON u.id = al."actorId"
      WHERE al."entityType" = 'ManagerAssessment' AND al."entityId" = ${row.id}
      ORDER BY al."createdAt"
    `;
    logs.push(...entries);
  }
  logs.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

  console.log(`\nAudit trail (${logs.length} entries):`);
  if (logs.length === 0) console.log("  none");
  for (const l of logs) {
    console.log(`  ${fmt(l.createdAt)}  ${l.action.padEnd(20)} ${l.actor_name ?? "?"} — ${l.summary ?? ""}`);
  }

  // Verdict.
  console.log("\nVerdict:");
  const populated = rows.filter((r) => r.submittedAt || r.resultsSentAt);
  const visible = rows.some((r) => r.resultsSentAt);

  if (visible && rows.length === 1) {
    console.log("  Results ARE shared on the only row — the employee should see this review.");
  }
  if (rows.length > 1) {
    console.log(`  CAUSE B: ${rows.length} rows for one cycle+employee. The summary API's`);
    console.log("  findFirst has no orderBy, so it can return the blank row. Populated row(s):");
    for (const r of populated) console.log(`    ${r.id} (manager ${r.manager_name})`);
  }
  const sends = logs.filter((l) => l.action === "assessment.send");
  const unlocks = logs.filter((l) => l.action === "assessment.unlock");
  const lastSend = sends[sends.length - 1];
  const lastUnlock = unlocks[unlocks.length - 1];
  if (lastUnlock && (!lastSend || new Date(lastUnlock.createdAt) > new Date(lastSend.createdAt))) {
    console.log("  CAUSE A: results were unlocked after being sent and never re-sent.");
    if (lastSend) console.log(`  Original send timestamp to restore: ${fmt(lastSend.createdAt)}`);
  }
  if (!visible && rows.length === 1 && !lastUnlock) {
    console.log("  Single row, never unlocked, resultsSentAt is null — results were never sent.");
  }
}

console.log("");
