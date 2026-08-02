import type { EmailMessage } from "@tokenring-ai/email";
import formatError from "@tokenring-ai/utility/error/formatError";
import { Inbox, Loader2, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import ErrorState from "../../../components/ui/ErrorState.tsx";
import FilterTabs from "../../../components/ui/FilterTabs.tsx";
import { toastManager } from "../../../components/ui/toast.tsx";
import { emailRPCClient, useEmailMessages, useEmailSearch } from "../../../rpc.ts";
import { MESSAGE_FILTERS, PAGE_SIZE } from "../constants.ts";
import type { MessageFilter } from "../types.ts";
import MessageListItem from "./MessageListItem.tsx";

export default function MessageListPane({
  provider,
  box,
  selectedId,
  onSelect,
  messageFilter,
  onMessageFilterChange,
  searchQuery,
  refreshKey,
}: {
  provider: string | null;
  box: string;
  selectedId: string | null;
  onSelect: (id: string) => void;
  messageFilter: MessageFilter;
  onMessageFilterChange: (filter: MessageFilter) => void;
  searchQuery: string | null;
  /** Bump to force list revalidation after send etc. */
  refreshKey?: number;
}) {
  const unreadOnly = messageFilter === "unread";
  const listing = useEmailMessages(searchQuery ? undefined : (provider ?? undefined), {
    box,
    limit: PAGE_SIZE,
    unreadOnly,
  });
  const search = useEmailSearch(provider ?? undefined, searchQuery !== null ? searchQuery : undefined, {
    box,
    limit: PAGE_SIZE,
    unreadOnly,
  });
  const result = searchQuery ? search : listing;

  const [extraMessages, setExtraMessages] = useState<EmailMessage[]>([]);
  const [nextPageToken, setNextPageToken] = useState<string | undefined>();
  const [loadingMore, setLoadingMore] = useState(false);

  // Reset accumulated pages when the mailbox query changes
  useEffect(() => {
    setExtraMessages([]);
    setNextPageToken(undefined);
  }, [provider, box, searchQuery, messageFilter]);

  // Sync next-page token from the first page only while we have not loaded more
  // (search endpoint has no pagination; only listing does)
  useEffect(() => {
    if (searchQuery || extraMessages.length > 0) return;
    setNextPageToken(listing.data?.nextPageToken);
  }, [listing.data?.nextPageToken, searchQuery, extraMessages.length]);

  // Parent starts at 0; only revalidate when bumped after send/etc. (avoids double-fetch on mount)
  useEffect(() => {
    if (refreshKey === undefined || refreshKey === 0) return;
    setExtraMessages([]);
    setNextPageToken(undefined);
    void result.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only revalidate when refreshKey bumps
  }, [refreshKey]);

  const baseMessages = (result.data?.messages ?? []) as EmailMessage[];
  const messages = useMemo(() => {
    if (extraMessages.length === 0) return baseMessages;
    const seen = new Set(baseMessages.map(m => m.id));
    return [...baseMessages, ...extraMessages.filter(m => !seen.has(m.id))];
  }, [baseMessages, extraMessages]);

  const filteredMessages = useMemo(
    () =>
      messages.filter(msg => {
        if (messageFilter === "read") return msg.isRead;
        // unread is applied server-side when possible; still filter client-side for safety
        if (messageFilter === "unread") return !msg.isRead;
        return true;
      }),
    [messageFilter, messages],
  );

  const countLabel = useMemo(() => {
    if (!result.data) return "";
    const n = filteredMessages.length;
    if (messageFilter === "all" && !extraMessages.length) {
      return searchQuery ? `${result.data.count} results` : `${result.data.count} messages`;
    }
    const suffix = searchQuery ? "results" : "messages";
    const filterLabel = messageFilter === "all" ? "" : `${messageFilter} `;
    return `${n} ${filterLabel}${suffix}`.replace("  ", " ");
  }, [extraMessages.length, filteredMessages.length, messageFilter, result.data, searchQuery]);

  const emptyMessage = searchQuery
    ? `No ${messageFilter === "all" ? "emails" : messageFilter} emails found for "${searchQuery}"`
    : messageFilter === "unread"
      ? `No unread messages in ${box}`
      : messageFilter === "read"
        ? `No read messages in ${box}`
        : `${box} is empty`;

  const handleLoadMore = useCallback(async () => {
    if (!provider || !nextPageToken || searchQuery) return;
    setLoadingMore(true);
    try {
      const page = await emailRPCClient.getMessages({
        provider,
        box,
        limit: PAGE_SIZE,
        unreadOnly,
        pageToken: nextPageToken,
      });
      setExtraMessages(prev => {
        const seen = new Set(prev.map(m => m.id));
        const additions = page.messages.filter(m => !seen.has(m.id));
        return [...prev, ...additions];
      });
      setNextPageToken(page.nextPageToken);
    } catch (err) {
      toastManager.error(formatError(err), { duration: 4000 });
    } finally {
      setLoadingMore(false);
    }
  }, [box, nextPageToken, provider, searchQuery, unreadOnly]);

  return (
    <div className="flex flex-col h-full min-h-0">
      <FilterTabs
        tabs={MESSAGE_FILTERS}
        value={messageFilter}
        onChange={onMessageFilterChange}
        className="bg-secondary"
        activeTabClassName="border-red-500 text-primary"
      />

      <div className="shrink-0 h-9 border-b border-primary bg-secondary flex items-center justify-between px-3">
        <span className="text-2xs text-muted">{countLabel}</span>
        <button
          type="button"
          onClick={() => {
            setExtraMessages([]);
            setNextPageToken(undefined);
            void result.mutate();
          }}
          className="p-1 text-muted hover:text-primary transition-colors focus-ring rounded cursor-pointer"
          title="Refresh"
        >
          <RefreshCw className="w-3 h-3" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto relative">
        {result.isLoading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="w-5 h-5 text-muted animate-spin" />
          </div>
        ) : result.error ? (
          <ErrorState title="Failed to load messages" error={result.error} onRetry={() => void result.mutate()} variant="inline" className="py-8" />
        ) : filteredMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 gap-3 text-muted p-4 text-center">
            <Inbox className="w-8 h-8 opacity-30" />
            <p className="text-sm">{emptyMessage}</p>
          </div>
        ) : (
          <>
            {filteredMessages.map(msg => (
              <MessageListItem key={msg.id} msg={msg} selected={msg.id === selectedId} onClick={() => onSelect(msg.id)} />
            ))}
            {nextPageToken && !searchQuery && (
              <div className="p-3 flex justify-center">
                <button
                  type="button"
                  onClick={() => void handleLoadMore()}
                  disabled={loadingMore}
                  className="px-3 py-1.5 text-2xs font-medium text-muted hover:text-primary border border-primary rounded-lg focus-ring cursor-pointer disabled:opacity-50 transition-colors"
                >
                  {loadingMore ? (
                    <span className="inline-flex items-center gap-1.5">
                      <Loader2 className="w-3 h-3 animate-spin" /> Loading…
                    </span>
                  ) : (
                    "Load more"
                  )}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
