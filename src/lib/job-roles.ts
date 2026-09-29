// Job roles and the role-level goal and metric templates that flow through
// to everyone holding that role. Metrics resolve virtually at read time;
// goals are materialised per person so they carry their own status.

import { prisma } from "./prisma";

/** Finds or creates a job role by name. Returns null for an empty name. */
export async function ensureJobRole(name: string | null | undefined): Promise<{ id: string; name: string } | null> {
  const trimmed = (name ?? "").trim();
  if (!trimmed) return null;
  const existing = await prisma.jobRole.findFirst({
    where: { name: { equals: trimmed, mode: "insensitive" } },
    select: { id: true, name: true },
  });
  if (existing) return existing;
  return prisma.jobRole.create({ data: { name: trimmed }, select: { id: true, name: true } });
}

function templateApplies(template: { team: string | null }, user: { team: string | null }): boolean {
  if (!template.team) return true;
  return (user.team ?? "").trim().toLowerCase() === template.team.trim().toLowerCase();
}

/**
 * Creates the goals a user is owed from active goal templates for their role,
 * skipping any they already have.
 */
export async function syncTemplateGoalsForUser(userId: string): Promise<number> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, jobRoleId: true, team: true, isActive: true },
  });
  if (!user?.jobRoleId || !user.isActive) return 0;

  const templates = await prisma.goalTemplate.findMany({
    where: { jobRoleId: user.jobRoleId, isActive: true },
  });
  const existing = await prisma.goal.findMany({
    where: { employeeId: userId, templateId: { in: templates.map((t) => t.id) } },
    select: { templateId: true },
  });
  const have = new Set(existing.map((g) => g.templateId));

  let created = 0;
  for (const template of templates) {
    if (have.has(template.id) || !templateApplies(template, user)) continue;
    await prisma.goal.create({
      data: {
        employeeId: userId,
        createdById: template.createdById,
        templateId: template.id,
        title: template.title,
        description: template.description,
        dueDate: template.dueOffsetDays ? new Date(Date.now() + template.dueOffsetDays * 86400000) : null,
        status: "ACTIVE",
      },
    });
    created += 1;
  }
  return created;
}

/** Creates the goal for every active user in the template's role who lacks it. */
export async function materialiseGoalTemplate(templateId: string): Promise<number> {
  const template = await prisma.goalTemplate.findUnique({ where: { id: templateId } });
  if (!template || !template.isActive) return 0;

  const users = await prisma.user.findMany({
    where: { jobRoleId: template.jobRoleId, isActive: true },
    select: { id: true, team: true },
  });
  const existing = await prisma.goal.findMany({
    where: { templateId, employeeId: { in: users.map((u) => u.id) } },
    select: { employeeId: true },
  });
  const have = new Set(existing.map((g) => g.employeeId));

  let created = 0;
  for (const user of users) {
    if (have.has(user.id) || !templateApplies(template, user)) continue;
    await prisma.goal.create({
      data: {
        employeeId: user.id,
        createdById: template.createdById,
        templateId: template.id,
        title: template.title,
        description: template.description,
        dueDate: template.dueOffsetDays ? new Date(Date.now() + template.dueOffsetDays * 86400000) : null,
        status: "ACTIVE",
      },
    });
    created += 1;
  }
  return created;
}

/** Cancels the still-active goal instances of a deactivated template. */
export async function cancelGoalTemplateInstances(templateId: string): Promise<number> {
  const result = await prisma.goal.updateMany({
    where: { templateId, status: "ACTIVE" },
    data: { status: "CANCELLED" },
  });
  return result.count;
}

export interface EffectiveMetric {
  /** Stable id for the UI: the metric id or the template id. */
  id: string;
  source: "personal" | "role";
  keyMetricId: string | null;
  metricTemplateId: string | null;
  name: string;
  target: string;
  unit: string | null;
  notes: string | null;
  createdBy: { id: string; name: string } | null;
  /** The result for the requested cycle, if any. */
  result: MetricResultView | null;
  /** The most recent result in any cycle. */
  latestResult: MetricResultView | null;
}

export interface MetricResultView {
  id: string;
  cycleId: string;
  actual: string;
  achieved: boolean | null;
  note: string | null;
  recordedBy: { id: string; name: string };
  updatedAt: Date;
}

/** Personal metrics plus the role templates that apply, with results. */
export async function effectiveMetrics(employeeId: string, cycleId?: string | null): Promise<EffectiveMetric[]> {
  const user = await prisma.user.findUnique({
    where: { id: employeeId },
    select: { jobRoleId: true, team: true },
  });

  const [personal, templates, results] = await Promise.all([
    prisma.keyMetric.findMany({
      where: { employeeId },
      include: { createdBy: { select: { id: true, name: true } } },
      orderBy: { createdAt: "desc" },
    }),
    user?.jobRoleId
      ? prisma.metricTemplate.findMany({
          where: { jobRoleId: user.jobRoleId, isActive: true },
          include: { createdBy: { select: { id: true, name: true } } },
          orderBy: { createdAt: "asc" },
        })
      : Promise.resolve([]),
    prisma.keyMetricResult.findMany({
      where: { employeeId },
      include: { recordedBy: { select: { id: true, name: true } }, cycle: { select: { year: true, month: true } } },
      orderBy: [{ cycle: { year: "desc" } }, { cycle: { month: "desc" } }],
    }),
  ]);

  const view = (r: (typeof results)[number]): MetricResultView => ({
    id: r.id,
    cycleId: r.cycleId,
    actual: r.actual,
    achieved: r.achieved,
    note: r.note,
    recordedBy: r.recordedBy,
    updatedAt: r.updatedAt,
  });

  const forMetric = (key: "keyMetricId" | "metricTemplateId", id: string) => {
    const mine = results.filter((r) => r[key] === id);
    const forCycle = cycleId ? mine.find((r) => r.cycleId === cycleId) : undefined;
    return { result: forCycle ? view(forCycle) : null, latestResult: mine[0] ? view(mine[0]) : null };
  };

  const roleMetrics: EffectiveMetric[] = templates
    .filter((t) => templateApplies(t, { team: user?.team ?? null }))
    .map((t) => ({
      id: t.id,
      source: "role",
      keyMetricId: null,
      metricTemplateId: t.id,
      name: t.name,
      target: t.target,
      unit: t.unit,
      notes: t.notes,
      createdBy: t.createdBy,
      ...forMetric("metricTemplateId", t.id),
    }));

  const personalMetrics: EffectiveMetric[] = personal.map((m) => ({
    id: m.id,
    source: "personal",
    keyMetricId: m.id,
    metricTemplateId: null,
    name: m.name,
    target: m.target,
    unit: m.unit,
    notes: m.notes,
    createdBy: m.createdBy,
    ...forMetric("keyMetricId", m.id),
  }));

  return [...roleMetrics, ...personalMetrics];
}

/** Whether a performance rating sits above what the metric results support. */
export function metricDisconnect(
  rating: number | null | undefined,
  results: { achieved: boolean | null }[]
): { hit: number; missed: number; disconnect: boolean } {
  const hit = results.filter((r) => r.achieved === true).length;
  const missed = results.filter((r) => r.achieved === false).length;
  const disconnect = (rating ?? 0) >= 2 && missed > hit;
  return { hit, missed, disconnect };
}
