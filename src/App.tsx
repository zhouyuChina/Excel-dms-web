import { Link, Route, Routes, useLocation } from "react-router-dom";
import Login from "@/pages/Login";
import Records from "@/pages/Records";
import ImportPage from "@/pages/Import";
import { Button } from "@/components/ui/button";

export default function App() {
  const location = useLocation();
  const menu = [
    { to: "/records", label: "Records" },
    { to: "/import", label: "Import" },
  ];
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur">
        <div className="container flex h-14 items-center gap-4">
          <div className="font-semibold">DMS</div>
          <nav className="flex gap-2">
            {menu.map((m) => (
              <Button key={m.to} variant={location.pathname.startsWith(m.to) ? "default" : "ghost"} asChild>
                <Link to={m.to}>{m.label}</Link>
              </Button>
            ))}
          </nav>
          <div className="ml-auto">
            <Button variant="secondary" asChild><Link to="/login">Login</Link></Button>
          </div>
        </div>
      </header>
      <main className="container py-6">
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/records" element={<Records />} />
          <Route path="/import" element={<ImportPage />} />
          <Route path="*" element={<Records />} />
        </Routes>
      </main>
    </div>
  );
}
