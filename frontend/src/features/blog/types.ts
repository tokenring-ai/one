export type PostStatus = "draft" | "published" | "scheduled" | "pending" | "private";
export type StatusFilter = "all" | "draft" | "published";

export const POST_STATUSES: PostStatus[] = ["draft", "published", "scheduled", "pending", "private"];
