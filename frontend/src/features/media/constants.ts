import type { MediaKind } from "./types.ts";

export const AGENT_TYPE_PREFERENCES: Record<MediaKind, string[]> = {
  image: ["image", "imageGeneration", "media"],
  video: ["video", "videoGeneration", "media"],
  audio: ["audio", "voice", "media"],
};
