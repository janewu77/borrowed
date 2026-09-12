import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MORE THAN ONCE",
  description: "MORE THAN ONCE. Occasion wear with more life: borrow, lend, and share.",
  icons: {
    icon: "/favicon.png",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
