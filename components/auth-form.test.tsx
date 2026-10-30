import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { AuthState } from "@/app/auth/actions";
import { AuthForm } from "./auth-form";

const noopAction = async (state: AuthState) => state;

describe("AuthForm (signup)", () => {
  const html = renderToStaticMarkup(<AuthForm mode="signup" action={noopAction} />);

  it("keeps the avatar collection behind a button instead of listing all avatars", () => {
    expect(html).toContain("Avatar seç");
    expect(html).toContain('aria-haspopup="dialog"');
    expect(html).not.toMatch(/\/avatars\/preset-/);
    expect(html).toContain('name="avatarPreset"');
  });

  it("offers show/hide on both password fields", () => {
    expect(html.match(/aria-label="Şifreyi göster"/g)).toHaveLength(2);
    expect(html.match(/type="password"/g)).toHaveLength(2);
    expect(html).toContain('name="confirmPassword"');
  });

  it("labels the submit button for account creation", () => {
    expect(html).toContain("Hesap oluştur");
  });
});

describe("AuthForm (login)", () => {
  const html = renderToStaticMarkup(<AuthForm mode="login" action={noopAction} next="/hesabim" />);

  it("has one password field with a toggle and the reset link, but no avatar or confirmation", () => {
    expect(html.match(/aria-label="Şifreyi göster"/g)).toHaveLength(1);
    expect(html).toContain("Şifremi unuttum");
    expect(html).not.toContain("Avatar seç");
    expect(html).not.toContain('name="confirmPassword"');
    expect(html).toContain('value="/hesabim"');
  });
});
