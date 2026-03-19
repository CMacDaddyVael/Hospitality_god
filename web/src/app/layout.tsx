import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Hospitality God — AI Marketing Team for STR Owners",
  description:
    "Free listing audit + AI-powered marketing team for your Airbnb. Get a score, see what's broken, and get weekly content delivered to your inbox.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-white text-gray-900 antialiased">{children}</body>
    </html>
  );
}
