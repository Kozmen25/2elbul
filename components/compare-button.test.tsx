import { renderToStaticMarkup } from "react-dom/server";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CompareSelectionEntry } from "@/components/compare-context";

const compareStub = vi.hoisted(() => vi.fn());

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

const { CompareButton } = await import("@/components/compare-button");

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
    compareUrl: null,
  };
}

describe("CompareButton", () => {
  beforeEach(() => {
    compareStub.mockReset();
  });

  it("renders the default label when the listing is not selected", () => {
    compareStub.mockReturnValue(buildStub([]));

    const html = renderToStaticMarkup(
      <CompareButton listingId="listing-1" productName="iPhone 13" />,
    );

    expect(html).toContain("Karşılaştır");
    expect(html).toContain("aria-pressed=\"false\"");
  });

  it("renders the selected state with a check when the listing is selected", () => {
    compareStub.mockReturnValue(buildStub([entry("listing-1", "iPhone 13")]));

    const html = renderToStaticMarkup(
      <CompareButton listingId="listing-1" productName="iPhone 13" />,
    );

    expect(html).toContain("Seçildi");
    expect(html).toContain("aria-pressed=\"true\"");
  });

  it("renders a compact square button when compact is set", () => {
    compareStub.mockReturnValue(buildStub([]));

    const html = renderToStaticMarkup(
      <CompareButton listingId="listing-1" productName="iPhone 13" compact />,
    );

    expect(html).toContain("size-10");
    expect(html).not.toContain(">Karşılaştır<");
  });
});
