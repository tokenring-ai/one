import deepClone from "@tokenring-ai/utility/object/deepClone";
import codingAgents from "./coding";
import communicationAgents from "./communication";
import writingAgents from "./writing";

/**
 * Every agent type bundled with the app itself (plugins ship their own under
 * plugin/<name>/config/agents). Several first-party apps look these up by
 * exact name: Documents needs `writer`, Messaging `messaging`, Social `social`.
 */
export default deepClone(codingAgents, writingAgents, communicationAgents);
