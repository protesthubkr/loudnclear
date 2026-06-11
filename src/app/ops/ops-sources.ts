import "server-only";

import {
  attachSourceHealth,
  compareDataSources,
  getDataSourceHealthCounts,
} from "./ops-source-health";
import { getSummaryCountsBySource } from "./ops-source-summary-counts";
import type {
  BaseDataSourceRow,
  OpsSupabaseClient,
} from "./ops-types";

const SOURCE_HEALTH_LOOKBACK_DAYS = 7;

export { getDataSourceHealthCounts };

export async function getDataSources(supabase: OpsSupabaseClient) {
  const sinceIso = new Date(
    Date.now() - SOURCE_HEALTH_LOOKBACK_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();
  const [
    telegramSources,
    partySources,
    webSources,
    xSources,
    telegramSummaryCounts,
    partySummaryCounts,
    webSummaryCounts,
    xSummaryCounts,
  ] = await Promise.all([
    getTelegramSources(supabase),
    getPartySources(supabase),
    getWebSources(supabase),
    getXSources(supabase),
    getSummaryCountsBySource(
      supabase,
      "telegram_statement_summaries",
      "channel_username",
      sinceIso,
    ),
    getSummaryCountsBySource(
      supabase,
      "party_statement_summaries",
      "source_key",
      sinceIso,
    ),
    getSummaryCountsBySource(
      supabase,
      "web_statement_summaries",
      "source_key",
      sinceIso,
    ),
    getSummaryCountsBySource(
      supabase,
      "x_statement_summaries",
      "source_key",
      sinceIso,
    ),
  ]);

  const now = new Date();
  const dataSources = [
    ...telegramSources.map((source) =>
      attachSourceHealth(
        source,
        telegramSummaryCounts.get(source.source_key.replace(/^@/, "")),
        now,
      ),
    ),
    ...partySources.map((source) =>
      attachSourceHealth(source, partySummaryCounts.get(source.source_key), now),
    ),
    ...webSources.map((source) =>
      attachSourceHealth(source, webSummaryCounts.get(source.source_key), now),
    ),
    ...xSources.map((source) =>
      attachSourceHealth(
        source,
        xSummaryCounts.get(source.source_key.replace(/^@/, "")),
        now,
      ),
    ),
  ];

  return dataSources.sort(compareDataSources);
}

async function getTelegramSources(
  supabase: OpsSupabaseClient,
): Promise<BaseDataSourceRow[]> {
  const [subscriptions, states] = await Promise.all([
    supabase
      .from("telegram_channel_subscriptions")
      .select(
        [
          "channel_username",
          "channel_title",
          "status",
          "statement_feed_enabled",
          "last_checked_at",
          "last_checked_message_at",
          "last_error",
        ].join(","),
      )
      .order("channel_username", { ascending: true }),
    supabase
      .from("telegram_statement_scan_states")
      .select("channel_username,last_scanned_at,last_error"),
  ]);

  if (subscriptions.error) {
    throw new Error(subscriptions.error.message);
  }

  if (states.error) {
    throw new Error(states.error.message);
  }

  const stateByChannel = new Map(
    ((states.data ?? []) as Array<{
      channel_username: string;
      last_error: string | null;
      last_scanned_at: string | null;
    }>).map((state) => [state.channel_username, state]),
  );

  return ((subscriptions.data ?? []) as unknown as Array<{
    channel_title: string | null;
    channel_username: string;
    last_checked_at: string | null;
    last_checked_message_at: string | null;
    last_error: string | null;
    statement_feed_enabled: boolean;
    status: string;
  }>).map((subscription) => {
    const state = stateByChannel.get(subscription.channel_username);

    return {
      enabled:
        subscription.status === "active" && subscription.statement_feed_enabled,
      last_error: state?.last_error ?? subscription.last_error,
      last_scanned_at:
        state?.last_scanned_at ??
        subscription.last_checked_at ??
        subscription.last_checked_message_at,
      organization_name:
        subscription.channel_title ?? `@${subscription.channel_username}`,
      source_key: `@${subscription.channel_username}`,
      source_type: "telegram" as const,
      source_url: `https://t.me/s/${subscription.channel_username}`,
      status: getTelegramSourceStatus(subscription),
    };
  });
}

async function getPartySources(
  supabase: OpsSupabaseClient,
): Promise<BaseDataSourceRow[]> {
  const { data, error } = await supabase
    .from("party_statement_sources")
    .select(
      "source_key,organization_name,list_url,enabled,last_scanned_at,last_error",
    )
    .order("source_key", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as unknown as Array<{
    enabled: boolean;
    last_error: string | null;
    last_scanned_at: string | null;
    list_url: string;
    organization_name: string;
    source_key: string;
  }>).map((source) => ({
    enabled: source.enabled,
    last_error: source.last_error,
    last_scanned_at: source.last_scanned_at,
    organization_name: source.organization_name,
    source_key: source.source_key,
    source_type: "party" as const,
    source_url: source.list_url,
    status: source.enabled ? "enabled" : "disabled",
  }));
}

async function getXSources(
  supabase: OpsSupabaseClient,
): Promise<BaseDataSourceRow[]> {
  const { data, error } = await supabase
    .from("x_statement_sources")
    .select(
      [
        "source_key",
        "username",
        "organization_name",
        "source_url",
        "enabled",
        "last_scanned_at",
        "last_error",
      ].join(","),
    )
    .order("source_key", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as unknown as Array<{
    enabled: boolean;
    last_error: string | null;
    last_scanned_at: string | null;
    organization_name: string;
    source_key: string;
    source_url: string;
    username: string;
  }>).map((source) => ({
    enabled: source.enabled,
    last_error: source.last_error,
    last_scanned_at: source.last_scanned_at,
    organization_name: source.organization_name,
    source_key: `@${source.username}`,
    source_type: "x" as const,
    source_url: source.source_url,
    status: source.enabled ? "enabled" : "disabled",
  }));
}

async function getWebSources(
  supabase: OpsSupabaseClient,
): Promise<BaseDataSourceRow[]> {
  const { data, error } = await supabase
    .from("web_statement_sources")
    .select(
      [
        "source_key",
        "organization_name",
        "list_url",
        "enabled",
        "last_scanned_at",
        "last_error",
      ].join(","),
    )
    .order("source_key", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as unknown as Array<{
    enabled: boolean;
    last_error: string | null;
    last_scanned_at: string | null;
    list_url: string;
    organization_name: string;
    source_key: string;
  }>).map((source) => ({
    enabled: source.enabled,
    last_error: source.last_error,
    last_scanned_at: source.last_scanned_at,
    organization_name: source.organization_name,
    source_key: source.source_key,
    source_type: "web" as const,
    source_url: source.list_url,
    status: source.enabled ? "enabled" : "disabled",
  }));
}

function getTelegramSourceStatus(source: {
  statement_feed_enabled: boolean;
  status: string;
}) {
  if (source.status !== "active") {
    return source.status;
  }

  return source.statement_feed_enabled ? "enabled" : "disabled";
}
