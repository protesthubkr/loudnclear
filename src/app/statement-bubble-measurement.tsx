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
  lastMeasuredRowWidth: number;
  row: HTMLDivElement;
  sentenceElement: HTMLSpanElement;
};

type BubbleMeasurementContextValue = {
  register: (input: RegisterBubbleMeasurementInput) => () => void;
};

type MeasurementScheduleOptions = {
  notifyWhenSettled?: boolean;
};

type RegisterBubbleMeasurementInput = BubbleMeasurementRefs & {
  id: string;
};

const BUBBLE_WIDTH_MEASUREMENT_SLACK_PX = 14;
const BubbleMeasurementContext =
  createContext<BubbleMeasurementContextValue | null>(null);

export function StatementBubbleMeasurementProvider({
  children,
  measurementSignal,
  onMeasurementsSettled,
}: {
  children: ReactNode;
  measurementSignal?: number;
  onMeasurementsSettled?: () => void;
}) {
  const entriesRef = useRef(new Map<string, BubbleMeasurementEntry>());
  const pendingIdsRef = useRef(new Set<string>());
  const prepareFrameRef = useRef(0);
  const measureFrameRef = useRef(0);
  const shouldNotifySettledRef = useRef(false);

  const cancelPendingFrames = useCallback(() => {
    window.cancelAnimationFrame(prepareFrameRef.current);
    window.cancelAnimationFrame(measureFrameRef.current);
    prepareFrameRef.current = 0;
    measureFrameRef.current = 0;
  }, []);

  const notifyMeasurementsSettled = useCallback(() => {
    if (!shouldNotifySettledRef.current) {
      return;
    }

    shouldNotifySettledRef.current = false;
    onMeasurementsSettled?.();
  }, [onMeasurementsSettled]);

  const schedulePendingMeasurements = useCallback(
    ({ notifyWhenSettled }: MeasurementScheduleOptions = {}) => {
      if (notifyWhenSettled) {
        shouldNotifySettledRef.current = true;
      }

      if (prepareFrameRef.current) {
        return;
      }

      prepareFrameRef.current = window.requestAnimationFrame(() => {
        prepareFrameRef.current = 0;
        const pendingEntries = Array.from(pendingIdsRef.current)
          .map((pendingId) => entriesRef.current.get(pendingId))
          .filter((pendingEntry): pendingEntry is BubbleMeasurementEntry =>
            Boolean(pendingEntry),
          );
        pendingIdsRef.current.clear();
        const entriesToMeasure = prepareEntriesForMeasurement(pendingEntries);

        if (entriesToMeasure.length === 0) {
          notifyMeasurementsSettled();
          return;
        }

        measureFrameRef.current = window.requestAnimationFrame(() => {
          measureFrameRef.current = 0;
          measurePreparedEntries(entriesToMeasure);
          notifyMeasurementsSettled();
        });
      });
    },
    [notifyMeasurementsSettled],
  );

  const scheduleMeasurement = useCallback(
    (
      id: string,
      force = false,
      options: MeasurementScheduleOptions = {},
    ) => {
      const entry = entriesRef.current.get(id);

      if (!entry) {
        return;
      }

      entry.forceMeasure = entry.forceMeasure || force;
      pendingIdsRef.current.add(id);
      schedulePendingMeasurements(options);
    },
    [schedulePendingMeasurements],
  );

  const scheduleAllMeasurements = useCallback(
    (force = false, options: MeasurementScheduleOptions = {}) => {
      for (const entry of entriesRef.current.values()) {
        entry.forceMeasure = entry.forceMeasure || force;
        pendingIdsRef.current.add(entry.id);
      }

      schedulePendingMeasurements(options);
    },
    [schedulePendingMeasurements],
  );

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
        lastMeasuredRowWidth: 0,
        row,
        sentenceElement,
      };
      entriesRef.current.set(id, entry);
      scheduleMeasurement(id, true);

      return () => {
        entriesRef.current.delete(id);
        pendingIdsRef.current.delete(id);
      };
    },
    [scheduleMeasurement],
  );

  useEffect(() => {
    function measureAllRows() {
      scheduleAllMeasurements(true);
    }

    window.addEventListener("resize", measureAllRows);

    return () => {
      window.removeEventListener("resize", measureAllRows);
    };
  }, [scheduleAllMeasurements]);

  useLayoutEffect(() => {
    scheduleAllMeasurements(false, { notifyWhenSettled: true });
  }, [measurementSignal, scheduleAllMeasurements]);

  useEffect(
    () => () => {
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

function readPixelValue(value: string) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}
