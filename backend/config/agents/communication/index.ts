import type { AgentPackageConfig } from "@tokenring-ai/agent/schema";
import deepClone from "@tokenring-ai/utility/object/deepClone";
import messaging from "./messaging.yaml" with { type: "yaml" };
import social from "./social.yaml" with { type: "yaml" };

/**
 * Communication agents. `messaging` backs the Messaging app (first of the
 * frontend's MESSAGING_AGENT_TYPES) and `social` the Social app's launcher.
 */
export default deepClone(messaging, social) satisfies AgentPackageConfig;
