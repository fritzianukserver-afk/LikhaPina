import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, expect, it, vi } from "vitest";
import { DemoStoreProvider, useDemoStore } from "@/components/demo-store";
import { DEMO_STORAGE_KEY, productionStages } from "@/lib/demo-data";

function Harness() {
  const { state, createRequest, createQuote, acceptQuote, advanceOrder } = useDemoStore();
  const requestId = state.requests[0]?.id;
  const quoteId = state.quotes.find((quote) => quote.requestId === requestId)?.id;
  const order = state.orders[0];
  return (
    <>
      <button onClick={() => createRequest({ material: "Pure Piña", blend: "Pure piña", quantity: 12, unit: "meters", width: "36 in", length: "12 m", use: "Barong", budget: 18000, deadline: "2026-12-20", destination: "Manila", notes: "Demo" })}>Create request</button>
      {requestId ? <button onClick={() => createQuote({ requestId, price: 17000, completion: "20 days", terms: "Demo terms", notes: "Sample" })}>Create quote</button> : null}
      {quoteId ? <button onClick={() => acceptQuote(quoteId)}>Accept quote</button> : null}
      {order ? <button onClick={() => advanceOrder(order.id)}>Advance order</button> : null}
      <output>{JSON.stringify({ requestCount: state.requests.length, quoteCount: state.quotes.length, orderCount: state.orders.length, orderStage: order ? productionStages[order.stage] : null })}</output>
    </>
  );
}

let renderer: ReactTestRenderer | undefined;
afterEach(async () => {
  if (renderer) await act(() => renderer!.unmount());
  renderer = undefined;
  vi.unstubAllGlobals();
});

it("connects a new request, producer quote, buyer acceptance and production update", async () => {
  const values = new Map<string, string>();
  const getItem = vi.fn((key: string) => values.get(key) ?? null);
  const setItem = vi.fn((key: string, value: string) => values.set(key, value));
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("localStorage", { getItem, setItem });

  await act(async () => {
    renderer = create(<DemoStoreProvider><Harness /></DemoStoreProvider>);
  });
  const press = async (label: string) => {
    const button = renderer!.root.findAllByType("button").find((item) => item.children.join("") === label)!;
    await act(async () => button.props.onClick());
  };
  await press("Create request");
  await press("Create quote");
  await press("Accept quote");
  await press("Advance order");

  const output = renderer!.root.findByType("output").children.join("");
  expect(JSON.parse(output)).toMatchObject({
    requestCount: 2,
    quoteCount: 2,
    orderCount: 1,
    orderStage: productionStages[1],
  });
  expect(getItem).toHaveBeenCalledWith(DEMO_STORAGE_KEY);
  expect(getItem.mock.calls.every(([key]) => key === DEMO_STORAGE_KEY)).toBe(true);
  expect([...values.keys()]).toEqual([DEMO_STORAGE_KEY]);
});
