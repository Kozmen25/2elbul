export type TaxonomyLevel = 
  | "MainCategory"
  | "Category"
  | "SubCategory"
  | "Brand"
  | "Series"
  | "Model"
  | "Variant"
  | "Attribute";

export type TaxonomyNode = {
  id: string;
  label: string;
  level: TaxonomyLevel;
  aliases: string[];
  keywords: string[];
  children?: TaxonomyNode[];
  metadata?: Record<string, unknown>;
};

export type TaxonomyMatch = {
  node: TaxonomyNode;
  breadcrumbs: TaxonomyNode[];
  level: number;
  matchType: "exact" | "alias" | "keyword";
  matchedTerm: string;
};

export type AttributeType = 
  | "storage"
  | "ram"
  | "color"
  | "condition"
  | "warranty"
  | "network"
  | "battery"
  | "processor"
  | "os"
  | "screen-size"
  | "refresh-rate"
  | "material"
  | "size"
  | "weight"
  | "brand"
  | "year"
  | "mileage";

export type Attribute = {
  id: string;
  type: AttributeType;
  label: string;
  values?: string[];
  unit?: string;
  category?: string;
};

export type CategoryPathResolution = {
  mainCategory: TaxonomyNode | null;
  category: TaxonomyNode | null;
  subCategory: TaxonomyNode | null;
  brand: TaxonomyNode | null;
  series: TaxonomyNode | null;
  model: TaxonomyNode | null;
  variant: TaxonomyNode | null;
  attributes: Map<string, Attribute>;
};
