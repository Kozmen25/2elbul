import type { SourceRegistry, UnifiedSourceAdapter } from "./types";

class DefaultSourceRegistry implements SourceRegistry {
  private adapters: Map<string, UnifiedSourceAdapter> = new Map();

  register(adapter: UnifiedSourceAdapter): void {
    if (!adapter.sourceSlug) {
      throw new Error("Adapter sourceSlug tanımlanmamış.");
    }
    if (this.adapters.has(adapter.sourceSlug)) {
      console.warn(
        `Adapter zaten kayıtlı: ${adapter.sourceSlug}. Yenisi ile değiştirildi.`,
      );
    }
    this.adapters.set(adapter.sourceSlug, adapter);
  }

  get(sourceSlug: string): UnifiedSourceAdapter | null {
    return this.adapters.get(sourceSlug) || null;
  }

  getAll(): UnifiedSourceAdapter[] {
    return Array.from(this.adapters.values());
  }

  has(sourceSlug: string): boolean {
    return this.adapters.has(sourceSlug);
  }
}

let globalRegistry: SourceRegistry | null = null;

export function getSourceRegistry(): SourceRegistry {
  if (!globalRegistry) {
    globalRegistry = new DefaultSourceRegistry();
  }
  return globalRegistry;
}

export function initializeSourceRegistry(): SourceRegistry {
  globalRegistry = new DefaultSourceRegistry();
  return globalRegistry;
}
