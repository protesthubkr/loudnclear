import type { Metadata } from "next";
import { getPublicStatementFeedItems } from "@/lib/telegram-statements/public-feed";
import { groupStatementItemsByDate } from "./statement-date-groups";
import { StatementFeedList } from "./statement-feed-list";
import { SITE_DESCRIPTION, SITE_NAME } from "./site";

export const revalidate = 60;
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: SITE_NAME,
  description: SITE_DESCRIPTION,
};

export default async function HomePage() {
  const items = await getPublicStatementFeedItems();
  const dateGroups = groupStatementItemsByDate(items);

  return (
    <main className="statement-shell">
      <header className="statement-topbar">
        <h1>{SITE_NAME}</h1>
      </header>
      {items.length > 0 ? (
        <StatementFeedList dateGroups={dateGroups} />
      ) : (
        <section className="statement-empty">
          <h2>아직 공개할 성명문이 없습니다</h2>
        </section>
      )}
    </main>
  );
}
