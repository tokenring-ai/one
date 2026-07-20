import deepClone from "@tokenring-ai/utility/object/deepClone";
import codingAgents from "./agents/coding";
import specializedCodingAgents from "./agents/specialized";
import audio from "./audio.yaml" with { type: "yaml" };
import chat from "./chat.yaml" with { type: "yaml" };
import imageGeneration from "./imageGeneration.yaml" with { type: "yaml" };
import lifecycle from "./lifecycle.yaml" with { type: "yaml" };
import sandbox from "./sandbox.yaml" with { type: "yaml" };

export default deepClone(codingAgents, specializedCodingAgents, chat, audio, lifecycle, imageGeneration, sandbox);
