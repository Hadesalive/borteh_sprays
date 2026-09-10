import { describe, it, expect } from "vitest";
import { isPublic } from "@/proxy";

// The mobile app links to /privacy from signup and the profile screen, and
// both store listings carry it as their privacy-policy URL. If the auth gate
// ever swallows it again, app review sees a login page instead of a policy
// and rejects the build — so pin it here.
describe("public paths", () => {
  it("keeps the store listings' legal pages open to signed-out visitors", () => {
    expect(isPublic("/privacy")).toBe(true);
    expect(isPublic("/data-deletion")).toBe(true);
  });

  it("keeps admin routes gated", () => {
    for (const path of ["/", "/orders", "/pos", "/pos/sales", "/analytics", "/settings"]) {
      expect(isPublic(path)).toBe(false);
    }
  });

  it("does not leak a route that merely starts with a public prefix", () => {
    expect(isPublic("/privacy-settings")).toBe(false);
  });
});
