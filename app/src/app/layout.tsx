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
  description:
    "An AI paints a 20x20 canvas one pixel at a time. Predict which color it picks next and win SOL. Parimutuel betting, verifiable fairness, powered by Claude on Solana.",
  keywords: [
    "Solana",
    "prediction market",
    "AI art",
    "pixel art",
    "betting",
    "Claude",
    "on-chain game",
    "parimutuel",
    "crypto game",
    "NFT",
    "web3 game",
    "Splat",
  ],
  metadataBase: new URL("https://playsplat.fun"),
  openGraph: {
    title: "Splat | Bet the Canvas",
    description:
      "An AI paints a canvas. You predict every pixel. Win SOL if you're right.",
    url: "https://playsplat.fun",
    siteName: "Splat",
    images: [
      {
        url: "/og-image.jpg",
        width: 1200,
        height: 630,
        alt: "Splat — Bet the Canvas",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Splat | Bet the Canvas",
    description:
      "An AI paints a canvas. You predict every pixel. Win SOL if you're right.",
    images: ["/og-image.jpg"],
  },
  icons: {
    icon: "/favicon.ico",
  },
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
