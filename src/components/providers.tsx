"use client";

import { ThemeProvider } from "next-themes";
import type { ReactNode } from "react";
import { SyncProvider } from "@/lib/progress/sync";
import { SearchProvider } from "./search";
import { TooltipProvider } from "./ui/tooltip";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <SyncProvider>
        <TooltipProvider>
          <SearchProvider>{children}</SearchProvider>
        </TooltipProvider>
      </SyncProvider>
    </ThemeProvider>
  );
}
