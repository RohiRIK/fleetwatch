import { describe, it, expect } from "bun:test";

describe("Smoke Test", () => {
  it("should pass basic math", () => {
    expect(1 + 1).toBe(2);
  });

  it("should define NODE_ENV", () => {
    expect(process.env.NODE_ENV).toBeDefined();
  });
});
