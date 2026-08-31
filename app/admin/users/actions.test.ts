import { describe, expect, it, beforeEach, vi } from "vitest";

const {
  requireAdminUserMock,
  isAdminEmailMock,
  createSupabaseAdminClientMock,
  logAdminActionMock,
  revalidatePathMock,
  getSiteUrlMock,
} = vi.hoisted(() => ({
  requireAdminUserMock: vi.fn(),
  isAdminEmailMock: vi.fn(),
  createSupabaseAdminClientMock: vi.fn(),
  logAdminActionMock: vi.fn(),
  revalidatePathMock: vi.fn(),
  getSiteUrlMock: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: revalidatePathMock,
}));

vi.mock("@/lib/admin", () => ({
  isAdminEmail: isAdminEmailMock,
  requireAdminUser: requireAdminUserMock,
}));

vi.mock("@/lib/supabase-admin", () => ({
  createSupabaseAdminClient: createSupabaseAdminClientMock,
}));

vi.mock("@/lib/auth/audit", () => ({
  logAdminAction: logAdminActionMock,
}));

vi.mock("@/lib/site-url", () => ({
  getSiteUrl: getSiteUrlMock,
}));

vi.mock("server-only", () => ({}));

import {
  banUser,
  deleteUser,
  makeAdmin,
  removeAdmin,
  resetUserPassword,
  unbanUser,
  verifyUser,
} from "./actions";

const ADMIN = { id: "admin-1" };
const GOOD_RESULT = { data: null, error: null };

beforeEach(() => {
  vi.resetAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  requireAdminUserMock.mockResolvedValue(ADMIN);
  isAdminEmailMock.mockReturnValue(false);
  getSiteUrlMock.mockReturnValue("https://2elbul.test/");
  logAdminActionMock.mockResolvedValue(undefined);
  revalidatePathMock.mockReturnValue(undefined);

  const client = adminStub();
  createSupabaseAdminClientMock.mockReturnValue(client);
});

describe("admin user actions — return shape confidentiality", () => {
  const subj = "SECRET-VALUE-x7y";

  it("never returns any password/token/secret key or value", async () => {
    const results = await Promise.all([
      verifyUser("t-1"),
      resetUserPassword("t-1"),
      banUser("t-1"),
      unbanUser("t-1"),
      makeAdmin("t-1"),
      removeAdmin("t-1"),
      deleteUser("t-1"),
    ]);

    for (const result of results) {
      for (const key of Object.keys(result)) expect(["action", "message", "ok"]).toContain(key);
      const json = JSON.stringify(result);
      expect(json).not.toMatch(/password|token|secret|resetLink|recovery|hash/i);
      expect(json).not.toContain(subj);
    }
  });

  it("password-adjacent error text never leaks the real value", async () => {
    const client = createSupabaseAdminClientMock();
    client.auth.admin.updateUserById = vi.fn(async () => ({
      error: { message: `invalid ${subj}` },
    }));

    const result = await verifyUser("t-1");
    expect(result.ok).toBe(false);
    expect(JSON.stringify(result)).not.toContain(subj);
  });
});

describe("resetUserPassword — email flow, never the recovery link/token", () => {
  it("emails via resetPasswordForEmail and logs only action + target", async () => {
    const client = createSupabaseAdminClientMock();
    client.auth.admin.getUserById = vi.fn(async () => ({
      data: { user: { id: "t-1", email: "target@example.com" } },
      error: null,
    }));
    const resetMock = vi.fn(async () => ({ error: null }));
    client.auth.admin.resetPasswordForEmail = resetMock;

    const result = await resetUserPassword("t-1");

    expect(result).toEqual({
      ok: true,
      message: "Şifre sıfırlama bağlantısı gönderildi.",
      action: "RESET_EMAIL_SENT",
    });
    expect(resetMock).toHaveBeenCalledWith(
      "target@example.com",
      { redirectTo: "https://2elbul.test/auth/callback" },
    );
    expect(logAdminActionMock).toHaveBeenCalledWith(
      client,
      "admin-1",
      expect.objectContaining({
        action: "RESET_EMAIL_SENT",
        targetUserId: "t-1",
      }),
    );
    const metadata = logAdminActionMock.mock.calls[0][2].metadata;
    expect(metadata).toEqual({ via: "admin" });
    expect(JSON.stringify(metadata)).not.toMatch(/token|link|reset|recovery/i);
    expect(logAdminActionMock.mock.calls[0][2]).not.toHaveProperty("resetLink");
  });

  it("refuses when the target email is unknown", async () => {
    const client = createSupabaseAdminClientMock();
    client.auth.admin.getUserById = vi.fn(async () => ({ data: { user: null }, error: null }));

    const result = await resetUserPassword("t-1");
    expect(result.ok).toBe(false);
    expect(result.message).toContain("e-posta");
    expect(client.auth.admin.resetPasswordForEmail).toBeUndefined();
  });
});

describe("admin gate — IDOR rejection happens before any auth.admin write", () => {
  it("a non-admin caller is redirected and never reaches updateUserById", async () => {
    requireAdminUserMock.mockRejectedValue(new Error("NEXT_REDIRECT"));
    const client = createSupabaseAdminClientMock();
    client.auth.admin.updateUserById = vi.fn();

    await expect(verifyUser("t-1")).rejects.toThrow("NEXT_REDIRECT");
    expect(client.auth.admin.updateUserById).not.toHaveBeenCalled();
    expect(logAdminActionMock).not.toHaveBeenCalled();
  });

  it("a missing admin client aborts before acting", async () => {
    createSupabaseAdminClientMock.mockReturnValue(null);
    const result = await verifyUser("t-1");
    expect(result).toEqual({ ok: false, message: "Kullanıcı bulunamadı." });
  });
});

describe("verifyUser", () => {
  it("confirms the email only for the target user id", async () => {
    const client = createSupabaseAdminClientMock();
    const updateMock = vi.fn(async () => GOOD_RESULT);
    client.auth.admin.updateUserById = updateMock;

    const result = await verifyUser("t-42");

    expect(result).toEqual({
      ok: true,
      message: "Kullanıcının e-postası doğrulandı.",
      action: "USER_VERIFIED",
    });
    expect(updateMock).toHaveBeenCalledWith("t-42", { email_confirm: true });
    expect(logAdminActionMock).toHaveBeenCalledWith(
      client,
      "admin-1",
      expect.objectContaining({ action: "USER_VERIFIED", targetUserId: "t-42" }),
    );
    expect(revalidatePathMock).toHaveBeenCalled();
  });
});

describe("banUser / unbanUser", () => {
  it("bans with a long duration", async () => {
    const client = createSupabaseAdminClientMock();
    const updateMock = vi.fn(async () => GOOD_RESULT);
    client.auth.admin.updateUserById = updateMock;

    const result = await banUser("t-7");
    expect(result.action).toBe("USER_BANNED");
    expect(updateMock).toHaveBeenCalledWith("t-7", { ban_duration: "876000h" });
  });

  it("unbans by clearing the ban", async () => {
    const client = createSupabaseAdminClientMock();
    const updateMock = vi.fn(async () => GOOD_RESULT);
    client.auth.admin.updateUserById = updateMock;

    const result = await unbanUser("t-7");
    expect(result.action).toBe("USER_UNBANNED");
    expect(updateMock).toHaveBeenCalledWith("t-7", { ban_duration: "none" });
  });
});

describe("makeAdmin / removeAdmin — role grants act on admin_roles only", () => {
  it("grants via upsert on admin_roles, idempotent", async () => {
    const client = createSupabaseAdminClientMock();
    const result = await makeAdmin("t-9");

    expect(result.action).toBe("ADMIN_ROLE_GRANTED");
    expect(client.from).toHaveBeenCalledWith("admin_roles");
    const chain = fromResult(client, "admin_roles");
    expect(chain.upsert).toHaveBeenCalledWith(
      { user_id: "t-9", granted_by: "admin-1" },
      { onConflict: "user_id" },
    );
  });

  it("refuses self-demotion", async () => {
    requireAdminUserMock.mockResolvedValue({ id: "self-1" });
    const client = createSupabaseAdminClientMock();

    const result = await removeAdmin("self-1");
    expect(result.ok).toBe(false);
    expect(result.message).toContain("çıkaramazsınız");
    expect(client.from).not.toHaveBeenCalled();
  });

  it("refuses to revoke an env allow-list admin", async () => {
    isAdminEmailMock.mockReturnValue(true);
    const client = createSupabaseAdminClientMock();
    client.auth.admin.getUserById = vi.fn(async () => ({
      data: { user: { id: "env-1", email: "env-admin@example.com" } },
      error: null,
    }));

    const result = await removeAdmin("env-1");
    expect(result.ok).toBe(false);
    expect(result.message).toContain("ortam izniyle");
    expect(client.from).not.toHaveBeenCalled();
  });

  it("revokes a DB grant row", async () => {
    const client = createSupabaseAdminClientMock();
    client.auth.admin.getUserById = vi.fn(async () => ({
      data: { user: { id: "db-1", email: "db-admin@example.com" } },
      error: null,
    }));

    const result = await removeAdmin("db-1");
    expect(result.action).toBe("ADMIN_ROLE_REVOKED");
    expect(client.from).toHaveBeenCalledWith("admin_roles");
    const chain = fromResult(client, "admin_roles");
    expect(chain.delete).toHaveBeenCalled();
    expect(chain.delete.mock.results[0].value.eq).toHaveBeenCalledWith("user_id", "db-1");
  });
});

describe("deleteUser — refuses self-deletion", () => {
  it("refuses self-deletion", async () => {
    const client = createSupabaseAdminClientMock();
    const deleteMock = vi.fn();
    client.auth.admin.deleteUser = deleteMock;

    const result = await deleteUser("admin-1");
    expect(result.ok).toBe(false);
    expect(result.message).toContain("silinemez");
    expect(deleteMock).not.toHaveBeenCalled();
  });

  it("deletes a different user", async () => {
    const client = createSupabaseAdminClientMock();
    const deleteMock = vi.fn(async () => GOOD_RESULT);
    client.auth.admin.deleteUser = deleteMock;

    const result = await deleteUser("t-5");
    expect(result.action).toBe("USER_DELETED");
    expect(deleteMock).toHaveBeenCalledWith("t-5");
  });
});

function adminStub() {
  const from = vi.fn((table: string) => {
    if (table === "admin_roles") {
      return {
        upsert: vi.fn(async () => GOOD_RESULT),
        delete: vi.fn(() => ({ eq: vi.fn(async () => GOOD_RESULT) })),
      };
    }
    return { upsert: vi.fn(async () => GOOD_RESULT) };
  });

  return {
    from,
    auth: {
      admin: {
        updateUserById: vi.fn(async () => GOOD_RESULT),
        getUserById: vi.fn(async () => GOOD_RESULT),
        deleteUser: vi.fn(async () => GOOD_RESULT),
      },
    },
  };
}

function fromResult(client: { from: ReturnType<typeof vi.fn> }, table: string) {
  const index = client.from.mock.calls.findIndex((args) => args[0] === table);
  return client.from.mock.results[index].value;
}
