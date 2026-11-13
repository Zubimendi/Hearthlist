// src/lib/parseQuickAdd.ts
// Parses a quick-add string into { name, quantity, unit }.
// Examples from PRD:
//   "2kg rice"       → { name: "rice", quantity: 2, unit: "kg" }
//   "rice 2kg"       → { name: "rice", quantity: 2, unit: "kg" }
//   "3 tomatoes"     → { name: "tomatoes", quantity: 3, unit: undefined }
//   "tomatoes x3"    → { name: "tomatoes", quantity: 3, unit: undefined }
//   "rice"           → { name: "rice", quantity: undefined, unit: undefined }
//   unparseable      → { name: original, quantity: undefined, unit: undefined }

export interface ParsedItem {
  name: string;
  quantity: number | undefined;
  unit: string | undefined;
}

const UNITS = [
  'kg', 'g', 'l', 'ml', 'ltr', 'litre', 'litres', 'liter', 'liters',
  'pcs', 'pc', 'piece', 'pieces',
  'pack', 'packs', 'packet', 'packets',
  'bag', 'bags',
  'bottle', 'bottles',
  'tin', 'tins', 'can', 'cans',
  'crate', 'crates',
  'dozen', 'half',
  'cup', 'cups',
  'tbsp', 'tsp',
  'lb', 'lbs', 'oz',
];

// Sorted longest-first so "litre" matches before "l"
const UNIT_PATTERN = UNITS.slice().sort((a, b) => b.length - a.length).join('|');

// Matches: "2kg", "2 kg", "2.5kg", ".5 kg"
const QTY_UNIT_RE = new RegExp(
  `^(\\d+(?:\\.\\d+)?|\\d*\\.\\d+)\\s*(${UNIT_PATTERN})s?$`,
  'i'
);

// Matches: "x3", "x 3", "×3"
const X_QTY_RE = /^[x×]\s*(\d+(?:\.\d+)?)$/i;

// Matches: "3 tomatoes" (number then word)
const NUM_FIRST_RE = new RegExp(
  `^(\\d+(?:\\.\\d+)?)\\s*(${UNIT_PATTERN})s?\\s+(.+)$`,
  'i'
);
const PLAIN_NUM_FIRST_RE = /^(\d+(?:\.\d+)?)\s+(.+)$/;

export function parseQuickAdd(input: string): ParsedItem {
  const raw = input.trim();
  if (!raw) return { name: raw, quantity: undefined, unit: undefined };

  // --- Pattern: "2kg rice" or "2 kg rice" (qty+unit then name) ---
  const numUnitFirst = NUM_FIRST_RE.exec(raw);
  if (numUnitFirst) {
    return {
      name: numUnitFirst[3].trim(),
      quantity: parseFloat(numUnitFirst[1]),
      unit: normalizeUnit(numUnitFirst[2]),
    };
  }

  // --- Pattern: "3 tomatoes" (plain number then name) ---
  const numFirst = PLAIN_NUM_FIRST_RE.exec(raw);
  if (numFirst) {
    return {
      name: numFirst[2].trim(),
      quantity: parseFloat(numFirst[1]),
      unit: undefined,
    };
  }

  // Split into tokens for suffix patterns
  const tokens = raw.split(/\s+/);

  // --- Pattern: "rice 2kg" or "rice 2 kg" (name then qty+unit) ---
  for (let i = tokens.length - 1; i >= 1; i--) {
    const suffix = tokens.slice(i).join(' ');
    const qtyUnit = QTY_UNIT_RE.exec(suffix);
    if (qtyUnit) {
      return {
        name: tokens.slice(0, i).join(' '),
        quantity: parseFloat(qtyUnit[1]),
        unit: normalizeUnit(qtyUnit[2]),
      };
    }
  }

  // --- Pattern: "tomatoes x3" or "tomatoes ×3" ---
  const lastToken = tokens[tokens.length - 1];
  const xQty = X_QTY_RE.exec(lastToken);
  if (xQty && tokens.length > 1) {
    return {
      name: tokens.slice(0, -1).join(' '),
      quantity: parseFloat(xQty[1]),
      unit: undefined,
    };
  }

  // --- Pattern: "x3 tomatoes" (x-qty first) ---
  const firstToken = tokens[0];
  const xQtyFirst = X_QTY_RE.exec(firstToken);
  if (xQtyFirst && tokens.length > 1) {
    return {
      name: tokens.slice(1).join(' '),
      quantity: parseFloat(xQtyFirst[1]),
      unit: undefined,
    };
  }

  // --- Fallback: plain name ---
  return { name: raw, quantity: undefined, unit: undefined };
}

function normalizeUnit(raw: string): string {
  const lower = raw.toLowerCase();
  // Canonicalize plurals and aliases
  if (lower === 'liter' || lower === 'liters' || lower === 'litre' || lower === 'litres' || lower === 'ltr') return 'l';
  if (lower === 'piece' || lower === 'pieces' || lower === 'pc') return 'pcs';
  if (lower === 'packet' || lower === 'packets' || lower === 'packs') return 'pack';
  if (lower === 'bags') return 'bag';
  if (lower === 'bottles') return 'bottle';
  if (lower === 'tins' || lower === 'can' || lower === 'cans') return 'tin';
  if (lower === 'crates') return 'crate';
  if (lower === 'lbs') return 'lb';
  return lower;
}
