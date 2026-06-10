"use client";

import Image from "next/image";
import { useCallback, useState } from "react";
import type { PublicStatementFeedItem } from "@/lib/telegram-statements/public-feed-types";
import type { StatementFeedWindow } from "@/lib/telegram-statements/public-feed-window";
import {
  ALL_STATEMENT_PROFILES,
  isPartyStatementProfile,
} from "./statement-profile";
import { StatementFeedList } from "./statement-feed-list";
import { SITE_NAME } from "./site";

type StatementFeedShellProps = {
  initialHasMoreBefore: boolean;
  initialItems: PublicStatementFeedItem[];
  initialWindow: StatementFeedWindow;
};

type OrganizationFilterOption = {
  isParty: boolean;
  label: string;
  logoSrc: string | null;
};

const PINNED_PARTY_FILTER_LABELS = ["국힘당", "민주당"];

export function StatementFeedShell({
  initialHasMoreBefore,
  initialItems,
  initialWindow,
}: StatementFeedShellProps) {
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [hiddenOrganizationLabels, setHiddenOrganizationLabels] = useState<
    ReadonlySet<string>
  >(() => new Set());
  const [draftHiddenOrganizationLabels, setDraftHiddenOrganizationLabels] =
    useState<ReadonlySet<string>>(() => new Set());

  const organizationOptions = ALL_ORGANIZATION_FILTER_OPTIONS;
  const hiddenCount = hiddenOrganizationLabels.size;

  const openFilter = useCallback(() => {
    setDraftHiddenOrganizationLabels(new Set(hiddenOrganizationLabels));
    setIsFilterOpen(true);
  }, [hiddenOrganizationLabels]);

  const closeFilter = useCallback(() => {
    setIsFilterOpen(false);
  }, []);

  const applyFilter = useCallback(() => {
    setHiddenOrganizationLabels(new Set(draftHiddenOrganizationLabels));
    setIsFilterOpen(false);
  }, [draftHiddenOrganizationLabels]);

  const showAllOrganizations = useCallback(() => {
    setDraftHiddenOrganizationLabels(new Set());
  }, []);

  const toggleOrganization = useCallback((label: string) => {
    setDraftHiddenOrganizationLabels((current) => {
      const next = new Set(current);

      if (next.has(label)) {
        next.delete(label);
      } else {
        next.add(label);
      }

      return next;
    });
  }, []);

  return (
    <main className="statement-shell">
      <header className="statement-topbar">
        <h1>{SITE_NAME}</h1>
        <Image
          alt=""
          aria-hidden="true"
          className="statement-topbar-bird"
          height={327}
          priority
          src="/bird.png"
          width={306}
        />
        <button
          aria-label="단체 필터 열기"
          className={`statement-filter-trigger ${
            hiddenCount > 0 ? "is-active" : ""
          }`}
          type="button"
          onClick={openFilter}
        >
          <Image
            alt=""
            aria-hidden="true"
            className="statement-filter-trigger-icon"
            height={24}
            src="/filter.svg"
            width={24}
          />
          {hiddenCount > 0 ? (
            <span className="statement-filter-trigger-count">{hiddenCount}</span>
          ) : null}
        </button>
      </header>

      <StatementFeedList
        hiddenOrganizationLabels={hiddenOrganizationLabels}
        initialHasMoreBefore={initialHasMoreBefore}
        initialItems={initialItems}
        initialWindow={initialWindow}
      />

      {isFilterOpen ? (
        <StatementOrganizationFilterSheet
          draftHiddenOrganizationLabels={draftHiddenOrganizationLabels}
          organizationOptions={organizationOptions}
          onApply={applyFilter}
          onClose={closeFilter}
          onShowAll={showAllOrganizations}
          onToggleOrganization={toggleOrganization}
        />
      ) : null}
    </main>
  );
}

function StatementOrganizationFilterSheet({
  draftHiddenOrganizationLabels,
  organizationOptions,
  onApply,
  onClose,
  onShowAll,
  onToggleOrganization,
}: {
  draftHiddenOrganizationLabels: ReadonlySet<string>;
  organizationOptions: OrganizationFilterOption[];
  onApply: () => void;
  onClose: () => void;
  onShowAll: () => void;
  onToggleOrganization: (label: string) => void;
}) {
  const isAllVisible = draftHiddenOrganizationLabels.size === 0;

  return (
    <div className="statement-filter-backdrop" role="presentation" onClick={onClose}>
      <section
        aria-labelledby="statement-filter-title"
        aria-modal="true"
        className="statement-filter-sheet"
        role="dialog"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="statement-filter-sheet-header">
          <button type="button" onClick={onClose}>
            취소
          </button>
          <h1 id="statement-filter-title">단체 필터</h1>
          <button type="button" onClick={onApply}>
            적용
          </button>
        </div>

        <div className="statement-filter-content">
          <div className="statement-filter-panel-heading">
            <h2>보일 단체를 선택하세요</h2>
          </div>
          <div className="statement-filter-choice-list">
            <StatementFilterChoiceButton
              checked={isAllVisible}
              label="전체"
              logoSrc={null}
              onToggle={onShowAll}
            />
            {organizationOptions.map((option) => (
              <StatementFilterChoiceButton
                checked={!draftHiddenOrganizationLabels.has(option.label)}
                key={option.label}
                label={option.label}
                logoSrc={option.logoSrc}
                onToggle={() => onToggleOrganization(option.label)}
              />
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

function StatementFilterChoiceButton({
  checked,
  label,
  logoSrc,
  onToggle,
}: {
  checked: boolean;
  label: string;
  logoSrc: string | null;
  onToggle: () => void;
}) {
  return (
    <button
      aria-pressed={checked}
      className={`statement-filter-choice ${checked ? "is-selected" : ""} ${
        logoSrc ? "has-logo" : "is-all"
      }`}
      data-filter-label={label}
      type="button"
      onClick={onToggle}
    >
      {logoSrc ? (
        <span className="statement-filter-choice-logo" aria-hidden="true">
          <Image alt="" height={28} src={logoSrc} width={28} />
        </span>
      ) : null}
      <span className="statement-filter-choice-copy">
        <span className="statement-filter-choice-label">{label}</span>
      </span>
    </button>
  );
}

const ALL_ORGANIZATION_FILTER_OPTIONS = ALL_STATEMENT_PROFILES.map(
  (profile) => ({
    isParty: isPartyStatementProfile(profile),
    label: profile.label,
    logoSrc: profile.logoSrc,
  }),
).sort(compareOrganizationFilterOptions);

function compareOrganizationFilterOptions(
  first: OrganizationFilterOption,
  second: OrganizationFilterOption,
) {
  const firstRank = getOrganizationFilterRank(first);
  const secondRank = getOrganizationFilterRank(second);

  if (firstRank !== secondRank) {
    return firstRank - secondRank;
  }

  return first.label.localeCompare(second.label, "ko-KR");
}

function getOrganizationFilterRank(option: OrganizationFilterOption) {
  const pinnedIndex = PINNED_PARTY_FILTER_LABELS.indexOf(option.label);

  if (pinnedIndex >= 0) {
    return pinnedIndex;
  }

  return option.isParty ? PINNED_PARTY_FILTER_LABELS.length : 99;
}
