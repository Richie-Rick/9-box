"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { ChevronRight, CalendarClock, Users, Briefcase } from "lucide-react";

export default function AdminPage() {
  const { data: session } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (session?.user?.role && session.user.role !== "ADMIN") {
      router.push("/dashboard");
    }
  }, [session, router]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Admin"
        title={<>System <em>administration.</em></>}
        sub="Manage assessment cycles and the people who use them."
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card hover className="cursor-pointer" onClick={() => router.push("/admin/cycles")}>
          <CardContent className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <CalendarClock size={20} strokeWidth={1.6} className="mt-0.5 text-ink-2" />
              <div>
                <h3 className="serif text-lg text-ink">Assessment Cycles</h3>
                <p className="text-sm text-ink-3 mt-1">Open, close, and manage quarterly cycles</p>
              </div>
            </div>
            <ChevronRight size={18} strokeWidth={1.6} className="text-ink-3 shrink-0" />
          </CardContent>
        </Card>
        <Card hover className="cursor-pointer" onClick={() => router.push("/admin/users")}>
          <CardContent className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <Users size={20} strokeWidth={1.6} className="mt-0.5 text-ink-2" />
              <div>
                <h3 className="serif text-lg text-ink">User Management</h3>
                <p className="text-sm text-ink-3 mt-1">Add users, assign roles and managers</p>
              </div>
            </div>
            <ChevronRight size={18} strokeWidth={1.6} className="text-ink-3 shrink-0" />
          </CardContent>
        </Card>
        <Card hover className="cursor-pointer" onClick={() => router.push("/admin/roles")}>
          <CardContent className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <Briefcase size={20} strokeWidth={1.6} className="mt-0.5 text-ink-2" />
              <div>
                <h3 className="serif text-lg text-ink">Roles &amp; Templates</h3>
                <p className="text-sm text-ink-3 mt-1">Role-set metrics and goals for everyone in a job role</p>
              </div>
            </div>
            <ChevronRight size={18} strokeWidth={1.6} className="text-ink-3 shrink-0" />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
