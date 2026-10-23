import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { Keypair } from "@stellar/stellar-sdk";
import { StarterApp } from "@/components/starter-app";
import { fixtureAddress, fixturePrepared } from "./transaction-fixture";
import { envelopeHash } from "@/lib/transaction";
import { NEW_DEMO_ORDER } from "@/lib/types";
import { orderRecoveryKey } from "@/lib/recovery";
import { legacyRecoveryKey } from "@/lib/recovery";
import { connectWallet, signPrepared } from "@/lib/wallet";
vi.mock("@/lib/wallet", () => ({
  connectWallet: vi.fn(),
  signPrepared: vi.fn(),
}));
// Deterministic test-only public account, different from the recorded consenting wallet.
const otherAddress = Keypair.fromRawEd25519Seed(
  Buffer.alloc(32, 8),
).publicKey();
const scope =
  "https://beta.app.paiflow.xyz/12345678-1234-1234-1234-123456789abc";
const key = orderRecoveryKey(scope, NEW_DEMO_ORDER.orderReference);
const stored = {
  version: 3,
  orderReference: NEW_DEMO_ORDER.orderReference,
  scope,
  address: fixtureAddress,
  prepared: { ...fixturePrepared, txHash: envelopeHash(fixturePrepared.xdr) },
  signedXdr: fixturePrepared.xdr,
};
let renderer: ReactTestRenderer | undefined;
let values: Map<string, string>;
let lockAvailable = true;
function action(options?: RequestInit) {
  return JSON.parse(options?.body as string).action as string;
}
function status(value: string, hash = stored.prepared.txHash) {
  return Response.json({
    data: { txHash: hash, network: "testnet", status: value },
  });
}
function saved() {
  return JSON.parse(values.get(key)!);
}
function stalledResponse(options?: RequestInit) {
  return new Promise<Response>((_resolve, reject) => {
    options!.signal!.addEventListener(
      "abort",
      () => reject(new DOMException("Response deadline", "AbortError")),
      { once: true },
    );
  });
}
beforeEach(() => {
  renderer = undefined;
  values = new Map();
  lockAvailable = true;
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
        ) => callback(lockAvailable ? {} : null),
      ),
    },
  });
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => status("UNKNOWN")),
  );
});
afterEach(async () => {
  if (renderer) await act(() => renderer!.unmount());
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
async function mount() {
  await act(() => {
    renderer = create(
      <StarterApp config={{ ready: true, scope, deploymentUrl: scope }} />,
    );
  });
}
function button(label: string) {
  return renderer!.root
    .findAllByType("button")
    .find((b) => b.children.join("") === label)!;
}
function message() {
  const feedback = [
    ...renderer!.root.findAllByProps({ role: "status" }),
    ...renderer!.root.findAllByProps({ role: "alert" }),
  ].find((node) => node.props["data-testid"] === "payproof-feedback");
  return feedback?.children.join("") ?? "";
}
function flatten(node: unknown): string {
  if (typeof node === "string" || typeof node === "number")
    return String(node);
  if (Array.isArray(node)) return node.map(flatten).join(" ");
  if (node && typeof node === "object" && "children" in node)
    return flatten((node as { children: unknown }).children);
  return "";
}
function appText() {
  return flatten(renderer!.root.findByType("main").children);
}
async function click(label: string) {
  await act(async () => {
    void button(label).props.onClick();
  });
}
async function tick(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}
it("shows action-specific Freighter connection progress and success feedback", async () => {
  let resolveWallet!: (address: string) => void;
  vi.mocked(connectWallet).mockReturnValue(
    new Promise((resolve) => { resolveWallet = resolve; }),
  );
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => Response.json({ data: { ready: true } })),
  );
  await mount();
  await click("Connect Freighter");
  expect(appText()).toContain("Checking integration and waiting for Freighter access");
  await act(async () => {
    resolveWallet(fixtureAddress);
    await Promise.resolve();
  });
  await tick(0);
  expect(message()).toContain("Freighter connected. Selected public address is shown below.");
  expect(appText()).toContain(fixtureAddress);
  expect(appText()).toContain("Connected to Freighter");
});

it("submit RPC timeout keeps exact signed evidence, checks UNKNOWN then SUCCESS, and never automatically resubmits or prepares", async () => {
  values.set(key, JSON.stringify(stored));
  let checks = 0;
  const actions: string[] = [];
  vi.mocked(fetch).mockImplementation(async (_url, options) => {
    const kind = action(options);
    actions.push(kind);
    expect(saved().signedXdr).toBe(stored.signedXdr);
    expect(saved().attempted).toBe(true);
    if (kind === "submit")
      return Response.json(
        {
          error: { code: "UPSTREAM_RPC", message: "Confirmation unavailable" },
        },
        { status: 502 },
      );
    expect(JSON.parse(options!.body as string).txHash).toBe(
      stored.prepared.txHash,
    );
    return status(++checks === 1 ? "UNKNOWN" : "SUCCESS");
  });
  await mount();
  const onClick = button("Submit saved envelope").props.onClick;
  await act(async () => {
    void onClick();
    void onClick();
  });
  expect(message()).toContain("Confirmation pending");
  expect(saved().status).toBe("UNKNOWN");
  expect(button("Retry exact saved envelope").props.disabled).toBe(true);
  await tick(1000);
  expect(saved().status).toBe("SUCCESS");
  expect(message()).toContain("Original transaction confirmed");
  expect(actions).toEqual(["submit", "status", "status"]);
  expect(button("Acknowledge final result and clear").props.disabled).toBe(
    false,
  );
});
it("reload automatically resumes only original-hash reads with the same signed evidence", async () => {
  values.set(key, JSON.stringify({ ...stored, attempted: true }));
  vi.mocked(fetch).mockImplementation(async (_url, options) => {
    expect(action(options)).toBe("status");
    expect(JSON.parse(options!.body as string).txHash).toBe(
      stored.prepared.txHash,
    );
    return status("SUCCESS");
  });
  await mount();
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(saved().signedXdr).toBe(stored.signedXdr);
  expect(saved().status).toBe("SUCCESS");
});
it("bounded reload recovery retains UNKNOWN evidence and leaves manual original lookup available", async () => {
  values.set(key, JSON.stringify({ ...stored, attempted: true }));
  await mount();
  await tick(30000);
  expect(fetch).toHaveBeenCalledTimes(6);
  expect(saved().status).toBe("UNKNOWN");
  expect(message()).toContain("Use Check original transaction to resume");
  expect(button("Check original transaction").props.disabled).toBe(false);
  expect(button("Acknowledge final result and clear").props.disabled).toBe(
    true,
  );
  vi.mocked(fetch).mockResolvedValue(status("SUCCESS"));
  await click("Check original transaction");
  expect(saved().status).toBe("SUCCESS");
});
it("Stop checking aborts only recovery reads and ignores their late SUCCESS response", async () => {
  values.set(key, JSON.stringify({ ...stored, attempted: true }));
  let resolve!: (response: Response) => void;
  let signal: AbortSignal | undefined;
  vi.mocked(fetch).mockImplementation((_url, options) => {
    expect(action(options)).toBe("status");
    signal = options!.signal as AbortSignal;
    return new Promise<Response>((r) => {
      resolve = r;
    });
  });
  await mount();
  await click("Stop checking");
  expect(signal!.aborted).toBe(true);
  await act(async () => {
    resolve(status("SUCCESS"));
  });
  expect(saved().status).toBeUndefined();
  expect(message()).toContain("Original evidence is retained");
  expect(button("Check original transaction").props.disabled).toBe(false);
});
it("scope change aborts a pending lookup and prevents late writes or success UI in another deployment", async () => {
  values.set(key, JSON.stringify({ ...stored, attempted: true }));
  const original = values.get(key);
  let resolve!: (response: Response) => void;
  vi.mocked(fetch).mockImplementation(
    () =>
      new Promise<Response>((r) => {
        resolve = r;
      }),
  );
  await mount();
  await act(() =>
    renderer!.update(
      <StarterApp
        config={{
          ready: true,
          scope: scope + "-other",
          deploymentUrl: scope + "-other",
        }}
      />,
    ),
  );
  await act(async () => {
    resolve(status("SUCCESS"));
  });
  expect(values.get(key)).toBe(original);
  expect(values.has(key + "-other")).toBe(false);
  expect(message()).not.toContain("Original transaction confirmed");
  expect(button("Prepare 1 XLM payment").props.disabled).toBe(true);
});
it("unmount aborts original lookups and late responses cannot persist confirmation", async () => {
  values.set(key, JSON.stringify({ ...stored, attempted: true }));
  const original = values.get(key);
  let resolve!: (response: Response) => void;
  let signal: AbortSignal | undefined;
  vi.mocked(fetch).mockImplementation((_url, options) => {
    signal = options!.signal as AbortSignal;
    return new Promise<Response>((r) => {
      resolve = r;
    });
  });
  await mount();
  await act(() => renderer!.unmount());
  renderer = undefined;
  expect(signal!.aborted).toBe(true);
  await act(async () => {
    resolve(status("SUCCESS"));
  });
  expect(values.get(key)).toBe(original);
});
it("explicit REJECTED response is retained as nonfinal without automatic retry or replacement", async () => {
  values.set(key, JSON.stringify(stored));
  vi.mocked(fetch).mockResolvedValue(status("REJECTED"));
  await mount();
  await click("Submit saved envelope");
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(saved().status).toBe("REJECTED");
  expect(saved().signedXdr).toBe(stored.signedXdr);
  expect(button("Acknowledge final result and clear").props.disabled).toBe(
    true,
  );
  expect(button("Check original transaction").props.disabled).toBe(false);
});
it("validation refusal is shown without starting automatic confirmation calls", async () => {
  values.set(key, JSON.stringify(stored));
  vi.mocked(fetch).mockResolvedValue(
    Response.json(
      { error: { code: "VALIDATION", message: "Invalid envelope" } },
      { status: 422 },
    ),
  );
  await mount();
  await click("Submit saved envelope");
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(message()).toContain("VALIDATION");
  expect(saved().signedXdr).toBe(stored.signedXdr);
  expect(button("Acknowledge final result and clear").props.disabled).toBe(
    true,
  );
});
it("wallet cancellation leaves the original unsigned preparation and performs no submit or automatic lookup", async () => {
  values.set(key, JSON.stringify({ ...stored, signedXdr: undefined }));
  vi.mocked(fetch).mockResolvedValue(Response.json({ data: {} }));
  vi.mocked(connectWallet).mockResolvedValue(fixtureAddress);
  vi.mocked(signPrepared).mockRejectedValue(
    new Error("Wallet request cancelled"),
  );
  await mount();
  await click("Connect Freighter");
  await click("Sign original transaction");
  expect(message()).toContain("Wallet request cancelled");
  expect(saved().signedXdr).toBeUndefined();
  expect(saved().attempted).toBeUndefined();
  expect(fetch).toHaveBeenCalledTimes(1); // integration readiness, not payment submit/status
});
it("another tab owning the Web Lock prevents submit and preserves evidence", async () => {
  values.set(key, JSON.stringify(stored));
  await mount();
  lockAvailable = false;
  await click("Submit saved envelope");
  expect(fetch).not.toHaveBeenCalled();
  expect(values.get(key)).toBe(JSON.stringify(stored));
});
it("unreadable storage blocks all new payments instead of discarding evidence", async () => {
  values.set(key, "corrupt recovery");
  await mount();
  expect(button("Connect Freighter").props.disabled).toBe(true);
  expect(fetch).not.toHaveBeenCalled();
  expect(values.get(key)).toBe("corrupt recovery");
});
it("storage write failure prevents submission", async () => {
  values.set(key, JSON.stringify(stored));
  await mount();
  vi.stubGlobal("localStorage", {
    length: 1,
    key: () => key,
    getItem: () => JSON.stringify(stored),
    setItem: () => {
      throw new Error("quota");
    },
  });
  await click("Submit saved envelope");
  expect(fetch).not.toHaveBeenCalled();
});
it("a lost submit response times out as ambiguous and checks the original without another financial request", async () => {
  values.set(key, JSON.stringify(stored));
  const actions: string[] = [];
  vi.mocked(fetch).mockImplementation((_url, options) => {
    const kind = action(options);
    actions.push(kind);
    if (kind === "status") return Promise.resolve(status("SUCCESS"));
    return new Promise<Response>((_resolve, reject) => {
      options!.signal!.addEventListener(
        "abort",
        () => reject(new DOMException("Response lost", "AbortError")),
        { once: true },
      );
    });
  });
  await mount();
  await click("Submit saved envelope");
  expect(saved().attempted).toBe(true);
  expect(
    renderer!.root
      .findAllByType("button")
      .some((b) => b.children.join("") === "Stop checking"),
  ).toBe(false);
  await tick(29999);
  expect(actions).toEqual(["submit"]);
  expect(saved().signedXdr).toBe(stored.signedXdr);
  await tick(1);
  expect(actions).toEqual(["submit", "status"]);
  expect(saved().status).toBe("SUCCESS");
  expect(saved().signedXdr).toBe(stored.signedXdr);
});
it("a 20-second submit response succeeds without an early abort or duplicate financial action", async () => {
  values.set(key, JSON.stringify(stored));
  const actions: string[] = [];
  let submitSignal: AbortSignal | undefined;
  vi.mocked(fetch).mockImplementation((_url, options) => {
    const kind = action(options);
    actions.push(kind);
    if (kind === "status") return Promise.resolve(status("SUCCESS"));
    submitSignal = options!.signal as AbortSignal;
    expect(saved().attempted).toBe(true);
    expect(saved().signedXdr).toBe(stored.signedXdr);
    return new Promise<Response>((resolve, reject) => {
      const timer = setTimeout(() => resolve(status("PENDING")), 20000);
      submitSignal!.addEventListener(
        "abort",
        () => {
          clearTimeout(timer);
          reject(new DOMException("Response deadline", "AbortError"));
        },
        { once: true },
      );
    });
  });
  await mount();
  await click("Submit saved envelope");
  await tick(19999);
  expect(submitSignal!.aborted).toBe(false);
  expect(actions).toEqual(["submit"]);
  await tick(1);
  expect(saved().status).toBe("SUCCESS");
  expect(actions).toEqual(["submit", "status"]);
  expect(signPrepared).not.toHaveBeenCalled();
});
it("preparation stops at 30 seconds without signing, submitting or creating replacement evidence", async () => {
  vi.mocked(connectWallet).mockResolvedValue(fixtureAddress);
  let signal: AbortSignal | undefined;
  vi.mocked(fetch)
    .mockResolvedValueOnce(Response.json({ data: {} }))
    .mockImplementation((_url, options) => {
      expect(action(options)).toBe("prepare");
      signal = options!.signal as AbortSignal;
      return stalledResponse(options);
    });
  await mount();
  await click("Connect Freighter");
  await click("Prepare 1 XLM payment");
  await tick(29999);
  expect(signal!.aborted).toBe(false);
  expect(button("Prepare 1 XLM payment").props.disabled).toBe(true);
  await tick(1);
  expect(signal!.aborted).toBe(true);
  expect(message()).toContain("Response deadline");
  expect(values.size).toBe(0);
  expect(fetch).toHaveBeenCalledTimes(2); // one integration read and one preparation
  expect(signPrepared).not.toHaveBeenCalled();
  expect(button("Prepare 1 XLM payment").props.disabled).toBe(false);
});
it("manual status stops at 30 seconds and retains the exact original signed record", async () => {
  values.set(key, JSON.stringify(stored));
  const original = values.get(key);
  let signal: AbortSignal | undefined;
  vi.mocked(fetch).mockImplementation((_url, options) => {
    expect(action(options)).toBe("status");
    expect(JSON.parse(options!.body as string).txHash).toBe(
      stored.prepared.txHash,
    );
    signal = options!.signal as AbortSignal;
    return stalledResponse(options);
  });
  await mount();
  await click("Check original transaction");
  await tick(29999);
  expect(signal!.aborted).toBe(false);
  await tick(1);
  expect(signal!.aborted).toBe(true);
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(values.get(key)).toBe(original);
  expect(button("Check original transaction").props.disabled).toBe(false);
});
it("automatic confirmation gives a later stalled lookup only the remaining overall window", async () => {
  values.set(key, JSON.stringify({ ...stored, attempted: true }));
  const signals: AbortSignal[] = [];
  vi.mocked(fetch).mockImplementation((_url, options) => {
    expect(action(options)).toBe("status");
    signals.push(options!.signal as AbortSignal);
    if (signals.length === 1)
      return new Promise<Response>((resolve) =>
        setTimeout(() => resolve(status("UNKNOWN")), 20000),
      );
    return stalledResponse(options);
  });
  await mount();
  await tick(21000);
  expect(fetch).toHaveBeenCalledTimes(2);
  expect(saved().status).toBe("UNKNOWN");
  await tick(8999);
  expect(signals[1]!.aborted).toBe(false);
  await tick(1);
  expect(signals[1]!.aborted).toBe(true);
  expect(fetch).toHaveBeenCalledTimes(2);
  expect(message()).toContain("Original evidence is retained");
  expect(saved().signedXdr).toBe(stored.signedXdr);
  expect(saved().attempted).toBe(true);
  expect(button("Check original transaction").props.disabled).toBe(false);
});
it("rerendering the same scope does not restart or duplicate bounded confirmation", async () => {
  values.set(key, JSON.stringify({ ...stored, attempted: true }));
  vi.mocked(fetch)
    .mockResolvedValueOnce(status("UNKNOWN"))
    .mockResolvedValue(status("SUCCESS"));
  await mount();
  await act(() =>
    renderer!.update(
      <StarterApp config={{ ready: true, scope, deploymentUrl: scope }} />,
    ),
  );
  expect(fetch).toHaveBeenCalledTimes(1);
  await tick(1000);
  expect(fetch).toHaveBeenCalledTimes(2);
  expect(saved().status).toBe("SUCCESS");
});
it("a late preparation reply after scope change cannot create a record in either scope", async () => {
  vi.mocked(connectWallet).mockResolvedValue(fixtureAddress);
  let resolve!: (response: Response) => void;
  vi.mocked(fetch)
    .mockResolvedValueOnce(Response.json({ data: {} }))
    .mockImplementation(
      () =>
        new Promise<Response>((r) => {
          resolve = r;
        }),
    );
  await mount();
  await click("Connect Freighter");
  await click("Prepare 1 XLM payment");
  await act(() =>
    renderer!.update(
      <StarterApp
        config={{
          ready: true,
          scope: scope + "-other",
          deploymentUrl: scope + "-other",
        }}
      />,
    ),
  );
  await act(async () => {
    resolve(Response.json({ data: stored.prepared }));
  });
  expect(values.size).toBe(0);
  expect(message()).not.toContain("Prepared and saved");
});
it("late wallet signing after unmount cannot overwrite the saved preparation", async () => {
  values.set(key, JSON.stringify({ ...stored, signedXdr: undefined }));
  vi.mocked(connectWallet).mockResolvedValue(fixtureAddress);
  vi.mocked(fetch).mockResolvedValue(Response.json({ data: {} }));
  let resolve!: (xdr: string) => void;
  vi.mocked(signPrepared).mockImplementation(
    () =>
      new Promise<string>((r) => {
        resolve = r;
      }),
  );
  await mount();
  await click("Connect Freighter");
  await click("Sign original transaction");
  const original = values.get(key);
  await act(() => renderer!.unmount());
  renderer = undefined;
  await act(async () => {
    resolve(stored.signedXdr);
  });
  expect(values.get(key)).toBe(original);
  expect(saved().signedXdr).toBeUndefined();
});
it("late submit success after scope change cannot start confirmation or write to the new scope", async () => {
  values.set(key, JSON.stringify(stored));
  let resolve!: (response: Response) => void;
  vi.mocked(fetch).mockImplementation(
    () =>
      new Promise<Response>((r) => {
        resolve = r;
      }),
  );
  await mount();
  await click("Submit saved envelope");
  const original = values.get(key);
  await act(() =>
    renderer!.update(
      <StarterApp
        config={{
          ready: true,
          scope: scope + "-other",
          deploymentUrl: scope + "-other",
        }}
      />,
    ),
  );
  await act(async () => {
    resolve(status("SUCCESS"));
  });
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(values.get(key)).toBe(original);
  expect(values.has(key + "-other")).toBe(false);
  expect(message()).not.toContain("Original transaction confirmed");
});
it("reload checks an earlier REJECTED response without treating it as final failure", async () => {
  values.set(
    key,
    JSON.stringify({ ...stored, attempted: true, status: "REJECTED" }),
  );
  vi.mocked(fetch).mockResolvedValue(status("SUCCESS"));
  await mount();
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(action(vi.mocked(fetch).mock.calls[0]?.[1])).toBe("status");
  expect(saved().status).toBe("SUCCESS");
});
it("sign and check explain when no payment record exists instead of doing nothing", async () => {
  await mount();
  expect(button("Sign original transaction").props.disabled).toBe(true);
  expect(button("Check original transaction").props.disabled).toBe(true);
  await click("Check original transaction");
  expect(message()).toContain("No saved payment record");
  await click("Sign original transaction");
  expect(message()).toContain("No saved payment record");
  expect(fetch).not.toHaveBeenCalled();
});
it("sign stays disabled until the original consenting wallet is connected", async () => {
  values.set(key, JSON.stringify({ ...stored, signedXdr: undefined }));
  await mount();
  expect(button("Sign original transaction").props.disabled).toBe(true);
  vi.mocked(connectWallet).mockResolvedValue(otherAddress);
  await click("Connect Freighter");
  expect(button("Sign original transaction").props.disabled).toBe(true);
  vi.mocked(connectWallet).mockResolvedValue(fixtureAddress);
  await click("Connect Freighter");
  expect(button("Sign original transaction").props.disabled).toBe(false);
});
it("sign explains instead of signing when a different wallet is connected", async () => {
  values.set(key, JSON.stringify({ ...stored, signedXdr: undefined }));
  await mount();
  vi.mocked(connectWallet).mockResolvedValue(otherAddress);
  await click("Connect Freighter");
  await click("Sign original transaction");
  expect(message()).toContain("Connect the original consenting wallet");
  expect(signPrepared).not.toHaveBeenCalled();
});
it("sign explains when the exact signed envelope is already saved", async () => {
  values.set(key, JSON.stringify(stored));
  await mount();
  expect(button("Sign original transaction").props.disabled).toBe(true);
  await click("Sign original transaction");
  expect(message()).toContain("Signed envelope already saved");
  expect(saved().signedXdr).toBe(stored.signedXdr);
  expect(fetch).not.toHaveBeenCalled();
});
it("sign explains when the original transaction is already final", async () => {
  values.set(
    key,
    JSON.stringify({
      ...stored,
      signedXdr: undefined,
      attempted: true,
      status: "SUCCESS",
    }),
  );
  await mount();
  expect(button("Sign original transaction").props.disabled).toBe(true);
  await click("Sign original transaction");
  expect(message()).toContain("already final");
  expect(saved().status).toBe("SUCCESS");
  expect(fetch).not.toHaveBeenCalled();
});
it("shows visible guidance when no payment record is saved", async () => {
  await mount();
  const note = renderer!.root.findByProps({ role: "note" });
  expect(note.children.join("")).toContain("No saved payment record");
  expect(button("Sign original transaction").props.disabled).toBe(true);
  expect(button("Check original transaction").props.disabled).toBe(true);
});
it("hides the missing-record guidance once a payment record exists", async () => {
  values.set(key, JSON.stringify(stored));
  await mount();
  expect(renderer!.root.findAllByProps({ role: "note" })).toHaveLength(0);
});
it("a signing timeout keeps the unsigned preparation and never submits", async () => {
  values.set(key, JSON.stringify({ ...stored, signedXdr: undefined }));
  vi.mocked(connectWallet).mockResolvedValue(fixtureAddress);
  vi.mocked(signPrepared).mockRejectedValue(
    new Error(
      "Freighter did not answer the signing request in time. Open the extension, finish or dismiss the pending request, then try again. The original payment record is kept.",
    ),
  );
  await mount();
  await click("Connect Freighter");
  await click("Sign original transaction");
  expect(message()).toContain("did not answer the signing request in time");
  expect(saved().signedXdr).toBeUndefined();
  expect(saved().attempted).toBeUndefined();
  expect(saved().prepared.txHash).toBe(stored.prepared.txHash);
  expect(fetch).toHaveBeenCalledTimes(1); // integration readiness only, no payment action
});
it("shows the new order as not started and preserves a same-scope legacy record without reading it", async () => {
  const oldKey = legacyRecoveryKey(scope);
  const legacyRaw = "legacy-recovery-fixture-preserved-byte-for-byte";
  values.set(oldKey, legacyRaw);
  const getItem = vi.spyOn(localStorage, "getItem");

  await mount();

  expect(appText()).toContain("New simulated order");
  expect(appText()).toContain(NEW_DEMO_ORDER.orderReference);
  expect(appText()).toContain("Transaction status Not started");
  expect(appText().replace(/\s+/g, " ")).toContain(
    "Legacy order — LP-DEMO-0001",
  );
  expect(getItem).not.toHaveBeenCalledWith(oldKey);
  expect(values.get(oldKey)).toBe(legacyRaw);
  expect(values.has(key)).toBe(false);
  expect(connectWallet).not.toHaveBeenCalled();
  expect(fetch).not.toHaveBeenCalled();
});

it("keeps transaction SUCCESS separate from complete but unverified event evidence", async () => {
  values.set(key, JSON.stringify({ ...stored, status: "SUCCESS" }));
  vi.mocked(fetch).mockImplementation(async (_url, options) => {
    expect(action(options)).toBe("events");
    return Response.json({
      data: {
        txHash: stored.prepared.txHash,
        events: [],
        pagesRead: 1,
        duplicateCount: 0,
        invalidEventCount: 0,
        complete: true,
      },
    });
  });
  await mount();
  expect(appText()).toContain("Transaction status SUCCESS");
  await click("Read original transaction events");
  expect(appText()).toMatch(/Evidence state:\s+UNVERIFIED SPLIT/);
  expect(appText()).toContain("VERIFIED PAYOUTS");
  expect(appText()).toContain("conclusion is available");
  expect(renderer!.root.findAllByProps({ "data-testid": "payment-receipt" })).toHaveLength(1);
});
