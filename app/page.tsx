import Image from "next/image";
import Link from "next/link";
import { MarketHeader } from "@/components/marketplace-shell";
import { products, producers } from "@/lib/demo-data";

export default function HomePage() {
  return (
    <div className="market-app landing-page">
      <MarketHeader />
      <main className="landing-main">
        <section className="landing-hero">
          <div className="hero-copy">
            <p className="eyebrow">AKLAN PIÑA · B2B SOURCING</p>
            <h1>Source.<br /><em>Create.</em><br />Connect.</h1>
            <p className="hero-lead">A more thoughtful way for Filipino businesses to source piña textiles and coordinate with Aklan makers.</p>
            <div className="hero-actions"><Link className="button button-primary" href="/buyer">Explore buyer workspace <span aria-hidden="true">↗</span></Link><Link className="button button-outline" href="/producer">Enter producer view</Link></div>
            <p className="fine-print">Competition demo · fictional profiles and order data</p>
          </div>
          <div className="hero-art">
            <div className="hero-orbit" aria-hidden="true" />
            <Image src="/images/likhapina-logo.png" alt="LikhaPiña emblem with pineapple leaves, a loom and woven textile" width={460} height={460} priority />
            <div className="hero-caption"><span>AKLAN, PHILIPPINES</span><strong>Craft, coordinated.</strong></div>
          </div>
          <div className="hero-index"><span>01 / 03</span><span className="index-line" /><span>DISCOVER THE WORKFLOW</span></div>
        </section>
        <section className="landing-section workflow-section">
          <div className="landing-section-heading"><p className="eyebrow">A CLEARER WORKFLOW</p><h2>From first brief<br />to finished weave.</h2><p>Keep sourcing details, proposals and production progress in one shared place.</p></div>
          <div className="workflow-steps">{[["01", "Share your needs", "Post a sourcing brief with material, quantity, dimensions and destination."], ["02", "Review proposals", "Compare a producer’s sample price, timing and terms before accepting."], ["03", "Coordinate together", "Follow a simulated order through production milestones."]].map(([num, title, copy]) => <article key={num}><span>{num}</span><h3>{title}</h3><p>{copy}</p></article>)}</div>
        </section>
        <section className="landing-section collection-section">
          <div className="section-title"><div><p className="eyebrow">THE MATERIAL, REIMAGINED</p><h2>Textiles with a story.</h2></div><Link className="text-link" href="/buyer/producers">Browse producer profiles ↗</Link></div>
          <div className="landing-products">{products.slice(0, 3).map((product, index) => <article className={`landing-product textile-${index}`} key={product.name}><div className="fabric-tile"><span>LIKHA PIÑA</span></div><div><small>{product.category}</small><h3>{product.name}</h3><p>{product.description}</p></div></article>)}</div>
        </section>
        <section className="role-band"><div><p className="eyebrow">BUILT FOR BOTH SIDES</p><h2>One workflow.<br /><em>Two perspectives.</em></h2></div><div className="role-cards"><article><span>FOR BUYERS</span><h3>Source with clarity.</h3><p>Share a brief, compare quotations, and track each order milestone.</p><Link href="/buyer">Open buyer workspace ↗</Link></article><article><span>FOR PRODUCERS</span><h3>Respond with confidence.</h3><p>Review incoming needs, prepare a proposal, and keep progress visible.</p><Link href="/producer">Open producer workspace ↗</Link></article></div></section>
        <section className="about-strip"><div><p className="eyebrow">ROOTED IN AKLAN</p><h2>Tradition in every thread.<br />Possibility in every connection.</h2></div><p>LikhaPiña is a proposed B2B sourcing and production coordination concept focused on Aklan piña textiles. The prototype uses fictional makers and sample data to demonstrate how buyer and producer workflows could connect.</p><Image src="/images/likhapina-logo.png" alt="" width={86} height={86} /></section>
        <section className="payproof-link"><div><span className="eyebrow">A SEPARATE HACKATHON DEMO</span><h2>See PayProof.</h2><p>Explore the isolated testnet payment demo and its read-only transaction evidence flow.</p></div><Link className="button button-outline" href="/payproof">Open PayProof ↗</Link></section>
      </main>
      <footer className="market-footer"><span>LikhaPiña · Source. Create. Connect.</span><span>Aklan, Philippines · Fictional hackathon demo · {producers.length} sample maker profiles</span><Link href="/buyer">Enter the demo ↗</Link></footer>
    </div>
  );
}
