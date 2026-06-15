export type ListingSource =
  | "Sahibinden"
  | "Letgo"
  | "Facebook Marketplace"
  | "Dolap"
  | "EasyCep"
  | "Getmobil"
  | "Yenilenmiş Market"
  | "Teknosa Yenilenmiş"
  | "Hepsiburada Yenilenmiş"
  | "MediaMarkt Yenilenmiş";

export type ListingCondition =
  | "Sıfır"
  | "Yeni gibi"
  | "Çok iyi"
  | "İyi"
  | "İkinci El"
  | "Kullanılmış"
  | "Yenilenmiş";

export const LISTING_SOURCES: ListingSource[] = [
  "Sahibinden",
  "Letgo",
  "Facebook Marketplace",
  "Dolap",
  "EasyCep",
  "Getmobil",
  "Yenilenmiş Market",
  "Teknosa Yenilenmiş",
  "Hepsiburada Yenilenmiş",
  "MediaMarkt Yenilenmiş",
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
  title: string;
  productName: string;
  price: number;
  city: string;
  source: ListingSource;
  url: string;
  condition: ListingCondition;
  imageUrl: string | null;
  createdAt: string;
};

export type ProductOption = {
  id: string;
  name: string;
};
