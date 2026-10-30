// The 81 provinces of Türkiye, alphabetical (Turkish collation).
export const TR_CITIES = [
  "Adana", "Adıyaman", "Afyonkarahisar", "Ağrı", "Aksaray", "Amasya", "Ankara", "Antalya", "Ardahan", "Artvin",
  "Aydın", "Balıkesir", "Bartın", "Batman", "Bayburt", "Bilecik", "Bingöl", "Bitlis", "Bolu", "Burdur",
  "Bursa", "Çanakkale", "Çankırı", "Çorum", "Denizli", "Diyarbakır", "Düzce", "Edirne", "Elazığ", "Erzincan",
  "Erzurum", "Eskişehir", "Gaziantep", "Giresun", "Gümüşhane", "Hakkari", "Hatay", "Iğdır", "Isparta", "İstanbul",
  "İzmir", "Kahramanmaraş", "Karabük", "Karaman", "Kars", "Kastamonu", "Kayseri", "Kilis", "Kırıkkale", "Kırklareli",
  "Kırşehir", "Kocaeli", "Konya", "Kütahya", "Malatya", "Manisa", "Mardin", "Mersin", "Muğla", "Muş",
  "Nevşehir", "Niğde", "Ordu", "Osmaniye", "Rize", "Sakarya", "Samsun", "Şanlıurfa", "Siirt", "Sinop",
  "Sivas", "Şırnak", "Tekirdağ", "Tokat", "Trabzon", "Tunceli", "Uşak", "Van", "Yalova", "Yozgat", "Zonguldak",
] as const;

export type TrCity = (typeof TR_CITIES)[number];

const CITY_SET: ReadonlySet<string> = new Set(TR_CITIES);

export function isTrCity(value: string): value is TrCity {
  return CITY_SET.has(value);
}

/** Lower-cases and folds Turkish letters so "istanbul", "İstanbul" and "ISTANBUL" all match. */
export function foldTurkish(value: string): string {
  return value
    .replace(/İ/g, "i")
    .replace(/I/g, "ı")
    .toLocaleLowerCase("tr-TR")
    .replace(/ı/g, "i")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .trim();
}

/** Cities whose folded name starts with (then contains) the query, best matches first. */
export function searchCities(query: string, limit = 81): string[] {
  const folded = foldTurkish(query);
  if (!folded) return [...TR_CITIES].slice(0, limit);
  const starts: string[] = [];
  const contains: string[] = [];
  for (const city of TR_CITIES) {
    const name = foldTurkish(city);
    if (name.startsWith(folded)) starts.push(city);
    else if (name.includes(folded)) contains.push(city);
  }
  return [...starts, ...contains].slice(0, limit);
}
