import type { EmailMessage } from "@tokenring-ai/email";
import formatError from "@tokenring-ai/utility/error/formatError";
import { Inbox, Loader2, RefreshCw } from "lucide-react";
import { useCallback, useMemo } from "react";
import NavigationSidebarHeader from "../../../components/layout/NavigationSidebarHeader.tsx";
import ErrorState from "../../../components/ui/ErrorState.tsx";
import FilterTabs from "../../../components/ui/FilterTabs.tsx";
import { toastManager } from "../../../components/ui/toast.tsx";
import { usePaginatedList } from "../../../hooks/usePaginatedList.ts";
import { useRefSync } from "../../../hooks/useRefSync.ts";
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
  // Both hooks always run (Rules of Hooks); inactive one gets a null SWR key and does not fetch.
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
  // Keep latest result for refresh so mutate targets the active query after mode switches.
  const resultRef = useRefSync(result);

  const fetchNextPage = useCallback(
    async (pageToken: string) => {
      const page = await emailRPCClient.getMessages({
        provider: provider!,
        box,
        limit: PAGE_SIZE,
        unreadOnly,
        pageToken,
      });
      return { items: page.messages as EmailMessage[], nextPageToken: page.nextPageToken };
    },
    [box, provider, unreadOnly],
  );

  const {
    items: messages,
    loadingMore,
    hasMore,
    loadMore,
    refresh,
  } = usePaginatedList<EmailMessage>({
    firstPage: result.data?.messages as EmailMessage[] | undefined,
    firstPageToken: listing.data?.nextPageToken,
    resetKeys: [provider, box, searchQuery, messageFilter],
    refreshKey,
    mutate: () => resultRef.current.mutate(),
    fetchNextPage,
    paginationDisabled: !!searchQuery || !provider,
    onError: err => toastManager.error(formatError(err), { duration: 4000 }),
  });

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

  const baseCount = result.data?.messages.length ?? 0;
  const hasLoadedMore = messages.length > baseCount;

  const countLabel = useMemo(() => {
    if (!result.data) return "";
    const n = filteredMessages.length;
    if (messageFilter === "all" && !hasLoadedMore) {
      return searchQuery ? `${result.data.count} results` : `${result.data.count} messages`;
    }
    const suffix = searchQuery ? "results" : "messages";
    const filterLabel = messageFilter === "all" ? "" : `${messageFilter} `;
    return `${n} ${filterLabel}${suffix}`.replace("  ", " ");
  }, [filteredMessages.length, hasLoadedMore, messageFilter, result.data, searchQuery]);

  const emptyMessage = searchQuery
    ? `No ${messageFilter === "all" ? "emails" : messageFilter} emails found for "${searchQuery}"`
    : messageFilter === "unread"
      ? `No unread messages in ${box}`
      : messageFilter === "read"
        ? `No read messages in ${box}`
        : `${box} is empty`;

  return (
    <div className="flex flex-col h-full min-h-0">
      <NavigationSidebarHeader
        title="Messages"
        meta={countLabel || undefined}
        actions={[
          {
            icon: <RefreshCw className={result.isValidating ? "w-3 h-3 animate-spin" : "w-3 h-3"} />,
            label: "Refresh messages",
            title: "Refresh",
            onClick: () => refresh(),
          },
        ]}
      />

      <FilterTabs
        tabs={MESSAGE_FILTERS}
        value={messageFilter}
        onChange={onMessageFilterChange}
        className="bg-secondary"
        activeTabClassName="border-red-500 text-primary"
      />

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
            {hasMore && (
              <div className="p-3 flex justify-center">
                <button
                  type="button"
                  onClick={() => void loadMore()}
                  disabled={loadingMore}
                  className="px-3 py-1.5 text-xs font-medium text-muted hover:text-primary border border-primary rounded-lg focus-ring cursor-pointer disabled:opacity-50 transition-colors"
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
