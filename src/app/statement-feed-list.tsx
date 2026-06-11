"use client";

import {
  Fragment,
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { PublicStatementFeedItem } from "@/lib/telegram-statements/public-feed-types";
import {
  getPreviousStatementFeedWindow,
  type PublicStatementFeedWindowResponse,
  type StatementFeedWindow,
} from "@/lib/telegram-statements/public-feed-window";
import { groupStatementItemsByDate } from "./statement-date-groups";
import { mergeStatementItems } from "./statement-feed-items";
import {
  PullLoadIndicator,
  usePreviousStatementWindowPull,
} from "./statement-feed-pull-load";
import { StatementFeedRow } from "./statement-feed-row";
import { getStatementProfile } from "./statement-profile";

type StatementFeedListProps = {
  hiddenOrganizationLabels?: ReadonlySet<string>;
  initialHasMoreBefore: boolean;
  initialItems: PublicStatementFeedItem[];
  initialWindow: StatementFeedWindow;
};

type ScrollSnapshot = {
  scrollHeight: number;
  scrollY: number;
};

type LoadPreviousSource = "button" | "pull";

const EMPTY_HIDDEN_ORGANIZATION_LABELS = new Set<string>();

export function StatementFeedList({
  hiddenOrganizationLabels = EMPTY_HIDDEN_ORGANIZATION_LABELS,
  initialHasMoreBefore,
  initialItems,
  initialWindow,
}: StatementFeedListProps) {
  const [items, setItems] = useState(initialItems);
  const [oldestWindow, setOldestWindow] = useState(initialWindow);
  const [hasMoreBefore, setHasMoreBefore] = useState(initialHasMoreBefore);
  const [isLoadingPrevious, setIsLoadingPrevious] = useState(false);
  const [activeLoadSource, setActiveLoadSource] =
    useState<LoadPreviousSource | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [restoreVersion, setRestoreVersion] = useState(0);
  const didInitialScrollRef = useRef(false);
  const pendingScrollRestoreRef = useRef<ScrollSnapshot | null>(null);
  const visibleItems = useMemo(
    () =>
      items.filter(
        (item) => !hiddenOrganizationLabels.has(getStatementProfile(item).label),
      ),
    [hiddenOrganizationLabels, items],
  );
  const dateGroups = useMemo(
    () => groupStatementItemsByDate(visibleItems),
    [visibleItems],
  );

  const loadPreviousWindow = useCallback(async (source: LoadPreviousSource) => {
    if (isLoadingPrevious || !hasMoreBefore) {
      return;
    }

    const previousWindow = getPreviousStatementFeedWindow(oldestWindow);
    const params = new URLSearchParams({
      from: previousWindow.from,
      to: previousWindow.to,
    });

    pendingScrollRestoreRef.current = {
      scrollHeight: document.documentElement.scrollHeight,
      scrollY: window.scrollY,
    };
    setActiveLoadSource(source);
    setIsLoadingPrevious(true);
    setLoadError(null);

    try {
      const response = await fetch(`/api/statements?${params.toString()}`);

      if (!response.ok) {
        throw new Error(`Request failed with ${response.status}`);
      }

      const data = (await response.json()) as PublicStatementFeedWindowResponse;

      setItems((currentItems) => mergeStatementItems(data.items, currentItems));
      setOldestWindow(data.window);
      setHasMoreBefore(data.hasMoreBefore);
    } catch (error) {
      console.error(error);
      setLoadError("이전 성명문을 불러오지 못했습니다.");
    } finally {
      setRestoreVersion((version) => version + 1);
      setIsLoadingPrevious(false);
      setActiveLoadSource(null);
    }
  }, [hasMoreBefore, isLoadingPrevious, oldestWindow]);

  const pullLoadState = usePreviousStatementWindowPull({
    enabled: hasMoreBefore,
    isLoading: isLoadingPrevious,
    onLoadPrevious: () => loadPreviousWindow("pull"),
  });
  const isPullLoading = activeLoadSource === "pull";
  const isButtonLoading = activeLoadSource === "button";
  const shouldShowPullIndicator = isPullLoading || pullLoadState.progress > 0;
  const shouldShowLoadMoreButton =
    (hasMoreBefore || isButtonLoading) && !isPullLoading;

  useLayoutEffect(() => {
    if (didInitialScrollRef.current) {
      return;
    }

    didInitialScrollRef.current = true;
    requestAnimationFrame(() => {
      window.scrollTo(0, document.documentElement.scrollHeight);
      requestAnimationFrame(() => {
        window.scrollTo(0, document.documentElement.scrollHeight);
      });
    });
  }, []);

  useLayoutEffect(() => {
    const snapshot = pendingScrollRestoreRef.current;

    if (!snapshot) {
      return;
    }

    pendingScrollRestoreRef.current = null;
    const nextScrollHeight = document.documentElement.scrollHeight;
    window.scrollTo(0, snapshot.scrollY + nextScrollHeight - snapshot.scrollHeight);
  }, [restoreVersion]);

  return (
    <>
      {shouldShowPullIndicator ? (
        <PullLoadIndicator
          isLoading={isPullLoading}
          state={pullLoadState}
        />
      ) : null}
      <section
        aria-label="성명문 목록"
        aria-live="polite"
        className="statement-feed-list"
        role="log"
      >
        {shouldShowLoadMoreButton ? (
          <div className="statement-feed-load-more">
            <button
              aria-label="이전 7일 불러오기"
              className={`pull-load-button is-${
                isButtonLoading ? "loading" : "ready"
              }`}
              disabled={isLoadingPrevious || !hasMoreBefore}
              onClick={() => {
                void loadPreviousWindow("button");
              }}
              type="button"
            >
              <span aria-hidden="true" className="pull-load-mark">
                <span className="pull-load-arrow">↓</span>
              </span>
              <span className="pull-load-text">
                {isButtonLoading ? "불러오는 중" : "이전 7일 불러오기"}
              </span>
            </button>
          </div>
        ) : null}
        {dateGroups.length > 0 ? (
          dateGroups.map((group) => (
            <Fragment key={group.dateKey}>
              <div className="statement-date-divider">
                <span>{group.label}</span>
              </div>
              {group.items.map((item) => (
                <StatementFeedRow item={item} key={item.id} />
              ))}
            </Fragment>
          ))
        ) : (
          <div className="statement-empty statement-empty--inline">
            <h2>
              {items.length > 0
                ? "선택한 단체의 성명문이 없습니다"
                : "아직 공개된 성명문이 없습니다"}
            </h2>
          </div>
        )}
      </section>
      {loadError ? (
        <p className="statement-feed-status is-error">{loadError}</p>
      ) : null}
      {!hasMoreBefore && items.length > 0 ? (
        <p className="statement-feed-status">더 불러올 성명문이 없습니다</p>
      ) : null}
    </>
  );
}
