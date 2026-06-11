import type { ReactNode } from "react";

export function StatusCard({ label, value }: { label: string; value: number }) {
  return (
    <article className="ops-status-card">
      <span>{label}</span>
      <strong>{value.toLocaleString("ko-KR")}</strong>
    </article>
  );
}

export function OpsPanel({
  children,
  title,
}: {
  children: ReactNode;
  title: string;
}) {
  return (
    <section className="ops-panel">
      <h2>{title}</h2>
      {children}
    </section>
  );
}

export function OpsTable({
  emptyText,
  headers,
  rows,
}: {
  emptyText: string;
  headers: string[];
  rows: ReactNode[][];
}) {
  if (rows.length === 0) {
    return <p className="ops-empty-line">{emptyText}</p>;
  }

  return (
    <div className="ops-table-wrap">
      <table className="ops-table">
        <thead>
          <tr>
            {headers.map((header) => (
              <th key={header}>{header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {row.map((cell, cellIndex) => (
                <td key={cellIndex}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function OpsList({
  emptyText,
  items,
}: {
  emptyText: string;
  items: Array<{ href?: string; meta: string; text: string }>;
}) {
  if (items.length === 0) {
    return <p className="ops-empty-line">{emptyText}</p>;
  }

  return (
    <ul className="ops-list">
      {items.map((item, index) => (
        <li key={`${item.meta}:${index}`}>
          <p>{item.text}</p>
          {item.href ? (
            <a href={item.href} rel="noreferrer" target="_blank">
              {item.meta}
            </a>
          ) : (
            <span>{item.meta}</span>
          )}
        </li>
      ))}
    </ul>
  );
}

export function StatusPill({
  label,
  value,
}: {
  label?: string;
  value: string;
}) {
  return <span className={`ops-pill ops-pill--${value}`}>{label ?? value}</span>;
}
