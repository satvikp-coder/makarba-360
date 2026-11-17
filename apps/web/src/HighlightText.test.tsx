import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { HighlightText } from "./HighlightText.js";

it("keeps a shortened highlight readable and exposes its full text on request", () => {
  render(<HighlightText body="Short preview." fullBody="Short preview. More detail follows." />);
  expect(screen.getByText("Short preview.")).toBeTruthy();
  const summary = screen.getByText("Read full highlight");
  expect(summary.closest("details")?.open).toBe(false);
  fireEvent.click(summary);
  expect(summary.closest("details")?.open).toBe(true);
  expect(screen.getByText("Short preview. More detail follows.")).toBeTruthy();
});
