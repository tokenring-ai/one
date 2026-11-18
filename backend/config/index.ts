import deepClone from "@tokenring-ai/utility/object/deepClone";
import bundledAgents from "./agents";
import audio from "./audio.yaml" with { type: "yaml" };
import chat from "./chat.yaml" with { type: "yaml" };
import imageGeneration from "./imageGeneration.yaml" with { type: "yaml" };
import lifecycle from "./lifecycle.yaml" with { type: "yaml" };
import sandbox from "./sandbox.yaml" with { type: "yaml" };

export default deepClone(bundledAgents, chat, audio, lifecycle, imageGeneration, sandbox);
