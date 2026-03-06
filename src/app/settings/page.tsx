"use client";

import { Nav } from "@/components/layout/nav";
import { ChildrenList } from "@/components/children/children-list";

export default function SettingsPage() {
  return (
    <div className="min-h-screen bg-background">
      <Nav />
      <main className="container mx-auto px-4 py-6 max-w-2xl">
        <h2 className="text-2xl font-bold mb-6">設定</h2>
        <ChildrenList />
      </main>
    </div>
  );
}
