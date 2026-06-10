import type { MetadataRoute } from "next";
import { getSiteUrl } from "./site-url";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      changeFrequency: "hourly",
      lastModified: new Date(),
      priority: 1,
      url: getSiteUrl(),
    },
  ];
}
