/**
 * OledCare node half. The plugin is browser-only: this empty apply exists so
 * the host Loader can mount the row and the client module system can scan the
 * package's dsh.client declaration into the browser roster. The browser half
 * lives in client.js.
 */

/** Cordis plugin name. */
export const name = 'oled-care'

/** No host-side service dependencies. */
export const inject = []

/** Mount the node half (intentionally empty). */
export function apply() {}
