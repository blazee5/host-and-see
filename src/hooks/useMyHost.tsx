import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export type HostMembership = {
  host_id: string;
  role: "host" | "checker";
  host: { id: string; name: string; slug: string; logo_url: string | null };
};

export function useMyHost() {
  const { user } = useAuth();
  const [memberships, setMemberships] = useState<HostMembership[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    if (!user) { setMemberships([]); setLoading(false); return; }
    setLoading(true);
    const { data } = await supabase
      .from("host_members")
      .select("host_id, role, hosts:host_id(id,name,slug,logo_url)")
      .eq("user_id", user.id)
      .not("accepted_at", "is", null);
    setMemberships(((data || []) as any).map((r: any) => ({ host_id: r.host_id, role: r.role, host: r.hosts })));
    setLoading(false);
  };

  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, [user?.id]);

  const primaryHost = memberships.find((m) => m.role === "host")?.host || memberships[0]?.host || null;
  return { memberships, primaryHost, loading, refresh };
}