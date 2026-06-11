import { CLIMATEALL_WEB_STATEMENT_SOURCE } from "./sources/climateall";
import { EQUALITYACT_WEB_STATEMENT_SOURCE } from "./sources/equalityact";
import { KFEM_WEB_STATEMENT_SOURCE } from "./sources/kfem";
import { RAINBOWACTION_WEB_STATEMENT_SOURCE } from "./sources/rainbowaction";
import { WOMEN21_WEB_STATEMENT_SOURCE } from "./sources/women21";
import type { WebStatementSourceKey, WebStatementSourceParser } from "./types";

export const WEB_STATEMENT_SOURCES: WebStatementSourceParser[] = [
  CLIMATEALL_WEB_STATEMENT_SOURCE,
  EQUALITYACT_WEB_STATEMENT_SOURCE,
  KFEM_WEB_STATEMENT_SOURCE,
  RAINBOWACTION_WEB_STATEMENT_SOURCE,
  WOMEN21_WEB_STATEMENT_SOURCE,
];

export function getWebStatementSources(sourceKey?: WebStatementSourceKey) {
  if (!sourceKey) {
    return WEB_STATEMENT_SOURCES;
  }

  return WEB_STATEMENT_SOURCES.filter(
    (source) => source.sourceKey === sourceKey,
  );
}
