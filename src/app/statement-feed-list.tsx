"use client";

import {
  Fragment,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { compareStatementItemsOldestFirst } from "@/lib/telegram-statements/public-feed-time";
import type { PublicStatementFeedItem } from "@/lib/telegram-statements/public-feed-types";
import {
  getPreviousStatementFeedWindow,
  type PublicStatementFeedWindowResponse,
  type StatementFeedWindow,
} from "@/lib/telegram-statements/public-feed-window";
import { groupStatementItemsByDate } from "./statement-date-groups";
import { StatementFeedRow } from "./statement-feed-row";
import { getStatementProfile } from "./statement-profile";

type StatementFeedListProps = {
  hiddenOrganizationLabels?: ReadonlySet<string>;
  initialHasMoreBefore: boolean;
  initialItems: PublicStatementFeedItem[];
  initialWindow: StatementFeedWindow;
};

type PullLoadState = {
  isReady: boolean;
  progress: number;
};

type ScrollSnapshot = {
  scrollHeight: number;
  scrollY: number;
};

type LoadPreviousSource = "button" | "pull";

const PULL_THRESHOLD = 72;
const PULL_DAMPING = 0.55;
const TOP_TOLERANCE = 2;
const DEFAULT_PULL_LOAD_STATE: PullLoadState = {
  isReady: false,
  progress: 0,
};
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
      const response = await fetch(`/api/statements?${params.toString()}`, {
        cache: "no-store",
      });

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

function PullLoadIndicator({
  isLoading,
  state,
}: {
  isLoading: boolean;
  state: PullLoadState;
}) {
  const mode = isLoading ? "loading" : state.isReady ? "ready" : "pulling";
  const text = isLoading
    ? "불러오는 중"
    : state.isReady
      ? "놓으면 불러오기"
      : "이전 7일";

  return (
    <div
      aria-label={text}
      aria-live="polite"
      className={`pull-load-indicator is-${mode}`}
      style={
        {
          "--pull-progress": Math.max(state.progress, isLoading ? 1 : 0),
        } as CSSProperties
      }
    >
      <span aria-hidden="true" className="pull-load-mark">
        <span className="pull-load-arrow">↓</span>
      </span>
      <span className="pull-load-text">{text}</span>
    </div>
  );
}

function usePreviousStatementWindowPull({
  enabled,
  isLoading,
  onLoadPrevious,
}: {
  enabled: boolean;
  isLoading: boolean;
  onLoadPrevious: () => Promise<void>;
}) {
  const [state, setState] = useState<PullLoadState>(DEFAULT_PULL_LOAD_STATE);
  const startXRef = useRef<number | null>(null);
  const startYRef = useRef<number | null>(null);
  const isActiveRef = useRef(false);
  const isReadyRef = useRef(false);
  const onLoadPreviousRef = useRef(onLoadPrevious);

  useEffect(() => {
    onLoadPreviousRef.current = onLoadPrevious;
  }, [onLoadPrevious]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const isAtPageTop = () => window.scrollY <= TOP_TOLERANCE;
    const reset = () => {
      startXRef.current = null;
      startYRef.current = null;
      isActiveRef.current = false;
      isReadyRef.current = false;
      setState(DEFAULT_PULL_LOAD_STATE);
    };

    const handleTouchStart = (event: TouchEvent) => {
      if (isLoading || event.touches.length !== 1 || !isAtPageTop()) {
        return;
      }

      const touch = event.touches[0];
      startXRef.current = touch.clientX;
      startYRef.current = touch.clientY;
      isActiveRef.current = true;
      isReadyRef.current = false;
    };

    const handleTouchMove = (event: TouchEvent) => {
      if (!isActiveRef.current || startYRef.current === null || isLoading) {
        return;
      }

      const touch = event.touches[0];

      if (!touch || startXRef.current === null) {
        reset();
        return;
      }

      const deltaX = touch.clientX - startXRef.current;
      const deltaY = touch.clientY - startYRef.current;

      if (deltaY <= 0) {
        reset();
        return;
      }

      if (Math.abs(deltaX) > deltaY || !isAtPageTop()) {
        return;
      }

      event.preventDefault();
      const pullDistance = deltaY * PULL_DAMPING;
      const progress = Math.min(pullDistance / PULL_THRESHOLD, 1);
      const isReady = pullDistance >= PULL_THRESHOLD;

      isReadyRef.current = isReady;
      setState({ isReady, progress });
    };

    const handleTouchEnd = () => {
      const shouldLoad = isActiveRef.current && isReadyRef.current && !isLoading;
      reset();

      if (shouldLoad) {
        void onLoadPreviousRef.current();
      }
    };

    document.addEventListener("touchstart", handleTouchStart);
    document.addEventListener("touchmove", handleTouchMove, {
      passive: false,
    });
    document.addEventListener("touchend", handleTouchEnd);
    document.addEventListener("touchcancel", reset);

    return () => {
      document.removeEventListener("touchstart", handleTouchStart);
      document.removeEventListener("touchmove", handleTouchMove);
      document.removeEventListener("touchend", handleTouchEnd);
      document.removeEventListener("touchcancel", reset);
    };
  }, [enabled, isLoading]);

  return enabled ? state : DEFAULT_PULL_LOAD_STATE;
}

function mergeStatementItems(
  prependedItems: PublicStatementFeedItem[],
  currentItems: PublicStatementFeedItem[],
) {
  const itemsById = new Map<string, PublicStatementFeedItem>();

  for (const item of prependedItems) {
    itemsById.set(item.id, item);
  }

  for (const item of currentItems) {
    itemsById.set(item.id, item);
  }

  return [...itemsById.values()].sort(compareStatementItemsOldestFirst);
}
