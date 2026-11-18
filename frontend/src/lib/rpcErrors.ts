import formatError from "@tokenring-ai/utility/error/formatError";

/** JSON-RPC code the server's central gate answers with when a member calls an administrator-only method. */
export const ADMIN_REQUIRED_CODE = -32003;

export const ADMIN_REQUIRED_MESSAGE = "This needs an administrator.";

export function isAdminRequiredError(error: unknown): boolean {
  // Duck-typed on purpose: the RPC client module is mocked wholesale in many tests, and this is only ever asked about its errors.
  return error instanceof Error && error.name === "RPCError" && (error as Error & { code?: unknown }).code === ADMIN_REQUIRED_CODE;
}

/** A short message for people: the administrator-only refusal in plain words, anything else as the error says. */
export function describeRpcError(error: unknown): string {
  if (isAdminRequiredError(error)) return ADMIN_REQUIRED_MESSAGE;
  return error instanceof Error ? error.message || error.name : formatError(error, { includeStack: false });
}

/**
 * The server's refusal as text (toasts get strings, not errors): "RPCError: Administrator access required." becomes
 * the plain sentence. Anything else passes through untouched.
 */
export function plainAdminRefusal(message: string): string {
  return message.replace(/(?:RPCError:\s*)?Administrator access required\.?/g, ADMIN_REQUIRED_MESSAGE);
}
