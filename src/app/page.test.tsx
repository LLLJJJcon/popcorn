import { render, screen } from "@testing-library/react";
import HomePage from "./page";

test("describes the YouTube-to-reuse loop", () => {
  render(<HomePage />);
  expect(
    screen.getByRole("heading", {
      name: "Turn Chinese videos into language you can use",
    }),
  ).toBeInTheDocument();
});
