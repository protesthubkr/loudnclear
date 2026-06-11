import "server-only";

import { ensureStatementTopicEmbeddings } from "./embedding-cache";
import type {
  PartyTopicSummaryRow,
  PrimaryTopicSummaryRow,
} from "./repository-types";
import type { EmbeddedPartySummary, EmbeddedPrimarySummary } from "./types";

export async function embedPrimaryTopicRows(rows: PrimaryTopicSummaryRow[]) {
  const groupedRows = new Map<
    PrimaryTopicSummaryRow["source_type"],
    PrimaryTopicSummaryRow[]
  >();

  for (const row of rows) {
    groupedRows.set(row.source_type, [
      ...(groupedRows.get(row.source_type) ?? []),
      row,
    ]);
  }
  const embeddedById = new Map<
    string,
    {
      embedding: number[];
      text: string;
    }
  >();
  let created = 0;

  for (const [sourceType, sourceRows] of groupedRows) {
    const embedded = await ensureStatementTopicEmbeddings({
      rows: sourceRows.map((row) => ({
        coreSentence: row.core_sentence,
        fullText: row.text_snapshot,
        id: row.id,
        organizationName: row.organization_name,
        sourceType,
        title: row.title,
      })),
      sourceType,
    });

    created += embedded.created;

    for (const [id, embedding] of embedded.embeddings) {
      embeddedById.set(id, embedding);
    }
  }

  return {
    created,
    rows: rows.flatMap((row): EmbeddedPrimarySummary[] => {
      const embedding = embeddedById.get(row.id);

      if (!embedding) {
        return [];
      }

      return [
        {
          ...row,
          embedding: embedding.embedding,
          embeddingText: embedding.text,
        },
      ];
    }),
  };
}

export async function embedPartyTopicRows(rows: PartyTopicSummaryRow[]) {
  const embedded = await ensureStatementTopicEmbeddings({
    rows: rows.map((row) => ({
      coreSentence: row.core_sentence,
      fullText: row.text_snapshot,
      id: row.id,
      organizationName: row.organization_name,
      sourceType: "party" as const,
      title: row.title,
    })),
    sourceType: "party",
  });

  return {
    created: embedded.created,
    rows: rows.flatMap((row): EmbeddedPartySummary[] => {
      const embedding = embedded.embeddings.get(row.id);

      if (!embedding) {
        return [];
      }

      return [
        {
          ...row,
          embedding: embedding.embedding,
          embeddingText: embedding.text,
        },
      ];
    }),
  };
}
