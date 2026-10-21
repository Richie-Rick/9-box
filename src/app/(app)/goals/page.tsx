"use client";

import { useSession } from "next-auth/react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { SelfGoalsEditor } from "@/components/assessments/self-goals-editor";
import { KeyMetricsSelfEditor } from "@/components/assessments/key-metrics-self-editor";

export default function GoalsPage() {
  const { data: session } = useSession();
  const employeeId = session?.user?.id;

  if (!employeeId) return <div className="text-center py-12 muted">Loading…</div>;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="You"
        title={<>Goals &amp; <em>key metrics.</em></>}
        sub="View the goals and key metrics set for you — and set your own. Each is labelled with who set it."
      />

      <Card>
        <CardHeader>
          <CardTitle>Goals</CardTitle>
        </CardHeader>
        <CardContent>
          <SelfGoalsEditor employeeId={employeeId} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Key Metrics</CardTitle>
        </CardHeader>
        <CardContent>
          <KeyMetricsSelfEditor employeeId={employeeId} />
        </CardContent>
      </Card>
    </div>
  );
}
