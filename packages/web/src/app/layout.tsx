import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "RTK — Relationship Graph",
  description: "Radial relationship graph and event timeline",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-Hant">
      <body style={{ margin: 0, padding: 0 }}>{children}</body>
    </html>
  );
}
