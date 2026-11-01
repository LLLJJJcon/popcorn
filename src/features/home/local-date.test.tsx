import { act, render, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { hydrateRoot } from "react-dom/client";
import { LocalDate } from "./local-date";

describe("Home local dates", () => {
  it("uses the browser timezone on opposite sides of a UTC date boundary", () => {
    const NativeFormatter = Intl.DateTimeFormat;
    const formatter = vi.spyOn(Intl, "DateTimeFormat").mockImplementation(function (locale, options) {
      return new NativeFormatter(locale, { timeZone: "America/Los_Angeles", ...options });
    });
    try {
      render(<LocalDate instant="2026-09-06T01:00:00.000Z" />);
      expect(screen.getByText("Sep 5, 2026")).toBeInTheDocument();
    } finally { formatter.mockRestore(); }
  });

  it("hydrates a stable placeholder before showing the browser's actual local date", async () => {
    const html = renderToString(<LocalDate instant="2026-09-06T01:00:00.000Z" />);
    expect(html).toContain("…");
    const container = document.createElement("div");
    container.innerHTML = html;
    document.body.appendChild(container);
    const onRecoverableError = vi.fn();
    let root: ReturnType<typeof hydrateRoot> | undefined;
    try {
      await act(async () => { root = hydrateRoot(container, <LocalDate instant="2026-09-06T01:00:00.000Z" />, { onRecoverableError }); });
      expect(container).not.toHaveTextContent("…");
      expect(onRecoverableError).not.toHaveBeenCalled();
      expect(container.querySelector("time")).toHaveAttribute("datetime", "2026-09-06T01:00:00.000Z");
    } finally {
      await act(async () => root?.unmount());
      container.remove();
    }
  });
});
