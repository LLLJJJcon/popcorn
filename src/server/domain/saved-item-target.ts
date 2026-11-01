import type { HighlightSelection, SavedTargetSegment } from '@/contracts/highlights';
import type { SavedItemKind } from '@/contracts/source';
import type { Json } from '@/types/database.generated';
function object(value: Json): Record<string, Json | undefined> {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value : {};
}
/** Snapshot order is authoritative; moment gaps choose the preceding subtitle. */
export function resolveSavedItemTarget(kind: SavedItemKind, value: Json, segments: readonly SavedTargetSegment[], startSeconds: number | null = null) {
  const payload = { ...object(value) };
  let targetSegments: readonly SavedTargetSegment[] = [];
  if (kind !== 'video') {
    const ids = new Set<string>();
    if (typeof payload.segmentId === 'string')
      ids.add(payload.segmentId);
    if (Array.isArray(payload.segmentIds))
      for (const id of payload.segmentIds)
        if (typeof id === 'string')
          ids.add(id);
    if (kind === 'player_moment') {
      const second = typeof payload.capturedSecond === 'number' ? payload.capturedSecond : startSeconds ?? 0;
      const index = segments.findIndex(segment => segment.startSeconds <= second && second < segment.endSeconds);
      const preceding = segments.findLastIndex(segment => segment.startSeconds <= second);
      const target = segments[index >= 0 ? index : Math.max(0, preceding)];
      targetSegments = target ? [target] : [];
      if (target) {
        payload.resolvedSegmentId = target.id;
        payload.originalChinese = target.text;
        payload.startSeconds = target.startSeconds;
        payload.endSeconds = target.endSeconds;
      }
    }
    else
      targetSegments = segments.filter(segment => ids.has(segment.id));
  }
  const first = targetSegments[0];
  const last = targetSegments.at(-1);
  const start = first ? segments.findIndex(segment => segment.id === first.id) : -1;
  const end = last ? segments.findIndex(segment => segment.id === last.id) : -1;
  const contextBefore = start < 0 ? [] : segments.slice(Math.max(0, start - 3), start).map(segment => segment.text);
  const contextAfter = end < 0 ? [] : segments.slice(end + 1, end + 3).map(segment => segment.text);
  if (kind !== 'video' && targetSegments.length) {
    payload.contextBefore = contextBefore;
    payload.contextAfter = contextAfter;
  }
  return {
    targetSegments, contextBefore, contextAfter, payload
  };
}
function boundaries(segments: readonly SavedTargetSegment[], value: HighlightSelection) {
  const startIndex = segments.findIndex(segment => segment.id === value.startSegmentId);
  const endIndex = segments.findIndex(segment => segment.id === value.endSegmentId);
  if (startIndex < 0 || endIndex < startIndex)
    throw new TypeError('Invalid target selection');
  const startText = segments[startIndex]!.text;
  const endText = segments[endIndex]!.text;
  if (!Number.isInteger(value.startOffset) || !Number.isInteger(value.endOffset) || value.startOffset < 0 || value.endOffset < 0 || value.startOffset > startText.length || value.endOffset > endText.length)
    throw new TypeError('Invalid target offset');
  // A DOM range must never bisect a surrogate pair.
  for (const [text, offset] of [[startText, value.startOffset], [endText, value.endOffset]] as const) {
    const before = text.charCodeAt(offset - 1), after = text.charCodeAt(offset);
    if (before >= 0xd800 && before <= 0xdbff && after >= 0xdc00 && after <= 0xdfff)
      throw new TypeError('Split Unicode character');
  }
  const offsetOf = (index: number) => segments.slice(0, index).reduce((sum, segment) => sum + segment.text.length + 1, 0);
  const start = offsetOf(startIndex) + value.startOffset, end = offsetOf(endIndex) + value.endOffset;
  if (end <= start)
    throw new TypeError('Empty target selection');
  return { start, end };
}
function positionAt(segments: readonly SavedTargetSegment[], offset: number, end: boolean) {
  let rest = offset;
  for (let index = 0; index < segments.length; index++) {
    const segment = segments[index]!;
    if (rest <= segment.text.length || index === segments.length - 1)
      return { id: segment.id, offset: rest };
    rest -= segment.text.length + 1;
    if (rest < 0)
      return end ? { id: segment.id, offset: segment.text.length } : { id: segments[index + 1]!.id, offset: 0 };
  }
  throw new TypeError('Invalid selection');
}
export function normalizeHighlightSelection(segments: readonly SavedTargetSegment[], value: HighlightSelection): HighlightSelection & {
  text: string;
} {
  const range = boundaries(segments, value);
  const joined = segments.map(segment => segment.text).join('\n');
  const raw = joined.slice(range.start, range.end);
  const leading = raw.match(/^[\s\p{P}]+/u)?.[0].length ?? 0;
  const trailing = raw.match(/[\s\p{P}]+$/u)?.[0].length ?? 0;
  const text = raw.slice(leading, Math.max(leading, raw.length - trailing));
  if (!text || !/\p{Script=Han}/u.test(text))
    throw new TypeError('Select Chinese words to mark');
  const start = positionAt(segments, range.start + leading, false);
  const end = positionAt(segments, range.end - trailing, true);
  return {
    startSegmentId: start.id,
    startOffset: start.offset,
    endSegmentId: end.id,
    endOffset: end.offset,
    text
  };
}
export function highlightsOverlap(left: HighlightSelection, right: HighlightSelection, segments: readonly SavedTargetSegment[]) {
  const a = boundaries(segments, left), b = boundaries(segments, right);
  return a.start < b.end && b.start < a.end;
}
export function groundSuggestedHighlights(suggestions: readonly {
  readonly text: string;
  readonly occurrence?: number;
  readonly reasonEn?: string;
}[], segments: readonly SavedTargetSegment[]): (HighlightSelection & {
  text: string;
  reasonEn: string | null;
})[] {
  const result: (HighlightSelection & {
    text: string;
    reasonEn: string | null;
  })[] = [];
  const seen = new Set<string>();
  for (const suggestion of suggestions) {
    if (!/\p{Script=Han}/u.test(suggestion.text) || seen.has(suggestion.text))
      continue;
    const occurrence = suggestion.occurrence ?? 1;
    if (!Number.isInteger(occurrence) || occurrence < 1)
      continue;
    let found: (HighlightSelection & {
      text: string;
      reasonEn: string | null;
    }) | undefined;
    for (const segment of segments) {
      let remaining = occurrence;
      if (suggestion.text === segment.text)
        continue;
      let offset = 0;
      for (;;) {
        const index = segment.text.indexOf(suggestion.text, offset);
        if (index < 0)
          break;
        remaining--;
        if (remaining === 0) {
          found = {
            startSegmentId: segment.id,
            startOffset: index,
            endSegmentId: segment.id,
            endOffset: index + suggestion.text.length,
            text: suggestion.text,
            reasonEn: suggestion.reasonEn ?? null
          };
          break;
        }
        offset = index + 1;
      }
      if (found)
        break;
    }
    if (!found || result.some(existing => highlightsOverlap(existing, found!, segments)))
      continue;
    result.push(found);
    seen.add(found.text);
    if (result.length === 2)
      break;
  }
  if (suggestions.length > 0 && result.length === 0)
    throw new TypeError('No suggestion is grounded in target lines');
  return result;
}
