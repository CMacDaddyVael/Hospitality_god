import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Hospitality God — AI CMO for Short-Term Rentals",
  description:
    "Autonomous AI marketing platform for STR owners. Optimize listings, manage reviews, automate guest comms, and grow your bookings — on autopilot.",
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
