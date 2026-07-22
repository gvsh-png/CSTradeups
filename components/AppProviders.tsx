"use client";

import type { ReactNode } from "react";
import { AuthProvider } from "./AuthProvider";
import { CurrencyProvider } from "./CurrencyProvider";
import { SavedProvider } from "./SavedProvider";

export default function AppProviders({ children }: { children: ReactNode }) {
  return (
    <CurrencyProvider>
      <AuthProvider>
        <SavedProvider>{children}</SavedProvider>
      </AuthProvider>
    </CurrencyProvider>
  );
}
