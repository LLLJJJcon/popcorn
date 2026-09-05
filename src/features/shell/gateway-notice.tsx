"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { apiSuccessSchema } from "@/contracts/api";
import { ModelGatewaySettingsViewSchema } from "@/contracts/model-gateway";

import styles from "./app-shell.module.css";

type NoticeState = "loading" | "hidden" | "required";

function requiresGatewaySetup(payload: unknown): boolean {
  const parsed = apiSuccessSchema(ModelGatewaySettingsViewSchema).safeParse(payload);
  return parsed.success && !parsed.data.data.configs.some(({ state }) => state === "active");
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
        if (mounted) setState(requiresGatewaySetup(payload) ? "required" : "hidden");
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
