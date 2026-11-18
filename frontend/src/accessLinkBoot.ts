import { startAccessLinkRedeem } from "./lib/accessLink.ts";

/**
 * Must be the FIRST import of main.tsx: ES modules evaluate in import order, so the access token is removed from the
 * address bar before the router, the RPC client or any other module of the app has been evaluated. There are no
 * third-party scripts on the page (index.html loads only this bundle), so nothing runs earlier; an inline script in
 * index.html would gain only a few milliseconds and would have to hand the token to the app through a global.
 */
export const accessLinkRedeem = startAccessLinkRedeem({ location: window.location, history: window.history, fetch: window.fetch });
