/**
 * Fetch an authenticated blob (image/file) using the native fetch() API.
 * Unlike axios (XHR), fetch() does NOT log 404/error responses to the browser console.
 *
 * @param {string} url - Relative API path or full URL
 * @returns {Promise<string|null>} Blob object URL or null on failure
 */
export const fetchSecureBlob = async (url) => {
  const blob = await fetchSecureRawBlob(url);
  if (!blob) return null;
  return URL.createObjectURL(blob);
};

/**
 * Fetch an authenticated raw Blob using the native fetch() API.
 * Returns the actual Blob object (useful when you need to create File objects or inspect mime type).
 *
 * @param {string} url - Relative API path or full URL
 * @returns {Promise<Blob|null>} Raw Blob or null on failure
 */
export const fetchSecureRawBlob = async (url) => {
  const token = localStorage.getItem('token');
  const baseURL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/+$/, '');

  let cleanPath = url;

  // If it's a full URL, extract the API path portion
  if (cleanPath.startsWith('http://') || cleanPath.startsWith('https://')) {
    try {
      const parsed = new URL(cleanPath);
      const apiIndex = parsed.pathname.indexOf('/api/');
      if (apiIndex !== -1) {
        cleanPath = parsed.pathname.substring(apiIndex + 5);
      } else {
        cleanPath = parsed.pathname.replace(/^\/+/, '');
      }
    } catch {
      cleanPath = cleanPath.replace(/^\/+/, '');
    }
  }

  // Remove leading slashes
  cleanPath = cleanPath.replace(/^\/+/, '');

  const fullUrl = `${baseURL}/${cleanPath}`;

  try {
    const res = await fetch(fullUrl, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) return null;
    const blob = await res.blob();
    // 204 No Content = silently missing (dev proxy converts 404 → 204 for photo endpoints)
    if (!blob || blob.size === 0) return null;
    return blob;
  } catch {
    return null;
  }
};
