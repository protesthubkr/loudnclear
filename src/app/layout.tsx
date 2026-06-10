import type { Metadata } from "next";
import "./globals.css";

const siteName = "Loud & Clear";
const siteDescription = "주요 단체와 정당의 입장문 핵심 원문 문장 피드";

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: {
    default: siteName,
    template: `%s | ${siteName}`,
  },
  description: siteDescription,
  applicationName: siteName,
  openGraph: {
    title: siteName,
    description: siteDescription,
    locale: "ko_KR",
    siteName,
    type: "website",
  },
  twitter: {
    card: "summary",
    title: siteName,
    description: siteDescription,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}

function getSiteUrl() {
  const explicitSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  const vercelUrl =
    process.env.VERCEL_PROJECT_PRODUCTION_URL ?? process.env.VERCEL_URL;

  if (explicitSiteUrl) {
    return withProtocol(explicitSiteUrl);
  }

  if (vercelUrl) {
    return withProtocol(vercelUrl);
  }

  return "http://localhost:3000";
}

function withProtocol(url: string) {
  return /^https?:\/\//.test(url) ? url : `https://${url}`;
}
