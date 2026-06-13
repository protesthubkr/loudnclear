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
  lastMeasuredRowWidth: number;
  row: HTMLDivElement;
  sentenceElement: HTMLSpanElement;
};

type BubbleMeasurementContextValue = {
  register: (input: RegisterBubbleMeasurementInput) => () => void;
};

type RegisterBubbleMeasurementInput = BubbleMeasurementRefs & {
  id: string;
};

const BUBBLE_WIDTH_MEASUREMENT_SLACK_PX = 14;
const BUBBLE_VISIBILITY_ROOT_MARGIN = "240px 0px";
const BubbleMeasurementContext =
  createContext<BubbleMeasurementContextValue | null>(null);

export function StatementBubbleMeasurementProvider({
  children,
}: {
  children: ReactNode;
}) {
  const entriesRef = useRef(new Map<string, BubbleMeasurementEntry>());
  const pendingIdsRef = useRef(new Set<string>());
  const prepareFrameRef = useRef(0);
  const measureFrameRef = useRef(0);
  const observerRef = useRef<IntersectionObserver | null>(null);

  const cancelPendingFrames = useCallback(() => {
    window.cancelAnimationFrame(prepareFrameRef.current);
    window.cancelAnimationFrame(measureFrameRef.current);
    prepareFrameRef.current = 0;
    measureFrameRef.current = 0;
  }, []);

  const scheduleMeasurement = useCallback((id: string, force = false) => {
    const entry = entriesRef.current.get(id);

    if (!entry || !entry.isVisible) {
      return;
    }

    entry.forceMeasure = entry.forceMeasure || force;
    pendingIdsRef.current.add(id);

    if (prepareFrameRef.current) {
      return;
    }

    prepareFrameRef.current = window.requestAnimationFrame(() => {
      prepareFrameRef.current = 0;
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
        measurePreparedEntries(entriesToMeasure);
      });
    });
  }, []);

  const ensureObserver = useCallback(() => {
    if (observerRef.current || !("IntersectionObserver" in window)) {
      return observerRef.current;
    }

    observerRef.current = new IntersectionObserver(
      (intersectionEntries) => {
        for (const intersectionEntry of intersectionEntries) {
          const entry = findEntryByRow(
            entriesRef.current,
            intersectionEntry.target,
          );

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
        lastMeasuredRowWidth: 0,
        row,
        sentenceElement,
      };
      entriesRef.current.set(id, entry);

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

  useEffect(
    () => () => {
      observerRef.current?.disconnect();
      observerRef.current = null;
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

function prepareEntriesForMeasurement(entries: BubbleMeasurementEntry[]) {
  return entries.filter((entry) => {
    const rowWidth = Math.round(entry.row.getBoundingClientRect().width);

    if (
      !entry.forceMeasure &&
      rowWidth > 0 &&
      rowWidth === entry.lastMeasuredRowWidth &&
      entry.row.classList.contains("is-width-measured")
    ) {
      return false;
    }

    entry.forceMeasure = false;
    entry.lastMeasuredRowWidth = rowWidth;
    entry.row.classList.remove("is-width-measured");
    entry.row.classList.add("is-width-probing");
    entry.row.style.removeProperty("--statement-measured-bubble-width");

    return true;
  });
}

function measurePreparedEntries(entries: BubbleMeasurementEntry[]) {
  for (const entry of entries) {
    const measuredBubble = getMeasuredBubbleMetrics(
      entry.bubble,
      entry.sentenceElement,
    );

    if (!measuredBubble) {
      entry.row.classList.remove("is-width-probing");
      continue;
    }

    entry.row.classList.remove("is-width-probing");
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

function getMeasuredBubbleMetrics(
  bubble: HTMLElement,
  sentenceElement: HTMLSpanElement,
) {
  const range = document.createRange();
  range.selectNodeContents(sentenceElement);
  const lineRects = Array.from(range.getClientRects()).filter(
    (rect) => rect.width > 0 && rect.height > 0,
  );
  range.detach();

  if (lineRects.length === 0) {
    return null;
  }

  const bubbleStyle = window.getComputedStyle(bubble);
  const horizontalChrome =
    readPixelValue(bubbleStyle.paddingLeft) +
    readPixelValue(bubbleStyle.paddingRight) +
    readPixelValue(bubbleStyle.borderLeftWidth) +
    readPixelValue(bubbleStyle.borderRightWidth);
  const widestLine = Math.max(...lineRects.map((rect) => rect.width));

  return {
    lineCount: lineRects.length,
    width: Math.ceil(
      widestLine + horizontalChrome + BUBBLE_WIDTH_MEASUREMENT_SLACK_PX,
    ),
  };
}

function findEntryByRow(
  entries: Map<string, BubbleMeasurementEntry>,
  target: Element,
) {
  for (const entry of entries.values()) {
    if (entry.row === target) {
      return entry;
    }
  }

  return null;
}

function readPixelValue(value: string) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}
