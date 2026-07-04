import type { Attribute, AttributeType } from "./types";

class AttributeSystem {
  private attributes: Map<string, Attribute> = new Map();
  private attributesByType: Map<AttributeType, Attribute[]> = new Map();

  constructor() {
    this.registerDefaultAttributes();
  }

  private registerDefaultAttributes(): void {
    const defaults: Attribute[] = [
      { id: "storage", type: "storage", label: "Depolama", unit: "GB/TB", values: ["64GB", "128GB", "256GB", "512GB", "1TB", "2TB"] },
      { id: "ram", type: "ram", label: "RAM", unit: "GB", values: ["4GB", "6GB", "8GB", "12GB", "16GB", "32GB"] },
      { id: "color", type: "color", label: "Renk", values: ["Siyah", "Beyaz", "Gümüş", "Altın", "Mavi", "Kırmızı"] },
      { id: "condition", type: "condition", label: "Durumu", values: ["Yeni", "Sıfır", "Çok İyi", "İyi", "Orta", "Onarım Gerekli"] },
      { id: "warranty", type: "warranty", label: "Garanti", unit: "Ay/Yıl", values: ["1 Ay", "3 Ay", "6 Ay", "1 Yıl", "2 Yıl"] },
      { id: "network", type: "network", label: "Ağ Teknolojisi", values: ["4G", "5G", "LTE", "3G", "Dual SIM"] },
      { id: "battery", type: "battery", label: "Pil Kapasitesi", unit: "mAh", values: ["2000", "3000", "4000", "5000", "6000"] },
      { id: "processor", type: "processor", label: "İşlemci", values: ["Snapdragon 888", "Apple A15", "Exynos", "Snapdragon 870"] },
      { id: "os", type: "os", label: "İşletim Sistemi", values: ["iOS", "Android", "Windows", "macOS"] },
      { id: "screen-size", type: "screen-size", label: "Ekran Boyutu", unit: "inç", values: ["5.5\"", "6\"", "6.5\"", "6.7\"", "7\""] },
      { id: "refresh-rate", type: "refresh-rate", label: "Tarama Hızı", unit: "Hz", values: ["60Hz", "90Hz", "120Hz", "144Hz", "165Hz"] },
      { id: "material", type: "material", label: "Malzeme", values: ["Plastik", "Metal", "Cam", "Ahşap", "Çelik"] },
      { id: "size", type: "size", label: "Boyut", unit: "cm", values: ["S", "M", "L", "XL", "XXL"] },
      { id: "weight", type: "weight", label: "Ağırlık", unit: "kg", values: ["0.5kg", "1kg", "2kg", "5kg", "10kg"] },
      { id: "brand", type: "brand", label: "Marka", values: ["Apple", "Samsung", "Xiaomi", "Oppo", "Realme"] },
      { id: "year", type: "year", label: "Yıl", values: ["2020", "2021", "2022", "2023", "2024"] },
      { id: "mileage", type: "mileage", label: "Kilometre", unit: "km", values: ["0", "50000", "100000", "150000", "200000"] },
    ];

    for (const attr of defaults) {
      this.register(attr);
    }
  }

  register(attribute: Attribute): void {
    this.attributes.set(attribute.id, attribute);

    if (!this.attributesByType.has(attribute.type)) {
      this.attributesByType.set(attribute.type, []);
    }
    this.attributesByType.get(attribute.type)!.push(attribute);
  }

  get(id: string): Attribute | undefined {
    return this.attributes.get(id);
  }

  getByType(type: AttributeType): Attribute[] {
    return this.attributesByType.get(type) || [];
  }

  getAll(): Attribute[] {
    return Array.from(this.attributes.values());
  }

  extractFromText(text: string): Map<string, Attribute> {
    const found = new Map<string, Attribute>();
    const normalized = text.toLocaleLowerCase("tr-TR");

    for (const attr of this.getAll()) {
      if (!attr.values) continue;

      for (const value of attr.values) {
        if (normalized.includes(value.toLocaleLowerCase("tr-TR"))) {
          found.set(attr.id, attr);
          break;
        }
      }
    }

    return found;
  }

  isValueValid(attributeId: string, value: string): boolean {
    const attr = this.get(attributeId);
    if (!attr || !attr.values) return false;
    return attr.values.some(v => v.toLocaleLowerCase("tr-TR") === value.toLocaleLowerCase("tr-TR"));
  }
}

export default new AttributeSystem();
