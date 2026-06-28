const turkishCharacterMap: Record<string, string> = {
  ç: "c",
  ğ: "g",
  ı: "i",
  ö: "o",
  ş: "s",
  ü: "u",
  Ç: "c",
  Ğ: "g",
  İ: "i",
  I: "i",
  Ö: "o",
  Ş: "s",
  Ü: "u",
};

export function normalizeSearchDemandQuery(query: string) {
  return query
    .trim()
    .replace(/[çğıöşüÇĞİIÖŞÜ]/g, (character) => turkishCharacterMap[character] ?? character)
    .toLocaleLowerCase("en-US")
    .replace(/\s+/g, " ")
    .slice(0, 120);
}
