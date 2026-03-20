import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Hospitality God — AI Marketing Team for Your Rental",
  description:
    "Paste your Airbnb URL. Get a free audit, optimized copy, lifestyle photos, and weekly content — all powered by AI. $59/mo.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="scroll-smooth">
      <body className="bg-surface-subtle text-stone-900 antialiased">{children}</body>
    </html>
  );
}
