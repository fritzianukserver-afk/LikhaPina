import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "LikhaPiña PayProof",
  description:
    "Hackathon demo: blockchain-verifiable 1 XLM testnet payment for a simulated LikhaPiña Aklan piña order",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
