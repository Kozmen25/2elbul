import { describe, expect, it } from "vitest";
import { adminLoginPath, decideAdminAccess, isAdminPath } from "./admin-gate";

describe("isAdminPath", () => {
  it("matches the admin area only", () => {
    expect(isAdminPath("/admin")).toBe(true);
    expect(isAdminPath("/admin/users")).toBe(true);
    expect(isAdminPath("/admin/users/abc")).toBe(true);
    expect(isAdminPath("/administrator")).toBe(false);
    expect(isAdminPath("/api/admin/recovery")).toBe(false);
    expect(isAdminPath("/")).toBe(false);
  });
});

describe("decideAdminAccess", () => {
  it("sends anonymous visitors to the login page", () => {
    expect(decideAdminAccess(false, false)).toBe("login");
  });

  it("rejects signed-in users without admin rights", () => {
    expect(decideAdminAccess(true, false)).toBe("forbidden");
  });

  it("lets admins in", () => {
    expect(decideAdminAccess(true, true)).toBe("allow");
  });
});

describe("adminLoginPath", () => {
  it("keeps the requested page (with query) as the post-login target", () => {
    expect(adminLoginPath("/admin/listings", "?status=pending")).toBe(
      "/giris?next=%2Fadmin%2Flistings%3Fstatus%3Dpending",
    );
  });
});
