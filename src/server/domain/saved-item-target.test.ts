import { describe, expect, test } from 'vitest';
import { resolveSavedItemTarget, normalizeHighlightSelection, groundSuggestedHighlights, highlightsOverlap } from './saved-item-target';
const segments = Array.from({ length: 8 }, (_, i) => ({
  id: `s${i}`,
  text: i === 4 ? '  这杯咖啡高得要命。' : '第' + i + '句话',
  startSeconds: i * 10,
  endSeconds: i * 10 + 7
}));
describe('saved item target and highlights', () => {
  test('moment gaps use preceding line and the 3-before/2-after context', () => {
    const value = resolveSavedItemTarget('player_moment', { capturedSecond: 49 }, segments, 49);
    expect(value.targetSegments.map(s => s.id)).toEqual(['s4']);
    expect(value.contextBefore).toEqual(segments.slice(1, 4).map(s => s.text));
    expect(value.contextAfter).toEqual(segments.slice(5, 7).map(s => s.text));
    expect(value.payload.resolvedSegmentId).toBe('s4');
  });
  test('moment before first line takes first, explicit target order follows snapshot', () => {
    expect(resolveSavedItemTarget('player_moment', { capturedSecond: 0 }, segments.map(s => ({ ...s, startSeconds: s.startSeconds + 3, endSeconds: s.endSeconds + 3 })), 0).targetSegments[0]?.id).toBe('s0');
    expect(resolveSavedItemTarget('subtitle_selection', { segmentIds: ['s5', 's4'] }, segments).targetSegments.map(s => s.id)).toEqual(['s4', 's5']);
  });
  test('trims punctuation and whitespace while preserving UTF16 offsets', () => {
    const lines = [{
        id: 'x',
        text: '😀  高得要命。 ',
        startSeconds: 0,
        endSeconds: 1
      }];
    expect(normalizeHighlightSelection(lines, {
      startSegmentId: 'x',
      startOffset: 2,
      endSegmentId: 'x',
      endOffset: lines[0]!.text.length
    })).toMatchObject({ text: '高得要命', startOffset: 4, endOffset: 8 });
    expect(() => normalizeHighlightSelection(lines, {
      startSegmentId: 'x',
      startOffset: 1,
      endSegmentId: 'x',
      endOffset: 4
    })).toThrow();
  });
  test('supports cross-line marks and excludes empty or non-Chinese selections', () => {
    expect(normalizeHighlightSelection(segments.slice(4, 6), {
      startSegmentId: 's4',
      startOffset: 6,
      endSegmentId: 's5',
      endOffset: 3
    })).toMatchObject({ text: '高得要命。\n第5句' });
    expect(() => normalizeHighlightSelection(segments, {
      startSegmentId: 's4',
      startOffset: 0,
      endSegmentId: 's4',
      endOffset: 2
    })).toThrow();
  });
  test('suggestions choose exact occurrences, reject full lines/context and overlaps; empty is valid', () => {
    const lines = [{
        id: 'x',
        text: '贵得要命，真是贵得要命',
        startSeconds: 0,
        endSeconds: 1
      }];
    expect(groundSuggestedHighlights([{ text: '贵得要命', occurrence: 2 }], lines)).toMatchObject([{ text: '贵得要命', startOffset: 7, endOffset: 11 }]);
    expect(groundSuggestedHighlights([], lines)).toEqual([]);
    expect(groundSuggestedHighlights([{ text: '哈哈', occurrence: 2 }], [{
        id: 'r',
        text: '哈哈哈',
        startSeconds: 0,
        endSeconds: 1
      }])).toMatchObject([{ startOffset: 1, endOffset: 3 }]);
    expect(() => groundSuggestedHighlights([{ text: '贵得要命', occurrence: 2 }], [{
        id: 'a',
        text: '贵得要命，真的',
        startSeconds: 0,
        endSeconds: 1
      }, {
        id: 'b',
        text: '贵得要命，太贵',
        startSeconds: 1,
        endSeconds: 2
      }])).toThrow();
    expect(() => groundSuggestedHighlights([{ text: lines[0]!.text, occurrence: 1 }], lines)).toThrow();
    expect(() => groundSuggestedHighlights([{ text: '别的上下文', occurrence: 1 }], lines)).toThrow();
    expect(groundSuggestedHighlights([{ text: '贵得要命', occurrence: 1 }, { text: '要命', occurrence: 1 }], lines)).toHaveLength(1);
  });
  test('cross-line overlap uses target positions and excludes touching edges', () => {
    expect(highlightsOverlap({
      startSegmentId: 's4',
      startOffset: 2,
      endSegmentId: 's5',
      endOffset: 2
    }, {
      startSegmentId: 's5',
      startOffset: 1,
      endSegmentId: 's5',
      endOffset: 4
    }, segments)).toBe(true);
    expect(highlightsOverlap({
      startSegmentId: 's4',
      startOffset: 2,
      endSegmentId: 's4',
      endOffset: 4
    }, {
      startSegmentId: 's4',
      startOffset: 4,
      endSegmentId: 's4',
      endOffset: 6
    }, segments)).toBe(false);
  });
});
