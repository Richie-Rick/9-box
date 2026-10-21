// Event emails for the review cycle. Every send is recorded in
// NotificationLog keyed by (user, type, refId), so a retried request or a
// re-run cron never sends the same message twice. Sends never block the
// caller: wrap them in `after(() => ...)` from next/server.

import { prisma } from "./prisma";
import { sendEmail, buildEmailHtml, getAppUrl } from "./email";
import { formatCyclePeriod, cycleDueDates } from "./utils";
import { googleCalendarUrl, defaultMeetingSlot } from "./ics";

export type NotificationType =
  | "cycle_opened"
  | "self_submitted"
  | "review_shared"
  | "review_updated"
  | "meeting_completed"
  | "reminder";

interface NotifyArgs {
  userId: string;
  type: NotificationType;
  /** What this notification is about (cycle id, assessment id, or a date for reminders). */
  refId: string;
  subject: string;
  heading: string;
  body: string;
  ctaLabel?: string;
  ctaUrl?: string;
  cc?: string[];
}

/** Sends once per (user, type, refId). Returns true when an email went out. */
export async function notify(args: NotifyArgs): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: args.userId },
    select: { id: true, email: true, name: true, isActive: true },
  });
  if (!user || !user.isActive) return false;

  try {
    await prisma.notificationLog.create({
      data: { userId: user.id, type: args.type, refId: args.refId },
    });
  } catch {
    // Unique violation: already sent
    return false;
  }

  const result = await sendEmail({
    to: user.email,
    cc: args.cc,
    subject: args.subject,
    html: buildEmailHtml({
      recipientName: user.name,
      heading: args.heading,
      body: args.body,
      ctaLabel: args.ctaLabel,
      ctaUrl: args.ctaUrl,
    }),
  });

  if (!result.success) {
    // Let a later attempt try again
    await prisma.notificationLog.deleteMany({ where: { userId: user.id, type: args.type, refId: args.refId } });
    return false;
  }
  return true;
}

export function dueText(date: Date | null | undefined, prefix = "Due"): string {
  if (!date) return "";
  return ` ${prefix} ${date.toLocaleDateString("en-AU", { weekday: "long", day: "numeric", month: "long" })}.`;
}

/** Everyone active: a new cycle is open. */
export async function notifyCycleOpened(cycleId: string): Promise<void> {
  const cycle = await prisma.assessmentCycle.findUnique({ where: { id: cycleId } });
  if (!cycle) return;
  const due = cycleDueDates(cycle);
  const users = await prisma.user.findMany({ where: { isActive: true }, select: { id: true } });
  const period = formatCyclePeriod(cycle);
  for (const u of users) {
    await notify({
      userId: u.id,
      type: "cycle_opened",
      refId: cycleId,
      subject: `${period} review cycle is open`,
      heading: `The ${period} cycle is open`,
      body: `Your self-assessment for ${period} is ready to complete. Managers can start their reviews at the same time.${dueText(due.readyToMeet, "Both are due by")} 1:1s follow${dueText(due.meetingComplete, "by")}`,
      ctaLabel: "Open my dashboard",
      ctaUrl: `${getAppUrl()}/dashboard`,
    });
  }
}

/** The manager: an employee submitted their self-assessment. */
export async function notifySelfSubmitted(selfAssessmentId: string): Promise<void> {
  const self = await prisma.selfAssessment.findUnique({
    where: { id: selfAssessmentId },
    include: { employee: { select: { id: true, name: true, managerId: true } }, cycle: true },
  });
  if (!self?.employee.managerId) return;
  const period = formatCyclePeriod(self.cycle);
  const due = cycleDueDates(self.cycle);
  await notify({
    userId: self.employee.managerId,
    type: "self_submitted",
    refId: selfAssessmentId,
    subject: `${self.employee.name} submitted their ${period} self-assessment`,
    heading: `${self.employee.name}'s self-assessment is in`,
    body: `Rate each section, then reveal what they said and write your response.${dueText(due.readyToMeet, "Your review is due by")}`,
    ctaLabel: `Review ${self.employee.name.split(" ")[0]}`,
    ctaUrl: `${getAppUrl()}/assess/${self.employee.id}?cycleId=${self.cycleId}`,
  });
}

/** The employee: the manager shared their review, with a calendar link for the 1:1. */
export async function notifyReviewShared(assessmentId: string): Promise<void> {
  const a = await prisma.managerAssessment.findUnique({
    where: { id: assessmentId },
    include: {
      employee: { select: { id: true, name: true, email: true } },
      manager: { select: { name: true, email: true } },
      cycle: true,
    },
  });
  if (!a) return;
  const period = formatCyclePeriod(a.cycle);
  const due = cycleDueDates(a.cycle);
  const slot = defaultMeetingSlot();
  const calendarUrl = googleCalendarUrl({
    title: `1:1 performance conversation: ${a.employee.name} and ${a.manager.name}`,
    description: `Review of ${period}. Open your review: ${getAppUrl()}/my-reviews`,
    start: slot.start,
    end: slot.end,
    attendees: [a.manager.email],
  });
  await notify({
    userId: a.employee.id,
    type: "review_shared",
    refId: assessmentId,
    subject: `${a.manager.name} shared your ${period} review`,
    heading: `Your ${period} review is ready`,
    body: `${a.manager.name} has shared their ratings and comments so you can prepare for your 1:1.${dueText(due.meetingComplete, "1:1s are due by")}\n\nIf nothing is in your calendar yet, add it here: ${calendarUrl}`,
    ctaLabel: "Read my review",
    ctaUrl: `${getAppUrl()}/my-reviews`,
  });
}

/** The employee: the manager changed the review after sharing it (at most once a day). */
export async function notifyReviewUpdated(assessmentId: string): Promise<void> {
  const a = await prisma.managerAssessment.findUnique({
    where: { id: assessmentId },
    include: { employee: { select: { id: true } }, manager: { select: { name: true } }, cycle: true },
  });
  if (!a) return;
  const period = formatCyclePeriod(a.cycle);
  await notify({
    userId: a.employee.id,
    type: "review_updated",
    refId: `${assessmentId}:${new Date().toISOString().slice(0, 10)}`,
    subject: `Your ${period} review was updated`,
    heading: `${a.manager.name} updated your review`,
    body: `A rating or comment on your ${period} review changed after it was shared. Take a look before your 1:1.`,
    ctaLabel: "See what changed",
    ctaUrl: `${getAppUrl()}/my-reviews`,
  });
}

/** Both sides: the 1:1 was marked complete; notes and actions are visible. */
export async function notifyMeetingCompleted(assessmentId: string): Promise<void> {
  const a = await prisma.managerAssessment.findUnique({
    where: { id: assessmentId },
    include: { employee: { select: { id: true, name: true } }, manager: { select: { id: true, name: true } }, cycle: true },
  });
  if (!a) return;
  const period = formatCyclePeriod(a.cycle);
  await notify({
    userId: a.employee.id,
    type: "meeting_completed",
    refId: assessmentId,
    subject: `Notes from your ${period} 1:1`,
    heading: `Your ${period} 1:1 is wrapped up`,
    body: `${a.manager.name} has recorded the meeting notes and the actions you agreed. They are now on your reviews page and your tasks.`,
    ctaLabel: "See notes and actions",
    ctaUrl: `${getAppUrl()}/my-reviews`,
  });
  await notify({
    userId: a.manager.id,
    type: "meeting_completed",
    refId: assessmentId,
    subject: `${a.employee.name}'s ${period} 1:1 is complete`,
    heading: `Done: ${a.employee.name}, ${period}`,
    body: `Notes and agreed actions are saved and visible to ${a.employee.name.split(" ")[0]}. Send results from the board to close the cycle out.`,
    ctaLabel: "Open summary",
    ctaUrl: `${getAppUrl()}/summary/${a.employee.id}?cycleId=${a.cycleId}`,
  });
}
