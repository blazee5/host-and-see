import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useMyHost } from "@/hooks/useMyHost";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";

const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);

export default function HostOnboarding() {
  const { user, loading } = useAuth();
  const { primaryHost, refresh } = useMyHost();
  const nav = useNavigate();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [bio, setBio] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && !user) nav("/auth?next=/host/onboarding");
  }, [user, loading, nav]);

  useEffect(() => { if (primaryHost) nav("/host/dashboard"); }, [primaryHost, nav]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setBusy(true);
    const finalSlug = slug || slugify(name) + "-" + Math.random().toString(36).slice(2, 6);
    const { error } = await supabase.from("hosts").insert({
      owner_id: user.id, name, slug: finalSlug, bio: bio || null,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Host created!");
    await refresh();
    nav("/host/dashboard");
  };

  return (
    <div className="container max-w-md py-12">
      <Card className="p-6">
        <h1 className="text-2xl font-bold mb-1">Become a Host</h1>
        <p className="text-sm text-muted-foreground mb-6">Set up your host profile to start publishing events.</p>
        <form onSubmit={submit} className="space-y-4">
          <div><Label>Host name</Label><Input value={name} onChange={(e) => { setName(e.target.value); if (!slug) setSlug(slugify(e.target.value)); }} required /></div>
          <div><Label>URL slug</Label><Input value={slug} onChange={(e) => setSlug(slugify(e.target.value))} placeholder="my-community" /></div>
          <div><Label>Bio</Label><Textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={3} /></div>
          <Button type="submit" className="w-full" disabled={busy || !name}>Create host</Button>
        </form>
      </Card>
    </div>
  );
}