import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import type { ModelGatewayConfigView, ModelGatewaySettingsView } from "@/contracts/model-gateway";

import { ModelGatewaySettings } from "./model-gateway-settings";

const ORIGIN_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const CONFIG_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const NOW = "2026-08-20T00:00:00.000Z";
const origin = {
  id: ORIGIN_ID,
  slug: "approved-gateway",
  displayName: "Approved Gateway",
  canonicalOrigin: "https://gateway.example.com",
  adapterKind: "openai-compatible" as const,
};
const pending: ModelGatewayConfigView = {
  id: CONFIG_ID,
  displayName: "My Gateway",
  origin,
  model: "mandarin-model",
  revision: 1,
  configFingerprint: "a".repeat(64),
  state: "pending_consent",
  consent: null,
  hasApiKey: true,
  createdAt: NOW,
  updatedAt: NOW,
};
const active: ModelGatewayConfigView = {
  ...pending,
  state: "active",
  consent: {
    exactOrigin: origin.canonicalOrigin,
    policyVersion: "model-egress-v1",
    consentedAt: NOW,
  },
};
const revoked: ModelGatewayConfigView = {
  ...active,
  id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
  displayName: "Old Gateway",
  state: "revoked",
  hasApiKey: false,
};

function success<T>(data: T) {
  return { ok: true as const, data, requestId: "request-safe" };
}

function response<T>(data: T, status = 200) {
  return Response.json(success(data), { status, headers: { "Cache-Control": "no-store" } });
}

function settings(configs: ModelGatewayConfigView[] = []): ModelGatewaySettingsView {
  return { origins: [origin], configs };
}

function mockFetch(...results: Array<Response | Error | Promise<Response>>) {
  const fetchMock = vi.fn();
  for (const result of results) {
    if (result instanceof Error) fetchMock.mockRejectedValueOnce(result);
    else fetchMock.mockImplementationOnce(() => Promise.resolve(result));
  }
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("ModelGatewaySettings", () => {
  it("renders a polite loading state, then empty catalog and configuration states", async () => {
    let resolve!: (value: Response) => void;
    const waiting = new Promise<Response>((done) => { resolve = done; });
    mockFetch(waiting);
    render(<ModelGatewaySettings />);
    expect(screen.getByRole("status")).toHaveTextContent("Loading gateway settings");

    await act(async () => resolve(response({ origins: [], configs: [] })));
    expect(await screen.findByText("No approved gateways are available yet.")).toBeInTheDocument();
    expect(screen.getByText("You have not configured a gateway yet.")).toBeInTheDocument();
  });

  it("uses a generic accessible error for failed or malformed settings requests", async () => {
    mockFetch(Response.json({ raw: "vault-secret provider failure" }, { status: 500 }));
    render(<ModelGatewaySettings />);
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Gateway settings are unavailable. Try again.");
    expect(document.body).not.toHaveTextContent(/vault-secret|provider failure/i);
  });

  it("shows only approved gateway inputs and fixed pending-consent disclosures", async () => {
    mockFetch(response(settings([pending])));
    render(<ModelGatewaySettings />);

    expect(await screen.findByRole("heading", { name: "Model gateway settings" })).toBeInTheDocument();
    expect(screen.getByLabelText("Approved gateway")).toHaveValue(ORIGIN_ID);
    const key = screen.getByLabelText("API key");
    expect(key).toHaveAttribute("type", "password");
    expect(key).toHaveAttribute("autocomplete", "off");
    expect(key).toHaveAttribute("spellcheck", "false");
    expect(screen.queryByLabelText(/custom url|base path|provider headers|prompt|extension/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/screenshot|image input|generic url/i)).not.toBeInTheDocument();

    const consent = screen.getByRole("group", { name: "Confirm data sharing for My Gateway" });
    expect(consent).toHaveTextContent("https://gateway.example.com");
    expect(consent).toHaveTextContent("model-egress-v1");
    expect(consent).toHaveTextContent("Video title");
    expect(consent).toHaveTextContent("Necessary Chinese transcript excerpt or selection");
    expect(consent).toHaveTextContent("Timestamps");
    expect(consent).toHaveTextContent("Versioned prompt");
    expect(within(consent).getByRole("checkbox", { name: /I confirm/ })).not.toBeChecked();
    expect(within(consent).getByRole("button", { name: "Activate gateway" })).toBeDisabled();
  });

  it("shows non-secret active and revoked state with text labels", async () => {
    mockFetch(response(settings([active, revoked])));
    render(<ModelGatewaySettings />);
    const activeCard = await screen.findByRole("region", { name: "My Gateway" });
    expect(activeCard).toHaveTextContent("Active");
    expect(activeCard).toHaveTextContent("Key saved");
    expect(activeCard).toHaveTextContent("mandarin-model");
    expect(activeCard).toHaveTextContent("Revision 1");
    expect(activeCard).not.toHaveTextContent(active.configFingerprint);

    const revokedCard = screen.getByRole("region", { name: "Old Gateway" });
    expect(revokedCard).toHaveTextContent("Revoked");
    expect(revokedCard).toHaveTextContent("No key saved");
    expect(within(revokedCard).queryByRole("button", { name: /rename|rotate|revoke/i })).not.toBeInTheDocument();
  });

  it("creates with the frozen DTO, clears the key, discards the mutation response, and refetches", async () => {
    const created = { ...pending, displayName: "Study Gateway", model: "model-v2" };
    const fetchMock = mockFetch(
      response(settings()),
      response(created, 201),
      response(settings([created])),
    );
    const user = userEvent.setup();
    render(<ModelGatewaySettings />);
    await screen.findByLabelText("Approved gateway");
    await user.type(screen.getByLabelText("Display name"), "Study Gateway");
    await user.type(screen.getByLabelText("Model"), "model-v2");
    const key = screen.getByLabelText("API key");
    await user.type(key, "create-secret");
    await user.click(screen.getByRole("button", { name: "Save gateway" }));

    await screen.findByRole("region", { name: "Study Gateway" });
    expect(key).toHaveValue("");
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[0]).toEqual(["/api/v1/settings/model-gateway", {
      credentials: "same-origin",
      cache: "no-store",
    }]);
    expect(fetchMock.mock.calls[1]?.[0]).toBe("/api/v1/settings/model-gateway");
    expect(fetchMock.mock.calls[1]?.[1]).toMatchObject({
      method: "PUT",
      credentials: "same-origin",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
    });
    expect(JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body))).toEqual({
      originId: ORIGIN_ID,
      displayName: "Study Gateway",
      model: "model-v2",
      apiKey: "create-secret",
    });
    expect(fetchMock.mock.calls[2]?.[0]).toBe("/api/v1/settings/model-gateway");
    expect(document.body).not.toHaveTextContent("create-secret");
  });

  it("activates only checked exact consent and refetches the active view", async () => {
    const fetchMock = mockFetch(response(settings([pending])), response(active), response(settings([active])));
    const user = userEvent.setup();
    render(<ModelGatewaySettings />);
    const checkbox = await screen.findByRole("checkbox", { name: /I confirm/ });
    await user.click(checkbox);
    await user.click(screen.getByRole("button", { name: "Activate gateway" }));
    await screen.findByText("Active");
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[1]?.[0]).toBe("/api/v1/settings/model-gateway/consent");
    expect(JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body))).toEqual({
      configId: CONFIG_ID,
      exactOrigin: "https://gateway.example.com",
      policyVersion: "model-egress-v1",
      confirmed: true,
    });
  });

  it("renames, rotates with an empty-open password, and revokes through frozen DTOs with refetch", async () => {
    const renamed = { ...active, displayName: "Renamed Gateway" };
    const rotated = { ...renamed, revision: 2 };
    const revokedRenamed = { ...rotated, state: "revoked" as const, hasApiKey: false };
    const fetchMock = mockFetch(
      response(settings([active])),
      response(renamed), response(settings([renamed])),
      response(rotated), response(settings([rotated])),
      response(revokedRenamed), response(settings([revokedRenamed])),
    );
    const user = userEvent.setup();
    render(<ModelGatewaySettings />);
    const rename = await screen.findByLabelText("New display name for My Gateway");
    await user.clear(rename);
    await user.type(rename, "Renamed Gateway");
    await user.click(screen.getByRole("button", { name: "Rename My Gateway" }));
    await screen.findByRole("region", { name: "Renamed Gateway" });
    expect(JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body))).toEqual({
      configId: CONFIG_ID,
      displayName: "Renamed Gateway",
    });

    await user.click(screen.getByRole("button", { name: "Rotate key for Renamed Gateway" }));
    const rotation = screen.getByLabelText("New API key for Renamed Gateway");
    expect(rotation).toHaveValue("");
    expect(rotation).toHaveAttribute("type", "password");
    expect(rotation).toHaveAttribute("autocomplete", "off");
    expect(rotation).toHaveAttribute("spellcheck", "false");
    await user.type(rotation, "rotation-secret");
    await user.click(screen.getByRole("button", { name: "Save new key for Renamed Gateway" }));
    await waitFor(() => expect(screen.getByText("Revision 2")).toBeInTheDocument());
    expect(rotation).toHaveValue("");
    expect(JSON.parse(String(fetchMock.mock.calls[3]?.[1]?.body))).toEqual({
      configId: CONFIG_ID,
      apiKey: "rotation-secret",
    });

    await user.click(screen.getByRole("button", { name: "Revoke Renamed Gateway" }));
    const confirmation = screen.getByRole("group", { name: "Confirm revoke Renamed Gateway" });
    expect(within(confirmation).getByRole("button", { name: "Confirm revoke" })).toHaveFocus();
    await user.click(within(confirmation).getByRole("button", { name: "Confirm revoke" }));
    await screen.findByText("Revoked");
    expect(JSON.parse(String(fetchMock.mock.calls[5]?.[1]?.body))).toEqual({ configId: CONFIG_ID });
    expect(fetchMock.mock.calls[5]?.[1]).toMatchObject({ method: "DELETE" });
    expect(fetchMock).toHaveBeenCalledTimes(7);
    expect(document.body).not.toHaveTextContent("rotation-secret");
  });

  it("associates an empty rename error with its input and clears invalid state on edit", async () => {
    const fetchMock = mockFetch(response(settings([active])));
    const user = userEvent.setup();
    render(<ModelGatewaySettings />);

    const rename = await screen.findByLabelText("New display name for My Gateway");
    await user.clear(rename);
    await user.click(screen.getByRole("button", { name: "Rename My Gateway" }));

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Enter a display name before renaming.");
    expect(rename).toHaveAttribute("aria-invalid", "true");
    expect(rename).toHaveAttribute("aria-describedby", alert.id);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await user.type(rename, "Edited Gateway");
    expect(rename).not.toHaveAttribute("aria-invalid", "true");
    expect(rename).not.toHaveAttribute("aria-describedby");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("associates an empty rotation error, clears it on edit, and immediately clears a submitted key", async () => {
    const rotated = { ...active, revision: 2 };
    const fetchMock = mockFetch(
      response(settings([active])),
      response(rotated),
      response(settings([rotated])),
    );
    const user = userEvent.setup();
    render(<ModelGatewaySettings />);

    await user.click(await screen.findByRole("button", { name: "Rotate key for My Gateway" }));
    const rotation = screen.getByLabelText("New API key for My Gateway");
    await user.click(screen.getByRole("button", { name: "Save new key for My Gateway" }));

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Enter a new API key before saving.");
    expect(rotation).toHaveAttribute("aria-invalid", "true");
    expect(rotation).toHaveAttribute("aria-describedby", alert.id);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await user.type(rotation, "fresh-rotation-secret");
    expect(rotation).not.toHaveAttribute("aria-invalid", "true");
    expect(rotation).not.toHaveAttribute("aria-describedby");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Save new key for My Gateway" }));
    await waitFor(() => expect(screen.getByText("Revision 2")).toBeInTheDocument());
    expect(rotation).toHaveValue("");
    expect(rotation).not.toHaveAttribute("aria-invalid", "true");
    expect(rotation).not.toHaveAttribute("aria-describedby");
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(document.documentElement.outerHTML).not.toContain("fresh-rotation-secret");
  });

  it.each([
    { name: "validation", mutation: null },
    { name: "HTTP", mutation: Response.json({ raw: "failure-secret supplied-key" }, { status: 500 }) },
    { name: "parse", mutation: Response.json({ ok: true, data: { apiKey: "supplied-key" } }) },
    { name: "network", mutation: new Error("network supplied-key") },
  ])("clears a write-only key after $name failure without echo or persistence", async ({ mutation }) => {
    const fetchMock = mutation === null
      ? mockFetch(response(settings()))
      : mockFetch(response(settings()), mutation);
    const storage = vi.spyOn(Storage.prototype, "setItem");
    const push = vi.spyOn(window.history, "pushState");
    const replace = vi.spyOn(window.history, "replaceState");
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const user = userEvent.setup();
    render(<ModelGatewaySettings />);
    await screen.findByLabelText("API key");
    if (mutation !== null) {
      await user.type(screen.getByLabelText("Display name"), "Gateway");
      await user.type(screen.getByLabelText("Model"), "model-a");
    }
    const key = screen.getByLabelText("API key");
    await user.type(key, "supplied-key");
    await user.click(screen.getByRole("button", { name: "Save gateway" }));
    await waitFor(() => expect(key).toHaveValue(""));
    expect(await screen.findByRole("alert")).toHaveTextContent(/complete all fields|could not save/i);
    expect(document.documentElement.outerHTML).not.toContain("supplied-key");
    expect(storage).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
    expect(log).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(mutation === null ? 1 : 2);
  });

  it("does not persist a typed key across unmount and remount", async () => {
    mockFetch(response(settings()), response(settings()));
    const user = userEvent.setup();
    const first = render(<ModelGatewaySettings />);
    const key = await screen.findByLabelText("API key");
    await user.type(key, "temporary-secret");
    first.unmount();
    render(<ModelGatewaySettings />);
    expect(await screen.findByLabelText("API key")).toHaveValue("");
    expect(document.documentElement.outerHTML).not.toContain("temporary-secret");
  });

  it("prevents duplicate mutation submits while a request is in flight", async () => {
    let resolve!: (value: Response) => void;
    const waiting = new Promise<Response>((done) => { resolve = done; });
    const fetchMock = mockFetch(response(settings()), waiting, response(settings([pending])));
    const user = userEvent.setup();
    render(<ModelGatewaySettings />);
    await screen.findByLabelText("Approved gateway");
    await user.type(screen.getByLabelText("Display name"), "Gateway");
    await user.type(screen.getByLabelText("Model"), "model-a");
    await user.type(screen.getByLabelText("API key"), "one-secret");
    const submit = screen.getByRole("button", { name: "Save gateway" });
    await user.click(submit);
    expect(submit).toBeDisabled();
    await user.click(submit);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await act(async () => resolve(response(pending, 201)));
    await screen.findByRole("region", { name: "My Gateway" });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
