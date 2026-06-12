import type { Metadata } from "next";
import { Gowun_Batang } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";
import { SITE_DESCRIPTION, SITE_NAME } from "./site";
import { getSiteUrl } from "./site-url";

const gowunBatang = Gowun_Batang({
  display: "swap",
  subsets: ["latin"],
  variable: "--font-family-display",
  weight: ["400", "700"],
});

const OPEN_GRAPH_IMAGE = {
  alt: SITE_NAME,
  height: 839,
  url: "/opengraph-image.png",
  width: 1566,
};

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: {
    default: SITE_NAME,
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  openGraph: {
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    images: [OPEN_GRAPH_IMAGE],
    locale: "ko_KR",
    siteName: SITE_NAME,
    type: "website",
    url: "/",
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    images: [OPEN_GRAPH_IMAGE],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className={gowunBatang.variable}>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
