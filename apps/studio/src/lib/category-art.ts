/**
 * Category id -> hero photo + gradient tone, shared by every place a
 * category or a sample book needs the "hero card" look (see ui/photo-tile).
 */
export const CATEGORY_ART: Record<string, { photo: string; from: string; to: string }> = {
  babies: { photo: "babies", from: "#F9C5D1", to: "#F0913A" },
  dads: { photo: "dads", from: "#F6B73C", to: "#E8622C" },
  mums: { photo: "mums", from: "#F9C5D1", to: "#E8622C" },
  kids: { photo: "kids", from: "#F6B73C", to: "#F0913A" },
  siblings: { photo: "siblings", from: "#9DB8F0", to: "#2E5FD7" },
  grandparents: { photo: "grandparents", from: "#D9CBF0", to: "#9D8CE8" },
};

export function categoryArt(id: string, name: string) {
  if (CATEGORY_ART[id]) return CATEGORY_ART[id];
  const n = name.toLowerCase();
  for (const key of Object.keys(CATEGORY_ART)) {
    if (n.includes(key.slice(0, 3))) return CATEGORY_ART[key];
  }
  return CATEGORY_ART.kids;
}
