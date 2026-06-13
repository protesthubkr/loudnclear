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
  forceMeasure: boolean;
  id: string;
  lastMeasuredRowWidth: number;
  row: HTMLDivElement;
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
  const measurementTaskScheduledRef = useRef(false);
  const measurementGenerationRef = useRef(0);
  const shouldNotifySettledRef = useRef(false);

  const cancelPendingMeasurements = useCallback(() => {
    measurementGenerationRef.current += 1;
    measurementTaskScheduledRef.current = false;
    pendingIdsRef.current.clear();
    shouldNotifySettledRef.current = false;
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

      if (measurementTaskScheduledRef.current) {
        return;
      }

      measurementTaskScheduledRef.current = true;
      const measurementGeneration = measurementGenerationRef.current;
      queueMicrotask(() => {
        if (measurementGeneration !== measurementGenerationRef.current) {
          return;
        }

        measurementTaskScheduledRef.current = false;
        const pendingEntries = Array.from(pendingIdsRef.current)
          .map((pendingId) => entriesRef.current.get(pendingId))
          .filter((pendingEntry): pendingEntry is BubbleMeasurementEntry =>
            Boolean(pendingEntry),
          );
        pendingIdsRef.current.clear();
        const entriesToMeasure = getEntriesToMeasure(pendingEntries);

        if (entriesToMeasure.length === 0) {
          notifyMeasurementsSettled();
          return;
        }

        measurePreparedEntries(entriesToMeasure);
        notifyMeasurementsSettled();
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
      id,
      rowRef,
    }: RegisterBubbleMeasurementInput) => {
      const row = rowRef.current;

      if (!row) {
        return () => {};
      }

      const entry: BubbleMeasurementEntry = {
        forceMeasure: false,
        id,
        lastMeasuredRowWidth: 0,
        row,
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

  useEffect(() => {
    return () => {
      cancelPendingMeasurements();
    };
  }, [cancelPendingMeasurements]);

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

function getEntriesToMeasure(entries: BubbleMeasurementEntry[]) {
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

    return true;
  });
}

function measurePreparedEntries(entries: BubbleMeasurementEntry[]) {
  const measurementHost = createMeasurementHost();

  try {
    const measuredEntries = entries.map((entry) => ({
      entry,
      measuredBubble: measureEntryOffscreen(entry, measurementHost),
    }));

    for (const { entry, measuredBubble } of measuredEntries) {
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
  } finally {
    measurementHost.remove();
  }
}

function createMeasurementHost() {
  const host = document.createElement("div");
  host.setAttribute("aria-hidden", "true");
  host.style.position = "fixed";
  host.style.top = "0";
  host.style.left = "-10000px";
  host.style.width = "0";
  host.style.height = "0";
  host.style.overflow = "hidden";
  host.style.visibility = "hidden";
  host.style.pointerEvents = "none";
  host.style.contain = "layout style";
  document.body.appendChild(host);

  return host;
}

function measureEntryOffscreen(
  entry: BubbleMeasurementEntry,
  measurementHost: HTMLDivElement,
) {
  const clone = entry.row.cloneNode(true) as HTMLDivElement;
  clone.classList.remove("is-width-measured");
  clone.classList.add("is-width-probing");
  clone.style.removeProperty("--statement-measured-bubble-width");
  clone.style.width = `${Math.max(entry.lastMeasuredRowWidth, 1)}px`;
  measurementHost.appendChild(clone);

  const clonedBubble = clone.querySelector<HTMLElement>(".statement-bubble");
  const clonedSentence = clone.querySelector<HTMLSpanElement>(
    ".statement-core-sentence",
  );

  if (!clonedBubble || !clonedSentence) {
    return null;
  }

  return getMeasuredBubbleMetrics(clonedBubble, clonedSentence);
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
