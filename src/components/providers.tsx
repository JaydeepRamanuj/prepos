"use client";

import { ThemeProvider } from "next-themes";
import type { ReactNode } from "react";
import { SyncProvider } from "@/lib/progress/sync";
import { SearchProvider } from "./search";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <SyncProvider>
        <SearchProvider>{children}</SearchProvider>
      </SyncProvider>
    </ThemeProvider>
  );
}
