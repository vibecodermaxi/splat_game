import type { Metadata } from "next";
import { Luckiest_Guy, Nunito, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { SolanaWalletProvider } from "@/components/providers/WalletProvider";

// Display / Logo / Headings / Buttons
const luckiestGuy = Luckiest_Guy({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

// Body / UI text
const nunito = Nunito({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

// Monospace — wallet addresses, hashes, on-chain data
const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Splat | Bet the Canvas",
  description: "An AI paints a canvas. You bet on every pixel.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${luckiestGuy.variable} ${nunito.variable} ${jetbrainsMono.variable}`}
    >
      <body className="antialiased">
        <SolanaWalletProvider>{children}</SolanaWalletProvider>
      </body>
    </html>
  );
}
