"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

const buyerLinks: [string, string][] = [
  ["Overview", "/buyer"],
  ["Find textiles & producers", "/buyer/producers"],
  ["Sourcing requests", "/buyer/requests"],
  ["Quotations", "/buyer/quotations"],
  ["Orders & tracking", "/buyer/orders"],
];
const producerLinks: [string, string][] = [
  ["Overview", "/producer"],
  ["Incoming requests", "/producer/requests"],
  ["Quotations", "/producer/quotations"],
  ["Orders", "/producer/orders"],
  ["Production updates", "/producer/production"],
];

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link className={`market-brand${compact ? " compact" : ""}`} href="/" aria-label="LikhaPiña home">
      <Image src="/images/likhapina-logo.png" alt="" width={52} height={52} priority />
      <span>Likha<span>Piña</span><small>Source. Create. Connect.</small></span>
    </Link>
  );
}

export function MarketHeader() {
  return (
    <header className="market-header">
      <Brand />
      <nav aria-label="Main navigation">
        <Link href="/buyer/producers">Textiles & producers</Link>
        <Link href="/buyer">Buyer workspace</Link>
        <Link href="/producer">Producer workspace</Link>
      </nav>
      <Link className="market-header-link" href="/payproof">PayProof demo <span aria-hidden="true">↗</span></Link>
    </header>
  );
}

export function WorkspaceShell({ role, children }: { role: "buyer" | "producer"; children: ReactNode }) {
  const pathname = usePathname();
  const links = role === "buyer" ? buyerLinks : producerLinks;
  return (
    <div className="workspace-layout">
      <aside className="workspace-sidebar">
        <Brand compact />
        <div className="workspace-role">{role} workspace <span>DEMO</span></div>
        <nav aria-label={`${role} workspace navigation`}>
          {links.map(([label, href]) => (
            <Link key={href} className={pathname === href ? "active" : ""} href={href}>{label}</Link>
          ))}
        </nav>
        <div className="sidebar-note">Fictional sample records · stored in this browser</div>
      </aside>
      <main className="workspace-main">
        <div className="workspace-topline">
          <span>LikhaPiña / {role} workspace</span>
          <div><Link href="/buyer">Buyer view</Link><Link href="/producer">Producer view</Link></div>
        </div>
        {children}
      </main>
    </div>
  );
}

export function PageHeading({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: ReactNode }) {
  return (
    <div className="page-heading">
      <div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p>{description}</p></div>
      {action ? <div className="heading-action">{action}</div> : null}
    </div>
  );
}

export function DemoNotice({ children }: { children: ReactNode }) {
  return <p className="demo-notice"><span aria-hidden="true">✳</span>{children}</p>;
}
