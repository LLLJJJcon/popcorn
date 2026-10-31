import { z } from "zod";

import { YouTubeVideoIdSchema } from "@/contracts/source";

const MetadataSchema = z.object({
  title: z.string().trim().min(1).max(300),
  author_name: z.string().trim().min(1).max(200),
});

export type YouTubeVideoMetadata = { readonly title: string; readonly channel: string };
export type ReadVideoMetadata = (videoId: string) => Promise<YouTubeVideoMetadata | null>;

export function createYouTubeVideoMetadataProvider(fetchImpl: typeof fetch = fetch): ReadVideoMetadata {
  return async (videoId) => {
    if (!YouTubeVideoIdSchema.safeParse(videoId).success) return null;
    const url = new URL("https://www.youtube.com/oembed");
    url.searchParams.set("url", `https://www.youtube.com/watch?v=${videoId}`);
    url.searchParams.set("format", "json");
    try {
      const response = await fetchImpl(url, {
        redirect: "error",
        signal: AbortSignal.timeout(5_000),
        next: { revalidate: 86_400 },
      });
      if (!response.ok) return null;
      const parsed = MetadataSchema.safeParse(await response.json());
      return parsed.success ? { title: parsed.data.title, channel: parsed.data.author_name } : null;
    } catch {
      return null;
    }
  };
}
