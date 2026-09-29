import type { Role } from "@prisma/client";
import { prisma } from "./prisma";

export function isManager(role: Role): boolean {
  return role === "MANAGER" || role === "AREA_LEAD" || role === "LEADERSHIP" || role === "ADMIN";
}

export function isAdmin(role: Role): boolean {
  return role === "ADMIN";
}

export function canViewAllAssessments(role: Role): boolean {
  return role === "LEADERSHIP" || role === "ADMIN";
}

/**
 * Returns the list of employee IDs visible to the current user for assessment viewing.
 * - EMPLOYEE: only sees own data (after 1:1 complete)
 * - MANAGER: sees own direct reports
 * - AREA_LEAD: sees all MANAGER-level reports (not LEADERSHIP)
 * - LEADERSHIP/ADMIN: sees everything
 */
export async function getVisibleEmployeeIds(
  userId: string,
  role: Role
): Promise<string[] | "all"> {
  switch (role) {
    case "LEADERSHIP":
    case "ADMIN":
      return "all";

    case "AREA_LEAD": {
      // Own direct reports + all MANAGER-role users' direct reports
      const managers = await prisma.user.findMany({
        where: { role: "MANAGER", isActive: true },
        select: { id: true },
      });
      const managerIds = [...managers.map((m) => m.id), userId];
      const employees = await prisma.user.findMany({
        where: { managerId: { in: managerIds }, isActive: true },
        select: { id: true },
      });
      return employees.map((e) => e.id);
    }

    case "MANAGER": {
      const reports = await prisma.user.findMany({
        where: { managerId: userId, isActive: true },
        select: { id: true },
      });
      return reports.map((r) => r.id);
    }

    case "EMPLOYEE":
    default:
      return [userId];
  }
}

/**
 * Whether the viewer may see an employee's goals, metrics and profile.
 * Own record, their direct manager, area leads over that manager, and leadership.
 */
export async function canAccessEmployee(
  viewerId: string,
  viewerRole: Role,
  employeeId: string
): Promise<boolean> {
  if (viewerId === employeeId) return true;
  if (canViewAllAssessments(viewerRole)) return true;
  const employee = await prisma.user.findUnique({
    where: { id: employeeId },
    select: { managerId: true },
  });
  if (!employee) return false;
  if (employee.managerId === viewerId) return true;
  if (viewerRole === "AREA_LEAD") {
    const visible = await getVisibleEmployeeIds(viewerId, viewerRole);
    return visible === "all" || visible.includes(employeeId);
  }
  return false;
}

/**
 * Whether the viewer may set goals and metrics for an employee:
 * their direct manager or leadership.
 */
export async function canManageEmployee(
  viewerId: string,
  viewerRole: Role,
  employeeId: string
): Promise<boolean> {
  if (canViewAllAssessments(viewerRole)) return true;
  if (!isManager(viewerRole)) return false;
  const employee = await prisma.user.findUnique({
    where: { id: employeeId },
    select: { managerId: true },
  });
  return employee?.managerId === viewerId;
}

/**
 * Returns Prisma where filter for manager assessments based on role.
 */
export async function getManagerAssessmentFilter(
  userId: string,
  role: Role
): Promise<Record<string, unknown>> {
  const visibleIds = await getVisibleEmployeeIds(userId, role);
  if (visibleIds === "all") return {};
  return { employeeId: { in: visibleIds } };
}
