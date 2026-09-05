"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import styles from "./app-shell.module.css";

type NoticeState = "loading" | "hidden" | "required";

function hasActiveConfig(payload: unknown): boolean {
  if (!payload || typeof payload !== "object" || !("data" in payload)) return false;
  const data = payload.data;
  if (!data || typeof data !== "object" || !("configs" in data) || !Array.isArray(data.configs)) {
    return false;
  }
  return data.configs.some((config) =>
    config !== null && typeof config === "object" && "state" in config && config.state === "active"
  );
}

export function GatewayNotice(): React.JSX.Element | null {
  const [state, setState] = useState<NoticeState>("loading");

  useEffect(() => {
    let mounted = true;
    void fetch("/api/v1/settings/model-gateway", {
      credentials: "same-origin",
      cache: "no-store",
    })
      .then(async (response) => {
        if (!response.ok) throw new TypeError("settings unavailable");
        const payload: unknown = await response.json();
        if (mounted) setState(hasActiveConfig(payload) ? "hidden" : "required");
      })
      .catch(() => {
        if (mounted) setState("hidden");
      });
    return () => { mounted = false; };
  }, []);

  if (state !== "required") return null;

  return (
    <aside className={styles.gatewayNotice} role="status">
      <p><strong>Set up a model gateway</strong> to unlock generated learning support. Your saved moments stay available.</p>
      <Link href="/settings/model-gateway">Open Settings</Link>
    </aside>
  );
}
