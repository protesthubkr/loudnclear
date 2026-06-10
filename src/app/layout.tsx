import type { Metadata } from "next";
import { Gowun_Batang } from "next/font/google";
import "./globals.css";
import { SITE_DESCRIPTION, SITE_NAME } from "./site";
import { getSiteUrl } from "./site-url";

const gowunBatang = Gowun_Batang({
  display: "swap",
  subsets: ["latin"],
  variable: "--font-family-display",
  weight: ["400", "700"],
});

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
    locale: "ko_KR",
    siteName: SITE_NAME,
    type: "website",
  },
  twitter: {
    card: "summary",
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className={gowunBatang.variable}>{children}</body>
    </html>
  );
}
