var YTD_SETTINGS = (() => {
  const STORAGE_KEY = "popcorn_options";
  const DEFAULTS = Object.freeze({ boundedCachePrefix: "digest_" });
  const LEGACY_REMOVED_MODEL = "deepseek-v4-flash";

  function normalize() {
    return { ...DEFAULTS };
  }

  function migrateLegacyCustom(input = {}) {
    return { settings: normalize(), migrated: Object.keys(input).length > 0 };
  }

  function canonicalYouTubeUrl(videoId) {
    const normalized = String(videoId || "").trim();
    if (!/^[A-Za-z0-9_-]{6,20}$/.test(normalized)) throw new Error("Invalid YouTube video ID.");
    return `https://www.youtube.com/watch?v=${normalized}`;
  }

  return { STORAGE_KEY, DEFAULTS, LEGACY_REMOVED_MODEL, normalize, migrateLegacyCustom, canonicalYouTubeUrl };
})();

if (typeof module !== "undefined" && module.exports) module.exports = YTD_SETTINGS;
