"use client";

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";

export type PullLoadState = {
  isReady: boolean;
  progress: number;
};

const PULL_THRESHOLD = 72;
const PULL_DAMPING = 0.55;
const TOP_TOLERANCE = 2;
const DEFAULT_PULL_LOAD_STATE: PullLoadState = {
  isReady: false,
  progress: 0,
};

export function PullLoadIndicator({
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

export function usePreviousStatementWindowPull({
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
