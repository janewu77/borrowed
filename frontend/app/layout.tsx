import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MORE — To wear, give, share",
  description: "Occasion wear with more life: borrow, lend, and share.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
