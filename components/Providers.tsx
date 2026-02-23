"use client";

import { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { AuthProvider } from "@/lib/auth-context";
import UserMenu from "./UserMenu";
import MobileTabBar from "./MobileTabBar";

function LayoutInner({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  // Hide UserMenu on the main page during debates (it's a single-page app, always "/")
  // UserMenu shows on all other pages
  return (
    <>
      <UserMenu />
      {children}
      <MobileTabBar />
    </>
  );
}

export default function Providers({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <LayoutInner>{children}</LayoutInner>
    </AuthProvider>
  );
}
