import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { StarterApp } from "@/components/starter-app";
import {
  configuration,
  publicConfig,
} from "@/lib/paiflow";
import { AMOUNT, ORDER_REFERENCE, PRODUCT_NAME } from "@/lib/types";
import type { PublicConfig } from "@/lib/types";
import { fromStroops } from "@/lib/amount";
import { fixtureAddress, fixturePrepared } from "./transaction-fixture";
import { envelopeHash } from "@/lib/transaction";
import { connectWallet } from "@/lib/wallet";
import type { Recovery } from "@/lib/recovery";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/wallet", () => ({
  connectWallet: vi.fn(),
  signPrepared: vi.fn(),
}));

const id = "12345678-1234-1234-1234-123456789abc";
const scope = `https://beta.app.paiflow.xyz/${id}`;
const key = `paiflow-sdk-payment-v2:${scope}`;
const txHash = envelopeHash(fixturePrepared.xdr);
const stored: Recovery = {
  version: 2,
  scope,
  address: fixtureAddress,
  prepared: { ...fixturePrepared, txHash },
  signedXdr: fixturePrepared.xdr,
};

let renderer: ReactTestRenderer | undefined;
let values: Map<string, string>;
function status(value: string) {
  return Response.json({ data: { txHash, network: "testnet", status: value } });
}
beforeEach(() => {
  renderer = undefined;
  values = new Map();
  vi.useFakeTimers();
  vi.clearAllMocks();
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("localStorage", {
    get length() {
      return values.size;
    },
    key: (i: number) => [...values.keys()][i] ?? null,
    getItem: (k: string) => values.get(k) ?? null,
    setItem: (k: string, v: string) => values.set(k, v),
    removeItem: (k: string) => values.delete(k),
  });
  vi.stubGlobal("navigator", {
    locks: {
      request: vi.fn(
        async (
          _key: string,
          _options: unknown,
          callback: (lock: object | null) => unknown,
        ) => callback({}),
      ),
    },
  });
  vi.stubGlobal("fetch", vi.fn(async () => status("UNKNOWN")));
  vi.stubEnv("PAIFLOW_BASE_URL", "https://beta.app.paiflow.xyz");
  vi.stubEnv("PAIFLOW_DEPLOYMENT_ID", id);
  vi.stubEnv("PAIFLOW_API_TOKEN", "pfd_" + "a".repeat(64));
});
afterEach(async () => {
  if (renderer) await act(() => renderer!.unmount());
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
async function mount(config?: PublicConfig) {
  await act(() => {
    renderer = create(
      <StarterApp
        config={config ?? { ready: true, scope, deploymentUrl: scope }}
      />,
    );
  });
}
function flatten(node: unknown): string {
  if (typeof node === "string" || typeof node === "number")
    return String(node);
  if (Array.isArray(node)) return node.map(flatten).join(" ");
  if (node && typeof node === "object" && "children" in node)
    return flatten((node as { children: unknown }).children);
  return "";
}
function text() {
  return flatten(renderer!.root.findByType("main"));
}
it("labels the demo order clearly and fixes 1 XLM in stroops", () => {
  expect(ORDER_REFERENCE).toMatch(/^LP-DEMO-/);
  expect(PRODUCT_NAME).toContain("Piña");
  expect(fromStroops(AMOUNT)).toBe("1");
  expect(AMOUNT).toBe("10000000");
});
it("serves optional recipient display settings without ever exposing credentials", () => {
  vi.stubEnv("PAYPROOF_RECIPIENT_LABEL", "Aklan Piña Weaver Cooperative (testnet)");
  vi.stubEnv("PAYPROOF_RECIPIENT_ADDRESS", fixtureAddress);
  const config = publicConfig();
  if (!config.ready) throw new Error("expected ready config");
  expect(config.recipientLabel).toContain("Piña");
  expect(config.recipientAddress).toBe(fixtureAddress);
  expect(JSON.stringify(config)).not.toContain("a".repeat(64));
  // Invalid or unsafe display values are dropped, payment config unaffected.
  vi.stubEnv("PAYPROOF_RECIPIENT_ADDRESS", "not-an-address");
  vi.stubEnv("PAYPROOF_RECIPIENT_LABEL", "bad<label\u0001");
  const cleaned = publicConfig();
  if (!cleaned.ready) throw new Error("expected ready config");
  expect(cleaned.recipientAddress).toBeUndefined();
  expect(cleaned.recipientLabel).toBeUndefined();
  expect(configuration().token).toBe("pfd_" + "a".repeat(64));
});
it("shows the demo order, safe recipient display and no receipt before any verified payment", async () => {
  await mount();
  const body = text();
  expect(body).toContain("LikhaPiña PayProof");
  expect(body).toContain(ORDER_REFERENCE);
  expect(body).toContain(PRODUCT_NAME);
  expect(body).toContain("HACKATHON DEMO");
  expect(body).toContain("not a real order");
  expect(body).toContain("the API never exposes recipient addresses");
  expect(
    renderer!.root.findAllByProps({ "data-testid": "payment-receipt" }),
  ).toHaveLength(0);
});
it("renders the operator-configured recipient label and truncated address", async () => {
  await mount({
    ready: true,
    scope,
    deploymentUrl: scope,
    recipientLabel: "Aklan Piña Weaver Cooperative (testnet)",
    recipientAddress: fixtureAddress,
  });
  const body = text();
  expect(body).toContain("Aklan Piña Weaver Cooperative (testnet)");
  // The full address is not printed in the summary panel.
  const panel = flatten(
    renderer!.root
      .findAllByType("section")
      .find((s) => s.props["aria-label"] === "Demo order summary")!
      .children,
  );
  expect(panel).not.toContain(fixtureAddress);
  expect(panel).toContain(fixtureAddress.slice(0, 8));
});
it("receipt shows hash and testnet explorer link only on SUCCESS status", async () => {
  // FAILED evidence: no receipt, no explorer link.
  values.set(
    key,
    JSON.stringify({ ...stored, attempted: true, status: "FAILED" }),
  );
  await mount();
  expect(
    renderer!.root.findAllByProps({ "data-testid": "payment-receipt" }),
  ).toHaveLength(0);
  // SUCCESS evidence: receipt appears with hash and testnet link only.
  await act(() =>
    renderer!.update(
      <StarterApp
        config={{ ready: true, scope, deploymentUrl: scope }}
      />,
    ),
  );
  renderer = undefined;
  values.set(
    key,
    JSON.stringify({ ...stored, attempted: true, status: "SUCCESS" }),
  );
  vi.mocked(fetch).mockResolvedValue(status("SUCCESS"));
  await mount();
  const receipts = renderer!.root.findAllByProps({
    "data-testid": "payment-receipt",
  });
  expect(receipts).toHaveLength(1);
  const links = renderer!.root
    .findAllByType("a")
    .map((a) => a.props.href as string);
  expect(links).toContain(
    `https://stellar.expert/explorer/testnet/tx/${txHash}`,
  );
  expect(links.some((h) => h.includes("mainnet"))).toBe(false);
});
it("unconfigured server disables initiation and shows the setup message", async () => {
  vi.stubEnv("PAIFLOW_API_TOKEN", "");
  const config = publicConfig();
  if (config.ready) throw new Error("expected unready config");
  await mount(config);
  expect(text()).toContain(config.message);
  expect(
    renderer!.root
      .findAllByType("button")
      .every((b) => b.props.disabled === true),
  ).toBe(true);
  expect(
    renderer!.root.findAllByProps({ "data-testid": "payment-receipt" }),
  ).toHaveLength(0);
});
