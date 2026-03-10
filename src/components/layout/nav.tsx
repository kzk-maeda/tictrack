"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuthenticator } from "@aws-amplify/ui-react";
import { LogOut, Home, CreditCard, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";
import { LanguageSwitcher } from "./language-switcher";

export function Nav() {
  const pathname = usePathname();
  const { user, signOut } = useAuthenticator((context) => [context.user]);
  const t = useTranslations("nav");

  const navItems = [
    { href: "/tic-cards", label: t("ticCards"), icon: CreditCard },
    { href: "/timeline", label: t("timeline"), icon: Home },
    { href: "/settings", label: t("settings"), icon: Settings },
  ];

  return (
    <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50 shadow-soft">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-serif font-semibold tracking-tight bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">
            TicTrack
          </h1>
          <div className="flex items-center gap-4">
            <LanguageSwitcher />
            <span className="text-sm text-muted-foreground hidden sm:inline">
              {user?.signInDetails?.loginId}
            </span>
            <Button variant="ghost" size="sm" onClick={signOut} className="hover:bg-muted/60 transition-all">
              <LogOut className="h-4 w-4 mr-2" />
              {t("logout")}
            </Button>
          </div>
        </div>
        <nav className="flex gap-2">
          {navItems.map((item, idx) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-300 animate-fade-in-up",
                  isActive
                    ? "bg-primary text-primary-foreground shadow-soft"
                    : "text-muted-foreground hover:bg-secondary/40 hover:text-foreground hover:shadow-sm",
                  idx === 0 && "delay-50",
                  idx === 1 && "delay-100",
                  idx === 2 && "delay-150"
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
