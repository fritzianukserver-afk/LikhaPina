"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import {
  formatPeso,
  producers,
  products,
  productionStages,
  type SourcingRequest,
} from "@/lib/demo-data";
import { useDemoStore } from "@/components/demo-store";
import { DemoNotice, PageHeading } from "@/components/marketplace-shell";

function Metric({ label, value, note }: { label: string; value: number | string; note: string }) {
  return <article className="metric-card"><span>{label}</span><strong>{value}</strong><small>{note}</small></article>;
}

function ProductCard({ productIndex }: { productIndex: number }) {
  const product = products[productIndex % products.length]!;
  const maker = producers[productIndex % producers.length]!;
  return (
    <article className={`textile-card textile-${productIndex % 4}`}>
      <div className="textile-swatch" aria-hidden="true"><span>LP</span></div>
      <div className="textile-copy">
        <span className="tag">{product.category}</span>
        <h3>{product.name}</h3>
        <p>{product.description}</p>
        <div className="textile-meta"><span>{maker.name}</span><span>{maker.location}, Aklan</span></div>
        <Link className="text-link" href={`/buyer/producers/${maker.slug}`}>View producer <span aria-hidden="true">↗</span></Link>
      </div>
    </article>
  );
}

export function BuyerDashboard() {
  const { state } = useDemoStore();
  const openQuotes = state.quotes.filter((quote) => quote.status === "Pending").length;
  return (
    <>
      <PageHeading eyebrow="BUYER WORKSPACE" title="Good day, Amihan." description="Bring your next piña textile project from idea to a coordinated producer order." action={<Link className="button button-primary" href="/buyer/requests/new">+ New sourcing request</Link>} />
      <div className="metric-grid">
        <Metric label="Open requests" value={state.requests.length - state.orders.length} note="Shared with demo producers" />
        <Metric label="Quotes to review" value={openQuotes} note="Compare price and lead time" />
        <Metric label="Active orders" value={state.orders.filter((order) => order.stage < productionStages.length - 1).length} note="Production updates" />
      </div>
      <section className="section-block">
        <div className="section-title"><div><p className="eyebrow">CURATED FOR YOUR BRIEF</p><h2>Textiles to start with</h2></div><Link className="text-link" href="/buyer/producers">Explore all producers ↗</Link></div>
        <div className="textile-grid">{products.slice(0, 3).map((product, index) => <ProductCard key={product.name} productIndex={index} />)}</div>
      </section>
      <section className="section-block panel-light">
        <div className="section-title"><div><p className="eyebrow">YOUR SOURCING PIPELINE</p><h2>Recent requests</h2></div><Link className="text-link" href="/buyer/requests">View requests ↗</Link></div>
        <RequestTable requests={state.requests.slice(0, 4)} />
      </section>
      <DemoNotice>Fictional sample records for a video demo. Prices and availability are illustrative; confirm directly with a producer.</DemoNotice>
    </>
  );
}

function RequestTable({ requests }: { requests: SourcingRequest[] }) {
  const { state } = useDemoStore();
  if (!requests.length) return <div className="empty-panel">Your sourcing requests will appear here after you submit a brief.</div>;
  return (
    <div className="table-scroll"><table><thead><tr><th>Reference</th><th>Textile</th><th>Quantity</th><th>Response</th></tr></thead><tbody>
      {requests.map((request) => {
        const hasQuote = state.quotes.some((quote) => quote.requestId === request.id);
        return <tr key={request.id}><td><strong>{request.id}</strong></td><td>{request.material}</td><td>{request.quantity} {request.unit}</td><td><span className={`status-pill ${hasQuote ? "is-ready" : ""}`}>{hasQuote ? "Quotation received" : "Open"}</span></td></tr>;
      })}
    </tbody></table></div>
  );
}

export function ProducerDirectory() {
  const [search, setSearch] = useState("");
  const [location, setLocation] = useState("All locations");
  const [material, setMaterial] = useState("All materials");
  const visible = producers.filter((producer) => {
    const text = `${producer.name} ${producer.location} ${producer.materials}`.toLowerCase();
    return text.includes(search.toLowerCase()) &&
      (location === "All locations" || producer.location === location) &&
      (material === "All materials" || producer.materials.toLowerCase().includes(material.toLowerCase()));
  });
  return (
    <>
      <PageHeading eyebrow="BUYER · DISCOVER" title="Meet Aklan’s textile makers." description="Explore fictional producer profiles and the textile capabilities they bring to the demo marketplace." />
      <div className="filter-row"><label>Search producers<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Name, place or material" /></label><label>Location<select value={location} onChange={(event) => setLocation(event.target.value)}><option>All locations</option>{[...new Set(producers.map((item) => item.location))].map((item) => <option key={item}>{item}</option>)}</select></label><label>Material<select value={material} onChange={(event) => setMaterial(event.target.value)}><option>All materials</option><option>Pure piña</option><option>Piña-seda</option><option>blended</option></select></label></div>
      <div className="producer-grid">{visible.map((producer, index) => <article className="producer-card" key={producer.slug}><div className={`producer-art producer-art-${index % 4}`}><span>{producer.name.split(" ").map((part) => part[0]).slice(0, 2).join("")}</span><small>AKLAN · {producer.location.toUpperCase()}</small></div><div className="producer-card-body"><span className="tag">Sample profile · not verified</span><h2>{producer.name}</h2><p>{producer.materials}</p><div className="producer-facts"><span>Capacity<strong>{producer.capacity}</strong></span><span>Lead time<strong>{producer.leadTime}</strong></span></div><Link className="button button-outline" href={`/buyer/producers/${producer.slug}`}>View profile <span aria-hidden="true">↗</span></Link></div></article>)}</div>
      {!visible.length ? <div className="empty-panel">No producer matches those filters. Try another search.</div> : null}
      <DemoNotice>All producers and capabilities are fictional sample content, not verified partners or confirmed availability.</DemoNotice>
    </>
  );
}

export function ProducerProfile({ slug }: { slug: string }) {
  const producer = producers.find((item) => item.slug === slug) || producers[0]!;
  const productNames = producer.products;
  return (
    <>
      <Link className="back-link" href="/buyer/producers">← Back to producers</Link>
      <section className="profile-hero"><div className="profile-monogram">{producer.name.split(" ").map((part) => part[0]).slice(0, 2).join("")}</div><div><p className="eyebrow">FICTIONAL PRODUCER PROFILE</p><h1>{producer.name}</h1><p>{producer.location}, Aklan · {producer.materials}</p><span className="status-pill">Sample profile · not verified</span></div></section>
      <div className="profile-columns"><section className="panel-light"><p className="eyebrow">ABOUT THE MAKER</p><h2>Craft, coordinated.</h2><p>{producer.about}</p><div className="profile-facts"><div>Monthly capacity<strong>{producer.capacity}</strong></div><div>Typical lead time<strong>{producer.leadTime}</strong></div><div>Customization<strong>By request</strong></div></div></section><section className="panel-light"><p className="eyebrow">SAMPLE OFFERINGS</p><h2>Textile capabilities</h2><ul className="offering-list">{productNames.map((name) => <li key={name}>{name}</li>)}</ul><Link className="button button-primary" href="/buyer/requests/new">Create a sourcing request</Link></section></div>
      <DemoNotice>Fictional profile for demonstration only. No producer relationship, inventory or quotation is implied.</DemoNotice>
    </>
  );
}

export function NewSourcingRequest() {
  const { createRequest } = useDemoStore();
  const [savedId, setSavedId] = useState("");
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const id = createRequest({
      material: String(form.get("material")),
      blend: String(form.get("blend")),
      quantity: Number(form.get("quantity")),
      unit: String(form.get("unit")),
      width: String(form.get("width") || "—"),
      length: String(form.get("length") || "—"),
      use: String(form.get("use") || "—"),
      budget: Number(form.get("budget") || 0),
      deadline: String(form.get("deadline") || "To be discussed"),
      destination: String(form.get("destination") || "To be discussed"),
      notes: String(form.get("notes") || ""),
    });
    setSavedId(id);
    event.currentTarget.reset();
  }
  return <>
    <PageHeading eyebrow="BUYER · SOURCING REQUEST" title="Tell producers what you’re making." description="A clear brief helps producers respond with a useful sample quotation." />
    {savedId ? <div className="success-banner" role="status">Request {savedId} is ready for producer review. <Link href="/producer/requests">Open producer workspace ↗</Link></div> : null}
    <form className="form-panel form-grid" onSubmit={submit}>
      <label>Material<select name="material" required>{products.map((product) => <option key={product.name}>{product.name}</option>)}</select></label>
      <label>Fiber composition<select name="blend"><option>Pure piña</option><option>Piña-seda blend</option><option>Blended textile</option></select></label>
      <label>Quantity<input name="quantity" type="number" min="1" defaultValue="20" required /></label>
      <label>Unit<select name="unit"><option>meters</option><option>yards</option><option>pieces</option></select></label>
      <label>Width<input name="width" placeholder="36 inches" /></label><label>Length<input name="length" placeholder="20 meters" /></label>
      <label>Intended use<input name="use" placeholder="Barong, Filipiniana, interiors…" /></label><label>Target budget (₱)<input name="budget" type="number" min="0" placeholder="Optional" /></label>
      <label>Target deadline<input name="deadline" type="date" /></label><label>Delivery destination<input name="destination" placeholder="Manila" /></label>
      <label className="field-wide">Customization and notes<textarea name="notes" rows={4} placeholder="Finish, color, weave or other requirements" /></label>
      <div className="field-wide form-actions"><button className="button button-primary" type="submit">Post demo request ↗</button><Link className="button button-outline" href="/buyer/requests">Cancel</Link><small>Demo only · no request is sent to a real producer.</small></div>
    </form>
  </>;
}

export function BuyerRequests() {
  const { state } = useDemoStore();
  return <><PageHeading eyebrow="BUYER · SOURCING" title="Your sourcing requests." description="Follow requests and see when a sample producer has responded." action={<Link className="button button-primary" href="/buyer/requests/new">+ New request</Link>} /><div className="stack-list">{state.requests.map((request) => { const quoteCount = state.quotes.filter((quote) => quote.requestId === request.id).length; const hasOrder = state.orders.some((order) => order.requestId === request.id); return <article className="panel-light request-row" key={request.id}><div><span className="tag">{request.id}</span><h2>{request.material}</h2><p>{request.blend} · {request.quantity} {request.unit} · {request.width} wide</p><small>Use: {request.use} · Destination: {request.destination}</small></div><div className="request-row-side"><span className={`status-pill ${hasOrder ? "is-ready" : quoteCount ? "is-pending" : ""}`}>{hasOrder ? "Order created" : quoteCount ? `${quoteCount} quotation${quoteCount === 1 ? "" : "s"} received` : "Open"}</span>{quoteCount ? <Link className="text-link" href="/buyer/quotations">Review quotations ↗</Link> : null}</div></article>; })}</div><DemoNotice>Request references, names, quantities and deadlines are fictional and remain in this browser’s separate demo store.</DemoNotice></>;
}

export function BuyerQuotations() {
  const { state, acceptQuote } = useDemoStore();
  return <><PageHeading eyebrow="BUYER · QUOTATIONS" title="Compare the proposals." description="Review sample price, lead time and terms before creating a simulated order." /><div className="quote-grid">{state.quotes.map((quote) => { const request = state.requests.find((item) => item.id === quote.requestId); return <article className="quote-card" key={quote.id}><div className="quote-card-top"><span className="tag">{quote.id} · {request?.id}</span><span className={`status-pill ${quote.status === "Accepted" ? "is-ready" : quote.status === "Pending" ? "is-pending" : ""}`}>{quote.status}</span></div><p className="eyebrow">FROM {quote.producer.toUpperCase()}</p><h2>{quote.material}</h2><strong className="quote-price">{formatPeso(quote.price)}</strong><div className="quote-facts"><span>Quantity<strong>{quote.quantity} {quote.unit}</strong></span><span>Estimated completion<strong>{quote.completion}</strong></span></div><p>{quote.terms}</p><p className="muted-copy">{quote.notes}</p>{quote.status === "Pending" ? <button className="button button-primary" onClick={() => acceptQuote(quote.id)}>Accept proposal · create demo order</button> : quote.status === "Accepted" ? <Link className="button button-outline" href="/buyer/orders">View simulated order ↗</Link> : null}</article>; })}</div>{!state.quotes.length ? <div className="empty-panel">Producer quotations will appear here after a response.</div> : null}<DemoNotice>Accepting a proposal creates a simulated order only. No contract, invoice, payment or fulfilment is created.</DemoNotice></>;
}

function OrderCard({ order, showProgress = false, onAdvance }: { order: DemoStateOrder; showProgress?: boolean; onAdvance?: () => void }) {
  const stage = productionStages[order.stage] || productionStages[0]!;
  const pct = Math.round(((order.stage + 1) / productionStages.length) * 100);
  return <article className="panel-light order-panel"><div className="order-title-row"><div><span className="tag">{order.id} · {order.requestId}</span><h2>{order.material}</h2></div><strong className="quote-price">{formatPeso(order.price)}</strong></div><div className="order-facts"><span>Buyer<strong>{order.buyer}</strong></span><span>Producer<strong>{order.producer}</strong></span><span>Quantity<strong>{order.quantity} {order.unit}</strong></span><span>Lead time<strong>{order.completion}</strong></span></div><div className="progress-heading"><span>Production stage</span><strong>{stage}</strong><span>{pct}%</span></div><progress value={pct} max="100" aria-label={`Production progress: ${pct}%`} /><div className="stage-steps">{productionStages.map((item, index) => <span key={item} className={index <= order.stage ? "complete" : ""}>{item}</span>)}</div>{showProgress && onAdvance ? <button className="button button-primary" onClick={onAdvance} disabled={order.stage === productionStages.length - 1}>{order.stage === productionStages.length - 1 ? "Demo production complete" : "Advance simulated production"}</button> : null}</article>;
}

type DemoStateOrder = ReturnType<typeof useDemoStore>["state"]["orders"][number];

export function BuyerOrders() {
  const { state } = useDemoStore();
  return <><PageHeading eyebrow="BUYER · ORDERS" title="Orders, at a glance." description="Accepted proposals move into shared production tracking." />{state.orders.length ? <div className="stack-list">{state.orders.map((order) => <OrderCard key={order.id} order={order} />)}</div> : <div className="empty-panel"><h2>Your first order starts with a quotation.</h2><p>Review the ready-to-view sample proposal, or create a sourcing request and switch to the producer workspace.</p><Link className="button button-primary" href="/buyer/quotations">Review sample quotation ↗</Link></div>}<DemoNotice>Production progress is illustrative. Payment status in this app is coordination-only and does not represent PayProof.</DemoNotice></>;
}

export function BuyerTracking() {
  const { state } = useDemoStore();
  return <><PageHeading eyebrow="BUYER · PRODUCTION TRACKING" title="Follow the work in progress." description="The producer workspace can advance each simulated production stage." />{state.orders.length ? <div className="stack-list">{state.orders.map((order) => <OrderCard key={order.id} order={order} />)}</div> : <div className="empty-panel"><h2>No active production yet.</h2><p>Accept a sample quotation to create a trackable demo order.</p><Link className="button button-primary" href="/buyer/quotations">Review quotations ↗</Link></div>}<DemoNotice>These progress markers are simulated updates, not inspection or certification.</DemoNotice></>;
}

export function ProducerDashboard() {
  const { state } = useDemoStore();
  const incoming = state.requests.filter((request) => !state.quotes.some((quote) => quote.requestId === request.id && quote.producerSlug === producers[0]!.slug)).length;
  return <><PageHeading eyebrow="PRODUCER WORKSPACE" title="Welcome, Aklan Loom Collective." description="Review buyer briefs, prepare sample quotations and share production milestones." action={<Link className="button button-primary" href="/producer/requests">Review incoming requests ↗</Link>} /><div className="metric-grid"><Metric label="Requests to review" value={incoming} note="Fictional buyer briefs" /><Metric label="Pending quotations" value={state.quotes.filter((quote) => quote.status === "Pending").length} note="Awaiting buyer review" /><Metric label="Orders in production" value={state.orders.filter((order) => order.stage < productionStages.length - 1).length} note="Progress updates shared" /></div><section className="section-block panel-light"><div className="section-title"><div><p className="eyebrow">INCOMING OPPORTUNITY</p><h2>Latest sourcing brief</h2></div><Link className="text-link" href="/producer/requests">All requests ↗</Link></div><RequestTable requests={state.requests.slice(0, 3)} /></section><DemoNotice>Producer workspace is a simulated local role. No messages are sent to real buyers.</DemoNotice></>;
}

function QuoteForm({ request, onCancel }: { request: SourcingRequest; onCancel: () => void }) {
  const { createQuote } = useDemoStore();
  const [sent, setSent] = useState(false);
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    createQuote({ requestId: request.id, price: Number(form.get("price")), completion: String(form.get("completion")), terms: String(form.get("terms")), notes: String(form.get("notes") || "") });
    setSent(true);
  }
  if (sent) return <div className="success-banner" role="status">Sample quotation submitted. <Link href="/buyer/quotations">Review as buyer ↗</Link></div>;
  return <form className="quote-form" onSubmit={submit}><label>Proposed price (₱)<input type="number" name="price" min="1" defaultValue="28000" required /></label><label>Completion estimate<input name="completion" defaultValue="30 days" required /></label><label>Terms<input name="terms" defaultValue="50% down payment · 50% upon completion" required /></label><label>Note<input name="notes" defaultValue="Sample quotation for the demo." /></label><div><button className="button button-primary" type="submit">Submit sample quotation</button> <button className="button button-text" type="button" onClick={onCancel}>Cancel</button></div></form>;
}

export function ProducerRequests() {
  const { state } = useDemoStore();
  const [selected, setSelected] = useState<string | null>(null);
  return <><PageHeading eyebrow="PRODUCER · INCOMING" title="Buyer sourcing requests." description="Respond to a brief with a proposed price, timing and terms." /><div className="stack-list">{state.requests.map((request) => { const submitted = state.quotes.some((quote) => quote.requestId === request.id && quote.producerSlug === producers[0]!.slug); return <article className="panel-light incoming-card" key={request.id}><div className="incoming-head"><div><span className="tag">{request.id} · {request.buyer}</span><h2>{request.material}</h2><p>{request.blend} · {request.quantity} {request.unit} · {request.width} wide × {request.length}</p></div><span className={`status-pill ${submitted ? "is-ready" : ""}`}>{submitted ? "Quotation submitted" : "Open request"}</span></div><div className="request-detail-grid"><span>Intended use<strong>{request.use}</strong></span><span>Target budget<strong>{request.budget ? formatPeso(request.budget) : "Not specified"}</strong></span><span>Deadline<strong>{request.deadline}</strong></span><span>Destination<strong>{request.destination}</strong></span></div><p className="muted-copy">{request.notes}</p>{submitted ? <Link className="text-link" href="/producer/quotations">See submitted quotation ↗</Link> : selected === request.id ? <QuoteForm request={request} onCancel={() => setSelected(null)} /> : <button className="button button-primary" onClick={() => setSelected(request.id)}>Prepare a sample quotation</button>}</article>; })}</div><DemoNotice>Submitting a quotation updates the shared simulated demo state only.</DemoNotice></>;
}

export function ProducerQuotations() {
  const { state } = useDemoStore();
  const own = state.quotes.filter((quote) => quote.producerSlug === producers[0]!.slug);
  return <><PageHeading eyebrow="PRODUCER · QUOTATIONS" title="Your submitted proposals." description="See how sample quotations move from pending to accepted or declined." action={<Link className="button button-outline" href="/producer/requests">Find a request ↗</Link>} /><div className="stack-list">{own.map((quote) => <article className="panel-light quote-row" key={quote.id}><div><span className="tag">{quote.id} · {quote.requestId}</span><h2>{quote.material}</h2><p>{quote.quantity} {quote.unit} · {quote.completion} · {quote.terms}</p></div><div><strong className="quote-price">{formatPeso(quote.price)}</strong><span className={`status-pill ${quote.status === "Accepted" ? "is-ready" : quote.status === "Pending" ? "is-pending" : ""}`}>{quote.status}</span></div></article>)}</div>{!own.length ? <div className="empty-panel">Submit a response to an incoming sourcing request to see it here.</div> : null}<DemoNotice>Quotation status is simulated and does not form a binding offer or contract.</DemoNotice></>;
}

export function ProducerOrders() {
  const { state } = useDemoStore();
  return <><PageHeading eyebrow="PRODUCER · ORDERS" title="Accepted demo orders." description="Orders appear here when a buyer accepts a sample quotation." />{state.orders.length ? <div className="stack-list">{state.orders.map((order) => <OrderCard key={order.id} order={order} />)}</div> : <div className="empty-panel"><h2>No accepted quotations yet.</h2><p>Switch to the buyer workspace and accept the sample quotation to create a demo order.</p><Link className="button button-primary" href="/buyer/quotations">Open buyer quotations ↗</Link></div>}</>;
}

export function ProducerProduction() {
  const { state, advanceOrder } = useDemoStore();
  return <><PageHeading eyebrow="PRODUCER · PRODUCTION" title="Share a progress update." description="Advance a fictional order through the handwoven textile production journey." />{state.orders.length ? <div className="stack-list">{state.orders.map((order) => <OrderCard key={order.id} order={order} showProgress onAdvance={() => advanceOrder(order.id)} />)}</div> : <div className="empty-panel"><h2>Production starts after quotation acceptance.</h2><p>Accept the sample quotation from the buyer view, then return here to advance production.</p><Link className="button button-outline" href="/buyer/quotations">Switch to buyer view ↗</Link></div>}<DemoNotice>Stage updates are fictional and do not certify materials, workmanship or delivery.</DemoNotice></>;
}
