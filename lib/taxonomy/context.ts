import { getCategoryResolver, initializeCategoryResolver } from "./bootstrap";
import type { ICategoryResolver } from "./integration";

export class CategoryResolverContext {
  private resolver: ICategoryResolver | null = null;

  constructor(resolver?: ICategoryResolver) {
    this.resolver = resolver || null;
  }

  getResolver(): ICategoryResolver {
    if (this.resolver) {
      return this.resolver;
    }
    return getCategoryResolver();
  }

  setResolver(resolver: ICategoryResolver): void {
    this.resolver = resolver;
  }

  reset(): void {
    this.resolver = null;
  }

  async resolve(input: string, context?: Record<string, unknown>) {
    return this.getResolver().resolve(input, context);
  }

  resolveSync(input: string, context?: Record<string, unknown>) {
    return this.getResolver().resolveSync(input, context);
  }

  async canResolve(input: string): Promise<boolean> {
    return this.getResolver().canResolve(input);
  }
}

let globalContext: CategoryResolverContext | null = null;

export function getGlobalContext(): CategoryResolverContext {
  if (!globalContext) {
    globalContext = new CategoryResolverContext();
  }
  return globalContext;
}

export function initializeContext(resolver?: ICategoryResolver): CategoryResolverContext {
  const context = new CategoryResolverContext(resolver);
  globalContext = context;
  return context;
}

export function resetContext(): void {
  globalContext = null;
}

export const defaultContext = getGlobalContext();
