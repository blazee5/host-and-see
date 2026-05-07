import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export default function HostInvite() {
  const { token } = useParams();
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && !user) nav(`/auth?next=/host/invite/${token}`);
  }, [user, loading, token, nav]);

  const accept = async () => {
    if (!token) return;
    setBusy(true);
    const { error } = await supabase.rpc("accept_host_invite", { _token: token });
    setBusy(false);
    if (error) {
      const msg = /duplicate key|host_members_host_id_user_id_role_key/i.test(error.message)
        ? "You're already a member of this host team."
        : /invalid invite/i.test(error.message)
        ? "This invite link is invalid or has already been used."
        : /signed in/i.test(error.message)
        ? "Please sign in to accept this invite."
        : error.message;
      return toast.error(msg);
    }
    toast.success("You've joined the host team");
    nav("/host/dashboard");
  };

  if (!user) return null;
  return (
    <div className="container py-16 max-w-md">
      <Card className="p-6 space-y-4">
        <h1 className="text-2xl font-bold">Join host team</h1>
        <p className="text-sm text-muted-foreground">
          You've been invited to help check in attendees. Accept to gain access to the host dashboard.
        </p>
        <Button onClick={accept} disabled={busy} className="w-full">Accept invite</Button>
      </Card>
    </div>
  );
}
