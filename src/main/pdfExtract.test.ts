import { describe, expect, it } from "vitest";
import { isLikelyScanned } from "./pdfExtract";

describe("isLikelyScanned", () => {
  it("flags a PDF with almost no extractable text", () => {
    expect(isLikelyScanned(0, 1)).toBe(true);
    expect(isLikelyScanned(499, 1)).toBe(true);
  });

  it("does not flag a PDF with substantial text and a healthy per-page average", () => {
    expect(isLikelyScanned(5000, 10)).toBe(false); // 500 chars/page, 5000 total
  });

  it("flags a PDF with enough total text but a low average per page", () => {
    // total is above the 500 threshold, but spread over many pages so the
    // average per page is below 100 — e.g. one real page and 9 blank ones.
    expect(isLikelyScanned(600, 10)).toBe(true);
  });

  it("treats the total-characters threshold as exclusive at the boundary", () => {
    expect(isLikelyScanned(500, 1)).toBe(false);
    expect(isLikelyScanned(499, 1)).toBe(true);
  });

  it("treats the average-per-page threshold as exclusive at the boundary", () => {
    expect(isLikelyScanned(1000, 10)).toBe(false); // exactly 100/page
    expect(isLikelyScanned(990, 10)).toBe(true); // 99/page
  });

  it("does not divide by zero for a zero-page document", () => {
    expect(() => isLikelyScanned(0, 0)).not.toThrow();
    expect(isLikelyScanned(0, 0)).toBe(true);
  });
});
