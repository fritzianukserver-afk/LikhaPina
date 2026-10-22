import { expect, it, vi } from "vitest";
import { collectTransactionEvents } from "@/lib/payment-evidence";

const hash = "a".repeat(64);
function event(overrides: Record<string, unknown> = {}) {
  return {
    id: "row-1",
    eventId: "event-1",
    kind: "PAYOUT",
    topic: null,
    ledger: 10,
    txHash: hash,
    occurredAt: "2026-10-22T00:00:00Z",
    data: { arbitrary: "opaque" },
    ...overrides,
  };
}
function page(items: unknown[], nextCursor: string | null = null, hasMore = false) {
  return { items, nextCursor, hasMore };
}

it("follows nextCursor/hasMore and deduplicates events by eventId", async () => {
  const read = vi.fn()
    .mockResolvedValueOnce(page([event()], "cursor-1", true))
    .mockResolvedValueOnce(page([event({ id: "row-2" }), event({ eventId: "event-2" })]));
  const result = await collectTransactionEvents(hash, read);
  expect(result).toMatchObject({
    complete: true,
    pagesRead: 2,
    duplicateCount: 1,
    invalidEventCount: 0,
  });
  expect(result.events.map((e) => e.eventId)).toEqual(["event-1", "event-2"]);
  expect(read).toHaveBeenNthCalledWith(1, { txHash: hash, limit: 100 });
  expect(read).toHaveBeenNthCalledWith(2, { txHash: hash, cursor: "cursor-1", limit: 100 });
  expect(JSON.stringify(result)).not.toContain("arbitrary");
});

it("reports a complete empty page set without interpreting absence as failure", async () => {
  const result = await collectTransactionEvents(hash, async () => page([]));
  expect(result).toMatchObject({ complete: true, events: [], pagesRead: 1 });
});

it("allows delayed events to appear on a later read without treating the empty read as failure", async () => {
  const read = vi.fn()
    .mockResolvedValueOnce(page([]))
    .mockResolvedValueOnce(page([event()]));
  const first = await collectTransactionEvents(hash, read);
  const later = await collectTransactionEvents(hash, read);
  expect(first).toMatchObject({ complete: true, events: [] });
  expect(later).toMatchObject({ complete: true, events: [{ eventId: "event-1" }] });
});

it("marks page-cap and invalid cursor results incomplete", async () => {
  const pageLimited = await collectTransactionEvents(
    hash,
    async () => page([], "next", true),
    1,
  );
  expect(pageLimited).toMatchObject({ complete: false, reason: "PAGE_LIMIT" });
  const cursorLoop = await collectTransactionEvents(hash, async () => page([], "same", true), 3);
  expect(cursorLoop).toMatchObject({ complete: false, reason: "CURSOR_INVALID", pagesRead: 2 });
});

it("excludes mismatched hashes and unknown event schemas from complete evidence", async () => {
  const result = await collectTransactionEvents(hash, async () =>
    page([
      event({ txHash: "b".repeat(64) }),
      { eventId: "unknown-schema", txHash: hash, data: { payout: true } },
    ]),
  );
  expect(result).toMatchObject({ complete: false, reason: "INVALID_EVENTS", invalidEventCount: 2 });
  expect(result.events).toEqual([]);
});

it("never derives verified payouts from a SUCCESS transaction or opaque event data", async () => {
  const result = await collectTransactionEvents(hash, async () => page([event()]));
  expect(result.complete).toBe(true);
  expect(result.events).toHaveLength(1);
  expect(result.events[0]).not.toHaveProperty("data");
  expect(result).not.toHaveProperty("verifiedPayouts");
});

it("retains unfamiliar documented event kinds as raw metadata without assigning payout meaning", async () => {
  const result = await collectTransactionEvents(hash, async () =>
    page([event({ kind: "FUTURE_EVENT_KIND" })]),
  );
  expect(result.complete).toBe(true);
  expect(result.events[0]?.kind).toBe("FUTURE_EVENT_KIND");
  expect(result.events[0]).not.toHaveProperty("data");
  expect(result).not.toHaveProperty("verifiedPayouts");
});
