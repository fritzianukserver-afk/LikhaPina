"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  DEMO_STORAGE_KEY,
  initialDemoState,
  producers,
  productionStages,
  type DemoQuote,
  type DemoState,
  type SourcingRequest,
} from "@/lib/demo-data";

type NewRequest = Omit<SourcingRequest, "id" | "createdAt" | "buyer">;
type NewQuote = Pick<DemoQuote, "requestId" | "price" | "completion" | "terms" | "notes">;
type DemoStore = {
  state: DemoState;
  hydrated: boolean;
  createRequest: (input: NewRequest) => string;
  createQuote: (input: NewQuote) => string;
  acceptQuote: (quoteId: string) => void;
  advanceOrder: (orderId: string) => void;
};

const StoreContext = createContext<DemoStore | null>(null);

function validState(value: unknown): value is DemoState {
  if (!value || typeof value !== "object") return false;
  const data = value as Partial<DemoState>;
  return Array.isArray(data.requests) && Array.isArray(data.quotes) && Array.isArray(data.orders);
}

export function DemoStoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState(initialDemoState);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const saved = globalThis.localStorage.getItem(DEMO_STORAGE_KEY);
      if (saved) {
        const parsed: unknown = JSON.parse(saved);
        if (validState(parsed)) setState(parsed);
      }
    } catch {
      // Keep the in-memory seed available if the demo-only store is unavailable.
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      globalThis.localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Interactions continue in memory for this session.
    }
  }, [hydrated, state]);

  const createRequest = useCallback((input: NewRequest) => {
    const id = `REQ-${1001 + Date.now().toString().slice(-4)}`;
    setState((current) => ({
      ...current,
      requests: [
        { ...input, id, buyer: "Amihan Atelier", createdAt: new Date().toISOString() },
        ...current.requests,
      ],
    }));
    return id;
  }, []);

  const createQuote = useCallback((input: NewQuote) => {
    const request = state.requests.find((item) => item.id === input.requestId);
    if (!request) throw new Error("That sourcing request is no longer available.");
    const producer = producers[0]!;
    const id = `QUO-${1001 + Date.now().toString().slice(-4)}`;
    setState((current) => ({
      ...current,
      quotes: [
        {
          ...input,
          id,
          producerSlug: producer.slug,
          producer: producer.name,
          material: request.material,
          quantity: request.quantity,
          unit: request.unit,
          status: "Pending",
        },
        ...current.quotes,
      ],
    }));
    return id;
  }, [state.requests]);

  const acceptQuote = useCallback((quoteId: string) => {
    setState((current) => {
      const quote = current.quotes.find((item) => item.id === quoteId);
      if (!quote || quote.status !== "Pending") return current;
      const request = current.requests.find((item) => item.id === quote.requestId);
      if (!request || current.orders.some((item) => item.requestId === request.id)) return current;
      const orderId = `LP-DEMO-ORDER-${String(current.orders.length + 1).padStart(3, "0")}`;
      return {
        ...current,
        quotes: current.quotes.map((item) =>
          item.requestId !== quote.requestId
            ? item
            : { ...item, status: item.id === quote.id ? "Accepted" : item.status === "Pending" ? "Declined" : item.status },
        ),
        orders: [
          {
            id: orderId,
            requestId: request.id,
            quoteId: quote.id,
            buyer: request.buyer,
            producer: quote.producer,
            material: quote.material,
            quantity: quote.quantity,
            unit: quote.unit,
            price: quote.price,
            completion: quote.completion,
            stage: 0,
            createdAt: new Date().toISOString(),
          },
          ...current.orders,
        ],
      };
    });
  }, []);

  const advanceOrder = useCallback((orderId: string) => {
    setState((current) => ({
      ...current,
      orders: current.orders.map((order) =>
        order.id === orderId
          ? { ...order, stage: Math.min(order.stage + 1, productionStages.length - 1) }
          : order,
      ),
    }));
  }, []);

  const value = useMemo(
    () => ({ state, hydrated, createRequest, createQuote, acceptQuote, advanceOrder }),
    [state, hydrated, createRequest, createQuote, acceptQuote, advanceOrder],
  );
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useDemoStore() {
  const value = useContext(StoreContext);
  if (!value) throw new Error("DemoStoreProvider is missing.");
  return value;
}
