import { render, screen } from "@testing-library/react";

import { SignInForm } from "./sign-in-form";

describe("SignInForm", () => {
  it("posts bounded credentials with two explicit intents to the fixed server endpoint", () => {
    render(<SignInForm />);
    const form = screen.getByRole("form", { name: "Email and password sign in" });
    expect(form).toHaveAttribute("method", "post");
    expect(form).toHaveAttribute("action", "/auth/sign-in");
    expect(screen.getByLabelText("Email address")).toMatchObject({
      name: "email",
      type: "email",
      maxLength: 254,
      required: true,
    });
    expect(screen.getByLabelText("Password")).toMatchObject({
      name: "password",
      type: "password",
      minLength: 6,
      maxLength: 128,
      required: true,
    });
    expect(screen.getByRole("button", { name: "Sign in" })).toMatchObject({
      name: "intent",
      type: "submit",
      value: "sign-in",
    });
    expect(screen.getByRole("button", { name: "Create account" })).toMatchObject({
      name: "intent",
      type: "submit",
      value: "sign-up",
    });
    expect(form.querySelectorAll("input")).toHaveLength(2);
    expect(form).not.toHaveTextContent(/redirect|callback|token|next/i);
  });
});
