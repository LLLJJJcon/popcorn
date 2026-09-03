import { render, screen, within } from "@testing-library/react";

import SignInPage from "./page";

describe("SignInPage", () => {
  it("keeps Popcorn's learning purpose beside a clearly labelled local-account form", () => {
    render(<SignInPage />);

    const purpose = screen.getByRole("complementary", { name: "Turn the YouTube videos you watch into Mandarin practice." });
    expect(purpose).toHaveTextContent("Turn the YouTube videos you watch into Mandarin practice.");

    const account = screen.getByRole("region", { name: "Local Popcorn account" });
    expect(within(account).getByRole("form", { name: "Email and password sign in" })).toBeInTheDocument();
    expect(within(account).getByRole("button", { name: "Sign in" })).toBeInTheDocument();
    expect(within(account).getByRole("button", { name: "Create account" })).toBeInTheDocument();
  });
});
