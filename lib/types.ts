export const TESTNET = "Test SDF Network ; September 2015";
export const AMOUNT = "10000000";
/** Clearly-labelled demo order for the LikhaPiña PayProof hackathon demo. */
export const ORDER_REFERENCE = "LP-DEMO-0001";
export const PRODUCT_NAME = "Sample Aklan Piña Textile Order";
/** New simulated order; split values are display metadata, not deployment proof. */
export const NEW_DEMO_ORDER = {
  orderReference: "LP-DEMO-0002",
  productName: "Aklan Piña Weaver Cooperative Sample Order",
  amount: AMOUNT,
  network: "testnet" as const,
  expectedSplitBps: { weavers: 9000, platform: 1000 },
};
export type DemoOrder = typeof NEW_DEMO_ORDER;
export type Prepared = {
  xdr: string;
  network: "testnet" | "mainnet";
  networkPassphrase: string;
  expiresAt: string;
  preparationRequestId?: string;
  txHash: string;
};
export type PublicConfig =
  | { ready: false; message: string }
  | {
      ready: true;
      scope: string;
      deploymentUrl: string;
      /** Optional operator-configured display label for the deployment's recipient. */
      recipientLabel?: string;
      /** Optional operator-configured testnet recipient address, shown truncated. */
      recipientAddress?: string;
    };
export type Result = { txHash: string; status: string; network?: string };
