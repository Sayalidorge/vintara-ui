// Global fetch interceptor: if a request that carried a Bearer token comes back
// 401 (not authenticated - missing/invalid/expired token), clear the session and
// send the user back to the login page. 403 (authenticated but not permitted for
// this action, e.g. wrong role) is left alone - that's a normal error, not a
// reason to log out. Installed once at app startup so none of the existing
// fetch() call sites need to change.
import config from "../config";

function hasAuthHeader(headers) {
  if (!headers) return false;
  if (headers instanceof Headers) {
    return headers.has("Authorization") || headers.has("authorization");
  }
  return Object.prototype.hasOwnProperty.call(headers, "Authorization") ||
    Object.prototype.hasOwnProperty.call(headers, "authorization");
}

const originalFetch = window.fetch.bind(window);

window.fetch = async (input, init) => {
  const response = await originalFetch(input, init);

  const url = typeof input === "string" ? input : input?.url;
  const isApiCall = typeof url === "string" && url.startsWith(config.BASE_URL);
  const wasAuthenticatedCall = hasAuthHeader(init?.headers);

  if (isApiCall && wasAuthenticatedCall && response.status === 401) {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    if (window.location.pathname !== "/") {
      window.location.href = "/";
    }
  }

  return response;
};
