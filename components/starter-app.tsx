"use client";
import { useEffect, useRef, useState } from "react";
import type { PublicConfig, Prepared, Result } from "@/lib/types";
import { NEW_DEMO_ORDER, ORDER_REFERENCE } from "@/lib/types";
import { fromStroops } from "@/lib/amount";
import {
  BrowserRequestError,
  browserRequest,
  RESPONSE_DEADLINE_MS,
} from "@/lib/browser-api";
import {
  assertStatus,
  confirmOriginal,
  CONFIRMATION_PENDING,
  CONFIRMATION_UNRESOLVED,
} from "@/lib/confirmation";
import { connectWallet, signPrepared } from "@/lib/wallet";
import { assertOriginal } from "@/lib/transaction";
import {
  readOrderRecovery,
  saveOrderRecovery,
  terminal,
  assertNoConflictingRecovery,
  orderRecoveryKey,
} from "@/lib/recovery";
import type { OrderRecovery } from "@/lib/recovery";
import type { EventEvidence } from "@/lib/payment-evidence";

type Operation = {
  signal: AbortSignal;
  valid: () => boolean;
  save: (record: OrderRecovery) => void;
  message: (message: string) => void;
};

export function StarterApp({ config }: { config: PublicConfig }) {
  const [address, setAddress] = useState("");
  const [record, setRecord] = useState<OrderRecovery | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [message, setMessage] = useState("");
  const [progressMessage, setProgressMessage] = useState("");
  const [feedbackType, setFeedbackType] = useState<"status" | "error">("status");
  const [eventEvidence, setEventEvidence] = useState<EventEvidence | null>(null);
  const [eventPending, setEventPending] = useState(false);
  const [eventUnavailable, setEventUnavailable] = useState(false);
  const [blocked, setBlocked] = useState(true);
  const key = config.ready
    ? orderRecoveryKey(config.scope, NEW_DEMO_ORDER.orderReference)
    : "";
  const scopeKey = useRef(key);
  scopeKey.current = key;
  const loadedKey = useRef<string | null>(null);
  const active = useRef<AbortController | null>(null);
  const resumed = useRef(new Set<string>());
  useEffect(() => {
    loadedKey.current = null;
    active.current?.abort();
    active.current = null;
    setBusy(false);
    setConfirming(false);
    resumed.current.clear();
    setBlocked(true);
    setRecord(null);
    setAddress("");
    setMessage("");
    setProgressMessage("");
    setFeedbackType("status");
    setEventEvidence(null);
    setEventPending(false);
    setEventUnavailable(false);
    if (!config.ready) return;
    try {
      assertNoConflictingRecovery(localStorage, key, config.scope);
      const raw = localStorage.getItem(key);
      if (raw)
        setRecord(
          readOrderRecovery(
            config.scope,
            NEW_DEMO_ORDER.orderReference,
            raw,
          ),
        );
      loadedKey.current = key;
      setBlocked(false);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Recovery storage could not be read. Preserve it for support before starting another payment.",
      );
    }
    return () => {
      loadedKey.current = null;
      active.current?.abort();
    };
  }, [key, config.ready]);

  async function run(
    action: (current: OrderRecovery | null, op: Operation) => Promise<void>,
    progress: string,
  ) {
    if (!config.ready || active.current || blocked || loadedKey.current !== key)
      return;
    const controller = new AbortController();
    active.current = controller;
    const valid = () =>
      !controller.signal.aborted &&
      scopeKey.current === key &&
      loadedKey.current === key;
    const op: Operation = {
      signal: controller.signal,
      valid,
      save: (r) => {
        if (!valid())
          throw new DOMException("Operation cancelled", "AbortError");
        if (r.scope !== config.scope)
          throw new Error(
            "Recovery scope mismatch. Retain the original record.",
          );
        saveOrderRecovery(localStorage, key, r);
        setRecord(r);
      },
      message: (text) => {
        if (valid()) {
          setMessage(text);
          setFeedbackType("status");
        }
      },
    };
    setBusy(true);
    setProgressMessage(progress);
    setFeedbackType("status");
    setMessage("");
    try {
      if (!navigator.locks)
        throw new Error(
          "This browser needs Web Locks support for safe payment recovery.",
        );
      await navigator.locks.request(
        key,
        { ifAvailable: true },
        async (lock) => {
          if (!valid()) return;
          if (!lock)
            throw new Error(
              "Another tab is handling this deployment's payment. Return to that tab.",
            );
          assertNoConflictingRecovery(localStorage, key, config.scope);
          const raw = localStorage.getItem(key);
          const current = raw
            ? readOrderRecovery(
                config.scope,
                NEW_DEMO_ORDER.orderReference,
                raw,
              )
            : null;
          setRecord(current);
          await action(current, op);
        },
      );
    } catch (error) {
      if (op.valid()) {
        setMessage(
          error instanceof Error
            ? error.message
            : "Unresolved operation. Keep the original record.",
        );
        setFeedbackType("error");
      }
    } finally {
      if (active.current === controller) {
        active.current = null;
        if (scopeKey.current === key && loadedKey.current === key) {
          setBusy(false);
          setConfirming(false);
        }
      }
    }
  }

  function statusMessage(result: Result) {
    if (result.status === "SUCCESS")
      return "Original transaction confirmed. This does not verify downstream payouts or fulfil an application order.";
    if (result.status === "FAILED")
      return "Original transaction failed on the network. Its evidence is retained until acknowledged.";
    return `Original transaction: ${result.status}. UNKNOWN, rejection, expiry or missing history never prove replacement is safe.`;
  }
  async function checkOriginal(current: OrderRecovery, op: Operation) {
    if (!op.valid()) return;
    resumed.current.add(`${key}:${current.prepared.txHash}`);
    op.message(CONFIRMATION_PENDING);
    setProgressMessage(CONFIRMATION_PENDING);
    setConfirming(true);
    const outcome = await confirmOriginal({
      txHash: current.prepared.txHash,
      signal: op.signal,
      lookup: (signal, remainingMs) =>
        browserRequest<Result>(
          "/api/pay",
          { action: "status", txHash: current.prepared.txHash },
          signal,
          remainingMs,
        ),
      onResult: (result) => {
        op.save({ ...current, status: result.status });
        if (
          result.status === "SUCCESS" ||
          result.status === "FAILED" ||
          result.status === "REJECTED"
        )
          op.message(statusMessage(result));
      },
    });
    if (outcome === "unresolved") op.message(CONFIRMATION_UNRESOLVED);
  }
  useEffect(() => {
    if (
      blocked ||
      busy ||
      !record?.attempted ||
      !record.signedXdr ||
      terminal(record)
    )
      return;
    const identity = `${key}:${record.prepared.txHash}`;
    if (resumed.current.has(identity)) return;
    resumed.current.add(identity);
    void run(async (current, op) => {
      if (current?.attempted && current.signedXdr && !terminal(current))
        await checkOriginal(current, op);
    }, "Checking the original transaction after reload…");
  }, [key, blocked, busy, record]);

  async function prepare(current: OrderRecovery | null, op: Operation) {
    if (current)
      throw new Error("Resolve the existing payment before preparing another.");
    if (!address) throw new Error("Connect Freighter first.");
    const prepared = await browserRequest<Prepared>(
      "/api/pay",
      { action: "prepare", from: address },
      op.signal,
    );
    if (!config.ready) return;
    op.save({
      version: 3,
      orderReference: NEW_DEMO_ORDER.orderReference,
      scope: config.scope,
      address,
      prepared,
    });
    op.message(
      "Prepared and saved. Review the wallet transaction before approving.",
    );
  }
  async function sign(current: OrderRecovery | null, op: Operation) {
    if (!current) {
      op.message(
        "No saved payment record in this browser. Prepare a payment first.",
      );
      return;
    }
    if (current.signedXdr) {
      op.message(
        "Signed envelope already saved. Submit it or check its status.",
      );
      return;
    }
    if (terminal(current)) {
      op.message(
        "This transaction is already final. Acknowledge the final result and clear before starting another payment.",
      );
      return;
    }
    if (address !== current.address)
      throw new Error("Connect the original consenting wallet.");
    const next = { ...current, signing: true };
    op.save(next);
    const signedXdr = await signPrepared(current.prepared, current.address);
    assertOriginal(current.prepared.xdr, signedXdr, current.prepared.txHash);
    op.save({ ...next, signing: false, signedXdr });
    op.message("Exact signed envelope saved. Submit when ready.");
  }
  async function submit(current: OrderRecovery | null, op: Operation) {
    if (!current?.signedXdr || terminal(current)) return;
    assertOriginal(
      current.prepared.xdr,
      current.signedXdr,
      current.prepared.txHash,
    );
    const next = { ...current, attempted: true };
    resumed.current.add(`${key}:${current.prepared.txHash}`);
    op.save(next);
    let result: Result;
    try {
      result = await browserRequest<Result>(
        "/api/pay",
        {
          action: "submit",
          signedXdr: current.signedXdr,
          preparationRequestId: current.prepared.preparationRequestId,
        },
        op.signal,
        RESPONSE_DEADLINE_MS,
      );
    } catch (error) {
      if (!op.valid()) return;
      if (
        error instanceof BrowserRequestError &&
        error.status < 500 &&
        error.code !== "UPSTREAM_RPC"
      )
        throw error;
      await checkOriginal(next, op);
      return;
    }
    if (!op.valid()) return;
    if (result.txHash !== current.prepared.txHash)
      throw new Error("Response hash mismatch. Keep the original record.");
    if (result.status === "REJECTED") {
      op.save({ ...next, status: "REJECTED" });
      op.message(statusMessage(result));
      return;
    }
    // Confirmation uses the original status route even when submission reports success.
    await checkOriginal(next, op);
  }
  async function status(current: OrderRecovery | null, op: Operation) {
    if (!current) {
      op.message(
        "No saved payment record in this browser. Prepare a payment first.",
      );
      return;
    }
    const result = await browserRequest<Result>(
      "/api/pay",
      { action: "status", txHash: current.prepared.txHash },
      op.signal,
      RESPONSE_DEADLINE_MS,
    );
    if (!op.valid()) return;
    assertStatus(result, current.prepared.txHash);
    op.save({ ...current, status: result.status });
    op.message(statusMessage(result));
  }
  async function checkEvents(current: OrderRecovery | null, op: Operation) {
    if (!current) {
      op.message("No saved payment record in this browser.");
      return;
    }
    setEventPending(true);
    setEventUnavailable(false);
    setEventEvidence(null);
    try {
      const result = await browserRequest<EventEvidence>(
        "/api/pay",
        { action: "events", txHash: current.prepared.txHash },
        op.signal,
        RESPONSE_DEADLINE_MS,
      );
      if (!op.valid()) return;
      if (result.txHash !== current.prepared.txHash)
        throw new Error("Event evidence hash mismatch. Retain the original record.");
      setEventEvidence(result);
      op.message(
        result.complete
          ? "Event collection reached its current end. Payouts remain unverified because Paiflow does not document recipient and amount fields for general payout events."
          : "Event collection is incomplete. Retain the original record and check again later.",
      );
    } catch (error) {
      if (op.valid()) setEventUnavailable(true);
      throw error;
    } finally {
      if (op.valid()) setEventPending(false);
    }
  }
  async function clear(current: OrderRecovery | null, op: Operation) {
    if (!current || !terminal(current))
      throw new Error(
        "Check final SUCCESS or FAILED before clearing this record.",
      );
    if (!op.valid()) return;
    localStorage.removeItem(key);
    if (localStorage.getItem(key) !== null)
      throw new Error("Could not clear stored evidence.");
    setRecord(null);
    op.message(
      "Final transaction acknowledged. A new demo payment is now possible.",
    );
  }
  return (
    <main className="payproof-app" data-testid="payproof-app">
      <header>
        <h1>LikhaPiña PayProof</h1>
        <span className="chip" data-testid="network-chip">
          TESTNET
        </span>
        <span className="chip">HACKATHON DEMO</span>
      </header>
      <p>
        A payment-status demo for the LikhaPiña Aklan piña B2B sourcing
        platform. The new simulated order below is fixed at 1 XLM on
        Stellar Testnet. No real buyer, producer, goods or money participate;
        nothing is fulfilled.
      </p>
      <section data-testid="legacy-order" aria-label="Legacy order recovery">
        <h2>Legacy order — {ORDER_REFERENCE}</h2>
        <p>
          The earlier order keeps its original v2 recovery key. This new order
          does not load, migrate, relabel, or overwrite that recovery record.
          Keep its transaction evidence separate while reconciling it.
        </p>
      </section>
      <section aria-label="Demo order summary">
        <h2>New simulated order</h2>
        <dl>
          <dt>Product</dt>
          <dd>{NEW_DEMO_ORDER.productName}</dd>
          <dt>Order reference</dt>
          <dd>
            <code>{NEW_DEMO_ORDER.orderReference}</code> (demo reference, not a real order)
          </dd>
          <dt>Payment amount</dt>
          <dd>{fromStroops(NEW_DEMO_ORDER.amount)} XLM — Stellar Testnet only</dd>
          <dt>Expected payout split</dt>
          <dd>
            90% weavers / 10% platform (display metadata only; not verified
            against Paiflow deployment rules or transaction payouts)
          </dd>
          <dt>Recipient</dt>
          <dd>
            {config.ready &&
            (config.recipientLabel || config.recipientAddress) ? (
              <>
                {config.recipientLabel || "Configured testnet recipient"}
                {config.recipientAddress ? (
                  <>
                    {" "}
                    <code className="address">
                      {config.recipientAddress.slice(0, 8)}…
                      {config.recipientAddress.slice(-8)}
                    </code>
                  </>
                ) : null}
              </>
            ) : config.ready ? (
              <>
                The recipients configured on{" "}
                <a href={config.deploymentUrl} target="_blank" rel="noreferrer">
                  your Paiflow deployment
                </a>
                ; the API never exposes recipient addresses.
              </>
            ) : (
              "Unavailable until the server is configured."
            )}
          </dd>
          <dt>Transaction status</dt>
          <dd>{record?.status ?? "Not started"}</dd>
        </dl>
      </section>
      {!config.ready ? (
        <aside role="alert">{config.message}</aside>
      ) : (
        <p>
          <a href={config.deploymentUrl} target="_blank" rel="noreferrer">
            Review your deployment and its recipients
          </a>
        </p>
      )}
      <section>
        <h2>1. Connect and prepare</h2>
        <button
          disabled={busy || !config.ready || blocked}
          onClick={() =>
            run(async (_current, op) => {
              await browserRequest("/api/integration", undefined, op.signal);
              const address = await connectWallet();
              if (op.valid()) {
                setAddress(address);
                op.message("Freighter connected. Selected public address is shown below.");
              }
            }, "Checking integration and waiting for Freighter access…")
          }
        >
          Connect Freighter
        </button>
        <p className="payproof-wallet" data-testid="wallet-state">
          Wallet: {address ? "Connected to Freighter" : "Not connected"}
        </p>
        {address && (
          <p className="payproof-long-value">Selected public address: <code>{address}</code></p>
        )}
        <p>
          Payment: 1 testnet XLM plus network fees. Review the full transaction
          in Freighter.
        </p>
        <button
          disabled={busy || blocked || !address || !!record}
          onClick={() => run(prepare, "Preparing a 1 XLM Testnet payment…")}
        >
          Prepare 1 XLM payment
        </button>
      </section>
      <section>
        <h2>2. Sign and submit</h2>
        <button
          disabled={
            busy ||
            !record ||
            !address ||
            (record !== null && address !== record.address) ||
            !!record.signedXdr ||
            terminal(record) ||
            blocked
          }
          onClick={() => run(sign, "Waiting for Freighter to authorize the original transaction…")}
        >
          Sign original transaction
        </button>{" "}
        <button
          disabled={
            busy ||
            !record?.signedXdr ||
            (!!record && terminal(record)) ||
            blocked
          }
          onClick={() => run(submit, "Submitting the saved transaction envelope…")}
        >
          {record?.attempted
            ? "Retry exact saved envelope"
            : "Submit saved envelope"}
        </button>
      </section>
      <section>
        <h2>3. Verify and recover</h2>
        <p>
          Reloading restores the original preparation and signed envelope. Keep
          this browser's storage until the original transaction is resolved.
          Re-signing uses the same body; it never prepares a replacement.
        </p>
        {config.ready && !blocked && !record && (
          <p role="note">
            No saved payment record in this browser yet. The check and recovery
            controls below stay inactive until you prepare the payment above;
            nothing is created, signed or submitted automatically.
          </p>
        )}
        {record && (
          <>
            <p>
              Original transaction: <code>{record.prepared.txHash}</code>
            </p>
            <p>Preparation expires: {record.prepared.expiresAt}</p>
            <p>Preparation: Saved</p>
            <p>Wallet authorization: {record.signedXdr ? "Signed envelope saved" : "Not signed"}</p>
            <p>Submission evidence: {record.attempted ? "Submission attempt recorded; network outcome is determined by status lookup" : "No submission attempt recorded"}</p>
            <p>Status: {record.status || "Not checked"}</p>
          </>
        )}
        <section data-testid="payout-evidence" aria-label="Payout evidence">
          <h3>Payout evidence</h3>
          <p>
            Evidence state: {eventPending
              ? "PENDING"
              : !eventEvidence
                ? eventUnavailable
                  ? "INCOMPLETE EVIDENCE"
                  : "NOT CHECKED"
                : eventEvidence.complete
                  ? "UNVERIFIED SPLIT"
                  : "INCOMPLETE EVIDENCE"}
          </p>
          <p>
            Transaction status and event collection are separate. Event payloads
            are not interpreted as payouts; current documented fields do not prove
            both recipient addresses or exact amounts. No `VERIFIED PAYOUTS`
            conclusion is available.
          </p>
          {eventEvidence && (
            <>
              <p>
                Collection: {eventEvidence.complete ? "complete page set" : "incomplete"};{" "}
                {eventEvidence.events.length} unique events across {eventEvidence.pagesRead} page(s).
                {eventEvidence.duplicateCount > 0
                  ? ` ${eventEvidence.duplicateCount} duplicate event(s) omitted.`
                  : ""}
                {eventEvidence.invalidEventCount > 0
                  ? ` ${eventEvidence.invalidEventCount} invalid or mismatched event(s) excluded.`
                  : ""}
              </p>
              {eventEvidence.events.map((event) => (
                <p key={event.eventId}>
                  {event.kind} · ledger {event.ledger} · {event.occurredAt} · tx{" "}
                  <code>{event.txHash}</code>
                </p>
              ))}
            </>
          )}
        </section>
        {record?.status === "SUCCESS" && (
          <section data-testid="payment-receipt" aria-label="Transaction confirmation">
            <h3>Transaction confirmation</h3>
            <p>
              Paiflow reported the original {fromStroops(NEW_DEMO_ORDER.amount)} XLM transaction for {NEW_DEMO_ORDER.productName} (
              <code>{NEW_DEMO_ORDER.orderReference}</code>) as SUCCESS on Stellar Testnet.
            </p>
            <p>
              Original transaction hash:{" "}
              <code className="address">{record.prepared.txHash}</code>
            </p>
            <p>
              <a
                href={`https://stellar.expert/explorer/testnet/tx/${record.prepared.txHash}`}
                target="_blank"
                rel="noreferrer"
              >
                View transaction on the Stellar Testnet explorer
              </a>
            </p>
            <p>
              This confirms transaction status only. It does not prove that the
              expected 90/10 split or recipient payouts occurred, and it does not
              verify or fulfil an application order.
            </p>
          </section>
        )}
        <button
          disabled={busy || !record || blocked}
          onClick={() => run(status, "Checking the original transaction status…")}
        >
          Check original transaction
        </button>{" "}
        <button
          disabled={busy || !record || blocked}
          onClick={() => run(checkEvents, "Reading events for the original transaction…")}
        >
          Read original transaction events
        </button>{" "}
        <button
          disabled={busy || !record || !terminal(record) || blocked}
          onClick={() => run(clear, "Acknowledging the final status of this saved record…")}
        >
          Acknowledge final result and clear
        </button>
        <p>
          Deployment activity and balances may provide separate context, but this
          app cannot use them to prove transaction-specific recipient payouts.
          Transaction confirmation alone is not application payment verification.
        </p>
      </section>
      <p
        className="payproof-feedback"
        data-error={feedbackType === "error" && !busy ? "true" : "false"}
        role={busy || feedbackType !== "error" ? "status" : "alert"}
        aria-live={feedbackType === "error" && !busy ? "assertive" : "polite"}
        aria-atomic="true"
        data-testid="payproof-feedback"
      >
        {busy ? progressMessage : message}
      </p>
      {confirming && (
        <button
          onClick={() => {
            active.current?.abort();
            setMessage(CONFIRMATION_UNRESOLVED);
          }}
        >
          Stop checking
        </button>
      )}
      <aside>
        LikhaPiña PayProof is a hackathon demo with no real buyer, producer,
        goods or money, and no app authentication, order database, rate limit
        or business verification. Do not deploy it as a production checkout. A
        production application must bind prepared transactions to authorised
        orders and keep durable server-side recovery evidence. Browser storage
        is not a backup; deleting it loses recovery.
      </aside>
    </main>
  );
}
