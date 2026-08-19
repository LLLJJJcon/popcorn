"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";

import { apiSuccessSchema } from "@/contracts/api";
import {
  ModelGatewayConfigViewSchema,
  ModelGatewaySettingsViewSchema,
  type ModelGatewayConfigView,
  type ModelGatewaySettingsView,
} from "@/contracts/model-gateway";

import styles from "./model-gateway-settings.module.css";

const SETTINGS_ENDPOINT = "/api/v1/settings/model-gateway";
const CONSENT_ENDPOINT = "/api/v1/settings/model-gateway/consent";
const GENERIC_ERROR = "Could not save gateway settings. Try again.";
const DATA_CLASSES = [
  "Video title",
  "Necessary Chinese transcript excerpt or selection",
  "Timestamps",
  "Versioned prompt",
] as const;

async function parseJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

async function requestSettings(): Promise<ModelGatewaySettingsView> {
  const response = await fetch(SETTINGS_ENDPOINT, {
    credentials: "same-origin",
    cache: "no-store",
  });
  if (!response.ok) throw new TypeError("settings unavailable");
  const parsed = apiSuccessSchema(ModelGatewaySettingsViewSchema).safeParse(await parseJson(response));
  if (!parsed.success) throw new TypeError("settings unavailable");
  return parsed.data.data;
}

export function ModelGatewaySettings() {
  const [settings, setSettings] = useState<ModelGatewaySettingsView | null>(null);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [status, setStatus] = useState("Loading gateway settings…");
  const [busy, setBusy] = useState(false);
  const [originId, setOriginId] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [model, setModel] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [createInvalid, setCreateInvalid] = useState(false);
  const [consents, setConsents] = useState<Record<string, boolean>>({});
  const [renameDrafts, setRenameDrafts] = useState<Record<string, string>>({});
  const [renameInvalidId, setRenameInvalidId] = useState<string | null>(null);
  const [rotatingId, setRotatingId] = useState<string | null>(null);
  const [rotationKeys, setRotationKeys] = useState<Record<string, string>>({});
  const [rotationInvalidId, setRotationInvalidId] = useState<string | null>(null);
  const [revokeId, setRevokeId] = useState<string | null>(null);
  const revokeConfirmRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    let active = true;
    void requestSettings()
      .then((nextSettings) => {
        if (!active) return;
        setSettings(nextSettings);
        setOriginId(nextSettings.origins[0]?.id || "");
        setPageError(null);
        setLoading(false);
        setStatus("Gateway settings loaded.");
      })
      .catch(() => {
        if (!active) return;
        setLoading(false);
        setPageError("Gateway settings are unavailable. Try again.");
        setStatus("");
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (revokeId) revokeConfirmRef.current?.focus();
  }, [revokeId]);

  async function mutate(
    endpoint: string,
    method: "PUT" | "POST" | "DELETE",
    body: unknown,
    message: string,
  ): Promise<boolean> {
    if (busy) return false;
    setBusy(true);
    setActionError(null);
    try {
      const response = await fetch(endpoint, {
        method,
        credentials: "same-origin",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!response.ok) throw new TypeError("mutation failed");
      const parsed = apiSuccessSchema(ModelGatewayConfigViewSchema).safeParse(await parseJson(response));
      if (!parsed.success) throw new TypeError("mutation failed");
      const nextSettings = await requestSettings();
      setSettings(nextSettings);
      setOriginId((current) => current || nextSettings.origins[0]?.id || "");
      setPageError(null);
      setStatus(message);
      return true;
    } catch {
      setActionError(GENERIC_ERROR);
      setStatus("");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function createGateway(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const writeOnlyKey = apiKey;
    setApiKey("");
    const valid = Boolean(originId && displayName.trim() && model.trim() && writeOnlyKey.trim());
    setCreateInvalid(!valid);
    setActionError(valid ? null : "Complete all fields before saving.");
    if (!valid || busy) return;
    await mutate(SETTINGS_ENDPOINT, "PUT", {
      originId,
      displayName: displayName.trim(),
      model: model.trim(),
      apiKey: writeOnlyKey,
    }, "Gateway saved. Confirm data sharing to activate it.");
  }

  async function consent(config: ModelGatewayConfigView) {
    if (!consents[config.id] || busy) return;
    await mutate(CONSENT_ENDPOINT, "POST", {
      configId: config.id,
      exactOrigin: config.origin.canonicalOrigin,
      policyVersion: "model-egress-v1",
      confirmed: true,
    }, "Gateway activated.");
  }

  async function rename(config: ModelGatewayConfigView, event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextName = (renameDrafts[config.id] ?? config.displayName).trim();
    if (!nextName) {
      setRenameInvalidId(config.id);
      setActionError("Enter a display name before renaming.");
      return;
    }
    if (busy) return;
    setRenameInvalidId(null);
    await mutate(SETTINGS_ENDPOINT, "PUT", {
      configId: config.id,
      displayName: nextName,
    }, "Gateway renamed.");
  }

  async function rotate(config: ModelGatewayConfigView, event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const writeOnlyKey = rotationKeys[config.id] ?? "";
    setRotationKeys((current) => ({ ...current, [config.id]: "" }));
    if (!writeOnlyKey.trim()) {
      setRotationInvalidId(config.id);
      setActionError("Enter a new API key before saving.");
      return;
    }
    if (busy) return;
    setRotationInvalidId(null);
    await mutate(SETTINGS_ENDPOINT, "PUT", {
      configId: config.id,
      apiKey: writeOnlyKey,
    }, "API key replaced.");
  }

  async function revoke(config: ModelGatewayConfigView) {
    if (busy) return;
    const changed = await mutate(SETTINGS_ENDPOINT, "DELETE", {
      configId: config.id,
    }, "Gateway revoked.");
    if (changed) setRevokeId(null);
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Popcorn learner settings</p>
          <h1>Model gateway settings</h1>
          <p>Choose where Popcorn sends only the learning context you approve.</p>
        </div>
        <form action="/auth/sign-out" method="post">
          <button className={styles.secondaryButton} type="submit">Sign out</button>
        </form>
      </header>

      <p className={styles.status} role="status" aria-live="polite">{status}</p>
      {pageError ? <p className={styles.error} role="alert">{pageError}</p> : null}
      {actionError ? <p id="gateway-action-error" className={styles.error} role="alert">{actionError}</p> : null}

      {loading ? null : (
        <>
          <section className={styles.panel} aria-labelledby="new-gateway-title">
            <div className={styles.sectionHeading}>
              <div>
                <p className={styles.step}>Step 1</p>
                <h2 id="new-gateway-title">Add a gateway</h2>
              </div>
              <p>Your key is sent directly to the server and is never shown again.</p>
            </div>
            {settings?.origins.length === 0 ? (
              <p>No approved gateways are available yet.</p>
            ) : (
              <form className={styles.formGrid} onSubmit={createGateway} aria-describedby={createInvalid ? "gateway-action-error" : undefined}>
                <label>
                  Approved gateway
                  <select value={originId} onChange={(event) => setOriginId(event.target.value)} disabled={busy}>
                    {settings?.origins.map((item) => (
                      <option key={item.id} value={item.id}>{item.displayName} — {item.canonicalOrigin}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Display name
                  <input
                    value={displayName}
                    onChange={(event) => setDisplayName(event.target.value)}
                    maxLength={80}
                    aria-invalid={createInvalid && !displayName.trim()}
                    aria-describedby={createInvalid ? "gateway-action-error" : undefined}
                    disabled={busy}
                  />
                </label>
                <label>
                  Model
                  <input
                    value={model}
                    onChange={(event) => setModel(event.target.value)}
                    maxLength={100}
                    aria-invalid={createInvalid && !model.trim()}
                    aria-describedby={createInvalid ? "gateway-action-error" : undefined}
                    disabled={busy}
                  />
                </label>
                <label>
                  API key
                  <input
                    type="password"
                    autoComplete="off"
                    spellCheck={false}
                    value={apiKey}
                    onChange={(event) => setApiKey(event.target.value)}
                    maxLength={4_096}
                    aria-invalid={createInvalid && !apiKey.trim()}
                    aria-describedby={createInvalid ? "gateway-action-error" : undefined}
                    disabled={busy}
                  />
                </label>
                <button className={styles.primaryButton} type="submit" disabled={busy}>Save gateway</button>
              </form>
            )}
          </section>

          <section className={styles.panel} aria-labelledby="configured-gateways-title">
            <div className={styles.sectionHeading}>
              <div>
                <p className={styles.step}>Step 2</p>
                <h2 id="configured-gateways-title">Configured gateways</h2>
              </div>
              <p>Review consent, replace keys, or revoke access at any time.</p>
            </div>
            {settings?.configs.length === 0 ? (
              <p>You have not configured a gateway yet.</p>
            ) : (
              <div className={styles.cards}>
                {settings?.configs.map((config) => (
                  <article className={styles.card} key={config.id} role="region" aria-label={config.displayName}>
                    <div className={styles.cardHeading}>
                      <div>
                        <h3>{config.displayName}</h3>
                        <p className={styles.origin}>{config.origin.canonicalOrigin}</p>
                      </div>
                      <span className={`${styles.state} ${styles[config.state]}`}>
                        {config.state === "pending_consent" ? "Pending consent" : config.state === "active" ? "Active" : "Revoked"}
                      </span>
                    </div>
                    <dl className={styles.details}>
                      <div><dt>Model</dt><dd>{config.model}</dd></div>
                      <div><dt>Revision</dt><dd>Revision {config.revision}</dd></div>
                      <div><dt>Credential</dt><dd>{config.hasApiKey ? "Key saved" : "No key saved"}</dd></div>
                    </dl>

                    {config.state === "pending_consent" ? (
                      <fieldset className={styles.consent}>
                        <legend>Confirm data sharing for {config.displayName}</legend>
                        <p>Exact destination: <span className={styles.origin}>{config.origin.canonicalOrigin}</span></p>
                        <p>Policy: <strong>model-egress-v1</strong></p>
                        <p>Popcorn may send:</p>
                        <ul>{DATA_CLASSES.map((item) => <li key={item}>{item}</li>)}</ul>
                        <label className={styles.checkLabel}>
                          <input
                            type="checkbox"
                            checked={Boolean(consents[config.id])}
                            onChange={(event) => setConsents((current) => ({ ...current, [config.id]: event.target.checked }))}
                            disabled={busy}
                          />
                          I confirm this exact destination and data sharing.
                        </label>
                        <button
                          className={styles.primaryButton}
                          type="button"
                          disabled={busy || !consents[config.id]}
                          onClick={() => void consent(config)}
                        >
                          Activate gateway
                        </button>
                      </fieldset>
                    ) : null}

                    {config.state === "active" ? (
                      <div className={styles.actions}>
                        <form onSubmit={(event) => void rename(config, event)}>
                          <label>
                            New display name for {config.displayName}
                            <input
                              value={renameDrafts[config.id] ?? config.displayName}
                              onChange={(event) => {
                                setRenameDrafts((current) => ({ ...current, [config.id]: event.target.value }));
                                if (renameInvalidId === config.id) {
                                  setRenameInvalidId(null);
                                  setActionError(null);
                                }
                              }}
                              maxLength={80}
                              aria-invalid={renameInvalidId === config.id ? true : undefined}
                              aria-describedby={renameInvalidId === config.id ? "gateway-action-error" : undefined}
                              disabled={busy}
                            />
                          </label>
                          <button className={styles.secondaryButton} type="submit" disabled={busy}>Rename {config.displayName}</button>
                        </form>

                        {rotatingId === config.id ? (
                          <form onSubmit={(event) => void rotate(config, event)}>
                            <label>
                              New API key for {config.displayName}
                              <input
                                type="password"
                                autoComplete="off"
                                spellCheck={false}
                                value={rotationKeys[config.id] ?? ""}
                                onChange={(event) => {
                                  setRotationKeys((current) => ({ ...current, [config.id]: event.target.value }));
                                  if (rotationInvalidId === config.id) {
                                    setRotationInvalidId(null);
                                    setActionError(null);
                                  }
                                }}
                                maxLength={4_096}
                                aria-invalid={rotationInvalidId === config.id ? true : undefined}
                                aria-describedby={rotationInvalidId === config.id ? "gateway-action-error" : undefined}
                                disabled={busy}
                              />
                            </label>
                            <div className={styles.buttonRow}>
                              <button className={styles.primaryButton} type="submit" disabled={busy}>Save new key for {config.displayName}</button>
                              <button
                                className={styles.secondaryButton}
                                type="button"
                                disabled={busy}
                                onClick={() => {
                                  setRotationKeys((current) => ({ ...current, [config.id]: "" }));
                                  setRotationInvalidId(null);
                                  setActionError(null);
                                  setRotatingId(null);
                                }}
                              >
                                Cancel rotation
                              </button>
                            </div>
                          </form>
                        ) : (
                          <button
                            className={styles.secondaryButton}
                            type="button"
                            disabled={busy}
                            onClick={() => {
                              setRotationKeys((current) => ({ ...current, [config.id]: "" }));
                              setRotationInvalidId(null);
                              setActionError(null);
                              setRotatingId(config.id);
                            }}
                          >
                            Rotate key for {config.displayName}
                          </button>
                        )}

                        {revokeId === config.id ? (
                          <div className={styles.confirmation} role="group" aria-label={`Confirm revoke ${config.displayName}`}>
                            <p>Revoke this gateway? Saved credentials will no longer be available.</p>
                            <div className={styles.buttonRow}>
                              <button
                                ref={revokeConfirmRef}
                                className={styles.dangerButton}
                                type="button"
                                disabled={busy}
                                onClick={() => void revoke(config)}
                              >
                                Confirm revoke
                              </button>
                              <button className={styles.secondaryButton} type="button" disabled={busy} onClick={() => setRevokeId(null)}>Cancel</button>
                            </div>
                          </div>
                        ) : (
                          <button className={styles.dangerButton} type="button" disabled={busy} onClick={() => setRevokeId(config.id)}>
                            Revoke {config.displayName}
                          </button>
                        )}
                      </div>
                    ) : null}
                  </article>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </main>
  );
}
