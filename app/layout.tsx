import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans, Sora } from "next/font/google";
import "./globals.css";

const sora = Sora({
  variable: "--font-display",
  subsets: ["latin"],
  display: "swap",
});

const plexSans = IBM_Plex_Sans({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ||
  "https://matthewfreeman.github.io/discrete-cash/xds-emission/";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "XDS Ten-Year Emission Explorer: A Code-Derived Analysis",
    template: "%s | Discrete Protocol Research",
  },
  description:
    "A reproducible visual analysis of ten XDS protocol years, including monthly issuance, block-reward changes, Treasury Reserve locks, and the exact tail-emission crossover.",
  applicationName: "Discrete Emission Explorer",
  authors: [{ name: "Discrete protocol research" }],
  keywords: [
    "Discrete",
    "XDS",
    "emission",
    "mining",
    "block reward",
    "Treasury Reserve",
    "cryptocurrency supply",
  ],
  alternates: { canonical: siteUrl },
  openGraph: {
    type: "website",
    url: siteUrl,
    title: "When Does XDS Enter Tail Emission?",
    description:
      "Explore ten years of monthly XDS issuance, generated supply, and block rewards—replayed from consensus code.",
    siteName: "Discrete Emission Explorer",
    images: [
      {
        url: `${siteUrl}og.png`,
        width: 1200,
        height: 630,
        alt: "XDS ten-year emission explorer and tail-emission crossover at block 1,093,337",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "When Does XDS Enter Tail Emission?",
    description:
      "A visual, reproducible analysis of ten XDS protocol years and the reward curve's transition into perpetual tail emission.",
    images: [`${siteUrl}og.png`],
  },
  icons: {
    icon: `${siteUrl}favicon.png`,
    apple: `${siteUrl}apple-touch-icon.png`,
  },
};

export const viewport: Viewport = {
  themeColor: "#0d1115",
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${sora.variable} ${plexSans.variable} ${plexMono.variable}`}
      >
        {children}
      </body>
    </html>
  );
}
