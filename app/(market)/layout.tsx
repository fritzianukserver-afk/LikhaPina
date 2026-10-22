import Link from "next/link";
import { DemoStoreProvider } from "@/components/demo-store";
import { MarketHeader } from "@/components/marketplace-shell";

export default function MarketLayout({ children }: { children: React.ReactNode }) {
  return (
    <DemoStoreProvider>
      <div className="market-app">
        <MarketHeader />
        {children}
        <footer className="market-footer">
          <span>LikhaPiña · Source. Create. Connect.</span>
          <span>Aklan, Philippines · Fictional hackathon demo</span>
          <Link href="/payproof">Open PayProof ↗</Link>
        </footer>
      </div>
    </DemoStoreProvider>
  );
}
