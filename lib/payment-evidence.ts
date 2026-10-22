/** Read-only, transaction-scoped event collection. Event payloads remain opaque. */
export type TransactionEvent = {
  id: string;
  eventId: string;
  kind: string;
  topic: string | null;
  ledger: number;
  txHash: string;
  occurredAt: string;
  /** Payload is deliberately not interpreted or returned to the browser. */
};

export type EventPage = {
  items: unknown[];
  nextCursor: string | null;
  hasMore: boolean;
};

export type EventEvidence = {
  txHash: string;
  events: TransactionEvent[];
  pagesRead: number;
  duplicateCount: number;
  invalidEventCount: number;
  complete: boolean;
  reason?: "PAGE_LIMIT" | "CURSOR_INVALID" | "INVALID_EVENTS";
};

type PageReader = (query: {
  txHash: string;
  cursor?: string;
  limit: number;
}) => Promise<EventPage>;

function parseEvent(value: unknown, txHash: string): TransactionEvent | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const event = value as Record<string, unknown>;
  if (
    typeof event.id !== "string" ||
    !event.id ||
    typeof event.eventId !== "string" ||
    !event.eventId ||
    typeof event.kind !== "string" ||
    !event.kind ||
    !(event.topic === null || typeof event.topic === "string") ||
    !Number.isSafeInteger(event.ledger) ||
    (event.ledger as number) < 0 ||
    typeof event.txHash !== "string" ||
    !/^[a-f0-9]{64}$/.test(event.txHash) ||
    event.txHash !== txHash ||
    typeof event.occurredAt !== "string" ||
    !Number.isFinite(Date.parse(event.occurredAt)) ||
    !("data" in event)
  )
    return null;
  return {
    id: event.id,
    eventId: event.eventId,
    kind: event.kind,
    topic: event.topic,
    ledger: event.ledger as number,
    txHash: event.txHash,
    occurredAt: event.occurredAt,
  };
}

/**
 * Reads bounded event pages, deduplicates by eventId, and marks any invalid,
 * mismatched, or truncated collection incomplete. It never interprets data.
 */
export async function collectTransactionEvents(
  txHash: string,
  readPage: PageReader,
  maxPages = 20,
): Promise<EventEvidence> {
  if (!/^[a-f0-9]{64}$/.test(txHash)) throw new Error("Invalid transaction hash.");
  if (!Number.isSafeInteger(maxPages) || maxPages < 1)
    throw new Error("Invalid event page limit.");

  const events: TransactionEvent[] = [];
  const eventIds = new Set<string>();
  const cursors = new Set<string>();
  let cursor: string | undefined;
  let pagesRead = 0;
  let duplicateCount = 0;
  let invalidEventCount = 0;

  while (pagesRead < maxPages) {
    const page = await readPage({ txHash, ...(cursor ? { cursor } : {}), limit: 100 });
    pagesRead++;
    if (!page || !Array.isArray(page.items) || typeof page.hasMore !== "boolean")
      throw new Error("Invalid Paiflow event page.");

    for (const value of page.items) {
      const event = parseEvent(value, txHash);
      if (!event) {
        invalidEventCount++;
        continue;
      }
      if (eventIds.has(event.eventId)) {
        duplicateCount++;
        continue;
      }
      eventIds.add(event.eventId);
      events.push(event);
    }

    if (!page.hasMore) {
      return {
        txHash,
        events,
        pagesRead,
        duplicateCount,
        invalidEventCount,
        complete: invalidEventCount === 0,
        ...(invalidEventCount ? { reason: "INVALID_EVENTS" as const } : {}),
      };
    }
    if (
      typeof page.nextCursor !== "string" ||
      !page.nextCursor ||
      cursors.has(page.nextCursor)
    )
      return {
        txHash,
        events,
        pagesRead,
        duplicateCount,
        invalidEventCount,
        complete: false,
        reason: "CURSOR_INVALID",
      };
    cursors.add(page.nextCursor);
    cursor = page.nextCursor;
  }

  return {
    txHash,
    events,
    pagesRead,
    duplicateCount,
    invalidEventCount,
    complete: false,
    reason: "PAGE_LIMIT",
  };
}
