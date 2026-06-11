import type { DataSourceRow } from "./ops-types";

export function formatSourceType(type: DataSourceRow["source_type"]) {
  switch (type) {
    case "party":
      return "정당 웹";
    case "telegram":
      return "텔레그램";
    case "web":
      return "공식 웹";
    case "x":
      return "X";
  }
}

export function formatDateTime(value: string | null) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("ko-KR", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "2-digit",
    timeZone: "Asia/Seoul",
  }).format(new Date(value));
}
