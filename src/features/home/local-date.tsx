"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};
const mounted = () => true;
const server = () => false;

export function LocalDate({ instant }: { readonly instant: string }) {
  const isMounted = useSyncExternalStore(subscribe, mounted, server);
  return <time dateTime={instant}>{isMounted ? new Intl.DateTimeFormat("en-US", {
    month: "short", day: "numeric", year: "numeric",
  }).format(new Date(instant)) : "…"}</time>;
}
