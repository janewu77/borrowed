import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MORE THAN ONCE",
  description: "MORE THAN ONCE. Occasion wear with more life: borrow, lend, and share.",
  icons: {
    icon: [{ url: "/favicon.png?v=20260913", type: "image/png", sizes: "512x512" }],
    shortcut: "/favicon.png?v=20260913",
    apple: "/favicon.png?v=20260913",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
