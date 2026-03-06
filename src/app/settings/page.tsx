"use client";

import { useAuthenticator } from "@aws-amplify/ui-react";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ChildrenList } from "@/components/children/children-list";

export default function SettingsPage() {
  const { user, signOut } = useAuthenticator((context) => [context.user]);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto flex items-center justify-between px-4 py-3">
          <h1 className="text-xl font-bold">TicTrack</h1>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">
              {user?.signInDetails?.loginId}
            </span>
            <Button variant="ghost" size="sm" onClick={signOut}>
              <LogOut className="h-4 w-4 mr-1" />
              ログアウト
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 max-w-2xl">
        <h2 className="text-2xl font-bold mb-6">設定</h2>
        <ChildrenList />
      </main>
    </div>
  );
}
