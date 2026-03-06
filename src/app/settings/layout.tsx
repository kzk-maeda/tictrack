"use client";

import { ProtectedLayout } from "@/components/auth/protected-layout";

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <ProtectedLayout>{children}</ProtectedLayout>;
}
