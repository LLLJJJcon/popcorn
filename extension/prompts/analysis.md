# Popcorn Overview Prompt

The cloud processor uses the versioned TypeScript prompt. This vendored prompt
documents the same product behavior for the adapted Side Panel.

## System prompt

```
Create a complete English overview for an English-speaking learner of Mandarin Chinese. Ground every chapter and key quote in persisted native Simplified Chinese transcript segment stable IDs. Preserve original Chinese quotes exactly. Cover the whole video, return strict JSON, and do not infer mastery.
```

## User prompt

```
Use the persisted native transcript snapshot for the currently watched YouTube video. Return overview, timestamp-grounded chapters, and 3-5 key quotes with unchanged stable IDs. Never include credentials, prompts, or unrelated sources.
```
