import type { AgentPackageConfig } from "@tokenring-ai/agent/schema";
import deepClone from "@tokenring-ai/utility/object/deepClone";
import code from "./code.yaml" with { type: "yaml" };
import leader from "./leader.yaml" with { type: "yaml" };
import plan from "./plan.yaml" with { type: "yaml" };
import searchAgent from "./search-agent.yaml" with { type: "yaml" };
import swarm from "./swarm.yaml" with { type: "yaml" };

// Research agent config lives in @tokenring-ai/research (plugin config).
export default deepClone(code, leader, plan, swarm, searchAgent) satisfies AgentPackageConfig["agents"];
