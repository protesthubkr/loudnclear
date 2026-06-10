"use client";

import Image from "next/image";
import type { RefObject } from "react";
import { useLayoutEffect, useRef } from "react";
import type { PublicStatementFeedItem } from "@/lib/telegram-statements/public-feed";
import { formatStatementTime } from "./statement-format";
import {
  getAvatarLabel,
  getAvatarTone,
  getStatementProfile,
  isPartyStatementProfile,
} from "./statement-profile";

const BUBBLE_WIDTH_MEASUREMENT_SLACK_PX = 14;

export function StatementFeedRow({ item }: { item: PublicStatementFeedItem }) {
  const profile = getStatementProfile(item);
  const side = isPartyStatementProfile(profile) ? "left" : "right";
  const avatarTone = getAvatarTone(profile.label);
  const avatarLabel = getAvatarLabel(profile.label);
  const displayTime = formatStatementTime(item);
  const widthClassName = getStatementRowWidthClass(item.coreSentence);
  const rowRef = useRef<HTMLDivElement>(null);
  const bubbleRef = useRef<HTMLAnchorElement>(null);
  const sentenceRef = useRef<HTMLSpanElement>(null);

  useMeasuredBubbleWidth({
    bubbleRef,
    rowRef,
    sentence: item.coreSentence,
    sentenceRef,
  });

  return (
    <div
      className={`statement-feed-row statement-feed-row--${side} ${widthClassName}`}
      ref={rowRef}
    >
      <span className="statement-author">
        {profile.logoSrc ? (
          <span
            aria-hidden="true"
            className="statement-avatar statement-avatar--logo"
          >
            <Image
              alt=""
              className="statement-avatar-image"
              height={34}
              src={profile.logoSrc}
              width={34}
            />
          </span>
        ) : (
          <span
            aria-hidden="true"
            className={`statement-avatar statement-avatar--tone-${avatarTone}`}
          >
            {avatarLabel}
          </span>
        )}
        <span className="statement-organization" title={item.organizationName}>
          {profile.label}
        </span>
      </span>
      <span className="statement-message">
        <a
          aria-label={`${item.organizationName} - ${item.coreSentence}`}
          className="statement-bubble"
          href={item.sourceUrl}
          ref={bubbleRef}
          rel="noreferrer"
          target="_blank"
        >
          <span className="statement-core-sentence" ref={sentenceRef}>
            {item.coreSentence}
          </span>
        </a>
        {displayTime ? (
          <time className="statement-time" dateTime={item.messageCreatedAt ?? ""}>
            {displayTime}
          </time>
        ) : null}
      </span>
    </div>
  );
}

function useMeasuredBubbleWidth({
  bubbleRef,
  rowRef,
  sentence,
  sentenceRef,
}: {
  bubbleRef: RefObject<HTMLAnchorElement | null>;
  rowRef: RefObject<HTMLDivElement | null>;
  sentence: string;
  sentenceRef: RefObject<HTMLSpanElement | null>;
}) {
  useLayoutEffect(() => {
    const row = rowRef.current;
    const bubble = bubbleRef.current;
    const sentenceElement = sentenceRef.current;

    if (!row || !bubble || !sentenceElement) {
      return;
    }

    const currentRow = row;
    const currentBubble = bubble;
    const currentSentenceElement = sentenceElement;

    let frameId = 0;
    let secondFrameId = 0;
    let lastMeasuredRowWidth = 0;

    function cancelPendingMeasurement() {
      window.cancelAnimationFrame(frameId);
      window.cancelAnimationFrame(secondFrameId);
      frameId = 0;
      secondFrameId = 0;
    }

    function measure() {
      const rowWidth = Math.round(currentRow.getBoundingClientRect().width);

      if (
        rowWidth > 0 &&
        rowWidth === lastMeasuredRowWidth &&
        currentRow.classList.contains("is-width-measured")
      ) {
        return;
      }

      lastMeasuredRowWidth = rowWidth;
      cancelPendingMeasurement();
      currentRow.classList.remove("is-width-measured");
      currentRow.classList.add("is-width-probing");
      currentRow.style.removeProperty("--statement-measured-bubble-width");

      frameId = window.requestAnimationFrame(() => {
        secondFrameId = window.requestAnimationFrame(() => {
          const measuredBubble = getMeasuredBubbleMetrics(
            currentBubble,
            currentSentenceElement,
          );

          if (!measuredBubble) {
            currentRow.classList.remove("is-width-probing");
            return;
          }

          currentRow.classList.remove("is-width-probing");
          currentRow.classList.toggle(
            "is-single-line-bubble",
            measuredBubble.lineCount === 1,
          );
          currentRow.style.setProperty(
            "--statement-measured-bubble-width",
            `${measuredBubble.width}px`,
          );
          currentRow.classList.add("is-width-measured");
        });
      });
    }

    measure();
    window.addEventListener("resize", measure);

    return () => {
      cancelPendingMeasurement();
      window.removeEventListener("resize", measure);
    };
  }, [bubbleRef, rowRef, sentence, sentenceRef]);
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

function getStatementRowWidthClass(sentence: string) {
  const length = Array.from(sentence.replace(/\s+/g, "").trim()).length;

  if (length <= 30) {
    return "statement-feed-row--text-tiny";
  }

  if (length <= 56) {
    return "statement-feed-row--text-short";
  }

  if (length <= 120) {
    return "statement-feed-row--text-compact";
  }

  if (length <= 180) {
    return "statement-feed-row--text-medium";
  }

  if (length <= 260) {
    return "statement-feed-row--text-long";
  }

  return "statement-feed-row--text-extra-long";
}
