import type { AgentPackageConfig } from "@tokenring-ai/agent/schema";
import writer from "./writer.yaml" with { type: "yaml" };

/** Writing agents. `writer` backs the Documents app's AI edit (frontend WRITER_AGENT_TYPE). */
export default writer satisfies AgentPackageConfig;
