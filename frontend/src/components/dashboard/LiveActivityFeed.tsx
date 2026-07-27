"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { useIncidentStore } from "@/lib/store/useIncidentStore";
import { KIND_ICON, KIND_CHIP } from "@/lib/activity/activityIcons";
import { formatDistanceToNow } from "date-fns";

export function LiveActivityFeed() {
  const feed = useIncidentStore((s) => s.feed);

  return (
    <Card className="flex h-full flex-col rounded-2xl border-slate-200/70 dark:border-slate-800">
      <CardHeader className="flex-row items-center justify-between pb-2">
        <CardTitle className="font-heading text-base">Live activity</CardTitle>
        <Badge variant="outline" className="gap-1 text-xs font-normal">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
          Live
        </Badge>
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden">
        <ScrollArea className="h-full pr-2">
          {feed.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No activity yet — updates will appear here in real time.
            </p>
          )}
          <div className="space-y-3">
            {feed.map((item) => {
              const Icon = KIND_ICON[item.kind];
              return (
                <div key={item.id} className="flex gap-3 text-sm">
                  <span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg ${KIND_CHIP[item.kind]}`}>
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-medium">{item.label}</p>
                    {item.detail && (
                      <p className="truncate text-xs text-muted-foreground">{item.detail}</p>
                    )}
                    <p className="text-[11px] text-muted-foreground">
                      {formatDistanceToNow(new Date(item.at), { addSuffix: true })}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
