# Popcorn Parallel Batch A Platform Capabilities Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** Build authenticated desktop navigation, safe Chinese-content ingestion, and a typed OpenAI analysis pipeline as three parallel modules.

**Architecture:** Each Agent consumes frozen M1 contracts and owns separate feature, repository, route, and test files. The primary Agent integrates the modules only after focused verification.

**Tech Stack:** Next.js App Router, Supabase SSR/Auth/Storage, Zod, OpenAI Responses API, Vitest, Testing Library, Playwright.

## Global Constraints

- English UI and explanations; Simplified Chinese learning content.
- Shared contracts, migrations, package.json, and root configuration are read-only for feature Agents.
- All routes return ApiSuccess or ApiFailure.
- Every repository method requires authenticated userId.
- OpenAI model and embedding model come from validated environment variables.
- Never expose provider keys, service-role keys, or raw provider responses to the browser.

---

### Task A1: Authentication and protected routing

**Agent:** Batch A Agent A

**Files:**

- Create: src/features/auth/server.ts
- Create: src/features/auth/client.ts
- Create: src/features/auth/sign-in-form.tsx
- Create: src/app/(auth)/sign-in/page.tsx
- Create: src/app/(app)/layout.tsx
- Create: src/proxy.ts
- Test: src/features/auth/server.test.ts
- Test: tests/e2e/auth-profile.spec.ts

**Interfaces:**

- Consumes: Supabase browser/server clients and ApiFailure.
- Produces:
  - requireUser(): Promise<{ id: string; email: string }>
  - signInWithPassword(input): Promise<ApiSuccess<{ redirectTo: string }> | ApiFailure>

- [ ] **Step 1: Write failing requireUser tests**

Assert an absent Supabase user throws AUTH_REQUIRED and a present user returns only id and email.

Run:

    pnpm vitest run src/features/auth/server.test.ts

Expected: FAIL because requireUser does not exist.

- [ ] **Step 2: Implement server and browser clients**

Use @supabase/ssr cookie integration. Service-role credentials are forbidden in browser modules. Protected layouts redirect unauthenticated visitors to /sign-in?next=/app.

- [ ] **Step 3: Write and implement sign-in form test**

Test English labels Email, Password, and Sign in; test pending state and safe invalid-credentials message.

Run:

    pnpm vitest run src/features/auth

Expected: tests pass.

- [ ] **Step 4: Add Playwright authentication path**

The E2E test signs in with seeded local credentials, reaches /app, signs out, and returns to /sign-in.

Run:

    pnpm test:e2e -- auth-profile

Expected: PASS against local Supabase.

- [ ] **Step 5: Commit**

Run:

    git add src/features/auth src/app/\(auth\) src/app/\(app\)/layout.tsx src/proxy.ts tests/e2e/auth-profile.spec.ts
    git commit -m "feat: add authenticated desktop shell"

### Task A2: Learner profile and navigation

**Agent:** Batch A Agent A

**Files:**

- Create: src/features/profile/schema.ts
- Create: src/features/profile/profile-repository.ts
- Create: src/features/profile/profile-form.tsx
- Create: src/features/profile/profile-form.test.tsx
- Create: src/app/(app)/profile/page.tsx
- Create: src/app/(app)/app-shell.tsx
- Test: tests/integration/profile/profile.test.ts

**Interfaces:**

- Produces:
  - Profile = { chineseLevel: "A2" | "B1" | "B2" | "C1"; learningGoal: string; nativeLanguage: "en"; targetLanguage: "zh-CN" }
  - getProfile(userId): Promise<Profile | null>
  - saveProfile(userId, input): Promise<Profile>

- [ ] **Step 1: Write failing profile tests**

Assert saving B1 plus “Understand Chinese social media” persists fixed en and zh-CN values. Assert an empty goal and unsupported level are rejected.

Run:

    pnpm test:integration -- profile

Expected: FAIL because repository and schema do not exist.

- [ ] **Step 2: Implement repository and form**

The form presents English field labels Chinese level and Learning goal. Native and target languages are explanatory read-only text, not selectable controls.

- [ ] **Step 3: Implement desktop navigation**

Navigation links are Home, Import, Vault, Queue, Progress, and Profile. The app shell displays an unsupported-width notice below 1024 pixels without implementing a mobile navigation pattern.

- [ ] **Step 4: Verify**

Run:

    pnpm vitest run src/features/profile
    pnpm test:integration -- profile
    pnpm test:e2e -- auth-profile
    pnpm typecheck

Expected: all commands exit 0.

- [ ] **Step 5: Commit**

Run:

    git add src/features/profile src/app/\(app\)/profile src/app/\(app\)/app-shell.tsx
    git commit -m "feat: add Chinese learner profile"

### Task B1: Text normalisation and persistence

**Agent:** Batch A Agent B

**Files:**

- Create: src/features/content/schema.ts
- Create: src/features/content/normalise-text.ts
- Create: src/server/repositories/content-repository.ts
- Create: src/app/api/v1/content/text/route.ts
- Test: src/features/content/normalise-text.test.ts
- Test: tests/integration/content/text-import.test.ts

**Interfaces:**

- Consumes: NormalisedContent and requireUser().
- Produces:
  - normaliseText(input): { language: "zh-CN"; text: string; contentHash: string }
  - createTextContent(userId, input): Promise<NormalisedContent>

- [ ] **Step 1: Write failing normalisation tests**

Assert trimming, Unicode NFC normalisation, CRLF conversion, stable SHA-256 hash, rejection below two Chinese characters, and rejection above 20,000 characters.

Run:

    pnpm vitest run src/features/content/normalise-text.test.ts

Expected: FAIL because normaliseText does not exist.

- [ ] **Step 2: Implement the pure normaliser**

Do not remove Chinese punctuation or convert between Traditional and Simplified Chinese. Store detected script evidence for later AI review; accept content containing meaningful Chinese text.

- [ ] **Step 3: Write integration tests**

Test authenticated insert, duplicate content returning the existing record, and user B being unable to fetch user A content.

- [ ] **Step 4: Implement repository and POST route**

POST /api/v1/content/text accepts { text: string; idempotencyKey: string } and returns ApiSuccess<NormalisedContent> with status 201 or existing data with status 200.

- [ ] **Step 5: Verify and commit**

Run:

    pnpm vitest run src/features/content/normalise-text.test.ts
    pnpm test:integration -- text-import
    pnpm typecheck
    git add src/features/content src/server/repositories/content-repository.ts src/app/api/v1/content tests/integration/content
    git commit -m "feat: add Chinese text ingestion"

### Task B2: Safe public URL ingestion

**Agent:** Batch A Agent B

**Files:**

- Create: src/features/content/fetch-public-url.ts
- Create: src/features/content/extract-readable-text.ts
- Create: src/app/api/v1/content/url/route.ts
- Test: src/features/content/fetch-public-url.test.ts
- Test: tests/integration/content/url-import.test.ts

**Interfaces:**

- Produces:
  - fetchPublicUrl(url, fetchImpl): Promise<{ finalUrl: string; contentType: string; body: string }>
  - extractReadableText(html): string

- [ ] **Step 1: Write SSRF and limit tests**

Reject localhost, loopback, link-local, private IPv4/IPv6 ranges, non-http protocols, credentials in URLs, more than three redirects, responses above 2 MB, and content types outside text/html and text/plain.

Run:

    pnpm vitest run src/features/content/fetch-public-url.test.ts

Expected: FAIL because the module does not exist.

- [ ] **Step 2: Implement bounded fetch**

Resolve and validate every redirect target before following it. Abort after 8 seconds. Use an explicit PopcornLanguage/1.0 user agent. Never bypass robots, authentication, or paywalls.

- [ ] **Step 3: Implement readable text extraction**

Remove scripts, styles, navigation, and repeated whitespace. Preserve Chinese punctuation and paragraph boundaries. Reject output with fewer than two Chinese characters.

- [ ] **Step 4: Implement route and integration tests**

POST /api/v1/content/url accepts url and idempotencyKey, persists sourceUrl and normalised text, and maps safe failures to CONTENT_UNAVAILABLE, CONTENT_UNSUPPORTED, or CONTENT_TOO_LARGE.

- [ ] **Step 5: Verify and commit**

Run:

    pnpm vitest run src/features/content/fetch-public-url.test.ts
    pnpm test:integration -- url-import
    pnpm typecheck
    git add src/features/content src/app/api/v1/content/url tests/integration/content
    git commit -m "feat: add safe public URL ingestion"

### Task B3: Screenshot upload and signed access

**Agent:** Batch A Agent B

**Files:**

- Create: src/features/content/image-schema.ts
- Create: src/features/content/upload-image.ts
- Create: src/app/api/v1/content/image/route.ts
- Test: src/features/content/image-schema.test.ts
- Test: tests/integration/content/image-import.test.ts

**Interfaces:**

- Produces uploadImage(userId, file): Promise<NormalisedContent>.

- [ ] **Step 1: Write image validation tests**

Allow image/png, image/jpeg, and image/webp up to 8 MB. Reject SVG, GIF, executable content, extension/MIME mismatch, and empty files.

- [ ] **Step 2: Implement upload**

Store under userId/contentId/original.ext in a private content-images bucket. Return a database record with storagePath; never return a public bucket URL.

- [ ] **Step 3: Add signed-access integration test**

User A receives a short-lived signed URL for their image. User B cannot sign or retrieve the path.

- [ ] **Step 4: Verify and commit**

Run:

    pnpm vitest run src/features/content/image-schema.test.ts
    pnpm test:integration -- image-import
    pnpm typecheck
    git add src/features/content src/app/api/v1/content/image tests/integration/content
    git commit -m "feat: add private screenshot ingestion"

### Task C1: OpenAI provider adapter and model configuration

**Agent:** Batch A Agent C

**Files:**

- Create: src/server/ai/model-config.ts
- Create: src/server/ai/provider.ts
- Create: src/server/ai/openai-provider.ts
- Test: src/server/ai/model-config.test.ts
- Test: tests/contract/ai/provider.test.ts

**Interfaces:**

- Produces AiProvider with:
  - analyse(content, profile): Promise<AnalysisResult>
  - activate(input): Promise<PracticeTask>
  - evaluate(input): Promise<EvaluationResult>
  - embedChinese(texts): Promise<number[][]>

- [ ] **Step 1: Write provider contract tests**

Use an in-memory FakeAiProvider. Assert all four methods return shared contract types and no OpenAI SDK type crosses the interface.

- [ ] **Step 2: Implement model configuration**

Read OPENAI_MODEL, OPENAI_EMBEDDING_MODEL, and OPENAI_EMBEDDING_DIMENSIONS from validated server env. Pass dimensions: 1536 to the embeddings request. No feature file may contain a model string.

- [ ] **Step 3: Implement OpenAI adapter**

Use the Responses API for text/image analysis and structured outputs. Use the embeddings endpoint for vectors. Map provider errors to AI_RATE_LIMITED, AI_TEMPORARILY_UNAVAILABLE, or AI_OUTPUT_INVALID.

- [ ] **Step 4: Verify and commit**

Run:

    pnpm test:contract -- provider
    pnpm typecheck
    git add src/server/ai tests/contract/ai
    git commit -m "feat: add typed OpenAI provider adapter"

### Task C2: Versioned prompts and structured analysis

**Agent:** Batch A Agent C

**Files:**

- Create: src/server/ai/prompts/scan-extract.v1.ts
- Create: src/server/ai/prompts/activate.v1.ts
- Create: src/server/ai/prompts/evaluate.v1.ts
- Create: src/server/ai/analyse-content.ts
- Create: src/features/analysis/analysis-card.tsx
- Test: tests/contract/ai/analyse-content.test.ts
- Test: src/features/analysis/analysis-card.test.tsx

**Interfaces:**

- Consumes: AiProvider, NormalisedContent, Profile.
- Produces analyseContent(input): Promise<AnalysisResult>.

- [ ] **Step 1: Write structured result tests**

Fixtures cover 太离谱了, 有点意思, and 说白了. Assert one to three expressions, exact source evidence, English meaning/function/tone, numeric confidence, and no invented expression absent from the source.

- [ ] **Step 2: Implement prompts**

Prompts state:

- learner is a native English speaker studying Mandarin Chinese;
- explanations must be concise English;
- candidate expressions must appear verbatim in the source;
- preserve register and regional caveats;
- return no complete learner response during analysis;
- uncertainty lowers confidence rather than inventing certainty.

- [ ] **Step 3: Implement analysis presentation**

Render source evidence in Chinese and all labels/explanations in English. Display at most three cards.

- [ ] **Step 4: Verify and commit**

Run:

    pnpm test:contract -- analyse-content
    pnpm vitest run src/features/analysis
    pnpm typecheck
    git add src/server/ai src/features/analysis tests/contract/ai
    git commit -m "feat: add structured Chinese analysis"

### Task C3: AI run persistence, cache, and bounded retry

**Agent:** Batch A Agent C

**Files:**

- Create: src/server/ai/cache-key.ts
- Create: src/server/ai/run-with-cache.ts
- Create: src/server/repositories/ai-run-repository.ts
- Test: src/server/ai/cache-key.test.ts
- Test: tests/integration/ai/run-with-cache.test.ts

**Interfaces:**

- Produces:
  - buildAiCacheKey(input): string
  - runWithCache(input, operation): Promise<T>

- [ ] **Step 1: Write cache-key tests**

The key changes when content hash, task type, prompt version, model, Chinese level, or learning goal changes. It remains stable across object key ordering.

- [ ] **Step 2: Implement canonical hash**

Use sorted JSON and SHA-256. Never include API keys, email, or raw user ID.

- [ ] **Step 3: Write retry and idempotency integration tests**

Assert cached success avoids provider call; rate limit retries at most twice; invalid structured output retries once; permanent failure persists failed status; concurrent same-key calls produce one succeeded cache record.

- [ ] **Step 4: Implement run persistence**

Record running, succeeded, or failed; prompt version; model; request duration; safe provider category; and structured result. Do not store raw sensitive content in logs.

- [ ] **Step 5: Verify and commit**

Run:

    pnpm vitest run src/server/ai/cache-key.test.ts
    pnpm test:integration -- run-with-cache
    pnpm typecheck
    git add src/server/ai src/server/repositories/ai-run-repository.ts tests/integration/ai
    git commit -m "feat: add versioned AI result cache"

### Task I-A: Primary-Agent integration gate

**Agent:** Primary Agent

**Files:**

- Create: src/app/api/v1/content/[contentId]/analysis/route.ts
- Create: tests/integration/content-analysis/content-analysis.test.ts
- Test: all Batch A checks.

**Interfaces:**

- POST /api/v1/content/:contentId/analysis returns ApiSuccess<AnalysisResult>.

- [ ] **Step 1: Write failing integrated test**

Authenticated user A imports text and analyses it through FakeAiProvider. User B receives FORBIDDEN for the content ID. A repeated request returns the cached result.

- [ ] **Step 2: Implement route orchestration**

Resolve user, load owned content, load profile, call runWithCache and analyseContent, then return the stable envelope.

- [ ] **Step 3: Verify**

Run:

    pnpm db:reset
    pnpm db:test
    pnpm test:integration -- content-analysis
    pnpm verify
    pnpm build

Expected: all commands exit 0.

- [ ] **Step 4: Commit**

Run:

    git add src/app/api/v1/content tests/integration/content-analysis
    git commit -m "feat: integrate content analysis platform"
