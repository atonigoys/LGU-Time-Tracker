import { getToken, clearSession } from "./storage";
import type { ApiResponse } from "./types";

const APPS_SCRIPT_URL = process.env.NEXT_PUBLIC_APPS_SCRIPT_URL;

class ApiError extends Error {}

/**
 * Calls the deployed Apps Script Web App, which is the sole API surface in
 * front of Google Sheets (nothing here ever touches the spreadsheet
 * directly). Uses a `text/plain` content type deliberately: Apps Script Web
 * Apps don't implement a CORS preflight (OPTIONS) handler, so a POST with
 * `application/json` would be blocked by the browser - `text/plain` is a
 * "simple request" and skips the preflight, while the server still parses
 * the body as JSON (it never actually reads the header).
 */
export async function call<T = Record<string, unknown>>(
  action: string,
  payload: Record<string, unknown> = {}
): Promise<T> {
  if (!APPS_SCRIPT_URL) {
    throw new ApiError("NEXT_PUBLIC_APPS_SCRIPT_URL is not configured.");
  }

  const token = getToken();
  const body: Record<string, unknown> = { action, ...payload };
  if (token && !body.token) body.token = token;

  const send = () =>
    fetch(APPS_SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(body),
    });

  let res: Response;
  try {
    res = await send();
    // Apps Script answers 404 for a moment while a new version is being
    // deployed. The script never ran, so one retry can't duplicate anything.
    if (res.status === 404) {
      await new Promise((r) => setTimeout(r, 2000));
      res = await send();
    }
  } catch {
    throw new ApiError("Could not reach the server. Check your internet connection.");
  }

  if (!res.ok) {
    console.error(`Apps Script responded with HTTP ${res.status}`);
    throw new ApiError(
      res.status === 404
        ? "The server is being updated. Please try again in a moment."
        : "The server is temporarily unavailable. Please try again."
    );
  }

  const json = (await res.json()) as ApiResponse<T>;
  if (!json.success) {
    if (/expired|log in again/i.test(json.error)) {
      clearSession();
      if (typeof window !== "undefined" && window.location.pathname !== "/login") {
        window.location.href = "/login";
      }
    }
    throw new ApiError(json.error);
  }

  const { success: _success, ...rest } = json;
  void _success;
  return rest as T;
}
