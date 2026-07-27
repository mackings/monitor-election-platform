"use client";

import { useEffect, useState } from "react";
import { listAdmins } from "@/lib/api/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CreateOfficerDialog } from "@/components/dashboard/CreateOfficerDialog";
import type { User } from "@/types";

function initials(name: string) {
  return name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
}

export default function AdminsPage() {
  const [admins, setAdmins] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  function refresh() {
    return listAdmins().then((data) => {
      setAdmins(data);
      setLoading(false);
    });
  }

  useEffect(() => {
    refresh();
  }, []);

  return (
    <div className="space-y-4 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold tracking-tight">Admins</h1>
          <p className="text-sm text-muted-foreground">{admins.length} admin accounts</p>
        </div>
        <CreateOfficerDialog role="admin" onCreated={refresh} />
      </div>

      <Card className="rounded-2xl border-slate-200/70 dark:border-slate-800">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Admin</TableHead>
                <TableHead>Username</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Phone</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {admins.map((admin) => (
                <TableRow key={admin.id}>
                  <TableCell className="flex items-center gap-2">
                    <Avatar className="h-7 w-7">
                      <AvatarFallback className="bg-slate-100 text-xs font-semibold dark:bg-slate-800">
                        {initials(admin.name)}
                      </AvatarFallback>
                    </Avatar>
                    <p className="font-medium">{admin.name}</p>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{admin.username}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{admin.email ?? "—"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{admin.phone}</TableCell>
                </TableRow>
              ))}
              {!loading && admins.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="py-10 text-center text-sm text-muted-foreground">
                    No admin accounts found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
