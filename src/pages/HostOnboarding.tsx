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

const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
const slugifyInput = (s: string) => s.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/-{2,}/g, "-").replace(/^-+/, "").slice(0, 40);

export default function HostOnboarding() {
  const { user, loading } = useAuth();
  const { primaryHost, refresh } = useMyHost();
  const nav = useNavigate();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [bio, setBio] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [website, setWebsite] = useState("");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && !user) nav("/auth?next=/host/onboarding");
  }, [user, loading, nav]);

  useEffect(() => { if (primaryHost) nav("/host/dashboard"); }, [primaryHost, nav]);

  useEffect(() => { if (user && !contactEmail) setContactEmail(user.email || ""); }, [user]); // eslint-disable-line

  const uploadLogo = async (file: File) => {
    if (!user) return;
    setUploading(true);
    const path = `${user.id}/${crypto.randomUUID()}-${file.name}`;
    const { error } = await supabase.storage.from("host-logos").upload(path, file);
    if (error) { setUploading(false); return toast.error(error.message); }
    const { data } = supabase.storage.from("host-logos").getPublicUrl(path);
    setLogoUrl(data.publicUrl);
    setUploading(false);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setBusy(true);
    const finalSlug = slugify(slug || name) || `host-${Math.random().toString(36).slice(2, 6)}`;
    const { error } = await supabase.from("hosts").insert({
      owner_id: user.id, name, slug: finalSlug, bio: bio || null,
      contact_email: contactEmail || null, website: website || null, logo_url: logoUrl,
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
          <div><Label>Host name</Label><Input value={name} onChange={(e) => { setName(e.target.value); if (!slugEdited) setSlug(slugify(e.target.value)); }} required /></div>
          <div><Label>URL slug</Label><Input value={slug} onChange={(e) => { setSlugEdited(true); setSlug(slugifyInput(e.target.value)); }} placeholder="my-community" /></div>
          <div><Label>Contact email *</Label><Input type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} required /></div>
          <div><Label>Website</Label><Input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://…" /></div>
          <div><Label>Bio</Label><Textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={3} /></div>
          <div>
            <Label>Logo</Label>
            {logoUrl && <img src={logoUrl} alt="logo" className="mt-2 h-20 w-20 object-cover rounded-full" />}
            <Input type="file" accept="image/*" className="mt-2" onChange={(e) => e.target.files?.[0] && uploadLogo(e.target.files[0])} />
            {uploading && <p className="text-xs text-muted-foreground mt-1">Uploading…</p>}
          </div>
          <Button type="submit" className="w-full" disabled={busy || !name || !contactEmail}>Create host</Button>
        </form>
      </Card>
    </div>
  );
}