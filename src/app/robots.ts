import type { MetadataRoute } from "next";
import { getSiteUrl } from "./site-url";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      allow: "/",
      disallow: ["/api/", "/ops/"],
      userAgent: "*",
    },
    sitemap: `${getSiteUrl()}/sitemap.xml`,
  };
}
