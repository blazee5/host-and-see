import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { useMyHost } from "@/hooks/useMyHost";
import { ThemeProvider, useTheme } from "@/hooks/useTheme";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Calendar, LogOut, Ticket, LayoutDashboard, Compass, Moon, Sun, CalendarCheck, Menu } from "lucide-react";
import { useState } from "react";

function Nav() {
  const { user, signOut } = useAuth();
  const { primaryHost } = useMyHost();
  const { theme, toggle } = useTheme();
  const nav = useNavigate();
  const [open, setOpen] = useState(false);

  const linkCls = ({ isActive }: { isActive: boolean }) =>
    `text-sm font-medium px-3 py-2 rounded-md transition-colors ${
      isActive ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:text-foreground"
    }`;

  const navLinks = (
    <>
      <NavLink to="/explore" className={linkCls} onClick={() => setOpen(false)}><Compass className="inline h-4 w-4 mr-1" />Explore</NavLink>
      {user && <NavLink to="/me/events" className={linkCls} onClick={() => setOpen(false)}><CalendarCheck className="inline h-4 w-4 mr-1" />My Events</NavLink>}
      {user && <NavLink to="/me/tickets" className={linkCls} onClick={() => setOpen(false)}><Ticket className="inline h-4 w-4 mr-1" />My Tickets</NavLink>}
      {user && primaryHost && (
        <NavLink to="/host/dashboard" className={linkCls} onClick={() => setOpen(false)}><LayoutDashboard className="inline h-4 w-4 mr-1" />Host</NavLink>
      )}
    </>
  );

  return (
    <header className="border-b bg-background sticky top-0 z-40">
      <div className="container flex h-14 items-center justify-between gap-2">
        <Link to="/" className="flex items-center gap-2 font-bold text-lg shrink-0">
          <Calendar className="h-5 w-5 text-primary" />
          <span>Gather</span>
        </Link>
        <nav className="hidden md:flex items-center gap-1">
          {navLinks}
        </nav>
        <div className="flex items-center gap-1">
          <Button size="icon" variant="ghost" onClick={toggle} aria-label="Toggle theme">
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
          {user ? (
            <>
              {!primaryHost && (
                <Button size="sm" variant="outline" className="hidden sm:inline-flex" onClick={() => nav("/host/onboarding")}>Become a host</Button>
              )}
              <Button size="icon" variant="ghost" className="hidden md:inline-flex" onClick={async () => { await signOut(); nav("/"); }} aria-label="Sign out">
                <LogOut className="h-4 w-4" />
              </Button>
            </>
          ) : (
            <Button size="sm" onClick={() => nav("/auth")}>Sign in</Button>
          )}
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button size="icon" variant="ghost" className="md:hidden" aria-label="Menu">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-64">
              <div className="flex flex-col gap-2 mt-8">
                {navLinks}
                {user && !primaryHost && (
                  <Button variant="outline" onClick={() => { setOpen(false); nav("/host/onboarding"); }}>Become a host</Button>
                )}
                {user && (
                  <Button variant="ghost" onClick={async () => { setOpen(false); await signOut(); nav("/"); }}>
                    <LogOut className="h-4 w-4 mr-2" />Sign out
                  </Button>
                )}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}

export default function Layout() {
  return (
    <ThemeProvider>
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
    </ThemeProvider>
  );
}