import type { MediaKind } from "./types.ts";

export const MEDIA_AGENT_TYPES = ["media", "image", "imageGeneration", "video", "videoGeneration", "audio", "voice"] as const;

export const AGENT_TYPE_PREFERENCES: Record<MediaKind, string[]> = {
  image: ["media", "image", "imageGeneration"],
  video: ["media", "video", "videoGeneration"],
  audio: ["media", "audio", "voice"],
};
