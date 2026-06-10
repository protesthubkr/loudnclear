export function getSiteUrl() {
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
