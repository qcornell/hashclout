"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { Flame, Trophy, User, Eye, Skull } from "lucide-react";

const TABS = [
  { href: "/", label: "LIVE", icon: Flame },
  { href: "/watch", label: "WATCH", icon: Eye },
  { href: "/roast", label: "ROAST", icon: Skull },
  { href: "/leaderboard", label: "CLOUT", icon: Trophy },
  { href: "/profile", label: "YOU", icon: User },
];

export default function MobileTabBar() {
  const pathname = usePathname();

  return (
    <nav style={{
      display: "none", /* shown via CSS below */
      position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 100,
      height: 64, background: "rgba(7,7,12,.92)",
      borderTop: "1px solid rgba(255,255,255,.08)",
      backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)",
      alignItems: "center", justifyContent: "space-around",
      padding: "0 20px",
      paddingBottom: "env(safe-area-inset-bottom, 0)",
      fontFamily: "'Inter', system-ui, sans-serif",
    }} className="mobile-tab-bar-global">
      {TABS.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || (href === "/" && pathname === "/");
        return (
          <Link key={href} href={href} style={{
            display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
            background: "none", border: "none", textDecoration: "none",
            color: active ? "#ff4d3d" : "rgba(255,255,255,.25)",
            fontSize: 10, fontWeight: 600, letterSpacing: ".06em",
            padding: "6px 10px", transition: "color .2s",
          }}>
            <span style={{
              filter: active ? "drop-shadow(0 0 6px rgba(255,77,61,.4))" : "none",
              transition: "filter .2s",
            }}>
              <Icon size={20} strokeWidth={2} />
            </span>
            <span>{label}</span>
          </Link>
        );
      })}

      <style>{`
        @media (max-width: 768px) {
          .mobile-tab-bar-global { display: flex !important; }
        }
      `}</style>
    </nav>
  );
}
