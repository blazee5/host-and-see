import { useState, useEffect } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

export default function Auth() {
  const [params] = useSearchParams();
  const next = params.get("next") || "/";
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const nav = useNavigate();
  const { user } = useAuth();

  useEffect(() => { if (user) nav(next, { replace: true }); }, [user, next, nav]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email, password,
          options: { emailRedirectTo: window.location.origin + next, data: { full_name: name } },
        });
        if (error) throw error;
        toast.success("Account created");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err: any) {
      toast.error(err.message || "Auth failed");
    } finally { setBusy(false); }
  };

  return (
    <div className="container max-w-md py-16">
      <Card className="p-6">
        <h1 className="text-2xl font-bold mb-1">{mode === "signin" ? "Sign in" : "Create account"}</h1>
        <p className="text-sm text-muted-foreground mb-6">to continue to Gather</p>
        <form onSubmit={submit} className="space-y-4">
          {mode === "signup" && (
            <div><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} required /></div>
          )}
          <div><Label>Email</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
          <div><Label>Password</Label><Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={6} required /></div>
          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? "Working…" : mode === "signin" ? "Sign in" : "Create account"}
          </Button>
        </form>
        <div className="text-sm text-center mt-4 text-muted-foreground">
          {mode === "signin" ? (
            <>No account? <button className="text-primary underline" onClick={() => setMode("signup")}>Sign up</button></>
          ) : (
            <>Have an account? <button className="text-primary underline" onClick={() => setMode("signin")}>Sign in</button></>
          )}
        </div>
        <div className="text-xs text-center mt-4"><Link to="/" className="text-muted-foreground">← back</Link></div>
      </Card>
    </div>
  );
}