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
  price: number;
  city: string;
  source: ListingSource;
  url: string;
  condition: ListingCondition;
  imageUrl: string | null;
  createdAt: string;
  updatedAt?: string | null;
};

export type ProductOption = {
  id: string;
  name: string;
};
