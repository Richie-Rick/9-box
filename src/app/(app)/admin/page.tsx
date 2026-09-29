"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";

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
      <div>
        <h1 className="text-2xl font-bold text-visory-navy">Admin</h1>
        <p className="text-sm text-gray-600 mt-1">System administration</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => router.push("/admin/cycles")}>
          <CardContent className="py-6">
            <h3 className="text-lg font-semibold text-visory-navy">Assessment Cycles</h3>
            <p className="text-sm text-gray-600 mt-1">Open, close, and manage monthly cycles</p>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => router.push("/admin/users")}>
          <CardContent className="py-6">
            <h3 className="text-lg font-semibold text-visory-navy">User Management</h3>
            <p className="text-sm text-gray-600 mt-1">Add users, assign roles and managers</p>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => router.push("/admin/roles")}>
          <CardContent className="py-6">
            <h3 className="text-lg font-semibold text-visory-navy">Roles &amp; Templates</h3>
            <p className="text-sm text-gray-600 mt-1">Job roles with role-set metrics and goals</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
