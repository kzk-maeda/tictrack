"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuthenticator } from "@aws-amplify/ui-react";
import { LogOut, Home, CreditCard, Settings, Menu, Pill, BarChart3, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";
import { LanguageSwitcher } from "./language-switcher";
import { useChildren } from "@/hooks/use-children";
import { apiClient } from "@/lib/api";
import type { Episode } from "@/lib/types";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

export function Nav() {
  const pathname = usePathname();
  const router = useRouter();
  const t = useTranslations("nav");
  const [isOpen, setIsOpen] = useState(false);

  // useAuthenticator is available in all contexts (wrapped by AmplifyProvider)
  // In demo mode, user will be null/undefined
  const { user, signOut } = useAuthenticator((context) => [context.user]);
  const { children } = useChildren();

  const handleSignOut = async () => {
    await signOut();
    router.push("/auth");
  };

  const handleRecordVideo = async () => {
    // Get default child or first child
    const defaultChild = children.find((c) => c.isDefault) || children[0];
    if (!defaultChild) {
      // No children available, redirect to timeline where they can add a child
      router.push("/timeline");
      return;
    }

    try {
      // Create a new episode first
      const episode = await apiClient<Episode>(`/children/${defaultChild.childId}/episodes`, {
        method: "POST",
        body: {
          recordType: "video",
          occurredAt: new Date().toISOString(),
        },
      });

      // Navigate to capture page with childId and episodeId
      router.push(`/capture?childId=${defaultChild.childId}&episodeId=${episode.episodeId}`);
    } catch (error) {
      console.error("Failed to create episode:", error);
    }
  };

  // Navigation items with demo mode support
  const baseNavItems = [
    { href: "/timeline", label: t("timeline"), icon: Home },
    { href: "/events", label: t("events"), icon: CreditCard },
    { href: "/dashboard", label: t("dashboard"), icon: BarChart3 },
    { href: "/settings", label: t("settings"), icon: Settings },
  ];

  // Detect demo mode from URL path (more reliable than localStorage for SSR)
  const isInDemoMode = pathname?.startsWith("/demo");

  const navItems = isInDemoMode
    ? baseNavItems.map((item) => ({ ...item, href: `/demo${item.href}` }))
    : baseNavItems;

  const handleNavClick = () => {
    setIsOpen(false);
  };

  return (
    <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50 shadow-soft">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="cursor-pointer">
              <h1 className="text-2xl font-semibold tracking-tight text-primary hover:opacity-80 transition-opacity">
                TicTrack
              </h1>
            </Link>

            {/* Mobile Hamburger Menu */}
            <Sheet open={isOpen} onOpenChange={setIsOpen}>
              <SheetTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="md:hidden hover:bg-muted/60"
                >
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-72">
                <SheetHeader>
                  <Link href="/" onClick={handleNavClick}>
                    <SheetTitle className="text-left text-primary hover:opacity-80 transition-opacity cursor-pointer">
                      TicTrack
                    </SheetTitle>
                  </Link>
                </SheetHeader>
                <nav className="flex flex-col gap-2 mt-8">
                  {navItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = pathname === item.href;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={handleNavClick}
                        className={cn(
                          "flex items-center gap-3 px-4 py-3 rounded-lg text-base font-medium transition-all duration-300",
                          isActive
                            ? "bg-primary text-primary-foreground shadow-soft"
                            : "text-muted-foreground hover:bg-secondary/40 hover:text-foreground"
                        )}
                      >
                        <Icon className="h-5 w-5" />
                        {item.label}
                      </Link>
                    );
                  })}
                </nav>

                {/* Mobile Video Recording Button (not in demo mode) */}
                {!isInDemoMode && (
                  <div className="px-6 mt-4">
                    <Button
                      variant="default"
                      className="w-full justify-start gap-2"
                      onClick={() => {
                        handleNavClick();
                        handleRecordVideo();
                      }}
                    >
                      <Video className="h-4 w-4" />
                      {t("recordVideo")}
                    </Button>
                  </div>
                )}

                {/* Mobile User Info & Logout (not in demo mode) */}
                {!isInDemoMode && (
                  <div className="absolute bottom-8 left-6 right-6 space-y-3">
                    <div className="text-sm text-muted-foreground px-2">
                      {user?.signInDetails?.loginId}
                    </div>
                    <Button
                      variant="outline"
                      className="w-full justify-start"
                      onClick={() => {
                        handleNavClick();
                        handleSignOut();
                      }}
                    >
                      <LogOut className="h-4 w-4 mr-2" />
                      {t("logout")}
                    </Button>
                  </div>
                )}
              </SheetContent>
            </Sheet>
          </div>

          {/* Desktop Actions */}
          <div className="flex items-center gap-4">
            {!isInDemoMode && (
              <Button
                variant="default"
                size="sm"
                onClick={handleRecordVideo}
                className="gap-2"
              >
                <Video className="h-4 w-4" />
                <span className="hidden sm:inline">{t("recordVideo")}</span>
              </Button>
            )}
            <LanguageSwitcher />
            {!isInDemoMode && (
              <>
                <span className="text-sm text-muted-foreground hidden sm:inline">
                  {user?.signInDetails?.loginId}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleSignOut}
                  className="hidden md:flex hover:bg-muted/60 transition-all"
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  {t("logout")}
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Desktop Tab Navigation */}
        <nav className="hidden md:flex gap-2 mt-4">
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
