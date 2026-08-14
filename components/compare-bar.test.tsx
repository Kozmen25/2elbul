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
  MAX_SELECTION: 4,
  MIN_SELECTION: 2,
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
  const ids = selection.map((e) => e.listingId).join(",");
  return {
    selection,
    hasSelection: selection.length > 0,
    isFull: selection.length >= 4,
    isSelected: (id: string) => selection.some((e) => e.listingId === id),
    addToSelection: vi.fn(),
    removeFromSelection: vi.fn(),
    clearSelection: vi.fn(),
    compareUrl: selection.length >= 2 ? `/compare?ids=${ids}` : null,
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

  it("shows one selected listing, disabled button, and helper text", () => {
    compareStub.mockReturnValue(buildStub([entry("listing-1", "iPhone 13")]));

    const html = renderToStaticMarkup(<CompareBar />);

    expect(html).toContain("Karşılaştırma");
    expect(html).toContain("1/4 ilan seçildi");
    expect(html).toContain("1. iPhone 13");
    expect(html).toContain("disabled=\"\"");
    expect(html).toContain("bir ilan daha seç");
  });

  it("enables the compare button and shows extra-slot helper when two are selected", () => {
    compareStub.mockReturnValue(
      buildStub([entry("listing-1", "iPhone 13"), entry("listing-2", "Galaxy S22")]),
    );

    const html = renderToStaticMarkup(<CompareBar />);

    expect(html).toContain("2/4 ilan seçildi");
    expect(html).toContain("1. iPhone 13");
    expect(html).toContain("2. Galaxy S22");
    expect(html).not.toContain('disabled=""');
    expect(html).toContain("Daha fazla ilan ekleyebilirsin");
  });

  it("shows 3 selected items and still shows helper text", () => {
    compareStub.mockReturnValue(
      buildStub([
        entry("listing-1", "iPhone 13"),
        entry("listing-2", "Galaxy S22"),
        entry("listing-3", "Pixel 8"),
      ]),
    );

    const html = renderToStaticMarkup(<CompareBar />);

    expect(html).toContain("3/4 ilan seçildi");
    expect(html).toContain("Daha fazla ilan ekleyebilirsin");
  });

  it("hides helper text and shows 4 items with no empty slots when full", () => {
    compareStub.mockReturnValue(
      buildStub([
        entry("listing-1", "iPhone 13"),
        entry("listing-2", "Galaxy S22"),
        entry("listing-3", "Pixel 8"),
        entry("listing-4", "Redmi Note 12"),
      ]),
    );

    const html = renderToStaticMarkup(<CompareBar />);

    expect(html).toContain("4/4 ilan seçildi");
    expect(html).toContain("1. iPhone 13");
    expect(html).toContain("2. Galaxy S22");
    expect(html).toContain("3. Pixel 8");
    expect(html).toContain("4. Redmi Note 12");
    expect(html).not.toContain("Daha fazla ilan ekleyebilirsin");
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

  it("renders 3 empty placeholder slots when only one listing is selected", () => {
    compareStub.mockReturnValue(buildStub([entry("listing-1", "iPhone 13")]));

    const html = renderToStaticMarkup(<CompareBar />);

    expect(html).toContain("2. ilan");
    expect(html).toContain("3. ilan");
    expect(html).toContain("4. ilan");
  });
});
