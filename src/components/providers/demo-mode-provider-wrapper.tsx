"use client";

import { DemoModeProvider } from "@/contexts/demo-mode-context";

export function DemoModeProviderWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  return <DemoModeProvider>{children}</DemoModeProvider>;
}
