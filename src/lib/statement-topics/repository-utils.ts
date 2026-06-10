export function normalizeEmbedding(value: unknown): number[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((item) =>
    typeof item === "number" ? item : Number.parseFloat(String(item)),
  );
}

export function roundSimilarity(value: number) {
  return Number.parseFloat(value.toFixed(5));
}
