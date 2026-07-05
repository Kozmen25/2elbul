import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { groupListingDuplicates } from "../product-matcher";
import type { BotAdapterListing } from "./types";

describe("listing-sync duplicate detection", () => {
  it("should detect duplicates within same batch", () => {
    const listings: BotAdapterListing[] = [
      {
        external_id: "1",
        product_name: "iPhone 12",
        title: "iPhone 12 128GB Siyah",
        price: 5000,
        city: "Istanbul",
        source: "EasyCep",
        url: "https://easycep.com/1",
        condition: "refurbished",
        image_url: "https://example.com/img1.jpg",
        image_urls: [],
        status: "published",
      },
      {
        external_id: "2",
        product_name: "iPhone 12",
        title: "iPhone 12 128GB Siyah",
        price: 5100,
        city: "Ankara",
        source: "Getmobil",
        url: "https://getmobil.com/1",
        condition: "refurbished",
        image_url: "https://example.com/img2.jpg",
        image_urls: [],
        status: "published",
      },
    ];

    const result = groupListingDuplicates(
      listings.map((l, idx) => ({
        id: l.external_id ?? `listing-${idx}`,
        title: l.title,
        price: l.price,
        source: l.source,
        condition: l.condition,
      })),
      70,
    );

    expect(result.groups).toBeDefined();
    expect(result.count).toBeGreaterThan(0);
  });

  it("should handle empty listings batch", () => {
    const listings: BotAdapterListing[] = [];

    const result = groupListingDuplicates(
      listings.map((l, idx) => ({
        id: l.external_id ?? `listing-${idx}`,
        title: l.title,
        price: l.price,
        source: l.source,
        condition: l.condition,
      })),
      70,
    );

    expect(result.groups).toBeDefined();
    expect(result.count).toBe(0);
  });

  it("should handle single listing batch", () => {
    const listings: BotAdapterListing[] = [
      {
        external_id: "1",
        product_name: "Samsung S21",
        title: "Samsung Galaxy S21 256GB",
        price: 8000,
        city: "Istanbul",
        source: "Teknosa",
        url: "https://teknosa.com/1",
        condition: "refurbished",
        image_url: "https://example.com/img1.jpg",
        image_urls: [],
        status: "published",
      },
    ];

    const result = groupListingDuplicates(
      listings.map((l, idx) => ({
        id: l.external_id ?? `listing-${idx}`,
        title: l.title,
        price: l.price,
        source: l.source,
        condition: l.condition,
      })),
      70,
    );

    expect(result.groups).toBeDefined();
    expect(result.count).toBeGreaterThanOrEqual(0);
  });

  it("should group high similarity listings", () => {
    const listings: BotAdapterListing[] = [
      {
        external_id: "1",
        product_name: "iPhone 13 Pro",
        title: "iPhone 13 Pro 128GB Gold",
        price: 9500,
        city: "Istanbul",
        source: "Source1",
        url: "https://example.com/1",
        condition: "refurbished",
        image_url: null,
        image_urls: [],
        status: "published",
      },
      {
        external_id: "2",
        product_name: "iPhone 13 Pro",
        title: "iPhone 13 Pro 128GB Gold",
        price: 9600,
        city: "Istanbul",
        source: "Source2",
        url: "https://example.com/2",
        condition: "refurbished",
        image_url: null,
        image_urls: [],
        status: "published",
      },
      {
        external_id: "3",
        product_name: "iPad Air",
        title: "iPad Air 2024",
        price: 7000,
        city: "Ankara",
        source: "Source3",
        url: "https://example.com/3",
        condition: "new",
        image_url: null,
        image_urls: [],
        status: "published",
      },
    ];

    const result = groupListingDuplicates(
      listings.map((l, idx) => ({
        id: l.external_id ?? `listing-${idx}`,
        title: l.title,
        price: l.price,
        source: l.source,
        condition: l.condition,
      })),
      70,
    );

    expect(result.groups).toBeDefined();
    expect(result.matchedCount).toBeGreaterThan(0);
  });

  it("should handle different conditions and prices", () => {
    const listings: BotAdapterListing[] = [
      {
        external_id: "1",
        product_name: "iPhone 12",
        title: "iPhone 12 128GB Siyah",
        price: 1000,
        city: "Istanbul",
        source: "Source1",
        url: "https://example.com/1",
        condition: "refurbished",
        image_url: null,
        image_urls: [],
        status: "published",
      },
      {
        external_id: "2",
        product_name: "iPhone 12",
        title: "iPhone 12 128GB Siyah",
        price: 2000,
        city: "Istanbul",
        source: "Source2",
        url: "https://example.com/2",
        condition: "new",
        image_url: null,
        image_urls: [],
        status: "published",
      },
      {
        external_id: "3",
        product_name: "iPhone 12",
        title: "iPhone 12 128GB Siyah",
        price: 900,
        city: "Istanbul",
        source: "Source3",
        url: "https://example.com/3",
        condition: "used",
        image_url: null,
        image_urls: [],
        status: "published",
      },
    ];

    const result = groupListingDuplicates(
      listings.map((l, idx) => ({
        id: l.external_id ?? `listing-${idx}`,
        title: l.title,
        price: l.price,
        source: l.source,
        condition: l.condition,
      })),
      70,
    );

    expect(result.groups).toBeDefined();
    expect(result.count).toBeGreaterThan(0);
    expect(Array.isArray(result.groups)).toBe(true);
  });
});
