"use client";

import { useEffect, useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { LeaderLoginForm } from "@/components/field/community/leader/LeaderLoginForm";
import { ProfileTab } from "@/components/field/community/leader/ProfileTab";
import { EventsTab } from "@/components/field/community/leader/EventsTab";
import { WhatsappInterestsTab } from "@/components/field/community/leader/WhatsappInterestsTab";
import { BroadcastTab } from "@/components/field/community/leader/BroadcastTab";
import { useRainAuthStore } from "@/lib/store/useRainAuthStore";
import { getMe } from "@/lib/api/rain";
import { LogOut } from "lucide-react";

export default function CommunityLeaderPage() {
  const { token, user, me, hydrated, hydrate, setMe, logout } = useRainAuthStore();
  const [tab, setTab] = useState("profile");

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (token && !me) {
      getMe()
        .then(setMe)
        .catch(() => {});
    }
  }, [token, me, setMe]);

  if (!hydrated) return null;

  if (!token || !user) {
    return <LeaderLoginForm />;
  }

  const canBroadcast = me?.permissions.includes("broadcast.send") ?? false;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-lg font-bold tracking-tight">
            {user.first_name} {user.last_name}
          </h1>
          <p className="text-xs text-muted-foreground">Community leader</p>
        </div>
        <Button variant="ghost" size="sm" onClick={logout} className="gap-1.5 text-muted-foreground">
          <LogOut className="h-4 w-4" />
          Log out
        </Button>
      </div>

      <Tabs value={tab} onValueChange={(v) => v && setTab(v as string)}>
        <TabsList className="w-full">
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="events">Events</TabsTrigger>
          <TabsTrigger value="whatsapp">WhatsApp</TabsTrigger>
          {canBroadcast && <TabsTrigger value="broadcast">Broadcast</TabsTrigger>}
        </TabsList>
        <TabsContent value="profile">
          <ProfileTab />
        </TabsContent>
        <TabsContent value="events">
          <EventsTab />
        </TabsContent>
        <TabsContent value="whatsapp">
          <WhatsappInterestsTab />
        </TabsContent>
        {canBroadcast && (
          <TabsContent value="broadcast">
            <BroadcastTab />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
