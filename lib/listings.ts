export type ListingSource =
  | "Sahibinden"
  | "Letgo"
  | "Facebook Marketplace"
  | "Dolap";

export type ListingCondition =
  | "Sıfır"
  | "Yeni gibi"
  | "Çok iyi"
  | "İyi"
  | "İkinci El"
  | "Kullanılmış";

export type Listing = {
  id: string;
  title: string;
  productName: string;
  price: number;
  city: string;
  source: ListingSource;
  url: string;
  condition: ListingCondition;
  createdAt: string;
};

export type ProductOption = {
  id: string;
  name: string;
};
