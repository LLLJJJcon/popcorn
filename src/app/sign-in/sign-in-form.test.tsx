import { render, screen } from "@testing-library/react";

import { SignInForm } from "./sign-in-form";

describe("SignInForm", () => {
  it("posts only a bounded email field to the fixed server endpoint", () => {
    render(<SignInForm />);
    const form = screen.getByRole("form", { name: "Email sign in" });
    expect(form).toHaveAttribute("method", "post");
    expect(form).toHaveAttribute("action", "/auth/sign-in");
    expect(screen.getByLabelText("Email address")).toMatchObject({
      name: "email",
      type: "email",
      maxLength: 254,
      required: true,
    });
    expect(form.querySelectorAll("input")).toHaveLength(1);
    expect(form).not.toHaveTextContent(/redirect|callback|token|next/i);
  });
});
