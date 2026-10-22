import { assertOriginal, envelopeHash } from "@/lib/transaction";
import { TESTNET } from "@/lib/types";
import type { Prepared } from "@/lib/types";
export type Recovery = {
  version: 2;
  scope: string;
  address: string;
  prepared: Prepared;
  signedXdr?: string;
  signing?: boolean;
  attempted?: boolean;
  status?: string;
};
export type OrderRecovery = Omit<Recovery, "version"> & {
  version: 3;
  orderReference: string;
};
export type StoredRecovery = Recovery | OrderRecovery;

export function legacyRecoveryKey(scope: string) {
  return `paiflow-sdk-payment-v2:${scope}`;
}

export function orderRecoveryKey(scope: string, orderReference: string) {
  if (!/^LP-DEMO-[A-Z0-9-]+$/.test(orderReference))
    throw new Error("Invalid demo order reference.");
  return `paiflow-sdk-order-v3:${encodeURIComponent(scope)}:${orderReference}`;
}
export function readRecovery(scope: string, raw: string): Recovery {
  const r = JSON.parse(raw) as Recovery;
  if (
    !r ||
    r.version !== 2 ||
    r.scope !== scope ||
    typeof r.address !== "string" ||
    !/^G[A-Z2-7]{55}$/.test(r.address) ||
    !r.prepared ||
    r.prepared.network !== "testnet" ||
    r.prepared.networkPassphrase !== TESTNET ||
    !Number.isFinite(Date.parse(r.prepared.expiresAt)) ||
    !/^[a-f0-9]{64}$/.test(r.prepared.txHash) ||
    (r.signing !== undefined && typeof r.signing !== "boolean") ||
    (r.attempted !== undefined && typeof r.attempted !== "boolean") ||
    (r.status !== undefined &&
      !["SUCCESS", "FAILED", "PENDING", "UNKNOWN", "REJECTED"].includes(
        r.status,
      ))
  )
    throw new Error(
      "Invalid recovery record. Retain storage for support; do not start another payment.",
    );
  if (envelopeHash(r.prepared.xdr) !== r.prepared.txHash)
    throw new Error("Stored transaction mismatch.");
  if (r.signedXdr !== undefined)
    assertOriginal(r.prepared.xdr, r.signedXdr, r.prepared.txHash);
  return r;
}
export function saveRecovery(
  storage: Pick<Storage, "setItem" | "getItem">,
  key: string,
  r: Recovery,
) {
  const raw = JSON.stringify(r);
  readRecovery(r.scope, raw);
  storage.setItem(key, raw);
  if (storage.getItem(key) !== raw)
    throw new Error("Recovery storage unavailable. Payment stopped.");
}
export function readOrderRecovery(
  scope: string,
  orderReference: string,
  raw: string,
): OrderRecovery {
  const value = JSON.parse(raw) as OrderRecovery;
  if (
    !value ||
    value.version !== 3 ||
    value.orderReference !== orderReference
  )
    throw new Error(
      "Invalid order recovery record. Retain storage for support; do not start another payment.",
    );
  const legacyShape = readRecovery(
    scope,
    JSON.stringify({ ...value, version: 2 }),
  );
  return { ...legacyShape, version: 3, orderReference };
}
export function saveOrderRecovery(
  storage: Pick<Storage, "setItem" | "getItem">,
  key: string,
  record: OrderRecovery,
) {
  const raw = JSON.stringify(record);
  readOrderRecovery(record.scope, record.orderReference, raw);
  storage.setItem(key, raw);
  if (storage.getItem(key) !== raw)
    throw new Error("Recovery storage unavailable. Payment stopped.");
}
export function terminal(r: Pick<Recovery, "status">) {
  return r.status === "SUCCESS" || r.status === "FAILED";
}

/** Old API operations and other configured deployments must be reconciled first. */
export function assertNoConflictingRecovery(
  storage: Pick<Storage, "length" | "key" | "getItem">,
  currentKey: string,
  currentScope?: string,
) {
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (!key) continue;
    if (
      key.startsWith("paiflow:operation:v1:") &&
      storage.getItem(key)
    )
      throw new Error(
        "Legacy API payment evidence remains in this browser. Use legacy/api-2026-10-17 at the same origin to reconcile it before switching to the SDK starter. Do not delete the record.",
      );
    if (key.startsWith("paiflow-sdk-payment-v2:") && key !== currentKey) {
      const foreignScope = key.slice("paiflow-sdk-payment-v2:".length);
      // A same-scope legacy order is retained in place and is not loaded by
      // the new order flow. Do not inspect or rewrite its recovery payload.
      if (currentScope && foreignScope === currentScope) continue;
      const raw = storage.getItem(key);
      if (!raw) continue;
      const foreign = readRecovery(foreignScope, raw);
      if (terminal(foreign)) continue;
      throw new Error(
        "Payment evidence for another environment or deployment remains. Restore that configuration and reconcile the original record before starting another payment.",
      );
    }
    if (key.startsWith("paiflow-sdk-order-v3:") && key !== currentKey) {
      const suffix = key.slice("paiflow-sdk-order-v3:".length);
      const separator = suffix.lastIndexOf(":");
      if (separator < 0) throw new Error("Invalid order recovery key.");
      let otherScope: string;
      try {
        otherScope = decodeURIComponent(suffix.slice(0, separator));
      } catch {
        throw new Error("Invalid order recovery key.");
      }
      if (key === currentKey || (currentScope && otherScope === currentScope))
        continue;
      const orderReference = suffix.slice(separator + 1);
      const raw = storage.getItem(key);
      if (!raw) continue;
      const other = readOrderRecovery(otherScope, orderReference, raw);
      if (!terminal(other))
        throw new Error(
          "Payment evidence for another environment or order remains. Restore that context and reconcile the original record before starting another payment.",
        );
    }
  }
}
