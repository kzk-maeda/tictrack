"use client";

import { ProtectedLayout } from "@/components/auth/protected-layout";

export default function CaptureLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <ProtectedLayout>{children}</ProtectedLayout>;
}
