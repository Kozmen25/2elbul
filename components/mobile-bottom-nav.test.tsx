import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ pathname: "/" }));

vi.mock("next/navigation", () => ({
  usePathname: () => mocks.pathname,
}));

import { MobileBottomNav } from "@/components/mobile-bottom-nav";

describe("MobileBottomNav", () => {
  beforeEach(() => {
    mocks.pathname = "/";
  });

  it("offers login to guests and the account page to signed-in users", () => {
    const guest = renderToStaticMarkup(<MobileBottomNav signedIn={false} />);
    expect(guest).toContain('href="/giris"');
    expect(guest).not.toContain('href="/hesabim"');

    const member = renderToStaticMarkup(<MobileBottomNav signedIn />);
    expect(member).toContain('href="/hesabim"');
    expect(member).not.toContain('href="/giris"');
  });

  it("marks only the current section as active", () => {
    mocks.pathname = "/category/telefon";
    const html = renderToStaticMarkup(<MobileBottomNav signedIn={false} />);
    expect(html.match(/aria-current="page"/g)).toHaveLength(1);
    const activeLink = html.match(/<a [^>]*aria-current="page"[^>]*>/)?.[0] ?? "";
    expect(activeLink).toContain('href="/categories"');
  });

  it("is a bottom bar hidden from md up", () => {
    const html = renderToStaticMarkup(<MobileBottomNav signedIn={false} />);
    expect(html).toContain("md:hidden");
    expect(html).toContain("mobile-bottom-nav");
  });
});
