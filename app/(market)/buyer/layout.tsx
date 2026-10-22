import type { ReactNode } from "react";
import { WorkspaceShell } from "@/components/marketplace-shell";

export default function BuyerLayout({ children }: { children: ReactNode }) {
  return <WorkspaceShell role="buyer">{children}</WorkspaceShell>;
}
