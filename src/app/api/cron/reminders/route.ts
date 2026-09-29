import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/permissions";
import { notify } from "@/lib/notifications";
import { getAppUrl } from "@/lib/email";
import { formatCyclePeriod } from "@/lib/utils";

const REMINDER_DAYS = new Set(["Sun", "Mon"]);
const ESCALATION_GRACE_DAYS = 3;

function localParts(date: Date, timeZone: string): { weekday: string; ymd: string } {
  const parts = new Intl.DateTimeFormat("en-AU", {
    timeZone,
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return { weekday: get("weekday"), ymd: `${get("year")}-${get("month")}-${get("day")}` };
}

function due(date: Date | null): string {
  return date ? ` It was due ${date.toLocaleDateString("en-AU", { weekday: "long", day: "numeric", month: "long" })}.` : "";
}

function overdueBy(date: Date | null, now: Date): number {
  if (!date) return 0;
  return Math.floor((now.getTime() - date.getTime()) / 86400000);
}

interface RunSummary {
  ranAt: string;
  localDay: string;
  skipped?: string;
  cycles: { period: string; selfReminders: number; managerReminders: number; shareReminders: number; meetingReminders: number; escalations: number }[];
}

/**
 * One pass over every open cycle. Each person gets at most one reminder per
 * kind per day (NotificationLog refId is the local date). After a due date
 * plus a grace period the manager's manager is copied in.
 */
export async function runReminders(now: Date, force: boolean): Promise<RunSummary> {
  const timeZone = process.env.REMINDER_TIMEZONE || "Australia/Melbourne";
  const { weekday, ymd } = localParts(now, timeZone);
  const summary: RunSummary = { ranAt: now.toISOString(), localDay: `${weekday} ${ymd}`, cycles: [] };

  if (!force && !REMINDER_DAYS.has(weekday)) {
    summary.skipped = `Reminders go out on Sunday and Monday mornings (${timeZone}); today is ${weekday}.`;
    return summary;
  }

  const cycles = await prisma.assessmentCycle.findMany({ where: { status: "OPEN" } });
  const appUrl = getAppUrl();

  for (const cycle of cycles) {
    const period = formatCyclePeriod(cycle.month, cycle.year);
    const counts = { period, selfReminders: 0, managerReminders: 0, shareReminders: 0, meetingReminders: 0, escalations: 0 };

    const users = await prisma.user.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        managerId: true,
        manager: { select: { id: true, email: true, managerId: true, manager: { select: { email: true } } } },
        selfAssessments: { where: { cycleId: cycle.id }, select: { submittedAt: true } },
        managerAssessmentsReceived: {
          where: { cycleId: cycle.id },
          select: { managerId: true, submittedAt: true, sharedAt: true, oneOnOneCompletedAt: true },
        },
      },
    });

    // 1. Employees who have not submitted a self-assessment
    const selfOverdue = overdueBy(cycle.selfDueAt, now);
    for (const u of users) {
      if (u.selfAssessments[0]?.submittedAt) continue;
      const escalate = selfOverdue > ESCALATION_GRACE_DAYS && u.manager?.email;
      const sent = await notify({
        userId: u.id,
        type: "reminder",
        refId: `${cycle.id}:self:${ymd}`,
        subject: `Reminder: your ${period} self-assessment`,
        heading: `Your ${period} self-assessment is waiting`,
        body: `It only takes a few minutes and your manager needs it to complete their review.${due(cycle.selfDueAt)}${escalate ? " Your manager has been copied because it is overdue." : ""}`,
        ctaLabel: "Complete my self-assessment",
        ctaUrl: `${appUrl}/dashboard`,
        cc: escalate ? [u.manager!.email] : undefined,
      });
      if (sent) {
        counts.selfReminders += 1;
        if (escalate) counts.escalations += 1;
      }
    }

    // 2. Managers with reviews not submitted, not shared, or meetings not held
    const byManager = new Map<string, { pending: string[]; toShare: string[]; toMeet: string[]; escalateTo: string | null }>();
    for (const u of users) {
      if (!u.managerId) continue;
      const entry = byManager.get(u.managerId) ?? { pending: [], toShare: [], toMeet: [], escalateTo: u.manager?.manager?.email ?? null };
      const ma = u.managerAssessmentsReceived.find((m) => m.managerId === u.managerId);
      if (!ma?.submittedAt) entry.pending.push(u.name);
      else if (!ma.sharedAt) entry.toShare.push(u.name);
      else if (!ma.oneOnOneCompletedAt) entry.toMeet.push(u.name);
      byManager.set(u.managerId, entry);
    }

    const managerOverdue = overdueBy(cycle.managerDueAt, now);
    const meetingOverdue = overdueBy(cycle.meetingDueAt, now);

    for (const [managerId, entry] of byManager) {
      if (entry.pending.length > 0) {
        const escalate = managerOverdue > ESCALATION_GRACE_DAYS && entry.escalateTo;
        const sent = await notify({
          userId: managerId,
          type: "reminder",
          refId: `${cycle.id}:manager:${ymd}`,
          subject: `Reminder: ${entry.pending.length} ${period} review${entry.pending.length === 1 ? "" : "s"} to complete`,
          heading: `${period} reviews still to submit`,
          body: `Waiting on your review for: ${entry.pending.join(", ")}.${due(cycle.managerDueAt)}${escalate ? " Your manager has been copied because these are overdue." : ""}`,
          ctaLabel: "Assess my team",
          ctaUrl: `${appUrl}/assess`,
          cc: escalate ? [entry.escalateTo!] : undefined,
        });
        if (sent) {
          counts.managerReminders += 1;
          if (escalate) counts.escalations += 1;
        }
      }
      if (entry.toShare.length > 0) {
        const sent = await notify({
          userId: managerId,
          type: "reminder",
          refId: `${cycle.id}:share:${ymd}`,
          subject: `Reminder: share your ${period} reviews`,
          heading: `Reviews submitted but not yet shared`,
          body: `Share your review so they can prepare for the 1:1: ${entry.toShare.join(", ")}.`,
          ctaLabel: "Open my team",
          ctaUrl: `${appUrl}/team`,
        });
        if (sent) counts.shareReminders += 1;
      }
      if (entry.toMeet.length > 0) {
        const escalate = meetingOverdue > ESCALATION_GRACE_DAYS && entry.escalateTo;
        const sent = await notify({
          userId: managerId,
          type: "reminder",
          refId: `${cycle.id}:meeting:${ymd}`,
          subject: `Reminder: ${period} 1:1s to hold`,
          heading: `1:1s still to hold this cycle`,
          body: `Reviews are shared but the 1:1 hasn't been marked complete for: ${entry.toMeet.join(", ")}.${due(cycle.meetingDueAt)}${escalate ? " Your manager has been copied because these are overdue." : ""}`,
          ctaLabel: "Open my team",
          ctaUrl: `${appUrl}/team`,
          cc: escalate ? [entry.escalateTo!] : undefined,
        });
        if (sent) {
          counts.meetingReminders += 1;
          if (escalate) counts.escalations += 1;
        }
      }
    }

    summary.cycles.push(counts);
  }

  return summary;
}

/** Vercel Cron entry point. Protected by CRON_SECRET. */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const header = request.headers.get("authorization");
  if (!secret || header !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const summary = await runReminders(new Date(), false);
  return NextResponse.json(summary);
}

/** Admin "send reminders now", ignoring the weekday rule but not the once-per-day log. */
export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isAdmin(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json({ error: "Email is not configured (RESEND_API_KEY missing)" }, { status: 400 });
  }
  const summary = await runReminders(new Date(), true);
  return NextResponse.json(summary);
}
