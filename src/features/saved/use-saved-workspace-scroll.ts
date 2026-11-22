"use client";

import { useEffect, type RefObject } from "react";

/** Let native scroll chaining take over only after the source has scrolled away. */
export function useSavedWorkspaceScroll(ref: RefObject<HTMLDivElement | null>, enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    const workspace = ref.current;
    const outer = workspace?.closest<HTMLElement>("[data-workspace-scroll]");
    if (!workspace || !outer) return;

    function updatePhase() {
      if (!workspace!.getClientRects().length) return;
      const top = workspace!.getBoundingClientRect().top - outer!.getBoundingClientRect().top;
      workspace!.dataset.scrollPhase = top <= 13 ? "learning" : "source";
    }

    updatePhase();
    outer.addEventListener("scroll", updatePhase, { passive: true });
    window.addEventListener("resize", updatePhase);
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(updatePhase);
    observer?.observe(workspace);
    observer?.observe(outer);
    const content = outer.querySelector<HTMLElement>("#main-content");
    if (content) observer?.observe(content);
    return () => {
      outer.removeEventListener("scroll", updatePhase);
      window.removeEventListener("resize", updatePhase);
      observer?.disconnect();
    };
  }, [ref, enabled]);
}
