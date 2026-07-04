import type { CategoryNode as ExistingCategoryNode } from "@/lib/category-taxonomy";
import type { TaxonomyNode } from "./types";
import taxonomyRegistry from "./registry";

class CategoryTreeBuilder {
  buildFromLegacy(legacyTaxonomy: ExistingCategoryNode[]): TaxonomyNode[] {
    const nodes: TaxonomyNode[] = [];

    for (const legacyNode of legacyTaxonomy) {
      const node = this.convertLegacyNode(legacyNode, "MainCategory");
      nodes.push(node);
    }

    taxonomyRegistry.registerBulk(nodes);
    return nodes;
  }

  private convertLegacyNode(
    legacyNode: ExistingCategoryNode,
    level: "MainCategory" | "Category" | "SubCategory" = "MainCategory",
  ): TaxonomyNode {
    const node: TaxonomyNode = {
      id: legacyNode.id,
      label: legacyNode.label,
      level,
      aliases: legacyNode.aliases || [],
      keywords: legacyNode.keywords || [],
      metadata: {
        sourceHints: legacyNode.sourceHints,
        priority: legacyNode.priority,
      },
    };

    if (legacyNode.children && legacyNode.children.length > 0) {
      const childLevel = this.getNextLevel(level);
      node.children = legacyNode.children.map((child) =>
        this.convertLegacyNode(child, childLevel),
      );
    }

    return node;
  }

  private getNextLevel(
    currentLevel: "MainCategory" | "Category" | "SubCategory",
  ): "MainCategory" | "Category" | "SubCategory" {
    const levelMap = {
      MainCategory: "Category" as const,
      Category: "SubCategory" as const,
      SubCategory: "SubCategory" as const,
    };
    return levelMap[currentLevel];
  }

  createEmpty(): TaxonomyNode {
    return {
      id: "root",
      label: "Root",
      level: "MainCategory",
      aliases: [],
      keywords: [],
      children: [],
    };
  }
}

export default new CategoryTreeBuilder();
