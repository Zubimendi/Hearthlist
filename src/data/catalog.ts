// src/data/catalog.ts
// Categories, common units, and predefined grocery catalog (including Nigerian staples).
// Used for quick-add suggestions and automatic category detection.

export const CATEGORIES = [
  'Produce',
  'Grains and staples',
  'Proteins',
  'Dairy and eggs',
  'Oils and spices',
  'Drinks',
  'Household',
  'Toiletries',
  'Other',
] as const;

export type Category = typeof CATEGORIES[number];

export const COMMON_UNITS = [
  'kg',
  'g',
  'l',
  'ml',
  'pcs',
  'pack',
  'bag',
  'bottle',
  'tin',
  'crate',
  'tuber',
  'wrap',
] as const;

export interface CatalogItem {
  name: string;
  category: Category;
  defaultUnit?: string;
}

export const CATALOG: CatalogItem[] = [
  // Grains and staples (including Nigerian staples)
  { name: 'Rice', category: 'Grains and staples', defaultUnit: 'kg' },
  { name: 'Rice (ofada)', category: 'Grains and staples', defaultUnit: 'kg' },
  { name: 'Garri', category: 'Grains and staples', defaultUnit: 'bag' },
  { name: 'Garri (yellow)', category: 'Grains and staples', defaultUnit: 'bag' },
  { name: 'Garri (white)', category: 'Grains and staples', defaultUnit: 'bag' },
  { name: 'Yam', category: 'Grains and staples', defaultUnit: 'tuber' },
  { name: 'Plantain', category: 'Produce', defaultUnit: 'bunch' },
  { name: 'Beans (brown)', category: 'Grains and staples', defaultUnit: 'kg' },
  { name: 'Beans (oloyin)', category: 'Grains and staples', defaultUnit: 'kg' },
  { name: 'Semovita', category: 'Grains and staples', defaultUnit: 'pack' },
  { name: 'Poundo Yam', category: 'Grains and staples', defaultUnit: 'pack' },
  { name: 'Bread', category: 'Grains and staples', defaultUnit: 'pcs' },
  { name: 'Pasta', category: 'Grains and staples', defaultUnit: 'pack' },
  { name: 'Indomie noodles', category: 'Grains and staples', defaultUnit: 'pack' },
  { name: 'Spaghetti', category: 'Grains and staples', defaultUnit: 'pack' },
  { name: 'Oats', category: 'Grains and staples', defaultUnit: 'tin' },

  // Produce
  { name: 'Tomatoes', category: 'Produce', defaultUnit: 'kg' },
  { name: 'Onions', category: 'Produce', defaultUnit: 'bag' },
  { name: 'Pepper (rodo)', category: 'Produce', defaultUnit: 'basket' },
  { name: 'Pepper (tatase)', category: 'Produce', defaultUnit: 'kg' },
  { name: 'Pepper (shombo)', category: 'Produce', defaultUnit: 'kg' },
  { name: 'Garlic', category: 'Produce', defaultUnit: 'pcs' },
  { name: 'Ginger', category: 'Produce', defaultUnit: 'kg' },
  { name: 'Spinach / Ugwu', category: 'Produce', defaultUnit: 'bunch' },
  { name: 'Bitter leaf', category: 'Produce', defaultUnit: 'bunch' },
  { name: 'Scent leaf / Efirin', category: 'Produce', defaultUnit: 'bunch' },
  { name: 'Waterleaf', category: 'Produce', defaultUnit: 'bunch' },
  { name: 'Okra', category: 'Produce', defaultUnit: 'basket' },
  { name: 'Potatoes (Irish)', category: 'Produce', defaultUnit: 'kg' },
  { name: 'Sweet potato', category: 'Produce', defaultUnit: 'kg' },
  { name: 'Carrots', category: 'Produce', defaultUnit: 'kg' },
  { name: 'Cabbage', category: 'Produce', defaultUnit: 'pcs' },
  { name: 'Bananas', category: 'Produce', defaultUnit: 'bunch' },
  { name: 'Oranges', category: 'Produce', defaultUnit: 'bag' },

  // Proteins
  { name: 'Chicken', category: 'Proteins', defaultUnit: 'kg' },
  { name: 'Beef', category: 'Proteins', defaultUnit: 'kg' },
  { name: 'Goat meat', category: 'Proteins', defaultUnit: 'kg' },
  { name: 'Titus fish', category: 'Proteins', defaultUnit: 'pcs' },
  { name: 'Stockfish', category: 'Proteins', defaultUnit: 'pcs' },
  { name: 'Crayfish', category: 'Proteins', defaultUnit: 'cup' },
  { name: 'Dry fish / Mangala', category: 'Proteins', defaultUnit: 'pcs' },
  { name: 'Catfish', category: 'Proteins', defaultUnit: 'kg' },
  { name: 'Eggs', category: 'Dairy and eggs', defaultUnit: 'crate' },
  { name: 'Pork', category: 'Proteins', defaultUnit: 'kg' },
  { name: 'Turkey', category: 'Proteins', defaultUnit: 'kg' },

  // Dairy and eggs
  { name: 'Milk (evaporated)', category: 'Dairy and eggs', defaultUnit: 'tin' },
  { name: 'Milk (powdered)', category: 'Dairy and eggs', defaultUnit: 'tin' },
  { name: 'Yogurt', category: 'Dairy and eggs', defaultUnit: 'bottle' },
  { name: 'Butter', category: 'Dairy and eggs', defaultUnit: 'tub' },
  { name: 'Cheese', category: 'Dairy and eggs', defaultUnit: 'pack' },

  // Oils and spices
  { name: 'Palm oil', category: 'Oils and spices', defaultUnit: 'l' },
  { name: 'Vegetable oil', category: 'Oils and spices', defaultUnit: 'l' },
  { name: 'Egusi (melon seeds)', category: 'Oils and spices', defaultUnit: 'cup' },
  { name: 'Ogbono', category: 'Oils and spices', defaultUnit: 'cup' },
  { name: 'Maggi / Knorr cubes', category: 'Oils and spices', defaultUnit: 'pack' },
  { name: 'Salt', category: 'Oils and spices', defaultUnit: 'pack' },
  { name: 'Curry powder', category: 'Oils and spices', defaultUnit: 'pack' },
  { name: 'Thyme', category: 'Oils and spices', defaultUnit: 'pack' },
  { name: 'Suya pepper / Yaji', category: 'Oils and spices', defaultUnit: 'pack' },
  { name: 'Tomato paste', category: 'Oils and spices', defaultUnit: 'tin' },

  // Drinks
  { name: 'Water (dispenser)', category: 'Drinks', defaultUnit: 'bottle' },
  { name: 'Water (pack)', category: 'Drinks', defaultUnit: 'pack' },
  { name: 'Milo', category: 'Drinks', defaultUnit: 'tin' },
  { name: 'Coffee', category: 'Drinks', defaultUnit: 'jar' },
  { name: 'Tea bags', category: 'Drinks', defaultUnit: 'pack' },
  { name: 'Fruit juice', category: 'Drinks', defaultUnit: 'pack' },
  { name: 'Malt drink', category: 'Drinks', defaultUnit: 'pack' },

  // Household
  { name: 'Dish soap', category: 'Household', defaultUnit: 'bottle' },
  { name: 'Laundry detergent', category: 'Household', defaultUnit: 'bag' },
  { name: 'Bleach / Hypo', category: 'Household', defaultUnit: 'bottle' },
  { name: 'Trash bags', category: 'Household', defaultUnit: 'pack' },
  { name: 'Paper towels', category: 'Household', defaultUnit: 'pack' },
  { name: 'Foil paper', category: 'Household', defaultUnit: 'roll' },
  { name: 'Sponges', category: 'Household', defaultUnit: 'pack' },

  // Toiletries
  { name: 'Toilet paper', category: 'Toiletries', defaultUnit: 'pack' },
  { name: 'Bathing soap', category: 'Toiletries', defaultUnit: 'pcs' },
  { name: 'Toothpaste', category: 'Toiletries', defaultUnit: 'tube' },
  { name: 'Body lotion', category: 'Toiletries', defaultUnit: 'bottle' },
  { name: 'Deodorant', category: 'Toiletries', defaultUnit: 'pcs' },
  { name: 'Shampoo', category: 'Toiletries', defaultUnit: 'bottle' },
];

/**
 * Predicts the category for a given item name.
 * Searches the catalog for substring matches (case-insensitive).
 * Defaults to 'Other' if no match found.
 */
export function predictCategory(itemName: string): Category {
  const normalized = itemName.trim().toLowerCase();
  if (!normalized) return 'Other';

  for (const item of CATALOG) {
    if (
      normalized.includes(item.name.toLowerCase()) ||
      item.name.toLowerCase().includes(normalized)
    ) {
      return item.category;
    }
  }

  return 'Other';
}

/**
 * Returns suggestions matching a query from the catalog.
 */
export function getCatalogSuggestions(query: string, limit = 4): CatalogItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  const matches: CatalogItem[] = [];
  for (const item of CATALOG) {
    if (item.name.toLowerCase().includes(q)) {
      matches.push(item);
      if (matches.length >= limit) break;
    }
  }
  return matches;
}
