import { HeaderClient } from "@/components/header-client";
import { getHeaderCategories } from "@/lib/header-categories";

// Deliberately free of cookies/auth: the header must not make every route
// dynamic. Account state is loaded by HeaderClient from /api/header-state.
export async function Header() {
  const categories = await getHeaderCategories();
  return <HeaderClient categories={categories} />;
}
