"use client";

import { ProtectedLayout } from "@/components/auth/protected-layout";
import { Nav } from "@/components/layout/nav";

export default function ProtectedRouteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ProtectedLayout>
      <Nav />
      <main className="container mx-auto px-4 py-8">{children}</main>
    </ProtectedLayout>
  );
}
