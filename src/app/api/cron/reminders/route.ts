import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/permissions";
import { notify, dueText } from "@/lib/notifications";
import { getAppUrl } from "@/lib/email";
import { formatCyclePeriod, cycleDueDates } from "@/lib/utils";

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

function overdueBy(date: Date, now: Date): number {
  return Math.floor((now.getTime() - date.getTime()) / 86400000);
}

export interface RunSummary {
  ranAt: string;
  localDay: string;
  skipped?: string;
  cycles: {
    period: string;
    selfReminders: number;
    managerReminders: number;
    shareReminders: number;
    meetingReminders: number;
    resultsReminders: number;
    escalations: number;
  }[];
}

/**
 * One pass over every open cycle. Each person gets at most one reminder per
 * kind per day (NotificationLog refId carries the local date). After a
 * milestone plus a grace period the manager's manager is copied in.
 * Milestones come from the cycle's stored dates (admin-chosen) or the
 * computed defaults.
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
    const period = formatCyclePeriod(cycle);
    const due = cycleDueDates(cycle);
    const counts = {
      period,
      selfReminders: 0,
      managerReminders: 0,
      shareReminders: 0,
      meetingReminders: 0,
      resultsReminders: 0,
      escalations: 0,
    };

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
          select: { managerId: true, submittedAt: true, sharedAt: true, resultsSentAt: true, meeting: { select: { completedAt: true } } },
        },
      },
    });

    // 1. Employees who have not submitted a self-assessment (chased against Ready to Meet)
    const selfOverdue = overdueBy(due.readyToMeet, now);
    for (const u of users) {
      if (u.selfAssessments[0]?.submittedAt) continue;
      const escalate = selfOverdue > ESCALATION_GRACE_DAYS && !!u.manager?.email;
      const sent = await notify({
        userId: u.id,
        type: "reminder",
        refId: `${cycle.id}:self:${ymd}`,
        subject: `Reminder: your ${period} self-assessment`,
        heading: `Your ${period} self-assessment is waiting`,
        body: `It only takes a few minutes and your manager needs it to complete their review.${dueText(due.readyToMeet, "Due by")}${escalate ? " Your manager has been copied because it is overdue." : ""}`,
        ctaLabel: "Complete my self-assessment",
        ctaUrl: `${appUrl}/self-assessment?cycleId=${cycle.id}`,
        cc: escalate ? [u.manager!.email] : undefined,
      });
      if (sent) {
        counts.selfReminders += 1;
        if (escalate) counts.escalations += 1;
      }
    }

    // 2. Managers: reviews not submitted, not shared, meetings not held, results not sent
    const byManager = new Map<string, { pending: string[]; toShare: string[]; toMeet: string[]; toSend: string[]; escalateTo: string | null }>();
    for (const u of users) {
      if (!u.managerId) continue;
      const entry = byManager.get(u.managerId) ?? { pending: [], toShare: [], toMeet: [], toSend: [], escalateTo: u.manager?.manager?.email ?? null };
      const ma = u.managerAssessmentsReceived.find((m) => m.managerId === u.managerId);
      if (ma?.resultsSentAt) {
        // closed out
      } else if (!ma?.submittedAt) entry.pending.push(u.name);
      else if (!ma.sharedAt) entry.toShare.push(u.name);
      else if (!ma.meeting?.completedAt) entry.toMeet.push(u.name);
      else entry.toSend.push(u.name);
      byManager.set(u.managerId, entry);
    }

    const managerOverdue = overdueBy(due.readyToMeet, now);
    const meetingOverdue = overdueBy(due.meetingComplete, now);
    const resultsOverdue = overdueBy(due.resultsSent, now);

    for (const [managerId, entry] of byManager) {
      if (entry.pending.length > 0) {
        const escalate = managerOverdue > ESCALATION_GRACE_DAYS && !!entry.escalateTo;
        const sent = await notify({
          userId: managerId,
          type: "reminder",
          refId: `${cycle.id}:manager:${ymd}`,
          subject: `Reminder: ${entry.pending.length} ${period} review${entry.pending.length === 1 ? "" : "s"} to complete`,
          heading: `${period} reviews still to submit`,
          body: `Waiting on your review for: ${entry.pending.join(", ")}.${dueText(due.readyToMeet, "Due by")}${escalate ? " Your manager has been copied because these are overdue." : ""}`,
          ctaLabel: "Open my dashboard",
          ctaUrl: `${appUrl}/dashboard`,
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
          heading: "Reviews submitted but not yet shared",
          body: `Share your review so they can prepare for the 1:1: ${entry.toShare.join(", ")}.${dueText(due.meetingComplete, "1:1s are due by")}`,
          ctaLabel: "Open my dashboard",
          ctaUrl: `${appUrl}/dashboard`,
        });
        if (sent) counts.shareReminders += 1;
      }
      if (entry.toMeet.length > 0) {
        const escalate = meetingOverdue > ESCALATION_GRACE_DAYS && !!entry.escalateTo;
        const sent = await notify({
          userId: managerId,
          type: "reminder",
          refId: `${cycle.id}:meeting:${ymd}`,
          subject: `Reminder: ${period} 1:1s to hold`,
          heading: "1:1s still to hold this cycle",
          body: `Reviews are shared but the 1:1 hasn't been marked complete for: ${entry.toMeet.join(", ")}.${dueText(due.meetingComplete, "Due by")}${escalate ? " Your manager has been copied because these are overdue." : ""}`,
          ctaLabel: "Open my dashboard",
          ctaUrl: `${appUrl}/dashboard`,
          cc: escalate ? [entry.escalateTo!] : undefined,
        });
        if (sent) {
          counts.meetingReminders += 1;
          if (escalate) counts.escalations += 1;
        }
      }
      if (entry.toSend.length > 0) {
        const escalate = resultsOverdue > ESCALATION_GRACE_DAYS && !!entry.escalateTo;
        const sent = await notify({
          userId: managerId,
          type: "reminder",
          refId: `${cycle.id}:results:${ymd}`,
          subject: `Reminder: send ${period} results`,
          heading: "Meetings held, results not yet sent",
          body: `Close the cycle out by sending results for: ${entry.toSend.join(", ")}.${dueText(due.resultsSent, "Due by")}${escalate ? " Your manager has been copied because these are overdue." : ""}`,
          ctaLabel: "Open my dashboard",
          ctaUrl: `${appUrl}/dashboard`,
          cc: escalate ? [entry.escalateTo!] : undefined,
        });
        if (sent) {
          counts.resultsReminders += 1;
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
