export type SearchInput = {
  query: string;
  normalizedQuery: string;
  sourceId: number | null;
  sourceName: string;
  sourceSlug: string;
  limit?: number;
};

export type NormalizedListing = {
  externalId: string;
  title: string;
  price: number;
  url: string;
  imageUrl: string | null;
  city: string | null;
  sourceName: string;
  category: string | null;
  brand: string | null;
  model: string | null;
  rawData: Record<string, unknown> | null;
};

export interface SourceAdapter {
  slug: string;
  search(input: SearchInput): Promise<NormalizedListing[]>;
}
