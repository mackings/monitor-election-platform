"use client";

import { useAuthStore } from "@/lib/store/useAuthStore";
import { ChangePasswordForm } from "@/components/shared/ChangePasswordForm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function FieldAccountPage() {
  const user = useAuthStore((s) => s.user);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-heading text-xl font-bold tracking-tight">My account</h1>
        <p className="text-sm text-muted-foreground">{user?.name} · {user?.username}</p>
      </div>

      <Card className="rounded-2xl border-slate-200/70 dark:border-slate-800">
        <CardHeader>
          <CardTitle className="text-base">Change password</CardTitle>
        </CardHeader>
        <CardContent>
          <ChangePasswordForm />
        </CardContent>
      </Card>
    </div>
  );
}
