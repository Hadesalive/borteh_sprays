import { describe, it, expect } from "vitest";
import { formatLe, formatInt, formatPct } from "@/lib/format";

describe("formatLe", () => {
  it("renders integer minor units as a Leone amount", () => {
    expect(formatLe(245_000)).toBe("Le 2,450");
  });

  it("renders two decimals when asked", () => {
    expect(formatLe(245_050, 2)).toBe("Le 2,450.50");
  });

  it("renders zero without a minus sign", () => {
    expect(formatLe(0)).toBe("Le 0");
  });
});

describe("formatInt", () => {
  it("groups thousands", () => {
    expect(formatInt(1280)).toBe("1,280");
  });
});

describe("formatPct", () => {
  it("renders one decimal", () => {
    expect(formatPct(0.626, 1)).toBe("62.6%");
  });
});
