// Job roles and the role-level metric and goal templates that flow through
// to everyone holding that role. Both kinds are materialised per person
// (templateId set) so each instance carries its own results and status, and
// the rest of the app treats them like any other key metric or goal.

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

function dueFromOffset(days: number | null): Date | null {
  return days ? new Date(Date.now() + days * 86400000) : null;
}

/**
 * Gives one user every active template of their role they do not yet have
 * (called at registration, on a role or team change, and on reactivation).
 */
export async function syncTemplatesForUser(userId: string): Promise<{ goals: number; metrics: number }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, jobRoleId: true, team: true, isActive: true },
  });
  if (!user?.jobRoleId || !user.isActive) return { goals: 0, metrics: 0 };

  const [goalTemplates, metricTemplates, goals, metrics] = await Promise.all([
    prisma.goalTemplate.findMany({ where: { jobRoleId: user.jobRoleId, isActive: true } }),
    prisma.metricTemplate.findMany({ where: { jobRoleId: user.jobRoleId, isActive: true } }),
    prisma.goal.findMany({ where: { employeeId: userId, templateId: { not: null } }, select: { templateId: true } }),
    prisma.keyMetric.findMany({ where: { employeeId: userId, templateId: { not: null } }, select: { templateId: true } }),
  ]);
  const haveGoal = new Set(goals.map((g) => g.templateId));
  const haveMetric = new Set(metrics.map((m) => m.templateId));

  let createdGoals = 0;
  for (const t of goalTemplates) {
    if (haveGoal.has(t.id) || !templateApplies(t, user)) continue;
    await prisma.goal.create({
      data: {
        employeeId: userId,
        createdById: t.createdById,
        templateId: t.id,
        title: t.title,
        description: t.description,
        dueDate: dueFromOffset(t.dueOffsetDays),
        status: "ACTIVE",
      },
    });
    createdGoals += 1;
  }

  let createdMetrics = 0;
  for (const t of metricTemplates) {
    if (haveMetric.has(t.id) || !templateApplies(t, user)) continue;
    await prisma.keyMetric.create({
      data: {
        employeeId: userId,
        createdById: t.createdById,
        templateId: t.id,
        name: t.name,
        target: t.target,
        unit: t.unit,
        notes: t.notes,
      },
    });
    createdMetrics += 1;
  }

  return { goals: createdGoals, metrics: createdMetrics };
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
        dueDate: dueFromOffset(template.dueOffsetDays),
        status: "ACTIVE",
      },
    });
    created += 1;
  }
  return created;
}

/** Creates the key metric for every active user in the template's role who lacks it. */
export async function materialiseMetricTemplate(templateId: string): Promise<number> {
  const template = await prisma.metricTemplate.findUnique({ where: { id: templateId } });
  if (!template || !template.isActive) return 0;

  const users = await prisma.user.findMany({
    where: { jobRoleId: template.jobRoleId, isActive: true },
    select: { id: true, team: true },
  });
  const existing = await prisma.keyMetric.findMany({
    where: { templateId, employeeId: { in: users.map((u) => u.id) } },
    select: { employeeId: true },
  });
  const have = new Set(existing.map((m) => m.employeeId));

  let created = 0;
  for (const user of users) {
    if (have.has(user.id) || !templateApplies(template, user)) continue;
    await prisma.keyMetric.create({
      data: {
        employeeId: user.id,
        createdById: template.createdById,
        templateId: template.id,
        name: template.name,
        target: template.target,
        unit: template.unit,
        notes: template.notes,
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

/**
 * Removes the metric instances of a deactivated template that never had a
 * result recorded; those with results stay as history.
 */
export async function retireMetricTemplateInstances(templateId: string): Promise<number> {
  const result = await prisma.keyMetric.deleteMany({
    where: { templateId, results: { none: {} } },
  });
  return result.count;
}

/** Pushes an edited template's name/target/unit/notes to its instances. */
export async function propagateMetricTemplate(templateId: string): Promise<number> {
  const template = await prisma.metricTemplate.findUnique({ where: { id: templateId } });
  if (!template) return 0;
  const result = await prisma.keyMetric.updateMany({
    where: { templateId },
    data: { name: template.name, target: template.target, unit: template.unit, notes: template.notes },
  });
  return result.count;
}

/** Pushes an edited goal template's title/description to its active instances. */
export async function propagateGoalTemplate(templateId: string): Promise<number> {
  const template = await prisma.goalTemplate.findUnique({ where: { id: templateId } });
  if (!template) return 0;
  const result = await prisma.goal.updateMany({
    where: { templateId, status: "ACTIVE" },
    data: { title: template.title, description: template.description },
  });
  return result.count;
}
