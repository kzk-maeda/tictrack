"use client";

import React, { createContext, useContext, useState, useEffect } from "react";

interface DemoModeContextType {
  isDemoMode: boolean;
  enterDemoMode: () => void;
  exitDemoMode: () => void;
}

const DemoModeContext = createContext<DemoModeContextType | undefined>(undefined);

const DEMO_MODE_STORAGE_KEY = "isDemoMode";

export function DemoModeProvider({ children }: { children: React.ReactNode }) {
  const [isDemoMode, setIsDemoMode] = useState(false);

  // Load demo mode state from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(DEMO_MODE_STORAGE_KEY);
    if (stored === "true") {
      setIsDemoMode(true);
    }
  }, []);

  const enterDemoMode = () => {
    setIsDemoMode(true);
    localStorage.setItem(DEMO_MODE_STORAGE_KEY, "true");
  };

  const exitDemoMode = () => {
    setIsDemoMode(false);
    localStorage.removeItem(DEMO_MODE_STORAGE_KEY);
  };

  return (
    <DemoModeContext.Provider value={{ isDemoMode, enterDemoMode, exitDemoMode }}>
      {children}
    </DemoModeContext.Provider>
  );
}

export function useDemoMode() {
  const context = useContext(DemoModeContext);
  if (context === undefined) {
    throw new Error("useDemoMode must be used within a DemoModeProvider");
  }
  return context;
}
