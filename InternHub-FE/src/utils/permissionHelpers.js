/**
 * Check if a permission name exists in the user's permissions array.
 * @param {string[]} permissions - Array of permission names from /api/user
 * @param {string} permissionName - Permission name to check (e.g. 'view_dashboard')
 * @returns {boolean}
 */
export const hasPermission = (permissions, permissionName) => {
  if (!Array.isArray(permissions)) return false;
  return permissions.includes(permissionName);
};

export const normalizeLabel = (label) => {
  if (!label && label !== 0) return '';
  return String(label)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, '_');
};

export const labelsFromEntries = (entries = []) => {
  const s = new Set();
  if (!Array.isArray(entries)) return s;
  entries.forEach((e) => {
    if (!e) return;
    // prefer label, then name, then fallback to textual id
    const text = e.label || e.name || e.permission_name || e.slug || e.permission || '';
    if (e.effective) s.add(normalizeLabel(text));
  });
  return s;
};
