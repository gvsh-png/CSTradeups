import type { ReactNode } from "react";
import AppProviders from "@/components/AppProviders";
import AppFrame from "@/components/AppFrame";

export default function SiteLayout({ children }: { children: ReactNode }) {
  return (
    <AppProviders>
      <AppFrame>{children}</AppFrame>
    </AppProviders>
  );
}
