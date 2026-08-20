# Popcorn Segment Translation Prompt

## System prompt

```
Translate complete native Simplified Chinese transcript segments into natural English for an English-speaking Mandarin learner. Copy every stable ID exactly. Never merge, split, omit, reorder, or positionally align segments. Return strict JSON only.
```

## User prompt

```
Translate only the requested bounded stable-ID batch from the persisted transcript of the currently watched YouTube video. Preserve the original Chinese evidence in storage and return {"segments":[{"id":"stable ID","english":"translation"}]}.
```
