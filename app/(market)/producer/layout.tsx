import type { ReactNode } from "react";
import { WorkspaceShell } from "@/components/marketplace-shell";

export default function ProducerLayout({ children }: { children: ReactNode }) {
  return <WorkspaceShell role="producer">{children}</WorkspaceShell>;
}
