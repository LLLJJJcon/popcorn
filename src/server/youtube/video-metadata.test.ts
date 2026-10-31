import { createYouTubeVideoMetadataProvider } from "./video-metadata";

const VIDEO_ID = "RPhGQDfVUl0";

describe("public YouTube video metadata", () => {
  it("reads only the public title and channel from the fixed YouTube endpoint", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => Response.json({
      title: "  视频真实标题  ", author_name: "  视频频道  ", html: "<iframe></iframe>",
    }));

    await expect(createYouTubeVideoMetadataProvider(fetchImpl)(VIDEO_ID)).resolves.toEqual({ title: "视频真实标题", channel: "视频频道" });
    const [input, options] = fetchImpl.mock.calls[0]!;
    const url = new URL(String(input));
    expect(url.origin + url.pathname).toBe("https://www.youtube.com/oembed");
    expect(url.searchParams.get("url")).toBe("https://www.youtube.com/watch?v=RPhGQDfVUl0");
    expect(options).toMatchObject({ redirect: "error", next: { revalidate: 86_400 } });
    expect(options?.signal).toBeInstanceOf(AbortSignal);
    expect(options?.headers).toBeUndefined();
  });

  it("does not send invalid video IDs to the provider", async () => {
    const fetchImpl = vi.fn<typeof fetch>();

    await expect(createYouTubeVideoMetadataProvider(fetchImpl)("https://internal.example")).resolves.toBeNull();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it.each([
    async () => new Response("Unavailable", { status: 404 }),
    async () => Response.json({ title: "", author_name: "YouTube" }),
    async () => { throw new Error("offline"); },
  ])("leaves existing saves usable when metadata is unavailable", async (fetchImpl) => {
    await expect(createYouTubeVideoMetadataProvider(fetchImpl)(VIDEO_ID)).resolves.toBeNull();
  });
});
