import { describe, it, expect } from "vitest";
import { analyzeProduct } from "../engine";
import { ProductUnderstandingInput } from "../types";

function makeInput(overrides: Partial<ProductUnderstandingInput> & { title: string }): ProductUnderstandingInput {
  return {
    title: overrides.title,
    description: overrides.description,
    price: overrides.price,
    sourceId: overrides.sourceId,
    marketplaceCategory: overrides.marketplaceCategory,
    brand: overrides.brand,
    seller: overrides.seller,
    conditionText: overrides.conditionText,
  };
}

describe("Product Understanding Engine", () => {
  // ── Accessory detection ─────────────────────────────────────────────

  it("detects iPhone 14 Pro as Device with correct productIntent", () => {
    const result = analyzeProduct(makeInput({
      title: "iPhone 14 Pro 128GB Cep Telefonu",
      price: 35000,
      sourceId: "Sahibinden",
    }));

    expect(result.productType.value).toBe("primary_product");
    expect(result.productIntent.value).toBe("Device");
    expect(result.deviceFamily.value).toBeNull();
    expect(result.priceRealityCheck.value?.signalDirection).toBe("primary");
  });

  it("detects MacBook Air M2 as Device", () => {
    const result = analyzeProduct(makeInput({
      title: "MacBook Air M2 13.6 inç 8GB RAM 256GB SSD",
      price: 28000,
      sourceId: "MediaMarkt",
    }));

    expect(result.productType.value).toBe("primary_product");
    expect(result.productIntent.value).toBe("Device");
    expect(result.deviceModel.value).toMatch(/macbook/i);
  });

  it("detects MacBook Air M2 Şarj Aleti as Accessory", () => {
    const result = analyzeProduct(makeInput({
      title: "MacBook Air M2 Şarj Aleti 30W USB-C",
      price: 450,
      sourceId: "Trendyol",
    }));

    expect(result.productType.value).toBe("accessory");
    expect(result.accessoryType.value).toBe("charger");
    expect(result.productIntent.value).toBe("Accessory");
    expect(result.compatibleDevice.value).toMatch(/macbook/i);
    expect(result.deviceFamily.value).toBe("Charger");
  });

  it("detects screen protector as Accessory with productIntent", () => {
    const result = analyzeProduct(makeInput({
      title: "iPhone 14 Pro Max Ekran Koruyucu Temperli Cam",
      price: 150,
      sourceId: "Trendyol",
    }));

    expect(result.productType.value).toBe("accessory");
    expect(result.productType.confidence).toBeGreaterThanOrEqual(60);
    expect(result.accessoryType.value).toBe("screen_protector");
    expect(result.productIntent.value).toBe("Accessory");
    expect(result.deviceFamily.value).toBe("Screen Protector");
    expect(result.compatibleDevice.value).toMatch(/iphone/i);
    expect(result.compatibleModel.value).toMatch(/1[45]/);
  });

  it("detects Samsung phone case as Accessory", () => {
    const result = analyzeProduct(makeInput({
      title: "Samsung Galaxy S24 Ultra Silikon Kılıf Kapak",
      price: 200,
      sourceId: "Hepsiburada",
    }));

    expect(result.productType.value).toBe("accessory");
    expect(result.accessoryType.value).toBe("case");
    expect(result.productIntent.value).toBe("Accessory");
    expect(result.deviceFamily.value).toBe("Case");
    expect(result.compatibleDevice.value).toMatch(/samsung/i);
    expect(result.compatibleModel.value).toMatch(/s24/i);
  });

  it("detects a genuine primary device (iPhone listing)", () => {
    const result = analyzeProduct(makeInput({
      title: "iPhone 15 Pro Max 256GB Sıfır Cep Telefonu",
      price: 55000,
      sourceId: "Sahibinden",
      marketplaceCategory: "Cep Telefonu",
    }));

    expect(result.productType.value).toBe("primary_product");
    expect(result.compatibleDevice.value).toBeNull(); // Not an accessory, no compatible device
  });

  it("detects a Samsung phone as primary product", () => {
    const result = analyzeProduct(makeInput({
      title: "Samsung Galaxy S24 Ultra 512GB",
      price: 40000,
      sourceId: "Sahibinden",
    }));

    expect(result.productType.value).toBe("primary_product");
  });

  // ── Charger / Power / Cable ─────────────────────────────────────────

  it("detects charger as accessory with price signal", () => {
    const result = analyzeProduct(makeInput({
      title: "iPhone 15 Pro Max Şarj Aleti Hızlı Şarj",
      price: 350,
      sourceId: "Teknosa",
    }));

    expect(result.productType.value).toBe("accessory");
    expect(result.accessoryType.value).toBe("charger");
  });

  it("detects cable as accessory", () => {
    const result = analyzeProduct(makeInput({
      title: "iPhone Lightning Kablo Data Kablosu 1m",
      price: 120,
    }));

    expect(result.productType.value).toBe("accessory");
    expect(result.accessoryType.value).toBe("cable");
  });

  // ── Spare parts ─────────────────────────────────────────────────────

  it("detects battery spare part", () => {
    const result = analyzeProduct(makeInput({
      title: "iPhone 13 Batarya Değişim Takımı Orijinal Pil",
      price: 400,
    }));

    expect(result.productType.value).toBe("spare_part");
    expect(result.sparePartType.value).toBe("battery");
  });

  it("detects screen spare part with compatible device", () => {
    const result = analyzeProduct(makeInput({
      title: "iPhone 12 LCD Ekran Değişim Takımı",
      price: 800,
    }));

    expect(result.productType.value).toBe("spare_part");
    expect(result.sparePartType.value).toBe("screen");
    expect(result.compatibleDevice.value).toMatch(/iphone/i);
  });

  // ── Service ─────────────────────────────────────────────────────────

  it("detects repair service", () => {
    const result = analyzeProduct(makeInput({
      title: "iPhone Ekran Tamiri Yetkili Servis",
    }));

    expect(result.productType.value).toBe("service");
    expect(result.serviceType.value).toBe("repair");
  });

  // ── Confidence degradation ──────────────────────────────────────────

  it("returns lower confidence for ambiguous titles", () => {
    const result = analyzeProduct(makeInput({
      title: "Telefon Kılıf",
      price: 100,
    }));

    expect(result.productType.value).toBe("accessory");
    expect(result.productType.confidence).toBeGreaterThanOrEqual(50);
  });

  // ── Price edge cases ────────────────────────────────────────────────

  it("does not misclassify expensive charger-capable device", () => {
    const result = analyzeProduct(makeInput({
      title: "Samsung Galaxy S24 Ultra Şarj Aleti",
      price: 5000, // Above maxPrice for charger → confidence penalty
    }));

    // Still an accessory because of "şarj aleti" pattern + "for" pattern
    expect(result.productType.value).toBe("accessory");
    expect(result.accessoryType.value).toBe("charger");
  });

  // ── Accessory-only brand ────────────────────────────────────────────

  it("detects accessory-only brands as accessories", () => {
    const result = analyzeProduct(makeInput({
      title: "Spigen iPhone 15 Pro Max Kılıf Tough Armor",
      price: 600,
      brand: "Spigen",
    }));

    expect(result.productType.value).toBe("accessory");
    expect(result.accessoryType.value).toBe("case");
  });

  // ─── Seller type and warranty detection ──────────────────────────────

  it("detects professional seller from source", () => {
    const result = analyzeProduct(makeInput({
      title: "iPhone 15 Pro Max 256GB",
      price: 55000,
      sourceId: "MediaMarkt",
    }));

    expect(result.sellerType.value).toBe("Profesyonel");
    expect(result.sellerType.confidence).toBeGreaterThanOrEqual(80);
  });

  it("detects warranty from title", () => {
    const result = analyzeProduct(makeInput({
      title: "iPhone 15 Pro Max 256GB Garantili",
      price: 52000,
      sourceId: "Sahibinden",
    }));

    expect(result.warranty.value).toBe(true);
    expect(result.warranty.confidence).toBeGreaterThanOrEqual(80);
  });

  // ── Generic accessory (no compatible device) ─────────────────────────

  it("detects generic charger without device info", () => {
    const result = analyzeProduct(makeInput({
      title: "Hızlı Şarj Aleti USB-C 20W",
      price: 250,
    }));

    expect(result.productType.value).toBe("accessory");
    expect(result.accessoryType.value).toBe("charger");
    expect(result.compatibleDevice.value).toBeNull();
  });

  // ── Title structure signal ──────────────────────────────────────────

  it("uses title structure 'için' signal for accessory", () => {
    const result = analyzeProduct(makeInput({
      title: "iPhone 14 İçin Kılıf",
      price: 100,
    }));

    expect(result.productType.value).toBe("accessory");
    expect(result.accessoryType.value).toBe("case");
  });

  // ── Headphone with price guard ──────────────────────────────────────

  it("detects cheap headphone accessory", () => {
    const result = analyzeProduct(makeInput({
      title: "Bluetooth Kulaklık Kablosuz",
      price: 150,
    }));

    expect(result.productType.value).toBe("accessory");
    expect(result.accessoryType.value).toBe("headphone");
  });
});
