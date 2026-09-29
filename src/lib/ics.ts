// Calendar helpers for the 1:1: a Google Calendar template link and an
// .ics file, both pre-filled with the review's title and agenda.

export interface CalendarEvent {
  title: string;
  description: string;
  start: Date;
  end: Date;
  attendees?: string[];
  uid?: string;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** UTC timestamp in the compact form calendars expect: 20260915T080000Z */
export function toCalendarUtc(date: Date): string {
  return `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}00Z`;
}

/** The next weekday at 10:00 local server time, 30 minutes long. A default the manager adjusts. */
export function defaultMeetingSlot(from: Date = new Date()): { start: Date; end: Date } {
  const start = new Date(from);
  start.setDate(start.getDate() + 1);
  while (start.getDay() === 0 || start.getDay() === 6) start.setDate(start.getDate() + 1);
  start.setHours(10, 0, 0, 0);
  const end = new Date(start.getTime() + 30 * 60000);
  return { start, end };
}

export function googleCalendarUrl(event: CalendarEvent): string {
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: event.title,
    details: event.description,
    dates: `${toCalendarUtc(event.start)}/${toCalendarUtc(event.end)}`,
  });
  if (event.attendees && event.attendees.length > 0) params.set("add", event.attendees.join(","));
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

function escapeIcs(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

export function buildIcs(event: CalendarEvent): string {
  const uid = event.uid ?? `${Date.now()}@visory-performance`;
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Visory//Performance & Growth OS//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${toCalendarUtc(new Date())}`,
    `DTSTART:${toCalendarUtc(event.start)}`,
    `DTEND:${toCalendarUtc(event.end)}`,
    `SUMMARY:${escapeIcs(event.title)}`,
    `DESCRIPTION:${escapeIcs(event.description)}`,
    ...(event.attendees ?? []).map((email) => `ATTENDEE;RSVP=TRUE:mailto:${email}`),
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lines.join("\r\n") + "\r\n";
}
