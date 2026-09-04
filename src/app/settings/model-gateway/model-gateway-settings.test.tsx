import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import type { ModelGatewayConfigView, ModelGatewaySettingsView } from "@/contracts/model-gateway";

import { ModelGatewaySettings } from "./model-gateway-settings";

const CONFIG_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const NOW = "2026-08-20T00:00:00.000Z";
const pending: ModelGatewayConfigView = {
  id: CONFIG_ID,
  displayName: "My Gateway",
  baseUrl: "https://gateway.example.com/v1",
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
    exactBaseUrl: "https://gateway.example.com/v1",
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
  return { configs };
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
  it("lets a user enter the exact gateway base URL without an approved catalog", async () => {
    mockFetch(response({ configs: [] }));
    render(<ModelGatewaySettings />);

    expect(await screen.findByLabelText("Gateway base URL")).toHaveValue("");
    expect(screen.queryByLabelText("Approved gateway")).not.toBeInTheDocument();
    expect(screen.queryByText(/No approved gateways/i)).not.toBeInTheDocument();
  });

  it("renders a polite loading state, then an empty configuration state", async () => {
    let resolve!: (value: Response) => void;
    const waiting = new Promise<Response>((done) => { resolve = done; });
    mockFetch(waiting);
    render(<ModelGatewaySettings />);
    expect(screen.getByRole("status")).toHaveTextContent("Loading gateway settings");

    await act(async () => resolve(response({ configs: [] })));
    expect(screen.getByText("You have not configured a gateway yet.")).toBeInTheDocument();
  });

  it("uses a generic accessible error for failed or malformed settings requests", async () => {
    mockFetch(Response.json({ raw: "vault-secret provider failure" }, { status: 500 }));
    render(<ModelGatewaySettings />);
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Gateway settings are unavailable. Try again.");
    expect(document.body).not.toHaveTextContent(/vault-secret|provider failure/i);
  });

  it("isolates direct gateway inputs from login autofill and shows recovery-only pending disclosures", async () => {
    mockFetch(response(settings([pending])));
    render(<ModelGatewaySettings />);

    expect(await screen.findByRole("heading", { name: "Model gateway settings" })).toBeInTheDocument();
    const createForm = screen.getByRole("form", { name: "Add a model gateway" });
    expect(createForm).toHaveAttribute("autocomplete", "off");
    const baseUrl = screen.getByLabelText("Gateway base URL");
    expect(baseUrl).toHaveValue("");
    expect(baseUrl).toHaveAttribute("id", "model-gateway-base-url");
    expect(baseUrl).toHaveAttribute("name", "model-gateway-base-url");
    expect(baseUrl).toHaveAttribute("autocomplete", "off");
    const displayName = screen.getByLabelText("Display name");
    expect(displayName).toHaveAttribute("id", "model-gateway-display-name");
    expect(displayName).toHaveAttribute("name", "model-gateway-display-name");
    expect(displayName).toHaveAttribute("autocomplete", "off");
    const model = screen.getByLabelText("Model");
    expect(model).toHaveAttribute("id", "model-gateway-model");
    expect(model).toHaveAttribute("name", "model-gateway-model");
    expect(model).toHaveAttribute("autocomplete", "off");
    const key = screen.getByLabelText("API key");
    expect(key).toHaveAttribute("id", "model-gateway-api-key");
    expect(key).toHaveAttribute("name", "model-gateway-api-key");
    expect(key).toHaveAttribute("type", "password");
    expect(key).toHaveAttribute("autocomplete", "new-password");
    expect(key).toHaveAttribute("spellcheck", "false");
    expect(screen.queryByLabelText(/custom url|base path|provider headers|prompt|extension/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/screenshot|image input|generic url/i)).not.toBeInTheDocument();

    const pendingCard = screen.getByRole("region", { name: "My Gateway" });
    expect(pendingCard).toHaveTextContent("https://gateway.example.com/v1");
    expect(pendingCard).toHaveTextContent("model-egress-v1");
    expect(pendingCard).toHaveTextContent("Video title");
    expect(pendingCard).toHaveTextContent("Necessary Chinese transcript excerpt or selection");
    expect(pendingCard).toHaveTextContent("Timestamps");
    expect(pendingCard).toHaveTextContent("Versioned prompt");
    expect(within(pendingCard).queryByRole("checkbox", { name: /I confirm/ })).not.toBeInTheDocument();
    expect(within(pendingCard).getByRole("button", { name: "Confirm and finish activation" })).toBeEnabled();
  });

  it("keeps the conditional key rotation form outside login autofill", async () => {
    mockFetch(response(settings([active])));
    const user = userEvent.setup();
    render(<ModelGatewaySettings />);

    await user.click(await screen.findByRole("button", { name: "Rotate key for My Gateway" }));
    const rotationForm = screen.getByRole("form", { name: "Rotate API key for My Gateway" });
    expect(rotationForm).toHaveAttribute("autocomplete", "off");
    const rotation = screen.getByLabelText("New API key for My Gateway");
    expect(rotation).toHaveAttribute("id", "model-gateway-rotation-api-key");
    expect(rotation).toHaveAttribute("name", "model-gateway-rotation-api-key");
    expect(rotation).toHaveAttribute("type", "password");
    expect(rotation).toHaveAttribute("autocomplete", "new-password");
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

  it("creates and activates with one confirmation", async () => {
    const created = { ...pending, displayName: "Study Gateway", model: "model-v2" };
    const activated: ModelGatewayConfigView = {
      ...created,
      state: "active" as const,
      consent: {
        exactBaseUrl: "https://gateway.example.com/v1",
        policyVersion: "model-egress-v1",
        consentedAt: NOW,
      },
    };
    const fetchMock = mockFetch(
      response(settings()),
      response(created, 201),
      response(activated),
      response(settings([activated])),
    );
    const user = userEvent.setup();
    render(<ModelGatewaySettings />);
    await screen.findByLabelText("Gateway base URL");
    await user.type(screen.getByLabelText("Gateway base URL"), "https://gateway.example.com/v1");
    await user.type(screen.getByLabelText("Display name"), "Study Gateway");
    await user.type(screen.getByLabelText("Model"), "model-v2");
    const key = screen.getByLabelText("API key");
    await user.type(key, "create-secret");
    const consent = screen.getByRole("checkbox", {
      name: /confirm this exact destination and data sharing/i,
    });
    expect(screen.getByText("Exact destination:", { exact: false })).toHaveTextContent("Exact destination: https://gateway.example.com/v1");
    expect(screen.getByText("Video title")).toBeInTheDocument();
    expect(screen.getByText("Necessary Chinese transcript excerpt or selection")).toBeInTheDocument();
    expect(screen.getByText("Timestamps")).toBeInTheDocument();
    expect(screen.getByText("Versioned prompt")).toBeInTheDocument();
    await user.click(consent);
    await user.click(screen.getByRole("button", { name: "Save and activate gateway" }));

    const sessionKey = await screen.findByLabelText("API key entered this session for Study Gateway");
    expect(sessionKey).toHaveAttribute("type", "password");
    expect(sessionKey).toHaveValue("create-secret");
    expect(screen.getByRole("status")).toHaveTextContent("Gateway saved and activated.");
    expect(key).toHaveValue("");
    expect(screen.getByLabelText("Gateway base URL")).toHaveValue("");
    expect(screen.getByLabelText("Display name")).toHaveValue("");
    expect(screen.getByLabelText("Model")).toHaveValue("");
    expect(screen.queryByRole("checkbox", { name: /confirm this exact destination/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save gateway" })).not.toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Confirm data sharing for Study Gateway" })).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(4);
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
      displayName: "Study Gateway",
      baseUrl: "https://gateway.example.com/v1",
      model: "model-v2",
      apiKey: "create-secret",
    });
    expect(fetchMock.mock.calls[2]?.[0]).toBe("/api/v1/settings/model-gateway/consent");
    expect(JSON.parse(String(fetchMock.mock.calls[2]?.[1]?.body))).toEqual({
      configId: CONFIG_ID,
      exactBaseUrl: "https://gateway.example.com/v1",
      policyVersion: "model-egress-v1",
      confirmed: true,
    });
    expect(fetchMock.mock.calls[3]?.[0]).toBe("/api/v1/settings/model-gateway");
    expect(document.body).not.toHaveTextContent("create-secret");
  });

  it("keeps one pending gateway when activation fails", async () => {
    const created = { ...pending, displayName: "Study Gateway", model: "model-v2" };
    const fetchMock = mockFetch(
      response(settings()),
      response(created, 201),
      Response.json({ raw: "activation unavailable" }, { status: 500 }),
      response(settings([created])),
    );
    const user = userEvent.setup();
    render(<ModelGatewaySettings />);
    await screen.findByLabelText("Gateway base URL");
    await user.type(screen.getByLabelText("Gateway base URL"), "https://gateway.example.com/v1");
    await user.type(screen.getByLabelText("Display name"), "Study Gateway");
    await user.type(screen.getByLabelText("Model"), "model-v2");
    await user.type(screen.getByLabelText("API key"), "partial-failure-key");
    await user.click(screen.getByRole("checkbox", { name: /confirm this exact destination and data sharing/i }));
    await user.click(screen.getByRole("button", { name: "Save and activate gateway" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Gateway saved but not activated. Finish activation below.",
    );
    expect(screen.getAllByRole("region", { name: "Study Gateway" })).toHaveLength(1);
    const sessionKey = screen.getByLabelText("API key entered this session for Study Gateway");
    expect(sessionKey).toHaveAttribute("type", "password");
    expect(sessionKey).toHaveValue("partial-failure-key");
    expect(screen.getByRole("button", {
      name: "Confirm and finish activation",
    })).toBeInTheDocument();
    expect(screen.queryByRole("checkbox", {
      name: /confirm this exact destination/i,
    })).not.toBeInTheDocument();
    expect(fetchMock.mock.calls.filter(([url, options]) =>
      url === "/api/v1/settings/model-gateway" && options?.method === "PUT"
    )).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it("finishes activation with one recovery action", async () => {
    const created = { ...pending, displayName: "Study Gateway", model: "model-v2" };
    const activated: ModelGatewayConfigView = {
      ...created,
      state: "active",
      consent: {
        exactBaseUrl: "https://gateway.example.com/v1",
        policyVersion: "model-egress-v1",
        consentedAt: NOW,
      },
    };
    const fetchMock = mockFetch(
      response(settings([created])),
      response(activated),
      response(settings([activated])),
    );
    const user = userEvent.setup();
    render(<ModelGatewaySettings />);

    await user.click(await screen.findByRole("button", { name: "Confirm and finish activation" }));
    await screen.findByText("Active");

    expect(screen.getByRole("status")).toHaveTextContent("Gateway activated.");
    expect(screen.queryByRole("checkbox", { name: /confirm this exact destination/i })).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[1]?.[0]).toBe("/api/v1/settings/model-gateway/consent");
    expect(JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body))).toEqual({
      configId: CONFIG_ID,
      exactBaseUrl: "https://gateway.example.com/v1",
      policyVersion: "model-egress-v1",
      confirmed: true,
    });
  });

  it("renames, rotates with an empty-open password, and keeps the new key in the matching card", async () => {
    const renamed = { ...active, displayName: "Renamed Gateway" };
    const rotated = { ...renamed, revision: 2 };
    const fetchMock = mockFetch(
      response(settings([active])),
      response(renamed), response(settings([renamed])),
      response(rotated), response(settings([rotated])),
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
    expect(rotation).toHaveAttribute("autocomplete", "new-password");
    expect(rotation).toHaveAttribute("spellcheck", "false");
    await user.type(rotation, "rotation-secret");
    await user.click(screen.getByRole("button", { name: "Save new key for Renamed Gateway" }));
    await waitFor(() => expect(screen.getByText("Revision 2")).toBeInTheDocument());
    expect(screen.queryByRole("form", { name: "Rotate API key for Renamed Gateway" })).not.toBeInTheDocument();
    const rotatedKey = screen.getByLabelText("API key entered this session for Renamed Gateway");
    expect(rotatedKey).toHaveAttribute("type", "password");
    expect(rotatedKey).toHaveValue("rotation-secret");
    const callsBeforeToggle = fetchMock.mock.calls.length;
    await user.click(screen.getByRole("button", { name: "Show key" }));
    expect(rotatedKey).toHaveAttribute("type", "text");
    await user.click(screen.getByRole("button", { name: "Hide key" }));
    expect(rotatedKey).toHaveAttribute("type", "password");
    expect(fetchMock).toHaveBeenCalledTimes(callsBeforeToggle);
    expect(JSON.parse(String(fetchMock.mock.calls[3]?.[1]?.body))).toEqual({
      configId: CONFIG_ID,
      apiKey: "rotation-secret",
    });
  });

  it("removes the transient key after revoke", async () => {
    const rotated = { ...active, revision: 2 };
    const revokedGateway = { ...rotated, state: "revoked" as const, hasApiKey: false };
    const fetchMock = mockFetch(
      response(settings([active])),
      response(rotated), response(settings([rotated])),
      response(revokedGateway), response(settings([revokedGateway])),
    );
    const user = userEvent.setup();
    render(<ModelGatewaySettings />);

    await user.click(await screen.findByRole("button", { name: "Rotate key for My Gateway" }));
    await user.type(screen.getByLabelText("New API key for My Gateway"), "rotation-secret");
    await user.click(screen.getByRole("button", { name: "Save new key for My Gateway" }));
    await screen.findByLabelText("API key entered this session for My Gateway");

    await user.click(screen.getByRole("button", { name: "Revoke My Gateway" }));
    const confirmation = screen.getByRole("group", { name: "Confirm revoke My Gateway" });
    expect(within(confirmation).getByRole("button", { name: "Confirm revoke" })).toHaveFocus();
    await user.click(within(confirmation).getByRole("button", { name: "Confirm revoke" }));
    await screen.findByText("Revoked");
    expect(screen.queryByLabelText("API key entered this session for My Gateway")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Show key" })).not.toBeInTheDocument();
    expect(JSON.parse(String(fetchMock.mock.calls[3]?.[1]?.body))).toEqual({ configId: CONFIG_ID });
    expect(fetchMock.mock.calls[3]?.[1]).toMatchObject({ method: "DELETE" });
    expect(fetchMock).toHaveBeenCalledTimes(5);
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

  it("associates an empty rotation error, clears it on edit, and closes after a successful replacement", async () => {
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
    expect(screen.queryByRole("form", { name: "Rotate API key for My Gateway" })).not.toBeInTheDocument();
    const sessionKey = screen.getByLabelText("API key entered this session for My Gateway");
    expect(sessionKey).toHaveAttribute("type", "password");
    expect(sessionKey).toHaveValue("fresh-rotation-secret");
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it.each([
    { name: "validation", mutation: null },
    { name: "HTTP", mutation: Response.json({ raw: "failure-secret supplied-key" }, { status: 500 }) },
    { name: "parse", mutation: Response.json({ ok: true, data: { apiKey: "supplied-key" } }) },
    { name: "network", mutation: new Error("network supplied-key") },
  ])("keeps a write-only key available after $name failure without persistence", async ({ mutation }) => {
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
      await user.type(screen.getByLabelText("Gateway base URL"), "https://gateway.example.com/v1");
      await user.type(screen.getByLabelText("Display name"), "Gateway");
      await user.type(screen.getByLabelText("Model"), "model-a");
    }
    const key = screen.getByLabelText("API key");
    await user.type(key, "supplied-key");
    if (mutation === null) {
      fireEvent.submit(screen.getByRole("form", { name: "Add a model gateway" }));
    } else {
      await user.click(screen.getByRole("checkbox", { name: /confirm this exact destination and data sharing/i }));
      await user.click(screen.getByRole("button", { name: "Save and activate gateway" }));
    }
    await waitFor(() => expect(key).toHaveValue("supplied-key"));
    expect(await screen.findByRole("alert")).toHaveTextContent(/complete all fields|could not save/i);
    expect(storage).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
    expect(log).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(mutation === null ? 1 : 2);
  });

  it("keeps a newly entered key only for the mounted page", async () => {
    const created = { ...pending, displayName: "Study Gateway", model: "model-v2" };
    const activated: ModelGatewayConfigView = {
      ...created,
      state: "active" as const,
      consent: {
        exactBaseUrl: "https://gateway.example.com/v1",
        policyVersion: "model-egress-v1",
        consentedAt: NOW,
      },
    };
    const fetchMock = mockFetch(
      response(settings()),
      response(created, 201),
      response(activated),
      response(settings([activated])),
      response(settings([activated])),
    );
    const storage = vi.spyOn(Storage.prototype, "setItem");
    const push = vi.spyOn(window.history, "pushState");
    const replace = vi.spyOn(window.history, "replaceState");
    const user = userEvent.setup();
    const first = render(<ModelGatewaySettings />);
    await screen.findByLabelText("Gateway base URL");
    await user.type(screen.getByLabelText("Gateway base URL"), "https://gateway.example.com/v1");
    await user.type(screen.getByLabelText("Display name"), "Study Gateway");
    await user.type(screen.getByLabelText("Model"), "model-v2");
    await user.type(screen.getByLabelText("API key"), "create-secret");
    await user.click(screen.getByRole("checkbox", { name: /confirm this exact destination and data sharing/i }));
    await user.click(screen.getByRole("button", { name: "Save and activate gateway" }));

    const sessionKey = await screen.findByLabelText("API key entered this session for Study Gateway");
    expect(sessionKey).toHaveAttribute("type", "password");
    expect(sessionKey).toHaveValue("create-secret");
    const callsBeforeToggle = fetchMock.mock.calls.length;
    await user.click(screen.getByRole("button", { name: "Show key" }));
    expect(sessionKey).toHaveAttribute("type", "text");
    await user.click(screen.getByRole("button", { name: "Hide key" }));
    expect(sessionKey).toHaveAttribute("type", "password");
    expect(fetchMock).toHaveBeenCalledTimes(callsBeforeToggle);

    first.unmount();
    render(<ModelGatewaySettings />);
    await screen.findByRole("region", { name: "Study Gateway" });
    expect(screen.queryByLabelText("API key entered this session for Study Gateway")).not.toBeInTheDocument();
    expect(screen.getByText("Key saved")).toBeInTheDocument();
    expect(storage).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
    expect(window.location.href).not.toContain("create-secret");
    expect(document.documentElement.outerHTML).not.toContain("create-secret");
  });

  it("prevents duplicate mutation submits while a request is in flight", async () => {
    let resolve!: (value: Response) => void;
    const waiting = new Promise<Response>((done) => { resolve = done; });
    const fetchMock = mockFetch(response(settings()), waiting, response(active), response(settings([active])));
    const user = userEvent.setup();
    render(<ModelGatewaySettings />);
    await screen.findByLabelText("Gateway base URL");
    await user.type(screen.getByLabelText("Gateway base URL"), "https://gateway.example.com/v1");
    await user.type(screen.getByLabelText("Display name"), "Gateway");
    await user.type(screen.getByLabelText("Model"), "model-a");
    await user.type(screen.getByLabelText("API key"), "one-secret");
    await user.click(screen.getByRole("checkbox", { name: /confirm this exact destination and data sharing/i }));
    const submit = screen.getByRole("button", { name: "Save and activate gateway" });
    await user.click(submit);
    expect(submit).toBeDisabled();
    await user.click(submit);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await act(async () => resolve(response(pending, 201)));
    await screen.findByText("Active");
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });
});
