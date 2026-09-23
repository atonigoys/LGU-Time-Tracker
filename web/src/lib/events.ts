/**
 * Fired on window after any successful write to the server, so cached reads
 * can be marked outdated. Lives in its own module with no imports because
 * api -> storage -> cache -> api is a cycle; a constant exported from api.ts
 * isn't initialized yet when cache.ts first runs.
 */
export const DATA_CHANGED_EVENT = "lgu:data-changed";
