import type { TaxonomyNode, TaxonomyMatch } from "./types";

class TaxonomyRegistry {
  private static instance: TaxonomyRegistry;
  private taxonomy: Map<string, TaxonomyNode> = new Map();
  private indexByLabel: Map<string, TaxonomyNode> = new Map();
  private indexByAlias: Map<string, TaxonomyNode> = new Map();
  private indexByKeyword: Map<string, TaxonomyNode> = new Map();

  private constructor() {
    this.initializeIndices();
  }

  static getInstance(): TaxonomyRegistry {
    if (!TaxonomyRegistry.instance) {
      TaxonomyRegistry.instance = new TaxonomyRegistry();
    }
    return TaxonomyRegistry.instance;
  }

  private initializeIndices() {
    this.indexByLabel.clear();
    this.indexByAlias.clear();
    this.indexByKeyword.clear();
  }

  register(node: TaxonomyNode): void {
    this.taxonomy.set(node.id, node);
    const normalized = this.normalize(node.label);
    this.indexByLabel.set(normalized, node);

    for (const alias of node.aliases) {
      this.indexByAlias.set(this.normalize(alias), node);
    }

    for (const keyword of node.keywords) {
      this.indexByKeyword.set(this.normalize(keyword), node);
    }

    if (node.children) {
      for (const child of node.children) {
        this.register(child);
      }
    }
  }

  registerBulk(nodes: TaxonomyNode[]): void {
    for (const node of nodes) {
      this.register(node);
    }
  }

  get(id: string): TaxonomyNode | undefined {
    return this.taxonomy.get(id);
  }

  findByLabel(label: string): TaxonomyNode | undefined {
    return this.indexByLabel.get(this.normalize(label));
  }

  findByAlias(alias: string): TaxonomyNode | undefined {
    return this.indexByAlias.get(this.normalize(alias));
  }

  findByKeyword(keyword: string): TaxonomyNode | undefined {
    return this.indexByKeyword.get(this.normalize(keyword));
  }

  search(query: string): TaxonomyMatch[] {
    const normalized = this.normalize(query);
    const matches: TaxonomyMatch[] = [];

    const nodeByLabel = this.indexByLabel.get(normalized);
    if (nodeByLabel) {
      matches.push({
        node: nodeByLabel,
        breadcrumbs: this.getBreadcrumbs(nodeByLabel),
        level: this.getDepth(nodeByLabel),
        matchType: "exact",
        matchedTerm: query,
      });
    }

    const nodeByAlias = this.indexByAlias.get(normalized);
    if (nodeByAlias && nodeByAlias !== nodeByLabel) {
      matches.push({
        node: nodeByAlias,
        breadcrumbs: this.getBreadcrumbs(nodeByAlias),
        level: this.getDepth(nodeByAlias),
        matchType: "alias",
        matchedTerm: query,
      });
    }

    const nodeByKeyword = this.indexByKeyword.get(normalized);
    if (nodeByKeyword && nodeByKeyword !== nodeByLabel && nodeByKeyword !== nodeByAlias) {
      matches.push({
        node: nodeByKeyword,
        breadcrumbs: this.getBreadcrumbs(nodeByKeyword),
        level: this.getDepth(nodeByKeyword),
        matchType: "keyword",
        matchedTerm: query,
      });
    }

    return matches;
  }

  getAll(): TaxonomyNode[] {
    return Array.from(this.taxonomy.values());
  }

  clear(): void {
    this.taxonomy.clear();
    this.initializeIndices();
  }

  private normalize(text: string): string {
    return text
      .toLocaleLowerCase("tr-TR")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/ı/g, "i")
      .replace(/ğ/g, "g")
      .replace(/ü/g, "u")
      .replace(/ş/g, "s")
      .replace(/ö/g, "o")
      .replace(/ç/g, "c")
      .replace(/\s+/g, " ")
      .trim();
  }

  private getBreadcrumbs(node: TaxonomyNode, breadcrumbs: TaxonomyNode[] = []): TaxonomyNode[] {
    const allNodes = Array.from(this.taxonomy.values());
    const path: TaxonomyNode[] = [];

    let current: TaxonomyNode | undefined = node;
    const visited = new Set<string>();

    while (current && !visited.has(current.id)) {
      path.unshift(current);
      visited.add(current.id);

      const parent = allNodes.find(n => n.children?.some(c => c.id === current!.id));
      current = parent;
    }

    return path;
  }

  private getDepth(node: TaxonomyNode): number {
    const allNodes = Array.from(this.taxonomy.values());
    let depth = 0;
    let current: TaxonomyNode | undefined = node;
    const visited = new Set<string>();

    while (current && !visited.has(current.id)) {
      depth++;
      visited.add(current.id);
      const parent = allNodes.find(n => n.children?.some(c => c.id === current!.id));
      current = parent;
    }

    return depth;
  }
}

export default TaxonomyRegistry.getInstance();
