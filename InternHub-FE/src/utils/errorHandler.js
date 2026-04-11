/**
 * Sanitize error messages from backend to prevent exposing sensitive information
 * Filters out SQL errors, database errors, stack traces, and other technical details
 */

const SENSITIVE_PATTERNS = [
  /SQL\s+(syntax\s+)?error/gi,
  /SQLSTATE/gi,
  /database\s+error/gi,
  /constraint\s+violation/gi,
  /foreign\s+key/gi,
  /duplicate\s+entry/gi,
  /table.+doesn.t.+exist/gi,
  /column.+doesn.t.+exist/gi,
  /syntax\s+error/gi,
  /undefined\s+variable/gi,
  /call\s+to\s+undefined/gi,
  /stack\s+trace/gi,
  /at\s+line\s+\d+/gi,
  /\/[a-z0-9_/\-\.]+\.(php|js|python|java)/gi,
  /https?:\/\/[^\s]+/g,
  /\[.+?\]/g,
  /Exception:|Error:/gi,
];

const FRIENDLY_MESSAGES = {
  '1062': 'This data already exists in the system.',
  '1064': 'There was a problem with the request. Please check your input.',
  '1451': 'This record is being used and cannot be deleted.',
  '2002': 'Unable to connect to server. Please try again later.',
  '2006': 'Connection lost. Please refresh and try again.',
};

/**
 * Sanitize error message - remove sensitive information
 * @param {string} message - Raw error message from backend
 * @returns {string} Sanitized message
 */
export const sanitizeErrorMessage = (message) => {
  if (!message || typeof message !== 'string') return '';
  
  let sanitized = String(message).trim();
  
  // Check for known SQL error codes and replace with friendly messages
  for (const [code, friendlyMsg] of Object.entries(FRIENDLY_MESSAGES)) {
    if (sanitized.includes(code)) {
      return friendlyMsg;
    }
  }
  
  // Remove sensitive patterns
  SENSITIVE_PATTERNS.forEach(pattern => {
    sanitized = sanitized.replace(pattern, '');
  });
  
  // Clean up extra spaces
  sanitized = sanitized.replace(/\s+/g, ' ').trim();
  
  // If message is empty after sanitization, return empty string
  if (!sanitized || sanitized.length < 3) return '';
  
  // Cap message to reasonable length
  return sanitized.length > 200 ? sanitized.substring(0, 200) + '...' : sanitized;
};

/**
 * Get safe error message from error object
 * @param {Error|Object} err - Error object
 * @param {string} fallback - Fallback message if extraction fails
 * @returns {string} Safe error message
 */
export const getSafeErrorMessage = (err, fallback = 'Something went wrong') => {
  if (!err) return fallback;
  
  try {
    // Priority 1: Check response status for specific handling
    if (err?.response?.status) {
      switch (err.response.status) {
        case 400:
          return sanitizeErrorMessage(err.response.data?.message) || 'Please check your input and try again.';
        case 401:
          return sanitizeErrorMessage(err.response.data?.message) || 'You are not authorized to perform this action.';
        case 403:
          return 'You do not have permission to access this resource.';
        case 404:
          return 'The requested resource was not found.';
        case 422:
          // Validation errors
          if (err.response.data?.errors) {
            const errors = err.response.data.errors;
            if (typeof errors === 'object') {
              const firstError = Object.values(errors)[0];
              if (Array.isArray(firstError)) {
                return sanitizeErrorMessage(firstError[0]) || fallback;
              }
            }
          }
          return sanitizeErrorMessage(err.response.data?.message) || 'Validation failed. Please check your input.';
        case 500:
          return 'Server error. Please try again later.';
        case 503:
          return 'Server is temporarily unavailable. Please try again later.';
        default:
          break;
      }
    }
    
    // Priority 2: Check response data message
    if (err?.response?.data?.message) {
      const sanitized = sanitizeErrorMessage(err.response.data.message);
      if (sanitized) return sanitized;
    }
    
    // Priority 3: Check error message
    if (err?.message) {
      const sanitized = sanitizeErrorMessage(err.message);
      if (sanitized) return sanitized;
    }
    
    // Priority 4: Check data property (for axios response)
    if (typeof err?.data === 'string') {
      const sanitized = sanitizeErrorMessage(err.data);
      if (sanitized) return sanitized;
    }
  } catch (e) {
    console.error('Error while processing error message:', e);
  }
  
  return fallback;
};

/**
 * Log error to console (development only) with full details
 * @param {string} context - Context of the error (e.g., "fetchInterns")
 * @param {Error|Object} err - Error object
 */
export const logError = (context = '', err = null) => {
  if (import.meta.env.DEV) {
    console.error(`[${context}]`, err);
  }
};
