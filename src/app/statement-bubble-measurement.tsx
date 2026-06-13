"use client";

import {
  createContext,
  type ReactNode,
  type RefObject,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
} from "react";

type BubbleMeasurementRefs = {
  bubbleRef: RefObject<HTMLAnchorElement | null>;
  rowRef: RefObject<HTMLDivElement | null>;
  sentenceRef: RefObject<HTMLSpanElement | null>;
};

type BubbleMeasurementEntry = {
  bubble: HTMLAnchorElement;
  forceMeasure: boolean;
  id: string;
  isVisible: boolean;
  lastMeasuredMaxBubbleWidth: number;
  row: HTMLDivElement;
  sentenceElement: HTMLSpanElement;
};

type PreparedBubbleMeasurementEntry = {
  entry: BubbleMeasurementEntry;
  maxBubbleWidth: number;
};

type BubbleMeasurementContextValue = {
  register: (input: RegisterBubbleMeasurementInput) => () => void;
};

type RegisterBubbleMeasurementInput = BubbleMeasurementRefs & {
  id: string;
};

const BUBBLE_WIDTH_MEASUREMENT_SLACK_PX = 14;
const BUBBLE_WIDTH_PROBE_MAX_PX = 360;
const BUBBLE_VISIBILITY_ROOT_MARGIN = "240px 0px";
const BUBBLE_MEASUREMENT_BATCH_SIZE = 6;
const SCROLL_IDLE_MEASUREMENT_DELAY_MS = 140;
const BubbleMeasurementContext =
  createContext<BubbleMeasurementContextValue | null>(null);

export function StatementBubbleMeasurementProvider({
  children,
}: {
  children: ReactNode;
}) {
  const entriesRef = useRef(new Map<string, BubbleMeasurementEntry>());
  const rowEntryRef = useRef(new WeakMap<Element, BubbleMeasurementEntry>());
  const pendingIdsRef = useRef(new Set<string>());
  const prepareFrameRef = useRef(0);
  const measureFrameRef = useRef(0);
  const measurementHostRef = useRef<HTMLDivElement | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const isScrollActiveRef = useRef(false);
  const scrollIdleTimerRef = useRef(0);

  const cancelPendingFrames = useCallback(() => {
    window.cancelAnimationFrame(prepareFrameRef.current);
    window.cancelAnimationFrame(measureFrameRef.current);
    window.clearTimeout(scrollIdleTimerRef.current);
    prepareFrameRef.current = 0;
    measureFrameRef.current = 0;
    scrollIdleTimerRef.current = 0;
  }, []);

  const schedulePendingMeasurements = useCallback(() => {
    if (prepareFrameRef.current) {
      return;
    }

    prepareFrameRef.current = window.requestAnimationFrame(() => {
      prepareFrameRef.current = 0;

      if (isScrollActiveRef.current) {
        return;
      }

      const pendingEntries = Array.from(pendingIdsRef.current)
        .map((pendingId) => entriesRef.current.get(pendingId))
        .filter((pendingEntry): pendingEntry is BubbleMeasurementEntry =>
          Boolean(pendingEntry?.isVisible),
        );
      pendingIdsRef.current.clear();
      const entriesToMeasure = prepareEntriesForMeasurement(pendingEntries);

      if (entriesToMeasure.length === 0) {
        return;
      }

      measureFrameRef.current = window.requestAnimationFrame(() => {
        measureFrameRef.current = 0;

        if (isScrollActiveRef.current) {
          requeuePreparedEntries(entriesToMeasure, pendingIdsRef.current);
          return;
        }

        measurePreparedEntriesInBatches({
          entries: entriesToMeasure,
          isScrollActiveRef,
          measurementHostRef,
          pendingIds: pendingIdsRef.current,
        });
      });
    });
  }, []);

  const scheduleMeasurement = useCallback(
    (id: string, force = false) => {
      const entry = entriesRef.current.get(id);

      if (!entry || !entry.isVisible) {
        return;
      }

      entry.forceMeasure = entry.forceMeasure || force;
      pendingIdsRef.current.add(id);

      if (!isScrollActiveRef.current) {
        schedulePendingMeasurements();
      }
    },
    [schedulePendingMeasurements],
  );

  const ensureObserver = useCallback(() => {
    if (observerRef.current || !("IntersectionObserver" in window)) {
      return observerRef.current;
    }

    observerRef.current = new IntersectionObserver(
      (intersectionEntries) => {
        for (const intersectionEntry of intersectionEntries) {
          const entry = rowEntryRef.current.get(intersectionEntry.target);

          if (!entry) {
            continue;
          }

          entry.isVisible = intersectionEntry.isIntersecting;

          if (entry.isVisible) {
            scheduleMeasurement(entry.id);
          }
        }
      },
      {
        root: null,
        rootMargin: BUBBLE_VISIBILITY_ROOT_MARGIN,
      },
    );

    return observerRef.current;
  }, [scheduleMeasurement]);

  const register = useCallback(
    ({
      bubbleRef,
      id,
      rowRef,
      sentenceRef,
    }: RegisterBubbleMeasurementInput) => {
      const row = rowRef.current;
      const bubble = bubbleRef.current;
      const sentenceElement = sentenceRef.current;

      if (!row || !bubble || !sentenceElement) {
        return () => {};
      }

      const entry: BubbleMeasurementEntry = {
        bubble,
        forceMeasure: false,
        id,
        isVisible: false,
        lastMeasuredMaxBubbleWidth: 0,
        row,
        sentenceElement,
      };
      entriesRef.current.set(id, entry);
      rowEntryRef.current.set(row, entry);

      const observer = ensureObserver();

      if (observer) {
        observer.observe(row);
      } else {
        entry.isVisible = true;
        scheduleMeasurement(id, true);
      }

      return () => {
        entriesRef.current.delete(id);
        pendingIdsRef.current.delete(id);
        rowEntryRef.current.delete(row);
        observerRef.current?.unobserve(row);
      };
    },
    [ensureObserver, scheduleMeasurement],
  );

  useEffect(() => {
    function measureVisibleRows() {
      for (const entry of entriesRef.current.values()) {
        if (entry.isVisible) {
          scheduleMeasurement(entry.id, true);
        }
      }
    }

    window.addEventListener("resize", measureVisibleRows);

    return () => {
      window.removeEventListener("resize", measureVisibleRows);
    };
  }, [scheduleMeasurement]);

  useEffect(() => {
    function scheduleAfterScrollIdle() {
      isScrollActiveRef.current = true;
      window.clearTimeout(scrollIdleTimerRef.current);
      scrollIdleTimerRef.current = window.setTimeout(() => {
        isScrollActiveRef.current = false;
        scrollIdleTimerRef.current = 0;
        schedulePendingMeasurements();
      }, SCROLL_IDLE_MEASUREMENT_DELAY_MS);
    }

    window.addEventListener("scroll", scheduleAfterScrollIdle, {
      passive: true,
    });

    return () => {
      window.removeEventListener("scroll", scheduleAfterScrollIdle);
      window.clearTimeout(scrollIdleTimerRef.current);
    };
  }, [schedulePendingMeasurements]);

  useEffect(
    () => () => {
      observerRef.current?.disconnect();
      observerRef.current = null;
      measurementHostRef.current?.remove();
      measurementHostRef.current = null;
      cancelPendingFrames();
    },
    [cancelPendingFrames],
  );

  const contextValue = useMemo(() => ({ register }), [register]);

  return (
    <BubbleMeasurementContext.Provider value={contextValue}>
      {children}
    </BubbleMeasurementContext.Provider>
  );
}

export function useStatementBubbleMeasurement({
  bubbleRef,
  id,
  rowRef,
  sentence,
  sentenceRef,
}: BubbleMeasurementRefs & {
  id: string;
  sentence: string;
}) {
  const context = useContext(BubbleMeasurementContext);

  useLayoutEffect(() => {
    if (!context) {
      return undefined;
    }

    return context.register({
      bubbleRef,
      id,
      rowRef,
      sentenceRef,
    });
  }, [bubbleRef, context, id, rowRef, sentence, sentenceRef]);
}

function prepareEntriesForMeasurement(
  entries: BubbleMeasurementEntry[],
): PreparedBubbleMeasurementEntry[] {
  return entries.flatMap((entry) => {
    const maxBubbleWidth = getMaxProbeBubbleWidth(entry.row);

    if (
      !entry.forceMeasure &&
      maxBubbleWidth > 0 &&
      maxBubbleWidth === entry.lastMeasuredMaxBubbleWidth &&
      entry.row.classList.contains("is-width-measured")
    ) {
      return [];
    }

    entry.forceMeasure = false;
    entry.lastMeasuredMaxBubbleWidth = maxBubbleWidth;

    return maxBubbleWidth > 0 ? [{ entry, maxBubbleWidth }] : [];
  });
}

function measurePreparedEntries(
  entries: PreparedBubbleMeasurementEntry[],
  measurementHostRef: RefObject<HTMLDivElement | null>,
) {
  const measurementHost = ensureMeasurementHost(measurementHostRef);

  for (const { entry, maxBubbleWidth } of entries) {
    const measuredBubble = getMeasuredBubbleMetrics(
      entry.bubble,
      entry.sentenceElement,
      maxBubbleWidth,
      measurementHost,
    );

    if (!measuredBubble) {
      continue;
    }

    entry.row.classList.toggle(
      "is-single-line-bubble",
      measuredBubble.lineCount === 1,
    );
    entry.row.style.setProperty(
      "--statement-measured-bubble-width",
      `${measuredBubble.width}px`,
    );
    entry.row.classList.add("is-width-measured");
  }
}

function measurePreparedEntriesInBatches({
  entries,
  isScrollActiveRef,
  measurementHostRef,
  pendingIds,
}: {
  entries: PreparedBubbleMeasurementEntry[];
  isScrollActiveRef: RefObject<boolean>;
  measurementHostRef: RefObject<HTMLDivElement | null>;
  pendingIds: Set<string>;
}) {
  if (isScrollActiveRef.current) {
    requeuePreparedEntries(entries, pendingIds);
    return;
  }

  const batch = entries.slice(0, BUBBLE_MEASUREMENT_BATCH_SIZE);
  const rest = entries.slice(BUBBLE_MEASUREMENT_BATCH_SIZE);

  measurePreparedEntries(batch, measurementHostRef);

  if (rest.length === 0) {
    return;
  }

  window.requestAnimationFrame(() => {
    measurePreparedEntriesInBatches({
      entries: rest,
      isScrollActiveRef,
      measurementHostRef,
      pendingIds,
    });
  });
}

function requeuePreparedEntries(
  entries: PreparedBubbleMeasurementEntry[],
  pendingIds: Set<string>,
) {
  for (const { entry } of entries) {
    entry.forceMeasure = true;
    pendingIds.add(entry.id);
  }
}

function getMeasuredBubbleMetrics(
  bubble: HTMLElement,
  sentenceElement: HTMLSpanElement,
  maxBubbleWidth: number,
  measurementHost: HTMLDivElement,
) {
  const mirrorBubble = document.createElement("span");
  const mirrorSentence = document.createElement("span");
  mirrorBubble.className = bubble.className;
  mirrorBubble.style.maxWidth = `${maxBubbleWidth}px`;
  mirrorBubble.style.width = "fit-content";
  mirrorSentence.className = sentenceElement.className;
  mirrorSentence.textContent = sentenceElement.textContent ?? "";
  mirrorBubble.append(mirrorSentence);
  measurementHost.replaceChildren(mirrorBubble);

  const range = document.createRange();
  range.selectNodeContents(mirrorSentence);
  const lineRects = Array.from(range.getClientRects()).filter(
    (rect) => rect.width > 0 && rect.height > 0,
  );
  range.detach();

  if (lineRects.length === 0) {
    measurementHost.replaceChildren();
    return null;
  }

  const bubbleStyle = window.getComputedStyle(mirrorBubble);
  const horizontalChrome =
    readPixelValue(bubbleStyle.paddingLeft) +
    readPixelValue(bubbleStyle.paddingRight) +
    readPixelValue(bubbleStyle.borderLeftWidth) +
    readPixelValue(bubbleStyle.borderRightWidth);
  const widestLine = Math.max(...lineRects.map((rect) => rect.width));
  measurementHost.replaceChildren();

  return {
    lineCount: lineRects.length,
    width: Math.ceil(
      widestLine + horizontalChrome + BUBBLE_WIDTH_MEASUREMENT_SLACK_PX,
    ),
  };
}

function getMaxProbeBubbleWidth(row: HTMLDivElement) {
  const rowWidth = Math.round(row.getBoundingClientRect().width);

  if (rowWidth <= 0) {
    return 0;
  }

  const rowChromeWidth = window.matchMedia("(min-width: 700px)").matches
    ? rowWidth * 0.68
    : rowWidth - 64;

  return Math.max(
    0,
    Math.floor(Math.min(rowChromeWidth, BUBBLE_WIDTH_PROBE_MAX_PX)),
  );
}

function ensureMeasurementHost(
  measurementHostRef: RefObject<HTMLDivElement | null>,
) {
  if (measurementHostRef.current) {
    return measurementHostRef.current;
  }

  const host = document.createElement("div");
  host.setAttribute("aria-hidden", "true");
  host.style.contain = "layout style";
  host.style.left = "-10000px";
  host.style.pointerEvents = "none";
  host.style.position = "fixed";
  host.style.top = "0";
  host.style.visibility = "hidden";
  host.style.zIndex = "-1";
  document.body.append(host);
  measurementHostRef.current = host;

  return host;
}

function readPixelValue(value: string) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}
