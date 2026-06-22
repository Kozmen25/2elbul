import type { ListingCondition, ListingSource } from "@/lib/listings";

export type ImportSource = Extract<
  ListingSource,
  | "Sahibinden"
  | "Letgo"
  | "Facebook Marketplace"
  | "EasyCep"
  | "Getmobil"
  | "Yenilenmiş Market"
  | "Teknosa Yenilenmiş"
  | "Hepsiburada Yenilenmiş"
  | "MediaMarkt Yenilenmiş"
>;

export type RawImportListing = Record<string, unknown>;

export type NormalizedImportListing = {
  externalId: string;
  productName: string;
  category: string | null;
  title: string;
  price: number;
  city: string;
  source: ImportSource;
  url: string;
  condition: ListingCondition;
  imageUrl: string | null;
  imageUrls: string[];
  publishedAt: string | null;
  rawPayload: RawImportListing;
};

export type ImportAdapter = {
  source: ImportSource;
  normalize: (payload: RawImportListing) => NormalizedImportListing;
};

export type ImportResult = {
  imported: number;
  failed: number;
  errors: Array<{ index: number; message: string }>;
};
