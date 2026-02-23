"use client";

import { ReactNode } from "react";
import { AuthProvider } from "@/lib/auth-context";
import UserMenu from "./UserMenu";
import MobileTabBar from "./MobileTabBar";

export default function Providers({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <UserMenu />
      {children}
      <MobileTabBar />
    </AuthProvider>
  );
}
