import type { SavedItemStatus } from "@/contracts/source";

export function ProcessingState({ state }: { readonly state: SavedItemStatus }) {
  const messages: Record<SavedItemStatus, string> = {
    saved: "Saved. Waiting to organize.",
    resolving_source: "Finding native Simplified Chinese subtitles.",
    organizing: "Organizing this save.",
    ready: "Ready to learn.",
    unsupported: "Popcorn needs native Simplified Chinese subtitles for this video. Your original save is still here.",
    failed: "Could not organize this save. Your original save is still here.",
  };
  return <p role="status">{messages[state]}</p>;
}
