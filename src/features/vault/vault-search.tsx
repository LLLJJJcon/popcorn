"use client";

import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";

import {
  ExpressionSearchApiSuccessSchema,
  type ExpressionSearchResult,
} from "@/features/vault/search-schema";

type Filters = {
  readonly query: string;
  readonly communicativeFunction: string;
  readonly register: string;
  readonly videoSourceId: string;
  readonly masteryState: string;
  readonly createdFrom: string;
  readonly createdBefore: string;
};

const EMPTY_FILTERS: Filters = {
  query: "",
  communicativeFunction: "",
  register: "",
  videoSourceId: "",
  masteryState: "",
  createdFrom: "",
  createdBefore: "",
};

const MATCH_LABELS: Record<ExpressionSearchResult["matchReason"], string> = {
  exact: "Exact match",
  prefix: "Prefix match",
  substring: "Substring match",
  trigram: "Close text match",
  english_meaning: "English meaning match",
  communicative_function: "Function match",
  register: "Register match",
  recent: "Recently learned",
};

function searchUrl(filters: Filters): string {
  const parameters = new URLSearchParams({ search: "1", q: filters.query });
  if (filters.communicativeFunction) parameters.set("function", filters.communicativeFunction);
  if (filters.register) parameters.set("register", filters.register);
  if (filters.videoSourceId) parameters.set("source", filters.videoSourceId);
  if (filters.masteryState) parameters.set("mastery", filters.masteryState);
  if (filters.createdFrom) parameters.set("from", `${filters.createdFrom}T00:00:00.000Z`);
  if (filters.createdBefore) parameters.set("before", `${filters.createdBefore}T00:00:00.000Z`);
  parameters.set("limit", "20");
  return `/api/v1/vault?${parameters.toString()}`;
}

export function VaultSearch() {
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [results, setResults] = useState<readonly ExpressionSearchResult[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const inputRef = useRef<HTMLInputElement>(null);
  const resultRefs = useRef<Array<HTMLAnchorElement | null>>([]);

  useEffect(() => {
    const timeout = window.setTimeout(async () => {
      setState("loading");
      try {
        const response = await fetch(searchUrl(filters), {
          credentials: "same-origin",
          cache: "no-store",
        });
        if (!response.ok) throw new Error("search failed");
        const parsed = ExpressionSearchApiSuccessSchema.parse(await response.json());
        setResults(parsed.data);
        resultRefs.current = resultRefs.current.slice(0, parsed.data.length);
        setState("ready");
      } catch {
        setResults([]);
        setState("error");
      }
    }, 250);
    return () => window.clearTimeout(timeout);
  }, [filters]);

  function update<K extends keyof Filters>(key: K, value: Filters[K]) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  function focusResult(index: number) {
    resultRefs.current[index]?.focus();
  }

  function resultKeyDown(event: KeyboardEvent<HTMLAnchorElement>, index: number) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      focusResult(Math.min(index + 1, results.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      if (index === 0) inputRef.current?.focus();
      else focusResult(index - 1);
    }
  }

  return (
    <section aria-labelledby="vault-search-heading">
      <h2 id="vault-search-heading">Search your Vault</h2>
      <form onSubmit={(event: FormEvent) => event.preventDefault()}>
        <label>Search expressions
          <input
            ref={inputRef}
            type="search"
            value={filters.query}
            maxLength={200}
            onChange={(event) => update("query", event.currentTarget.value)}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown" && results.length > 0) {
                event.preventDefault();
                focusResult(0);
              }
            }}
          />
        </label>
        <label>Communicative function
          <input value={filters.communicativeFunction} maxLength={300} onChange={(event) => update("communicativeFunction", event.currentTarget.value)} />
        </label>
        <label>Register
          <input value={filters.register} maxLength={200} onChange={(event) => update("register", event.currentTarget.value)} />
        </label>
        <label>Video source ID
          <input value={filters.videoSourceId} onChange={(event) => update("videoSourceId", event.currentTarget.value)} />
        </label>
        <label>Mastery
          <select value={filters.masteryState} onChange={(event) => update("masteryState", event.currentTarget.value)}>
            <option value="">Any mastery</option>
            <option value="tried">Tried</option>
            <option value="reused">Reused</option>
            <option value="owned">Owned</option>
          </select>
        </label>
        <label>Learned from
          <input type="date" value={filters.createdFrom} onChange={(event) => update("createdFrom", event.currentTarget.value)} />
        </label>
        <label>Learned before
          <input type="date" value={filters.createdBefore} onChange={(event) => update("createdBefore", event.currentTarget.value)} />
        </label>
        <button type="button" onClick={() => setFilters(EMPTY_FILTERS)}>Clear filters</button>
      </form>

      {state === "loading" && <p role="status">Searching your Vault…</p>}
      {state === "error" && <p role="alert">Vault search is unavailable. Try again.</p>}
      {state === "ready" && results.length === 0 && <p>No learned expressions match these filters.</p>}
      {state === "ready" && results.length > 0 && (
        <ul aria-label="Vault search results">
          {results.map((result, index) => (
            <li key={result.userExpressionId}>
              <a
                ref={(element) => { resultRefs.current[index] = element; }}
                href={`/vault#expression-${result.userExpressionId}`}
                onKeyDown={(event) => resultKeyDown(event, index)}
              >
                <span lang="zh-CN">{result.expressionText}</span> — {result.englishMeaning}
              </a>
              <p>
                {result.sourceCount} {result.sourceCount === 1 ? "source" : "sources"} · {result.masteryState} · {MATCH_LABELS[result.matchReason]}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
