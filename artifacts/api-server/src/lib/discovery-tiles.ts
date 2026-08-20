import { db, categoriesTable, type StorefrontDiscoveryTile } from "@workspace/db";
import { and, eq, inArray } from "drizzle-orm";

type DiscoverySort = "featured" | "price-asc" | "price-desc" | "name";

const discoverySorts = new Set<DiscoverySort>([
  "featured",
  "price-asc",
  "price-desc",
  "name",
]);

export async function validateDiscoveryTiles(
  tiles: StorefrontDiscoveryTile[] | undefined,
  storeId?: number,
): Promise<string | null> {
  if (!tiles) return null;

  const tileIds = new Set<string>();
  const targets = new Set<string>();
  const categoryIds: number[] = [];

  for (const tile of tiles) {
    if (!tile.id.trim() || !tile.label.trim()) return "Each discovery tile needs an ID and label.";
    if (tileIds.has(tile.id)) return "Discovery tile IDs must be unique.";
    tileIds.add(tile.id);

    if (tile.type === "category") {
      if (!Number.isInteger(tile.categoryId) || tile.categoryId < 1) {
        return "Category tiles must reference one valid category.";
      }
      const target = `category:${tile.categoryId}`;
      if (targets.has(target)) return "A category can only appear once in discovery tiles.";
      targets.add(target);
      categoryIds.push(tile.categoryId);
      continue;
    }

    if (!discoverySorts.has(tile.sort)) {
      return "Product-view tiles must use one valid sort option.";
    }
    const target = `sort:${tile.sort}`;
    if (targets.has(target)) return "A product view can only appear once in discovery tiles.";
    targets.add(target);
  }

  if (!categoryIds.length) return null;
  if (!storeId) return "Category discovery tiles can be added after the store is created.";

  const ownedCategories = await db
    .select({ id: categoriesTable.id })
    .from(categoriesTable)
    .where(and(eq(categoriesTable.storeId, storeId), inArray(categoriesTable.id, categoryIds)));

  return ownedCategories.length === categoryIds.length
    ? null
    : "Each discovery category must belong to this store.";
}