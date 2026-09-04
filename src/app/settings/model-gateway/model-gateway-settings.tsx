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

async function requestConfig(
  endpoint: string,
  method: "PUT" | "POST" | "DELETE",
  body: unknown,
): Promise<ModelGatewayConfigView> {
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
  return parsed.data.data;
}

type SessionKey = { readonly value: string; readonly revealed: boolean };

function isValidGatewayBaseUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return (parsed.protocol === "https:" || parsed.protocol === "http:") && Boolean(parsed.host);
  } catch {
    return false;
  }
}

function appendCreatedConfig(
  settings: ModelGatewaySettingsView | null,
  createdConfig: ModelGatewayConfigView,
): ModelGatewaySettingsView {
  const configs = settings?.configs ?? [];
  return configs.some((config) => config.id === createdConfig.id)
    ? { configs }
    : { configs: [...configs, createdConfig] };
}

function reconcileFetchedSettings(
  settings: ModelGatewaySettingsView,
  fallbackConfig: ModelGatewayConfigView,
) {
  const config = settings.configs.find((candidate) => candidate.id === fallbackConfig.id);
  return {
    settings: config ? settings : appendCreatedConfig(settings, fallbackConfig),
    config: config ?? fallbackConfig,
  };
}

function DataSharingSummary({ exactBaseUrl }: { readonly exactBaseUrl: string }) {
  return (
    <div className={styles.consentSummary}>
      <p>Exact destination: <span className={styles.origin}>{exactBaseUrl || "Enter a gateway base URL to review its exact destination."}</span></p>
      <p>Policy: <strong>model-egress-v1</strong></p>
      <p>Popcorn may send:</p>
      <ul>{DATA_CLASSES.map((item) => <li key={item}>{item}</li>)}</ul>
    </div>
  );
}

function SessionKeyDisplay({
  config,
  sessionKey,
  onToggle,
}: {
  readonly config: ModelGatewayConfigView;
  readonly sessionKey: SessionKey;
  readonly onToggle: () => void;
}) {
  const label = `API key entered this session for ${config.displayName}`;
  const inputId = `session-key-${config.id}`;
  const action = sessionKey.revealed ? "Hide" : "Show";
  return (
    <div className={styles.sessionKey}>
      <label>
        {label}
        <input
          id={inputId}
          type={sessionKey.revealed ? "text" : "password"}
          readOnly
          value={sessionKey.value}
          autoComplete="off"
          spellCheck={false}
          aria-describedby={`session-key-lifetime-${config.id}`}
        />
      </label>
      <p id={`session-key-lifetime-${config.id}`}>Available until you refresh or leave this page.</p>
      <button
        className={styles.secondaryButton}
        type="button"
        aria-controls={inputId}
        aria-label={`${action} key for ${config.displayName}`}
        onClick={onToggle}
      >
        {action} key
      </button>
    </div>
  );
}

export function ModelGatewaySettings() {
  const [settings, setSettings] = useState<ModelGatewaySettingsView | null>(null);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [status, setStatus] = useState("Loading gateway settings…");
  const [busy, setBusy] = useState(false);
  const [baseUrl, setBaseUrl] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [model, setModel] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [createInvalid, setCreateInvalid] = useState(false);
  const [createConsent, setCreateConsent] = useState(false);
  const [sessionKeys, setSessionKeys] = useState<Record<string, SessionKey>>({});
  const [renameDrafts, setRenameDrafts] = useState<Record<string, string>>({});
  const [renameInvalidId, setRenameInvalidId] = useState<string | null>(null);
  const [rotatingId, setRotatingId] = useState<string | null>(null);
  const [rotationKeys, setRotationKeys] = useState<Record<string, string>>({});
  const [rotationInvalidId, setRotationInvalidId] = useState<string | null>(null);
  const [revokeId, setRevokeId] = useState<string | null>(null);
  const revokeConfirmRef = useRef<HTMLButtonElement | null>(null);
  const trimmedBaseUrl = baseUrl.trim();
  const hasValidBaseUrl = isValidGatewayBaseUrl(trimmedBaseUrl);

  useEffect(() => {
    let active = true;
    void requestSettings()
      .then((nextSettings) => {
        if (!active) return;
        setSettings(nextSettings);
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

  function clearConfigTransientState(configId: string) {
    setSessionKeys((current) => {
      const next = { ...current };
      delete next[configId];
      return next;
    });
    setRotationKeys((current) => {
      const next = { ...current };
      delete next[configId];
      return next;
    });
    setRotationInvalidId((current) => current === configId ? null : current);
    setRotatingId((current) => current === configId ? null : current);
    setRevokeId((current) => current === configId ? null : current);
  }

  function commitFetchedSettings(
    nextSettings: ModelGatewaySettingsView,
    fallbackConfig: ModelGatewayConfigView,
  ) {
    const reconciliation = reconcileFetchedSettings(nextSettings, fallbackConfig);
    setSettings(reconciliation.settings);
    if (reconciliation.config.state === "revoked") {
      clearConfigTransientState(reconciliation.config.id);
    }
    return reconciliation;
  }

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
      await requestConfig(endpoint, method, body);
      const nextSettings = await requestSettings();
      setSettings(nextSettings);
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
    const valid = Boolean(hasValidBaseUrl && displayName.trim() && model.trim() && writeOnlyKey.trim() && createConsent);
    setCreateInvalid(!valid);
    setActionError(valid ? null : "Complete all fields before saving.");
    if (!valid || busy) return;
    setBusy(true);
    setActionError(null);
    let created: ModelGatewayConfigView | null = null;
    let refetchedSettings: ModelGatewaySettingsView | null = null;
    let requestedSettings = false;
    const clearCreateForm = () => {
      setBaseUrl("");
      setDisplayName("");
      setModel("");
      setApiKey("");
      setCreateConsent(false);
      setCreateInvalid(false);
    };
    const finishActivation = (nextSettings: ModelGatewaySettingsView, configId: string) => {
      setSettings(nextSettings);
      setPageError(null);
      setSessionKeys((current) => ({
        ...current,
        [configId]: { value: writeOnlyKey, revealed: false },
      }));
      clearCreateForm();
      setStatus("Gateway saved and activated.");
    };
    try {
      created = await requestConfig(SETTINGS_ENDPOINT, "PUT", {
        displayName: displayName.trim(),
        baseUrl: baseUrl.trim(),
        model: model.trim(),
        apiKey: writeOnlyKey,
      });
      const createdConfig = created;
      const activated = await requestConfig(CONSENT_ENDPOINT, "POST", {
        configId: createdConfig.id,
        exactBaseUrl: createdConfig.baseUrl,
        policyVersion: "model-egress-v1",
        confirmed: true,
      });
      if (activated.id !== createdConfig.id || activated.state !== "active") {
        throw new TypeError("mutation failed");
      }
      requestedSettings = true;
      refetchedSettings = await requestSettings();
      const authoritativeConfig = refetchedSettings.configs.find((config) => config.id === createdConfig.id);
      if (authoritativeConfig?.state !== "active") {
        throw new TypeError("activation unconfirmed");
      }
      finishActivation(refetchedSettings, activated.id);
    } catch {
      if (created) {
        const createdConfig = created;
        if (!requestedSettings) {
          requestedSettings = true;
          try {
            refetchedSettings = await requestSettings();
          } catch {
            refetchedSettings = null;
          }
        }
        const recoveredSettings = refetchedSettings;
        const authoritativeConfig = recoveredSettings?.configs.find((config) => config.id === createdConfig.id);
        if (authoritativeConfig?.state === "active" && recoveredSettings) {
          finishActivation(recoveredSettings, createdConfig.id);
          return;
        }
        const recoveryConfig = recoveredSettings
          ? commitFetchedSettings(recoveredSettings, createdConfig).config
          : createdConfig;
        if (!recoveredSettings) {
          setSettings((current) => appendCreatedConfig(current, createdConfig));
        }
        setPageError(null);
        if (recoveryConfig.state !== "revoked") {
          setSessionKeys((current) => ({
            ...current,
            [createdConfig.id]: { value: writeOnlyKey, revealed: false },
          }));
        }
        clearCreateForm();
        setActionError(recoveryConfig.state === "revoked"
          ? "Gateway was revoked before activation could be completed."
          : "Gateway saved but not activated. Finish activation below.");
        setStatus("");
        return;
      }
      setActionError(GENERIC_ERROR);
      setStatus("");
    } finally {
      setBusy(false);
    }
  }

  async function consent(config: ModelGatewayConfigView) {
    if (busy) return;
    setBusy(true);
    setActionError(null);
    try {
      let consented: ModelGatewayConfigView | null = null;
      try {
        consented = await requestConfig(CONSENT_ENDPOINT, "POST", {
          configId: config.id,
          exactBaseUrl: config.baseUrl,
          policyVersion: "model-egress-v1",
          confirmed: true,
        });
      } catch {
        consented = null;
      }
      const nextSettings = await requestSettings();
      const authoritativeConfig = nextSettings.configs.find((candidate) => candidate.id === config.id);
      commitFetchedSettings(nextSettings, config);
      const responseMatchesActivation = consented?.id === config.id && consented.state === "active";
      if (authoritativeConfig?.state !== "active") {
        throw new TypeError(responseMatchesActivation ? "activation unavailable" : "activation unconfirmed");
      }
      setPageError(null);
      setStatus("Gateway activated.");
    } catch {
      setActionError(GENERIC_ERROR);
      setStatus("");
    } finally {
      setBusy(false);
    }
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
    if (!writeOnlyKey.trim()) {
      setRotationInvalidId(config.id);
      setActionError("Enter a new API key before saving.");
      return;
    }
    if (busy) return;
    setRotationInvalidId(null);
    setBusy(true);
    setActionError(null);
    try {
      await requestConfig(SETTINGS_ENDPOINT, "PUT", {
        configId: config.id,
        apiKey: writeOnlyKey,
      });
      const nextSettings = await requestSettings();
      const reconciliation = commitFetchedSettings(nextSettings, config);
      setPageError(null);
      if (reconciliation.config.state === "revoked") {
        setStatus("Gateway was revoked. API key was not retained.");
      } else {
        setSessionKeys((current) => ({
          ...current,
          [config.id]: { value: writeOnlyKey, revealed: false },
        }));
        setRotationKeys((current) => {
          const next = { ...current };
          delete next[config.id];
          return next;
        });
        setRotatingId(null);
        setStatus("API key replaced.");
      }
    } catch {
      setActionError(GENERIC_ERROR);
      setStatus("");
    } finally {
      setBusy(false);
    }
  }

  async function revoke(config: ModelGatewayConfigView) {
    if (busy) return;
    const changed = await mutate(SETTINGS_ENDPOINT, "DELETE", {
      configId: config.id,
    }, "Gateway revoked.");
    if (changed) {
      clearConfigTransientState(config.id);
    }
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
              <p>Your key is sent directly to the server and is available here only until you refresh or leave this page.</p>
            </div>
            <form className={styles.formGrid} onSubmit={createGateway} aria-label="Add a model gateway" aria-describedby={createInvalid ? "gateway-action-error" : undefined} autoComplete="off">
                <label htmlFor="model-gateway-base-url">
                  Gateway base URL
                  <input
                    id="model-gateway-base-url"
                    name="model-gateway-base-url"
                    type="url"
                    autoComplete="off"
                    value={baseUrl}
                    onChange={(event) => {
                      setBaseUrl(event.target.value);
                      setCreateConsent(false);
                    }}
                    maxLength={453}
                    placeholder="https://api.example.com/v1"
                    aria-invalid={createInvalid && !baseUrl.trim()}
                    aria-describedby={createInvalid ? "gateway-action-error" : undefined}
                    disabled={busy}
                  />
                </label>
                <label htmlFor="model-gateway-display-name">
                  Display name
                  <input
                    id="model-gateway-display-name"
                    name="model-gateway-display-name"
                    autoComplete="off"
                    value={displayName}
                    onChange={(event) => setDisplayName(event.target.value)}
                    maxLength={80}
                    aria-invalid={createInvalid && !displayName.trim()}
                    aria-describedby={createInvalid ? "gateway-action-error" : undefined}
                    disabled={busy}
                  />
                </label>
                <label htmlFor="model-gateway-model">
                  Model
                  <input
                    id="model-gateway-model"
                    name="model-gateway-model"
                    autoComplete="off"
                    value={model}
                    onChange={(event) => setModel(event.target.value)}
                    maxLength={100}
                    aria-invalid={createInvalid && !model.trim()}
                    aria-describedby={createInvalid ? "gateway-action-error" : undefined}
                    disabled={busy}
                  />
                </label>
                <label htmlFor="model-gateway-api-key">
                  API key
                  <input
                    id="model-gateway-api-key"
                    name="model-gateway-api-key"
                    type="password"
                    autoComplete="new-password"
                    spellCheck={false}
                    value={apiKey}
                    onChange={(event) => setApiKey(event.target.value)}
                    maxLength={4_096}
                    aria-invalid={createInvalid && !apiKey.trim()}
                    aria-describedby={createInvalid ? "gateway-action-error" : undefined}
                    disabled={busy}
                  />
                </label>
                {hasValidBaseUrl ? (
                  <fieldset className={styles.consent}>
                    <legend>Review destination and data sharing</legend>
                    <DataSharingSummary exactBaseUrl={trimmedBaseUrl} />
                    <label className={styles.checkLabel}>
                      <input
                        type="checkbox"
                        checked={createConsent}
                        onChange={(event) => {
                          setCreateConsent(event.target.checked);
                          if (createInvalid) {
                            setCreateInvalid(false);
                            setActionError(null);
                          }
                        }}
                        aria-invalid={createInvalid && !createConsent}
                        aria-describedby={createInvalid ? "gateway-action-error" : undefined}
                        disabled={busy}
                      />
                      I confirm this exact destination and data sharing.
                    </label>
                  </fieldset>
                ) : null}
                <button
                  className={styles.primaryButton}
                  type="submit"
                  disabled={busy || !hasValidBaseUrl || !displayName.trim() || !model.trim() || !apiKey.trim() || !createConsent}
                >
                  Save and activate gateway
                </button>
              </form>
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
                        <p className={styles.origin}>{config.baseUrl}</p>
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

                    {config.state !== "revoked" && sessionKeys[config.id] ? (
                      <SessionKeyDisplay
                        config={config}
                        sessionKey={sessionKeys[config.id]}
                        onToggle={() => setSessionKeys((current) => ({
                          ...current,
                          [config.id]: {
                            ...current[config.id],
                            revealed: !current[config.id].revealed,
                          },
                        }))}
                      />
                    ) : null}

                    {config.state === "pending_consent" ? (
                      <div className={styles.consent}>
                        <DataSharingSummary exactBaseUrl={config.baseUrl} />
                        <button
                          className={styles.primaryButton}
                          type="button"
                          disabled={busy}
                          onClick={() => void consent(config)}
                        >
                          Confirm and finish activation
                        </button>
                      </div>
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
                          <form onSubmit={(event) => void rotate(config, event)} aria-label={`Rotate API key for ${config.displayName}`} autoComplete="off">
                            <label htmlFor="model-gateway-rotation-api-key">
                              New API key for {config.displayName}
                              <input
                                id="model-gateway-rotation-api-key"
                                name="model-gateway-rotation-api-key"
                                type="password"
                                autoComplete="new-password"
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
