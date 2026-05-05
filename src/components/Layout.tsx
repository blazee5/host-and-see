import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { useMyHost } from "@/hooks/useMyHost";
import { Button } from "@/components/ui/button";
import { Calendar, LogOut, Ticket, LayoutDashboard, Compass } from "lucide-react";

function Nav() {
  const { user, signOut } = useAuth();
  const { primaryHost } = useMyHost();
  const nav = useNavigate();

  const linkCls = ({ isActive }: { isActive: boolean }) =>
    `text-sm font-medium px-3 py-2 rounded-md transition-colors ${
      isActive ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:text-foreground"
    }`;

  return (
    <header className="border-b bg-background sticky top-0 z-40">
      <div className="container flex h-14 items-center justify-between gap-4">
        <Link to="/" className="flex items-center gap-2 font-bold text-lg">
          <Calendar className="h-5 w-5 text-primary" />
          <span>Gather</span>
        </Link>
        <nav className="flex items-center gap-1">
          <NavLink to="/explore" className={linkCls}><Compass className="inline h-4 w-4 mr-1" />Explore</NavLink>
          {user && <NavLink to="/me/tickets" className={linkCls}><Ticket className="inline h-4 w-4 mr-1" />My Tickets</NavLink>}
          {user && primaryHost && (
            <NavLink to="/host/dashboard" className={linkCls}><LayoutDashboard className="inline h-4 w-4 mr-1" />Host</NavLink>
          )}
        </nav>
        <div className="flex items-center gap-2">
          {user ? (
            <>
              {!primaryHost && (
                <Button size="sm" variant="outline" onClick={() => nav("/host/onboarding")}>Become a host</Button>
              )}
              <Button size="sm" variant="ghost" onClick={async () => { await signOut(); nav("/"); }}>
                <LogOut className="h-4 w-4" />
              </Button>
            </>
          ) : (
            <Button size="sm" onClick={() => nav("/auth")}>Sign in</Button>
          )}
        </div>
      </div>
    </header>
  );
}

export default function Layout() {
  return (
    <AuthProvider>
      <div className="min-h-screen flex flex-col">
        <Nav />
        <main className="flex-1">
          <Outlet />
        </main>
        <footer className="border-t py-6 text-center text-xs text-muted-foreground">
          Gather · community events made easy
        </footer>
      </div>
    </AuthProvider>
  );
}