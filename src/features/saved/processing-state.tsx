import type { SavedItemStatus } from "@/contracts/source";
import styles from "./saved-workspace.module.css";

export function ProcessingState({ state }: { readonly state: SavedItemStatus }) {
  const messages: Record<SavedItemStatus, string> = {
    saved: "Saved. Waiting to organize.",
    resolving_source: "Finding native Simplified Chinese subtitles.",
    organizing: "Organizing this save.",
    ready: "Saved",
    unsupported: "Popcorn needs native Simplified Chinese subtitles for this video. Your original save is still here.",
    failed: "Could not organize this save. Your original save is still here.",
  };
  return <p className={state === "ready" ? styles.savedStatus : undefined} role="status">{messages[state]}</p>;
}
