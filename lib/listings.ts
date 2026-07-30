export type ListingSource =
  | "Sahibinden"
  | "Letgo"
  | "Facebook Marketplace"
  | "EasyCep"
  | "Getmobil"
  | "Yenilenmiş Market"
  | "Teknosa Yenilenmiş"
  | "Hepsiburada Yenilenmiş"
  | "MediaMarkt Yenilenmiş"
  | "Satarız";

export type ListingCondition =
  | "Sıfır"
  | "Yeni gibi"
  | "Çok iyi"
  | "İyi"
  | "İkinci El"
  | "Kullanılmış"
  | "Yenilenmiş";

export type SellerType =
  | "corporate"
  | "individual"
  | "store"
  | "official"
  | "marketplace"
  | "unknown";

export type WarrantyType =
  | "apple_official"
  | "distributor"
  | "importer"
  | "store"
  | "no_warranty"
  | "unknown";

export type PriceQualityType =
  | "good_deal"
  | "fair_price"
  | "overpriced"
  | "suspicious"
  | "unknown";

export const LISTING_SOURCES: ListingSource[] = [
  "Sahibinden",
  "Letgo",
  "Facebook Marketplace",
  "EasyCep",
  "Getmobil",
  "Yenilenmiş Market",
  "Teknosa Yenilenmiş",
  "Hepsiburada Yenilenmiş",
  "MediaMarkt Yenilenmiş",
  "Satarız",
];

export const LISTING_CONDITIONS: ListingCondition[] = [
  "İkinci El",
  "Yeni gibi",
  "İyi",
  "Yenilenmiş",
  "Sıfır",
  "Çok iyi",
  "Kullanılmış",
];

export type Listing = {
  id: string;
  productId?: string;
  title: string;
  productName: string;
  category?: string | null;
  price: number;
  city: string;
  source: ListingSource;
  url: string;
  condition: ListingCondition;
  imageUrl: string | null;
  createdAt: string;
  updatedAt?: string | null;
  sellerName?: string | null;
  sellerType?: SellerType | null;
  warranty?: string | null;
  warrantyType?: WarrantyType | null;
  priceQuality?: PriceQualityType | null;
};

export type ProductOption = {
  id: string;
  name: string;
};
