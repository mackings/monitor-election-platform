"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { getLeaderProfile, upsertLeaderProfile } from "@/lib/api/rain";
import { useGeolocation } from "@/lib/hooks/useGeolocation";
import { toast } from "sonner";
import { LocateFixed, Loader2 } from "lucide-react";

export function ProfileTab() {
  const [loaded, setLoaded] = useState(false);
  const [displayTitle, setDisplayTitle] = useState("");
  const [bio, setBio] = useState("");
  const [address, setAddress] = useState("");
  const [whatsappLink, setWhatsappLink] = useState("");
  const [publicPhone, setPublicPhone] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const { locate, loading: locating } = useGeolocation();

  useEffect(() => {
    let ignore = false;
    getLeaderProfile()
      .then((profile) => {
        if (ignore || !profile) return;
        setDisplayTitle(profile.display_title ?? "");
        setBio(profile.bio ?? "");
        setAddress(profile.address ?? "");
        setWhatsappLink(profile.whatsapp_group_link ?? "");
        setPublicPhone(profile.public_phone ?? "");
        setIsPublic(profile.is_public);
        setLat(profile.lat ?? null);
        setLng(profile.lng ?? null);
      })
      .catch(() => {})
      .finally(() => {
        if (!ignore) setLoaded(true);
      });
    return () => {
      ignore = true;
    };
  }, []);

  async function handleUseLocation() {
    try {
      const { lat: la, lng: ln } = await locate({ enableHighAccuracy: false, timeoutMs: 15000 });
      setLat(la);
      setLng(ln);
      toast.success("Location captured");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't get your location.");
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (lat == null || lng == null) {
      toast.error("Set your location so you appear in the finder.");
      return;
    }
    setSaving(true);
    try {
      await upsertLeaderProfile({
        display_title: displayTitle || undefined,
        bio: bio || undefined,
        address: address || undefined,
        whatsapp_group_link: whatsappLink || undefined,
        public_phone: publicPhone || undefined,
        lat,
        lng,
        is_public: isPublic,
      });
      toast.success("Profile saved");
    } catch {
      toast.error("Couldn't save your profile. Try again.");
    } finally {
      setSaving(false);
    }
  }

  if (!loaded) {
    return (
      <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading…
      </div>
    );
  }

  return (
    <form onSubmit={handleSave} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="display-title">Display title</Label>
        <Input
          id="display-title"
          value={displayTitle}
          onChange={(e) => setDisplayTitle(e.target.value)}
          placeholder="e.g. Ward Coordinator, Bodija"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="bio">Bio</Label>
        <Textarea id="bio" value={bio} onChange={(e) => setBio(e.target.value)} rows={3} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="address">Address</Label>
        <Input id="address" value={address} onChange={(e) => setAddress(e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="whatsapp-link">WhatsApp group link</Label>
        <Input
          id="whatsapp-link"
          value={whatsappLink}
          onChange={(e) => setWhatsappLink(e.target.value)}
          placeholder="https://chat.whatsapp.com/..."
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="public-phone">Public phone</Label>
        <Input id="public-phone" type="tel" value={publicPhone} onChange={(e) => setPublicPhone(e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label>Location</Label>
        <Button
          type="button"
          variant="outline"
          onClick={handleUseLocation}
          disabled={locating}
          className="w-full gap-1.5"
        >
          {locating ? <Loader2 className="h-4 w-4 animate-spin" /> : <LocateFixed className="h-4 w-4" />}
          {lat != null ? "Update to my current location" : "Use my current location"}
        </Button>
        {lat != null && lng != null && (
          <p className="text-xs text-muted-foreground">
            {lat.toFixed(5)}, {lng.toFixed(5)}
          </p>
        )}
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={isPublic}
          onChange={(e) => setIsPublic(e.target.checked)}
          className="h-4 w-4 rounded border-slate-300"
        />
        Visible in the public finder
      </label>
      <Button type="submit" disabled={saving} className="h-11 w-full rounded-xl bg-indigo-600 text-white hover:bg-indigo-500">
        {saving ? "Saving…" : "Save profile"}
      </Button>
    </form>
  );
}
