"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { z } from "zod";
import { apiSuccessSchema } from "@/contracts/api";
import { HighlightStatusSchema, SavedHighlightSchema, type HighlightSelection, type HighlightStatus, type SavedHighlight, type SavedTargetSegment } from "@/contracts/highlights";
import { normalizeHighlightSelection } from "@/server/domain/saved-item-target";
import styles from "./saved-workspace.module.css";

const MutationSchema = apiSuccessSchema(z.object({ highlights: z.array(SavedHighlightSchema), highlightStatus: HighlightStatusSchema, gatewayRequired: z.boolean().optional() }));
type Selection = HighlightSelection & { readonly text: string };

/** Count only transcript text, never the inline remove controls. DOM/String offsets are UTF-16. */
export function projectSavedSelection(range: Range, root: HTMLElement, segments: readonly SavedTargetSegment[]): Selection | null {
  if (range.collapsed || !root.contains(range.startContainer) || !root.contains(range.endContainer)) return null;
  const fragments: { id: string; start: number; end: number }[] = [];
  for (const run of root.querySelectorAll<HTMLElement>("[data-target-text]")) {
    if (!range.intersectsNode(run)) continue;
    const clipped = document.createRange(); clipped.selectNodeContents(run);
    if (range.compareBoundaryPoints(Range.START_TO_START, clipped) > 0) clipped.setStart(range.startContainer, range.startOffset);
    if (range.compareBoundaryPoints(Range.END_TO_END, clipped) < 0) clipped.setEnd(range.endContainer, range.endOffset);
    if (clipped.collapsed || !clipped.toString()) continue;
    const prefix = document.createRange(); prefix.selectNodeContents(run); prefix.setEnd(clipped.startContainer, clipped.startOffset);
    const start = Number(run.dataset.textStart ?? 0) + prefix.toString().length;
    const id = run.closest<HTMLElement>("[data-segment-id]")?.dataset.segmentId;
    if (id) fragments.push({ id, start, end: start + clipped.toString().length });
  }
  const first = fragments[0], last = fragments.at(-1);
  if (!first || !last) return null;
  try {
    return normalizeHighlightSelection(segments, { startSegmentId: first.id, startOffset: first.start, endSegmentId: last.id, endOffset: last.end });
  } catch { return null; }
}

function lineRuns(segment: SavedTargetSegment, segmentIndex: number, segments: readonly SavedTargetSegment[], highlights: readonly SavedHighlight[]) {
  const marks = highlights.flatMap(highlight => {
    if (highlight.status !== "active") return [];
    const start = segments.findIndex(value => value.id === highlight.startSegmentId);
    const end = segments.findIndex(value => value.id === highlight.endSegmentId);
    if (start < 0 || end < segmentIndex || start > segmentIndex) return [];
    return [{ highlight, start: start === segmentIndex ? highlight.startOffset : 0, end: end === segmentIndex ? highlight.endOffset : segment.text.length }];
  }).sort((left, right) => left.start - right.start);
  const runs: { start: number; text: string; highlight?: SavedHighlight; remove?: boolean }[] = [];
  let cursor = 0;
  for (const mark of marks) {
    if (mark.start < cursor || mark.end <= mark.start || mark.end > segment.text.length) continue;
    if (mark.start > cursor) runs.push({ start: cursor, text: segment.text.slice(cursor, mark.start) });
    runs.push({ start: mark.start, text: segment.text.slice(mark.start, mark.end), highlight: mark.highlight, remove: segment.id === mark.highlight.endSegmentId });
    cursor = mark.end;
  }
  if (cursor < segment.text.length) runs.push({ start: cursor, text: segment.text.slice(cursor) });
  return runs;
}

export function HighlightEditor({ savedItemId, segments, highlights, highlightStatus, gatewayAvailable = true, onChange }: {
  readonly savedItemId: string;
  readonly segments: readonly SavedTargetSegment[];
  readonly highlights: readonly SavedHighlight[];
  readonly highlightStatus: HighlightStatus | null;
  readonly gatewayAvailable?: boolean;
  readonly onChange: (highlights: SavedHighlight[], status: HighlightStatus) => void;
}) {
  const root = useRef<HTMLDivElement>(null);
  const mounted = useRef(false);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const request = useRef<AbortController | null>(null);
  const [selection, setSelection] = useState<(Selection & { left: number; top: number }) | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [gatewayMissing, setGatewayMissing] = useState(false);
  const [removed, setRemoved] = useState<SavedHighlight | null>(null);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; request.current?.abort(); if (undoTimer.current) clearTimeout(undoTimer.current); };
  }, []);

  function captureSelection() {
    const browserSelection = window.getSelection();
    if (!root.current || !browserSelection?.rangeCount) { setSelection(null); return; }
    const range = browserSelection.getRangeAt(0);
    const value = projectSavedSelection(range, root.current, segments);
    if (!value) { setSelection(null); return; }
    const parentRect = root.current.getBoundingClientRect();
    const rect = typeof range.getBoundingClientRect === "function" ? range.getBoundingClientRect() : parentRect;
    setSelection({ ...value, left: Math.max(0, Math.min(rect.left - parentRect.left + rect.width / 2 - 32, parentRect.width - 74)), top: Math.max(0, rect.bottom - parentRect.top + 5) });
  }

  async function mutate(suffix: string, method: "POST" | "DELETE", body?: unknown) {
    if (request.current || busy) return false;
    const controller = new AbortController(); request.current = controller;
    setBusy(true); setError(null);
    try {
      const response = await fetch(`/api/v1/saved-items/${savedItemId}/highlights${suffix}`, { method, credentials: "same-origin", headers: body ? { "Content-Type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined, signal: controller.signal });
      const parsed = MutationSchema.safeParse(await response.json());
      if (!response.ok || !parsed.success) throw new Error();
      if (!mounted.current) return false;
      setGatewayMissing(Boolean(parsed.data.data.gatewayRequired));
      onChange(parsed.data.data.highlights, parsed.data.data.highlightStatus);
      return true;
    } catch {
      if (!controller.signal.aborted && mounted.current) setError("Couldn't save your change. Please try again.");
      return false;
    } finally { if (request.current === controller) request.current = null; if (mounted.current) setBusy(false); }
  }

  async function remove(highlight: SavedHighlight) {
    if (!await mutate(`/${highlight.id}`, "DELETE")) return;
    setRemoved(highlight);
    if (undoTimer.current) clearTimeout(undoTimer.current);
    undoTimer.current = setTimeout(() => { setRemoved(null); undoTimer.current = null; }, 5_000);
  }
  async function restore() {
    if (!removed || !await mutate(`/${removed.id}/restore`, "POST")) return;
    if (undoTimer.current) clearTimeout(undoTimer.current);
    setRemoved(null);
  }
  async function mark() {
    if (!selection) return;
    const { startSegmentId, startOffset, endSegmentId, endOffset } = selection;
    if (await mutate("", "POST", { startSegmentId, startOffset, endSegmentId, endOffset })) {
      setSelection(null); window.getSelection()?.removeAllRanges();
    }
  }

  return (
    <div className={styles.highlightEditor} aria-busy={busy}>
      <div className={styles.selectionSurface}>
        <div ref={root} className={styles.rawText} data-testid="raw-text" lang="zh-CN" onMouseUp={captureSelection} onKeyUp={captureSelection}>
          {segments.map((segment, index) => <div className={styles.targetLine} data-segment-id={segment.id} key={segment.id}>
            {lineRuns(segment, index, segments, highlights).map(run => run.highlight ? (
              <span key={run.start} className={styles.highlightWrap}>
                <mark className={styles.expressionHighlight} title={run.highlight.reasonEn ?? undefined} data-target-text data-text-start={run.start}>{run.text}</mark>
                {run.remove ? <button className={styles.removeHighlight} type="button" aria-label={`Remove highlight ${run.highlight.text}`} disabled={busy} onClick={() => void remove(run.highlight!)}><span aria-hidden="true">×</span></button> : null}
              </span>
            ) : <span key={run.start} data-target-text data-text-start={run.start}>{run.text}</span>)}
          </div>)}
        </div>
        {selection ? <button className={styles.markSelection} style={{ left: selection.left, top: selection.top }} type="button" disabled={busy} onMouseDown={event => event.preventDefault()} onClick={() => void mark()}>Mark</button> : null}
      </div>
      <div className={styles.highlightGuidance}>
        {highlightStatus === "pending" ? <p role="status"><span className={styles.activityIndicator} aria-hidden="true" />Finding expressions…</p>
          : highlightStatus === "unavailable" ? <p>No suggestions this time — select any words you want to learn. {gatewayAvailable && !gatewayMissing ? <button type="button" className={styles.inlineAction} disabled={busy} onClick={() => void mutate("/suggest", "POST")}>Suggest again</button> : <Link href="/settings/model-gateway">Set up model gateway</Link>}</p>
          : highlights.length === 0 ? <p>No suggestions for this line — select any words you want to learn.</p>
          : <p className={styles.selectionInstruction}>Select words to add a mark. Hover a mark to remove it.</p>}
        {removed ? <p className={styles.undoNotice} role="status"><span>Removed ·</span> <button type="button" className={styles.inlineAction} disabled={busy} onClick={() => void restore()}>Undo</button></p> : null}
        {error ? <p className={styles.editorError} role="alert">{error}</p> : null}
      </div>
    </div>
  );
}
