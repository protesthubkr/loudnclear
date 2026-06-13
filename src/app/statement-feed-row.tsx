"use client";

import { useRef } from "react";
import type { PublicStatementFeedItem } from "@/lib/telegram-statements/public-feed-types";
import { useStatementBubbleMeasurement } from "./statement-bubble-measurement";
import { formatStatementTime } from "./statement-format";
import {
  getAvatarLabel,
  getAvatarTone,
  getStatementProfile,
  isPartyStatementProfile,
} from "./statement-profile";

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

  useStatementBubbleMeasurement({
    bubbleRef,
    id: item.id,
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
            {/* eslint-disable-next-line @next/next/no-img-element -- Tiny repeated feed logos should avoid scroll-time lazy image work. */}
            <img
              alt=""
              className="statement-avatar-image"
              decoding="async"
              height={34}
              loading="eager"
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
