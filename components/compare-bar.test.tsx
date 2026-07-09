import { renderToStaticMarkup } from "react-dom/server";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CompareSelectionEntry } from "@/components/compare-context";

const compareStub = vi.hoisted(() => vi.fn());
const routerPush = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: routerPush }),
}));

vi.mock("@/components/compare-context", () => ({
  useCompare: () => compareStub(),
}));

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...props
  }: {
    children: ReactNode;
    href: string;
    [key: string]: unknown;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

const { CompareBar } = await import("@/components/compare-bar");

const entry = (listingId: string, productName = listingId): CompareSelectionEntry => ({
  listingId,
  productName,
});

function buildStub(selection: CompareSelectionEntry[]) {
  return {
    selection,
    hasSelection: selection.length > 0,
    isFull: selection.length >= 2,
    isSelected: (id: string) => selection.some((e) => e.listingId === id),
    addToSelection: vi.fn(),
    removeFromSelection: vi.fn(),
    clearSelection: vi.fn(),
    compareUrl:
      selection.length === 2
        ? `/compare?a=${selection[0].listingId}&b=${selection[1].listingId}`
        : null,
  };
}

describe("CompareBar", () => {
  beforeEach(() => {
    routerPush.mockReset();
    compareStub.mockReset();
  });

  it("renders nothing when no listing is selected", () => {
    compareStub.mockReturnValue(buildStub([]));

    const html = renderToStaticMarkup(<CompareBar />);

    expect(html).not.toContain("Karşılaştırma");
    expect(html).not.toContain("ilan seçildi");
  });

  it("shows one selected listing and a disabled compare button", () => {
    compareStub.mockReturnValue(buildStub([entry("listing-1", "iPhone 13")]));

    const html = renderToStaticMarkup(<CompareBar />);

    expect(html).toContain("Karşılaştırma");
    expect(html).toContain("1/2 ilan seçildi");
    expect(html).toContain("1. iPhone 13");
    expect(html).toContain("disabled");
    expect(html).toContain("bir ilan daha seç");
  });

  it("enables the compare button and hides the helper when two listings are selected", () => {
    compareStub.mockReturnValue(
      buildStub([entry("listing-1", "iPhone 13"), entry("listing-2", "Galaxy S22")]),
    );

    const html = renderToStaticMarkup(<CompareBar />);

    expect(html).toContain("2/2 ilan seçildi");
    expect(html).toContain("1. iPhone 13");
    expect(html).toContain("2. Galaxy S22");
    expect(html).not.toContain("bir ilan daha seç");
  });

  it("renders the responsive layout classes for mobile", () => {
    compareStub.mockReturnValue(
      buildStub([entry("listing-1", "iPhone 13"), entry("listing-2", "Galaxy S22")]),
    );

    const html = renderToStaticMarkup(<CompareBar />);

    expect(html).toContain("sticky");
    expect(html).toContain("flex-col");
    expect(html).toContain("sm:flex-row");
    expect(html).toContain("overflow-x-auto");
  });

  it("renders clear and compare actions", () => {
    compareStub.mockReturnValue(
      buildStub([entry("listing-1", "iPhone 13"), entry("listing-2", "Galaxy S22")]),
    );

    const html = renderToStaticMarkup(<CompareBar />);

    expect(html).toContain("Temizle");
    expect(html).toContain("Karşılaştır");
  });

  it("renders empty placeholder slots when only one listing is selected", () => {
    compareStub.mockReturnValue(buildStub([entry("listing-1", "iPhone 13")]));

    const html = renderToStaticMarkup(<CompareBar />);

    expect(html).toContain("2. ilan");
  });
});
