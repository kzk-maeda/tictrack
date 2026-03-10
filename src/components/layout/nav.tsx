"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuthenticator } from "@aws-amplify/ui-react";
import { LogOut, Home, CreditCard, Settings, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";
import { LanguageSwitcher } from "./language-switcher";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

export function Nav() {
  const pathname = usePathname();
  const { user, signOut } = useAuthenticator((context) => [context.user]);
  const t = useTranslations("nav");
  const [isOpen, setIsOpen] = useState(false);

  const navItems = [
    { href: "/tic-cards", label: t("ticCards"), icon: CreditCard },
    { href: "/timeline", label: t("timeline"), icon: Home },
    { href: "/settings", label: t("settings"), icon: Settings },
  ];

  const handleNavClick = () => {
    setIsOpen(false);
  };

  return (
    <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50 shadow-soft">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-semibold tracking-tight text-primary">
              TicTrack
            </h1>

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
                  <SheetTitle className="text-left text-primary">
                    TicTrack
                  </SheetTitle>
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

                {/* Mobile User Info & Logout */}
                <div className="absolute bottom-8 left-6 right-6 space-y-3">
                  <div className="text-sm text-muted-foreground px-2">
                    {user?.signInDetails?.loginId}
                  </div>
                  <Button
                    variant="outline"
                    className="w-full justify-start"
                    onClick={() => {
                      handleNavClick();
                      signOut();
                    }}
                  >
                    <LogOut className="h-4 w-4 mr-2" />
                    {t("logout")}
                  </Button>
                </div>
              </SheetContent>
            </Sheet>
          </div>

          {/* Desktop Actions */}
          <div className="flex items-center gap-4">
            <LanguageSwitcher />
            <span className="text-sm text-muted-foreground hidden sm:inline">
              {user?.signInDetails?.loginId}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={signOut}
              className="hidden md:flex hover:bg-muted/60 transition-all"
            >
              <LogOut className="h-4 w-4 mr-2" />
              {t("logout")}
            </Button>
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
