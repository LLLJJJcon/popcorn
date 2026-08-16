import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Popcorn",
  description: "Turn Chinese videos into language you can use",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
