import type { Metadata } from "next";
import "./globals.css";
import "./likhapina.css";
export const metadata: Metadata = {
  title: "LikhaPiña · Source. Create. Connect.",
  description:
    "A fictional Aklan piña textile sourcing and production coordination demo.",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
