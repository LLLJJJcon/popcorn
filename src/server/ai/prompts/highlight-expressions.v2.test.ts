import { describe, expect, test } from 'vitest';
import { buildHighlightExpressionsPrompt, HIGHLIGHT_EXPRESSIONS_PROMPT_VERSION } from './highlight-expressions.v2';
import { groundSuggestedHighlights } from '@/server/domain/saved-item-target';

describe('strict highlight source spans', () => {
  const target = 'On為何要走Nike的回頭路';
  const segments = [{ id: 's1', text: target, startSeconds: 119, endSeconds: 120 }];

  test('requires literal contiguous copying on the first request, in trusted instructions', () => {
    const prompt = buildHighlightExpressionsPrompt({ lines: [{ line: 1, role: 'TARGET', text: target }] });
    expect(HIGHLIGHT_EXPRESSIONS_PROMPT_VERSION).toBe('highlight-expressions-v2');
    expect(prompt.systemPrompt).toContain('exact contiguous substring');
    expect(prompt.systemPrompt).toContain('Never delete intervening');
    expect(prompt.systemPrompt).toContain('走Nike的回頭路');
    expect(prompt.systemPrompt).toContain('走回頭路');
    expect(prompt.systemPrompt).toContain('回頭路');
    expect(JSON.parse(prompt.userPrompt.split('\n')[0]).lines[0].text).toBe(target);
  });

  test('rejects joining words across a brand and particle; keeps the literal shorter span', () => {
    expect(() => groundSuggestedHighlights([{ text: '走回頭路', occurrence: 1 }], segments)).toThrow();
    expect(groundSuggestedHighlights([{ text: '回頭路', occurrence: 1 }], segments)).toEqual([
      { startSegmentId: 's1', startOffset: 11, endSegmentId: 's1', endOffset: 14, text: '回頭路', reasonEn: null }
    ]);
  });
});
