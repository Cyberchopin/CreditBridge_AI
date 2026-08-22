import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CreditBridge AI",
  description: "Autonomous transfer-credit operations with evidence-grounded recommendations and human-controlled decisions.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en"><body>{children}</body></html>
  );
}
