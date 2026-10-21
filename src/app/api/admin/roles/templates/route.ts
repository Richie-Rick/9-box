import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/permissions";
import {
  materialiseGoalTemplate,
  materialiseMetricTemplate,
  cancelGoalTemplateInstances,
  retireMetricTemplateInstances,
  propagateGoalTemplate,
  propagateMetricTemplate,
} from "@/lib/job-roles";

function clean(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/** Creates a metric or goal template for a role and gives it to everyone in it. */
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isAdmin(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const { kind, jobRoleId } = body;
  if (!jobRoleId || (kind !== "metric" && kind !== "goal")) {
    return NextResponse.json({ error: "jobRoleId and kind (metric or goal) are required" }, { status: 400 });
  }

  if (kind === "metric") {
    const name = clean(body.name);
    const target = clean(body.target);
    if (!name || !target) {
      return NextResponse.json({ error: "name and target are required" }, { status: 400 });
    }
    const template = await prisma.metricTemplate.create({
      data: {
        jobRoleId,
        team: clean(body.team),
        name,
        target,
        unit: clean(body.unit),
        notes: clean(body.notes),
        createdById: session.user.id,
      },
    });
    const created = await materialiseMetricTemplate(template.id);
    return NextResponse.json({ ...template, instancesCreated: created }, { status: 201 });
  }

  const title = clean(body.title);
  if (!title) {
    return NextResponse.json({ error: "title is required" }, { status: 400 });
  }
  const dueOffsetDays = Number.isInteger(body.dueOffsetDays) && body.dueOffsetDays > 0 ? body.dueOffsetDays : null;
  const template = await prisma.goalTemplate.create({
    data: {
      jobRoleId,
      team: clean(body.team),
      title,
      description: clean(body.description),
      dueOffsetDays,
      createdById: session.user.id,
    },
  });
  const created = await materialiseGoalTemplate(template.id);
  return NextResponse.json({ ...template, instancesCreated: created }, { status: 201 });
}

/**
 * Edits or (de)activates a template. Edits propagate to the instances;
 * deactivating cancels active goal instances / retires metric instances with
 * no results; reactivating re-materialises.
 */
export async function PATCH(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isAdmin(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const { kind, templateId } = body;
  if (!templateId || (kind !== "metric" && kind !== "goal")) {
    return NextResponse.json({ error: "templateId and kind are required" }, { status: 400 });
  }

  let instancesCreated = 0;
  let instancesRetired = 0;

  if (kind === "metric") {
    const data: Record<string, unknown> = {};
    if (body.name !== undefined) data.name = clean(body.name) ?? undefined;
    if (body.target !== undefined) data.target = clean(body.target) ?? undefined;
    if (body.unit !== undefined) data.unit = clean(body.unit);
    if (body.notes !== undefined) data.notes = clean(body.notes);
    if (body.team !== undefined) data.team = clean(body.team);
    if (typeof body.isActive === "boolean") data.isActive = body.isActive;
    const template = await prisma.metricTemplate.update({ where: { id: templateId }, data });
    if (typeof body.isActive === "boolean") {
      if (body.isActive) instancesCreated = await materialiseMetricTemplate(templateId);
      else instancesRetired = await retireMetricTemplateInstances(templateId);
    } else {
      await propagateMetricTemplate(templateId);
    }
    return NextResponse.json({ ...template, instancesCreated, instancesRetired });
  }

  const data: Record<string, unknown> = {};
  if (body.title !== undefined) data.title = clean(body.title) ?? undefined;
  if (body.description !== undefined) data.description = clean(body.description);
  if (body.team !== undefined) data.team = clean(body.team);
  if (body.dueOffsetDays !== undefined) {
    data.dueOffsetDays = Number.isInteger(body.dueOffsetDays) && body.dueOffsetDays > 0 ? body.dueOffsetDays : null;
  }
  if (typeof body.isActive === "boolean") data.isActive = body.isActive;

  const template = await prisma.goalTemplate.update({ where: { id: templateId }, data });
  if (typeof body.isActive === "boolean") {
    if (body.isActive) instancesCreated = await materialiseGoalTemplate(templateId);
    else instancesRetired = await cancelGoalTemplateInstances(templateId);
  } else {
    await propagateGoalTemplate(templateId);
  }

  return NextResponse.json({ ...template, instancesCreated, instancesRetired });
}
