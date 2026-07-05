import type { CategoryPathResolution, TaxonomyNode } from "./types";
import registry from "./registry";
import { extractBrand } from "../normalization";

type ResolutionRule = {
  pattern: RegExp;
  handler: (query: string, matches: string[]) => Partial<CategoryPathResolution>;
};

class CategoryResolver {
  private rules: ResolutionRule[] = [];

  constructor() {
    this.registerDefaultRules();
  }

  private registerDefaultRules(): void {
    this.registerPhoneRules();
    this.registerComputerRules();
    this.registerTabletRules();
    this.registerLaptopRules();
    this.registerGameConsoleRules();
    this.registerElectronicsRules();
    this.registerVehicleRules();
    this.registerRealEstateRules();
  }

  private registerPhoneRules(): void {
    const phonePattern = /iphone|samsung\s*galaxy|xiaomi|oppo|realme|vivo|honor|huawei|nokia|motorola/i;
    this.addRule(phonePattern, (query) => {
      const mainCat = registry.findByLabel("Elektronik");
      const cat = registry.findByLabel("Telefon");
      const subCat = registry.findByLabel("Akıllı Telefon");

      let brand: TaxonomyNode | undefined;
      const brandKey = extractBrand(query);
      if (brandKey === "apple") brand = registry.findByLabel("Apple");
      else if (brandKey === "samsung") brand = registry.findByLabel("Samsung");
      else if (brandKey === "xiaomi") brand = registry.findByLabel("Xiaomi");
      else if (brandKey === "oppo") brand = registry.findByLabel("Oppo");

      return {
        mainCategory: mainCat,
        category: cat,
        subCategory: subCat,
        brand,
      };
    });
  }

  private registerComputerRules(): void {
    const pattern = /laptop|bilgisayar|notebook|macbook|pc|desktop/i;
    this.addRule(pattern, (query) => {
      const mainCat = registry.findByLabel("Elektronik");
      const cat = registry.findByLabel("Bilgisayar");

      let subCat: TaxonomyNode | undefined;
      if (query.match(/laptop|notebook/i)) subCat = registry.findByLabel("Laptop");
      else if (query.match(/desktop|pc|masaüstü/i)) subCat = registry.findByLabel("Masaüstü");
      else if (query.match(/macbook/i)) subCat = registry.findByLabel("Apple");

      return {
        mainCategory: mainCat,
        category: cat,
        subCategory: subCat,
      };
    });
  }

  private registerTabletRules(): void {
    const pattern = /tablet|ipad|galaxy\s*tab/i;
    this.addRule(pattern, (query) => {
      const mainCat = registry.findByLabel("Elektronik");
      const cat = registry.findByLabel("Tablet");

      let brand: TaxonomyNode | undefined;
      const brandKey = extractBrand(query);
      if (brandKey === "apple") brand = registry.findByLabel("Apple");
      else if (brandKey === "samsung") brand = registry.findByLabel("Samsung");

      return {
        mainCategory: mainCat,
        category: cat,
        brand,
      };
    });
  }

  private registerLaptopRules(): void {
    const pattern = /laptop|notebook|macbook/i;
    this.addRule(pattern, (query) => {
      const mainCat = registry.findByLabel("Elektronik");
      const cat = registry.findByLabel("Bilgisayar");
      const subCat = registry.findByLabel("Laptop");

      return {
        mainCategory: mainCat,
        category: cat,
        subCategory: subCat,
      };
    });
  }

  private registerGameConsoleRules(): void {
    const pattern = /playstation|ps5|xbox|nintendo|switch|konsol/i;
    this.addRule(pattern, (query) => {
      const mainCat = registry.findByLabel("Elektronik");
      const cat = registry.findByLabel("Oyun Konsolu");

      let series: TaxonomyNode | undefined;
      if (query.match(/ps5|playstation\s*5/i)) series = registry.findByLabel("PlayStation 5");
      else if (query.match(/ps4|playstation\s*4/i)) series = registry.findByLabel("PlayStation 4");
      else if (query.match(/xbox\s*series\s*x/i)) series = registry.findByLabel("Xbox Series X");

      return {
        mainCategory: mainCat,
        category: cat,
        series,
      };
    });
  }

  private registerElectronicsRules(): void {
    const pattern = /tv|monitor|kulaklık|airpods|hoparlör|kamera|drone/i;
    this.addRule(pattern, (query) => {
      const mainCat = registry.findByLabel("Elektronik");
      let cat: TaxonomyNode | undefined;

      if (query.match(/tv|television|monitor/i)) cat = registry.findByLabel("TV / Ses Sistemi");
      else if (query.match(/kamera|fotoğraf/i)) cat = registry.findByLabel("Fotoğraf / Kamera");
      else if (query.match(/kulaklık|airpods|buds/i)) cat = registry.findByLabel("Kulaklık / Ses");

      return {
        mainCategory: mainCat,
        category: cat,
      };
    });
  }

  private registerVehicleRules(): void {
    const pattern = /araba|araç|otomobil|motosiklet|motor|suv|jeep/i;
    this.addRule(pattern, (query) => {
      const mainCat = registry.findByLabel("Vasıta");

      let cat: TaxonomyNode | undefined;
      if (query.match(/araba|otomobil|sedan|coupe|hatchback/i)) cat = registry.findByLabel("Otomobil");
      else if (query.match(/motosiklet|motor|scooter/i)) cat = registry.findByLabel("Motosiklet");
      else if (query.match(/suv|jeep|4x4|pickup/i)) cat = registry.findByLabel("Arazi / SUV / Pickup");

      return {
        mainCategory: mainCat,
        category: cat,
      };
    });
  }

  private registerRealEstateRules(): void {
    const pattern = /ev|daire|villa|emlak|arsa|kira|satılık/i;
    this.addRule(pattern, (query) => {
      const mainCat = registry.findByLabel("Emlak");

      let cat: TaxonomyNode | undefined;
      if (query.match(/ev|konut|daire|villa/i)) cat = registry.findByLabel("Konut");
      else if (query.match(/arsa|tarla|bağ/i)) cat = registry.findByLabel("Arsa");
      else if (query.match(/işyeri|ofis|dükkan/i)) cat = registry.findByLabel("İş Yeri");

      return {
        mainCategory: mainCat,
        category: cat,
      };
    });
  }

  resolve(query: string): CategoryPathResolution {
    const resolution: CategoryPathResolution = {
      mainCategory: null,
      category: null,
      subCategory: null,
      brand: null,
      series: null,
      model: null,
      variant: null,
      attributes: new Map(),
    };

    for (const rule of this.rules) {
      const matches = query.match(rule.pattern);
      if (matches) {
        const ruleResult = rule.handler(query, matches);
        Object.assign(resolution, ruleResult);
        break;
      }
    }

    return resolution;
  }

  private addRule(pattern: RegExp, handler: (query: string, matches: string[]) => Partial<CategoryPathResolution>): void {
    this.rules.push({ pattern, handler });
  }
}

export default new CategoryResolver();
