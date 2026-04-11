import React, { useState, useRef, useEffect } from 'react';
import {
  Search,
  Filter,
  Plus,
  Edit2,
  Trash2,
  X,
  Check,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Calendar,
  Clock,
  MapPin
} from 'lucide-react';

import { motion, AnimatePresence } from 'framer-motion';
import apiClient from '../../../api/axiosConfig';
import { getSafeErrorMessage, logError } from '../../../utils/errorHandler';

// --- STYLE CONSTANTS ---
const colors = {
  primary: "#354C8F",
  primaryHover: "#2a3c70",
  textDark: "#203266",
  bgLight: "#F8F9FD"
};

// Button Styles
const btnPrimary = `bg-[#354C8F] hover:bg-[#2a3c70] text-white py-3 px-4 md:px-6 rounded-xl font-bold text-[14px] shadow-md shadow-indigo-200 flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed`;
const btnSecondary = `bg-white border border-slate-300 text-slate-700 py-3 px-4 md:px-6 rounded-xl font-bold text-[14px] hover:bg-slate-50 transition-all active:scale-95`;
// Utility class to hide button label text on small screens (show only icons)
const actionText = 'hidden sm:inline-block';

const UserRoleManagement = () => {
  // --- ALL STATE DECLARATIONS ---
  // Users (fetched from API)
  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  // Available roles fetched from backend (for reliable mapping)
  const [availableRoles, setAvailableRoles] = useState([]);

  // Modal Visibility Controls
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [showFormModal, setShowFormModal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);

  const [formMode, setFormMode] = useState("add");
  const [selectedUser, setSelectedUser] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  // formData.role is an array to allow selecting multiple roles (max 2)
  const [formData, setFormData] = useState({
    name: "",
    nip: "",
    email: "",
    role: ['Intern'],
    status: "Active",
    // Extended fields (match InternProfile)
    university: "",
    division: "",
    jobPosition: "",
    placement: "SIER",
    // Period split into start/end dates (Date objects)
    periodStart: null,
    periodEnd: null,
    workSchedule: "",
    major: "",
    semester: "",
    whatsapp: ""
  });

  const [confirmType, setConfirmType] = useState(null);
  const [statusType, setStatusType] = useState(null);
  const [statusMessage, setStatusMessage] = useState({ title: "", desc: "" });
  const [deleteConfirmChecked, setDeleteConfirmChecked] = useState(false);

  // Current signed-in user (read from localStorage `user_profile`) — used to protect self-actions
  const currentUserProfile = (() => {
    try {
      const raw = localStorage.getItem('user_profile');
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  })();
  const currentUserId = currentUserProfile?.user_id ?? currentUserProfile?.id ?? currentUserProfile?.userId ?? null;
  const currentUserRoles = (() => {
    try {
      const p = currentUserProfile;
      if (!p) return [];
      if (Array.isArray(p.roles)) return p.roles.map(r => (r.name || r.label || r).toString());
      if (p.role) return String(p.role).split(',').map(s => s.trim());
      return [];
    } catch (e) { return []; }
  })();
  const isCurrentUserAdmin = currentUserRoles.some(r => normalizeRole(r) === 'Admin');

  // Add New: User selection by role (InternProfile vs SSO)
  const [internOptions, setInternOptions] = useState([]);
  const [internsLoading, setInternsLoading] = useState(false);
  const [ssoOptions, setSsoOptions] = useState([]);
  const [ssoLoading, setSsoLoading] = useState(false);
  const [userSearch, setUserSearch] = useState("");
  const [selectedUserIds, setSelectedUserIds] = useState([]);
  const [allUserKeys, setAllUserKeys] = useState([]);
  // When true, the Add form is restricted to Intern role only (used by "Add Role Intern" button)
  const [forceInternOnly, setForceInternOnly] = useState(false);

  // Validation state: map field -> error message
  const [validationErrors, setValidationErrors] = useState({});

  const validateFormFields = () => {
    const errs = {};
    const roles = Array.isArray(formData.role) ? formData.role : (formData.role ? [formData.role] : []);

    if (formMode === 'add') {
      if (!selectedUserIds || selectedUserIds.length === 0) errs.selectedUsers = 'Please select at least one user';
      if (!formData.role || (Array.isArray(formData.role) && formData.role.length === 0)) errs.role = 'Please select at least one role';
      if (!formData.status) errs.status = 'Status is required';
      return errs;
    }

    // Edit mode: Role + Status only
    if (!formData.role || (Array.isArray(formData.role) && formData.role.length === 0)) errs.role = 'Please select at least one role';
    if (!formData.status) errs.status = 'Status is required';

    // Security: prevent an admin from deactivating their *own* admin account
    if (formMode === 'edit' && selectedUser && currentUserId && String(selectedUser.id) === String(currentUserId) && isCurrentUserAdmin) {
      if (String(formData.status).toLowerCase() === 'inactive') {
        errs.status = 'You cannot deactivate your own admin account.';
      }
    }

    return errs;
  };

  // Helper to set field and clear its validation error
  const setField = (k, v) => {
    setFormData(prev => ({ ...prev, [k]: v }));
    setValidationErrors(prev => {
      if (!prev || !prev[k]) return prev;
      const copy = { ...prev };
      delete copy[k];
      return copy;
    });
  };

  // Site (Office Location) list loaded from backend (/admin/sites)
  const [sites, setSites] = useState([]);
  const [sitesLoading, setSitesLoading] = useState(false);
  // Custom dropdown state for Office Location (styled popup with rounded corners)
  const [siteOpen, setSiteOpen] = useState(false);
  const siteRef = useRef(null);

  // Work schedule list loaded from backend (/admin/work-schedules)
  const [workSchedules, setWorkSchedules] = useState([]);
  const [workSchedulesLoading, setWorkSchedulesLoading] = useState(false);
  // Custom dropdown state for work schedules
  const [workOpen, setWorkOpen] = useState(false);
  const workRef = useRef(null);

  // Custom dropdown state for divisions
  const [divisionOpen, setDivisionOpen] = useState(false);
  const divisionRef = useRef(null);

  const fetchSites = async () => {
    setSitesLoading(true);
    try {
      const res = await apiClient.get('/admin/sites');
      const payload = res.data || {};
      const items = (payload.data || []).map(s => ({ id: s.id_site, name: s.nama_site }));
      setSites(items);
      // Auto-select first site when available IF current placement isn't a valid site
      if (items.length > 0) {
        setFormData(prev => {
          const currentPlacement = prev?.placement || '';
          const exists = items.find(si => si.name === currentPlacement);
          if (exists) return prev; // keep user selection or edit value
          // default to first site name
          return { ...prev, placement: items[0].name };
        });
      }
    } catch (err) {
      console.warn('Could not fetch sites', err);
      setSites([]);
    } finally {
      setSitesLoading(false);
    }
  };

  const fetchWorkSchedules = async () => {
    setWorkSchedulesLoading(true);
    try {
      const res = await apiClient.get('/admin/work-schedules');
      const payload = res.data || {};
      let items = (payload.data || []).map(w => ({ id: w.id, name: w.name, start_time: w.start_time, end_time: w.end_time }));
      // Prefer default schedules if present: 'Normal (Senin-Kamis)' and 'Jumat' go first
      const preferred = ['normal (senin-kamis)', 'jumat'];
      items = items.sort((a, b) => {
        const ai = preferred.findIndex(p => a.name.toString().trim().toLowerCase().includes(p));
        const bi = preferred.findIndex(p => b.name.toString().trim().toLowerCase().includes(p));
        if (ai === -1 && bi === -1) return 0;
        if (ai === -1) return 1;
        if (bi === -1) return -1;
        return ai - bi;
      });
      setWorkSchedules(items);
      // Auto-select first schedule when available if current value is not valid
      if (items.length > 0) {
        setFormData(prev => {
          const current = prev?.workSchedule || '';
          const exists = items.find(ws => ws.name === current);
          if (exists) return prev;
          return { ...prev, workSchedule: items[0].name };
        });
      }
    } catch (err) {
      console.warn('Could not fetch work schedules', err);
      setWorkSchedules([]);
    } finally {
      setWorkSchedulesLoading(false);
    }
  };

  const [divisions, setDivisions] = useState([]);
  const [divisionsLoading, setDivisionsLoading] = useState(false);

  const fetchDivisions = async () => {
    setDivisionsLoading(true);
    try {
      // User request: "fetch dari api/available-divisions"
      const res = await apiClient.get('/available-divisions');
      const data = res.data?.data || res.data || [];
      // Normalize data: array of strings or objects? Usually simple array of names or objects with id/name
      // Assuming it returns objects {id, name} or just names. Let's support both.
      // If just strings, map to objects.
      const items = Array.isArray(data) ? data.map(d => typeof d === 'string' ? { name: d } : d) : [];
      setDivisions(items);
    } catch (err) {
      console.warn('Failed to fetch divisions', err);
    } finally {
      setDivisionsLoading(false);
    }
  };

  const [filter, setFilter] = useState({ role: [], status: [], date: "" });

  // Applied filters (only used when user clicks Apply)
  const [appliedFilterType, setAppliedFilterType] = useState([]);
  const [appliedFilterStatus, setAppliedFilterStatus] = useState([]);
  const [appliedFilterDate, setAppliedFilterDate] = useState("");

  // Pagination Logic
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // Pagination metadata from server
  const [paginationMeta, setPaginationMeta] = useState({ current_page: 1, last_page: 1, from: 0, to: 0, total: 0 });

  // --- HELPER FUNCTIONS ---
  // Helper to normalize role names to 'Admin' | 'Mentor' | 'Intern' for UI
  const normalizeRole = (roleNameOrLabel) => {
    if (!roleNameOrLabel) return '';
    const r = String(roleNameOrLabel).toLowerCase();
    if (r.includes('admin')) return 'Admin';
    if (r.includes('mentor') || r.includes('pembimbing')) return 'Mentor';
    if (r.includes('intern') || r.includes('mahasiswa')) return 'Intern';
    // fallback: capitalize
    return roleNameOrLabel.charAt(0).toUpperCase() + roleNameOrLabel.slice(1);
  };

  // Map role display name to role_id used by backend (fallback)
  const ROLE_NAME_TO_ID = {
    Admin: 1,
    Mentor: 2,
    Intern: 3
  };

  // Helper: format Date -> YYYY-MM-DD
  const fmtDate = (d) => {
    if (!d) return '';
    if (typeof d === 'string') return d;
    try { return d.toISOString().split('T')[0]; } catch (e) { return ''; }
  };

  // Short human-friendly date for UI (e.g. "1 Jan 2026")
  const fmtDateShort = (d) => {
    if (!d) return '';
    const date = (typeof d === 'string') ? new Date(d) : d;
    if (!date || Number.isNaN(date.getTime())) return '';
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  // Normalize a period string like "2026-01-01 - 2026-06-30" to "1 Jan 2026 - 30 Jun 2026"
  const formatPeriodString = (p) => {
    if (!p) return '';
    const parts = String(p).split(' - ').map(x => x.trim());
    if (parts.length === 2) {
      const s = new Date(parts[0]);
      const e = new Date(parts[1]);
      if (!Number.isNaN(s.getTime()) && !Number.isNaN(e.getTime())) {
        return `${fmtDateShort(s)} - ${fmtDateShort(e)}`;
      }
    }
    return p;
  };

  // --- API FETCH FUNCTIONS ---
  const fetchRoles = async () => {
    try {
      const res = await apiClient.get('admin/roles');
      const payload = res.data || {};
      const rolesData = Array.isArray(payload.data) ? payload.data : Array.isArray(payload) ? payload : [];
      if (rolesData && rolesData.length > 0) {
        setAvailableRoles(rolesData);
      }
    } catch (err) {
      console.warn('Could not fetch roles list, falling back to hard-coded map', err);
    }
  };

  const fetchUsers = async (page = 1, search = "", filters = {}, ignoreFilters = false, forceFetch = false) => {
    // do not hit the API while the add/edit user modal is visible –
    // user just wants to pick interns, we don’t need pagination updates
    if (showFormModal && !forceFetch) {
      console.log('[UserRole] fetchUsers skipped because form modal is open');
      return;
    }

    setLoadingUsers(true);
    try {
      const params = { page, per_page: itemsPerPage };

      // Add search parameter only when not ignoring filters/search
      if (!ignoreFilters && search) params.q = search;

      // Add filter parameters (adjusted based on backend expectations)
      if (!ignoreFilters && filters && Object.keys(filters).length > 0) {
        if (filters.role && filters.role.length > 0) {
          // Try sending as comma-separated role_ids
          const roleIds = filters.role.map(roleName => {
            const normalized = normalizeRole(roleName);
            return ROLE_NAME_TO_ID[normalized] || ROLE_NAME_TO_ID[roleName];
          }).filter(Boolean);
          if (roleIds.length > 0) params.role_id = roleIds.join(',');
        }

        if (filters.status && filters.status.length > 0) {
          params.status = filters.status.map(s => s.toLowerCase()).join(',');
        }

        // Use created_month (YYYY-MM) for month filtering (backend expects created_month)
        if (filters.date) params.created_month = filters.date;
      }

      console.log('Fetching users with params:', params, { ignoreFilters });

      const res = await apiClient.get('admin/users', { params });
      const payload = res.data || {};
      // API returns paginated data directly in res.data (not wrapped in a 'data' field)
      if (payload && payload.data && Array.isArray(payload.data)) {
        let mapped = (payload.data || []).map(u => {
          // Period handling (mulai_magang / akhir_magang)
          let periodStr = '';
          if (u.mulai_magang || u.akhir_magang) {
            const s = u.mulai_magang ? new Date(u.mulai_magang) : null;
            const e = u.akhir_magang ? new Date(u.akhir_magang) : null;
            if (s && e) periodStr = `${s.toISOString().split('T')[0]} - ${e.toISOString().split('T')[0]}`;
            else if (s) periodStr = s.toISOString().split('T')[0];
          } else if (u.period) {
            periodStr = u.period;
          }

          return ({
            id: u.user_id,
            name: u.nama_lengkap || u.nama,
            nip: u.identifier,
            email: u.email,
            // Use role string directly from API response (already normalized: "admin, mentor" or "intern")
            role: u.role || 'Intern',
            status: u.status === 'active' ? 'Active' : 'Inactive',
            dateAdded: u.created_at ? u.created_at.split('T')[0] : '',
            updatedAt: u.updated_at ? u.updated_at.split('T')[0] : '',
            rawRoles: u.roles || [], // Keep raw roles for filtering

            // Keep original raw payload for downstream logic (detect mahasiswa vs user)
            raw: u,

            // Extended profile fields (map backend naming differences)
            university: u.universitas || u.university || '',
            division: u.division || u.divisi || u.job_position || '',
            major: u.jurusan || u.major || '',
            semester: u.semester || '',
            whatsapp: u.no_telp || u.whatsapp || '',
            workSchedule: u.workSchedule || u.work_schedule || '',

            // Site / placement
            placement: (u.site && (u.site.nama_site || u.site.name)) || (u.id_site ? (u.id_site === 1 ? 'SIER' : (u.id_site === 2 ? 'PIER' : String(u.id_site))) : ''),

            // period for edit parsing
            period: periodStr,
            is_self: Boolean(u.is_self)
          });
        });

        // Client-side filtering only if we did not ask backend to filter by role
        if (!params.role_id && filters.role && filters.role.length > 0) {
          mapped = mapped.filter(user => {
            // Check if user has any of the selected roles
            const userRoleNames = String(user.role || '').split(',').map(r => r.trim());
            return filters.role.some(selectedRole => userRoleNames.includes(selectedRole));
          });
        }

        if (filters.date) {
          // filter locally by created date month (dateAdded is YYYY-MM-DD)
          mapped = mapped.filter(user => user.dateAdded && user.dateAdded.startsWith(filters.date));
        }

        setUsers(mapped);
        setPaginationMeta({
          current_page: payload.current_page || page,
          last_page: payload.last_page || 1,
          from: payload.from || ((page - 1) * itemsPerPage) + 1,
          to: payload.to || ((page - 1) * itemsPerPage) + mapped.length,
          total: payload.total || mapped.length
        });
        setCurrentPage(payload.current_page || page);
      }
    } catch (e) {
      console.error('Error fetching users:', e);
    } finally {
      setLoadingUsers(false);
    }
  };

  const fetchInternOptions = async () => {
    setInternsLoading(true);
    try {
      // only retrieve mahasiswa entries that do *not* yet have a user account
      // backend provides a dedicated route for this
      const res = await apiClient.get('/admin/mahasiswa/no-user', {
        params: {
          page: 1,
          per_page: 200
        }
      });
      const payload = res.data || {};
      const mapped = (payload.data || []).map(i => ({
        // always use the mahasiswa identifier as the primary key for selection
        id: i.id_mahasiswa,
        // record original user account id when present
        userId: i.user?.user_id || i.user_id || null,
        name: i.nama_lengkap || i.nama || '',
        nip: i.identifier || i.nim || '',
        email: i.email || (i.user && i.user.email) || '',
        role: (i.user && i.user.roles && i.user.roles[0]) ? normalizeRole(i.user.roles[0].name || i.user.roles[0].label) : (i.user?.level ? normalizeRole(i.user.level) : 'Intern'),
        hasUserAccount: Boolean(i.user?.user_id || i.user?.id || i.user_id || i.user?.id_user || i.user?.userId),
        id_mahasiswa: i.id_mahasiswa,
        status: i.status || 'active',
        raw: i
      }));
      setInternOptions(mapped);
    } catch (e) {
      console.error('Error fetching intern options:', e);
      setInternOptions([]);
    } finally {
      setInternsLoading(false);
    }
  };

  const fetchAllUserKeys = async () => {
    try {
      const perPage = 200;
      let page = 1;
      let lastPage = 1;
      const keys = [];
      do {
        const res = await apiClient.get('admin/users', { params: { page, per_page: perPage } });
        const payload = res.data || {};
        const data = payload.data || [];
        data.forEach(u => {
          if (u.identifier) keys.push(String(u.identifier).trim().toLowerCase());
          if (u.nip) keys.push(String(u.nip).trim().toLowerCase());
          if (u.email) keys.push(String(u.email).trim().toLowerCase());
        });
        lastPage = payload.last_page || 1;
        page += 1;
      } while (page <= lastPage && page <= 5);
      setAllUserKeys(keys);
    } catch (err) {
      console.error('Failed to fetch all user keys:', err);
      setAllUserKeys([]);
    }
  };

  const fetchSsoOptions = async (roleNames) => {
    setSsoLoading(true);
    try {
      const roleParam = Array.isArray(roleNames)
        ? roleNames.map(r => String(r).toLowerCase()).join(',')
        : (roleNames ? String(roleNames).toLowerCase() : undefined);
      const res = await apiClient.get('/admin/sso-users', {
        params: roleParam ? { role: roleParam } : undefined
      });
      const list = res.data?.data || res.data || [];
      const mapped = Array.isArray(list) ? list.map(u => ({
        id: u.user_id || u.id || u.uid,
        name: u.nama_lengkap || u.name || u.full_name || u.username || '- ',
        nip: u.identifier || u.nip || u.nik || '',
        email: u.email || '',
        role: normalizeRole(u.role || u.level || u.type || (Array.isArray(roleNames) ? roleNames[0] : roleNames))
      })) : [];
      setSsoOptions(mapped.filter(u => u.id));
    } catch (e) {
      console.error('Error fetching SSO users:', e);
      setSsoOptions([]);
    } finally {
      setSsoLoading(false);
    }
  };

  const toggleUserSelection = (id) => {
    setSelectedUserIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
    setValidationErrors(prev => {
      if (!prev || !prev.selectedUsers) return prev;
      const copy = { ...prev };
      delete copy.selectedUsers;
      return copy;
    });
  };

  // --- EFFECTS ---
  // initial load
  React.useEffect(() => {
    fetchRoles();
    fetchUsers(1);
    fetchSites();
    fetchWorkSchedules();
    fetchDivisions();
  }, []);


  React.useEffect(() => {
    const handleClickOutsideWork = (e) => {
      if (workRef.current && !workRef.current.contains(e.target)) setWorkOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutsideWork);
    return () => document.removeEventListener('mousedown', handleClickOutsideWork);
  }, []);

  // Close site dropdown when clicking outside
  React.useEffect(() => {
    const handleClickOutsideSite = (e) => {
      if (siteRef.current && !siteRef.current.contains(e.target)) setSiteOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutsideSite);
    return () => document.removeEventListener('mousedown', handleClickOutsideSite);
  }, []);

  // Close division dropdown when clicking outside
  React.useEffect(() => {
    const handleClickOutsideDivision = (e) => {
      if (divisionRef.current && !divisionRef.current.contains(e.target)) setDivisionOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutsideDivision);
    return () => document.removeEventListener('mousedown', handleClickOutsideDivision);
  }, []);

  // Debounced search and filter effect (skip on initial mount)
  const isInitialMount = React.useRef(true);
  React.useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    const timer = setTimeout(() => {
      fetchUsers(1, searchTerm, {
        role: appliedFilterType,
        status: appliedFilterStatus,
        date: appliedFilterDate
      });
    }, 500);
    return () => clearTimeout(timer);
  }, [searchTerm, appliedFilterType, appliedFilterStatus, appliedFilterDate]);

  // Refetch when itemsPerPage changes
  React.useEffect(() => {
    fetchUsers(1, searchTerm, {
      role: appliedFilterType,
      status: appliedFilterStatus,
      date: appliedFilterDate
    });
  }, [itemsPerPage]);

  // --- COMPUTED VALUES ---
  // currentItems now come directly from server response (no client-side slicing)
  const currentItems = users;

  // Check if any filters are applied
  const isFilterActive = appliedFilterType.length > 0 || appliedFilterStatus.length > 0 || appliedFilterDate !== "";

  const addRoles = Array.isArray(formData.role) ? formData.role : (formData.role ? [formData.role] : []);
  const hasInternRole = addRoles.includes('Intern');
  const hasAdminRole = addRoles.includes('Admin');
  const hasMentorRole = addRoles.includes('Mentor');
  const addRoleLabel = hasInternRole
    ? 'Intern'
    : (hasAdminRole || hasMentorRole) ? 'Employee' : 'User';

  const existingUserKeys = React.useMemo(() => {
    const keys = new Set();
    (allUserKeys || []).forEach(k => keys.add(String(k).trim().toLowerCase()));
    (users || []).forEach(u => {
      if (u.nip) keys.add(String(u.nip).trim().toLowerCase());
      if (u.email) keys.add(String(u.email).trim().toLowerCase());
    });
    return keys;
  }, [allUserKeys, users]);

  const addUserOptions = hasInternRole
    ? internOptions.filter(i => {
      if (existingUserKeys.has(String(i.nip || '').trim().toLowerCase())) return false;
      if (existingUserKeys.has(String(i.email || '').trim().toLowerCase())) return false;
      return true;
    })
    : ssoOptions.filter(u => {
      if (!u.role) return true;
      const nr = normalizeRole(u.role);
      if (hasAdminRole && nr === 'Admin') return true;
      if (hasMentorRole && nr === 'Mentor') return true;
      return !(hasAdminRole || hasMentorRole);
    });

  const filteredAddUserOptions = addUserOptions.filter(u => {
    const q = userSearch.toLowerCase();
    return (
      (u.name || '').toLowerCase().includes(q) ||
      (u.nip || '').toLowerCase().includes(q) ||
      (u.email || '').toLowerCase().includes(q)
    );
  });

  // --- HANDLERS ---
  const handlePageChange = (page) => {
    if (page >= 1 && page <= paginationMeta.last_page) {
      fetchUsers(page, searchTerm, {
        role: appliedFilterType,
        status: appliedFilterStatus,
        date: appliedFilterDate
      });
    }
  };

  // Fetch single user details for editing
  const fetchUserDetails = async (userId) => {
    try {
      // Prefer mahasiswa endpoint when ID could be a mahasiswa id (fallback to users)
      let u = null;
      try {
        const resM = await apiClient.get(`admin/mahasiswa/${userId}`);
        const payloadM = resM.data || {};
        // payload may return mahasiswa wrapper or raw data
        const m = payloadM.mahasiswa || payloadM;
        if (m) {
          // normalize to shape expected below
          u = {
            user_id: m.user?.user_id || m.user_id || m.id_mahasiswa || userId,
            nama_lengkap: m.nama_lengkap || m.nama || '',
            identifier: m.identifier || m.nim || '',
            email: m.email || (m.user && m.user.email) || '',
            status: m.status || (m.user && m.user.status) || 'active',
            roles: m.user ? (m.user.roles || []) : (m.roles || []),
            universitas: m.universitas || m.university,
            divisi: m.divisi || m.division,
            job_position: m.job_position || m.jobPosition,
            site: m.site,
            work_schedule: m.work_schedule,
            jurusan: m.jurusan || m.major,
            semester: m.semester,
            no_telp: m.no_telp || m.whatsapp,
            // keep raw
            raw_mahasiswa: m
          };
        }
      } catch (maErr) {
        // ignore and fallback to users
      }

      if (!u) {
        const res = await apiClient.get(`admin/users/${userId}`);
        const payload = res.data || {};
        u = payload.user || payload;
      }

      if (u && (u.user_id || u.userId || u.id)) {
        const mapped = {
          name: u.nama_lengkap || u.name || "",
          nip: u.identifier || u.nip || "",
          email: u.email || "",
          status: String(u.status).toLowerCase() === 'active' ? 'Active' : 'Inactive',
          // Map roles: prefer array of objects with name/label
          role: (u.roles && u.roles.length > 0)
            ? u.roles.map(r => normalizeRole(r.label || r.name))
            : (u.level ? [normalizeRole(u.level)] : ['Intern']),

          // Extended fields
          university: u.universitas || u.university || "",
          division: u.divisi || u.division || "",
          jobPosition: u.job_position || u.jobPosition || "",
          placement: (u.site && u.site.nama_site) ? u.site.nama_site : "SIER",
          workSchedule: (u.work_schedule && u.work_schedule.name) ? u.work_schedule.name : "",

          // Dates / Other
          major: u.jurusan || u.major || "",
          semester: u.semester || "",
          whatsapp: u.no_telp || u.whatsapp || "",
        };

        // Handle Period parsing (YYYY-MM-DD from API)
        let pStart = null;
        let pEnd = null;
        if (u.mulai_magang) pStart = new Date(u.mulai_magang);
        if (u.akhir_magang) pEnd = new Date(u.akhir_magang);

        // Fallback: try parsing 'period' string if start/end fields are missing/null
        if ((!pStart || !pEnd) && selectedUser?.period) {
          const splitByRange = String(selectedUser.period).split(' - ').map(p => p.trim());
          if (splitByRange.length === 2) {
            const s = new Date(splitByRange[0]);
            const e = new Date(splitByRange[1]);
            if (!Number.isNaN(s.getTime())) pStart = s;
            if (!Number.isNaN(e.getTime())) pEnd = e;
          }
        }

        setFormData(prev => ({
          ...prev,
          ...mapped,
          periodStart: pStart,
          periodEnd: pEnd
        }));
      }
    } catch (err) {
      console.error("Failed to fetch user details:", err);
    }
  }; 

  const openAddIntern = () => {
    setFormMode('add');
    setValidationErrors({});
    setForceInternOnly(true);
    // ensure role/status defaults are correct for adding interns
    setFormData(prev => ({ ...prev, role: ['Intern'], status: 'Active' }));
    setSelectedUserIds([]);
    setUserSearch('');
    // fetchAllUserKeys();
    fetchInternOptions();
    setShowFormModal(true);
  };

  const closeForm = () => {
    setShowFormModal(false);
    setForceInternOnly(false);
    setSelectedUserIds([]);
  };

  const openForm = (mode, user = null) => {
    setFormMode(mode);
    setValidationErrors({});

    if (mode === 'edit' && user) {
      setSelectedUser(user);

      // 1. Set initial data from the table row (FAST)
      const rolesArray = user.role
        ? user.role.split(',').map(r => normalizeRole(r.trim())).filter(Boolean)
        : [];
      let periodStart = null;
      let periodEnd = null;

      // Try parsing table period string
      if (user.period && typeof user.period === 'string') {
        const splitByRange = user.period.split(' - ').map(p => p.trim());
        if (splitByRange.length === 2) {
          const s = new Date(splitByRange[0]);
          const e = new Date(splitByRange[1]);
          if (!Number.isNaN(s.getTime())) periodStart = s;
          if (!Number.isNaN(e.getTime())) periodEnd = e;
        } else {
          const s = new Date(user.period.trim());
          if (!Number.isNaN(s.getTime())) periodStart = s;
        }
      }

      setFormData({
        ...user,
        role: rolesArray,
        periodStart,
        periodEnd,
        // Ensure fields exist to avoid null errors
        workSchedule: user.workSchedule || "",
        university: user.university || "",
        major: user.major || "",
        semester: user.semester || "",
        whatsapp: user.whatsapp || "",
        division: user.division || "",
        jobPosition: user.jobPosition || "",
        placement: user.placement || "SIER"
      });

      setShowFormModal(true);

    } else {
      setSelectedUser(null);
      setFormData({
        name: "", nip: "", email: "", role: ['Intern'], status: "Active",
        university: "", division: "", jobPosition: "", placement: sites[0]?.name || 'SIER',
        periodStart: null, periodEnd: null,
        workSchedule: workSchedules[0]?.name || "",
        major: "", semester: "", whatsapp: ""
      });
      setSelectedUserIds([]);
      setUserSearch("");
      fetchAllUserKeys();
      fetchInternOptions();
      setShowFormModal(true);
    }
  };

  const toggleFormRole = (r) => {
    if (formMode === 'add') {
      setFormData(prev => {
        const roles = Array.isArray(prev.role) ? [...prev.role] : (prev.role ? [prev.role] : []);

        if (r === 'Intern') {
          const nextRoles = roles.includes('Intern') ? roles.filter(x => x !== 'Intern') : ['Intern'];
          if (nextRoles.length === 0) {
            setSelectedUserIds([]);
            setUserSearch("");
            return { ...prev, role: [] };
          }
          setSelectedUserIds([]);
          setUserSearch("");
          fetchAllUserKeys();
          fetchInternOptions();
          return { ...prev, role: ['Intern'] };
        }

        // Employee (Admin/Mentor) toggle (intern is exclusive)
        let nextRoles = roles.filter(x => x !== 'Intern');
        if (nextRoles.includes(r)) nextRoles = nextRoles.filter(x => x !== r);
        else nextRoles = [...nextRoles, r];

        setSelectedUserIds([]);
        setUserSearch("");
        if (nextRoles.length > 0) fetchSsoOptions(nextRoles);
        return { ...prev, role: nextRoles };
      });
      return;
    }
    setFormData(prev => {
      const roles = Array.isArray(prev.role) ? [...prev.role] : (prev.role ? [prev.role] : []);
      // If selecting 'Intern' make it exclusive
      if (r === 'Intern') {
        if (roles.includes('Intern')) {
          // removing Intern -> clear intern-only fields
          return { ...prev, role: roles.filter(x => x !== 'Intern'), university: '', major: '', semester: '', whatsapp: '', periodStart: null, periodEnd: null, workSchedule: '', jobPosition: '' };
        }
        // set as only role and set defaults for intern-specific fields
        return { ...prev, role: ['Intern'], university: prev.university || '', major: prev.major || '', semester: prev.semester || '', whatsapp: prev.whatsapp || '', workSchedule: prev.workSchedule || workSchedules[0]?.name || '' };
      }

      // If 'Intern' is already selected, disallow selecting other roles
      if (roles.includes('Intern')) {
        setStatusMessage({ title: 'Invalid Selection', desc: 'Intern cannot be combined with other roles.' });
        setStatusType('error');
        setShowStatusModal(true);
        return prev;
      }

      if (roles.includes(r)) return { ...prev, role: roles.filter(x => x !== r) };
      if (roles.length >= 2) {
        // keep limit at 2 but do not show helper text
        setStatusMessage({ title: 'Max Roles', desc: 'You can select up to 2 roles.' });
        setStatusType('error');
        setShowStatusModal(true);
        return prev;
      }
      return { ...prev, role: [...roles, r] };
    });
  };

  const handleFormSubmit = () => {
    const errs = validateFormFields();
    if (Object.keys(errs).length > 0) {
      setValidationErrors(errs);
      // show first error in status modal
      const firstKey = Object.keys(errs)[0];
      setStatusMessage({ title: 'Validation', desc: errs[firstKey] });
      setStatusType('error');
      setShowStatusModal(true);
      return;
    }
    setValidationErrors({});
    setConfirmType(formMode === 'add' ? 'add' : 'save');
    setShowConfirmModal(true); // Open Confirm on top of Form
  };

  const handleDeleteInit = (user) => {
    // Prevent deleting own account from UI (extra runtime guard)
    if (currentUserId && String(user?.id) === String(currentUserId)) {
      setStatusType('error');
      setStatusMessage({ title: 'Action forbidden', desc: 'You cannot delete your own account.' });
      setShowStatusModal(true);
      return;
    }

    setSelectedUser(user);
    setConfirmType('delete');
    setDeleteConfirmChecked(false);
    setShowConfirmModal(true);
  };

  const executeAction = async () => {
    setIsSubmitting(true);

    if (confirmType === 'delete') {
      // Extra safeguard: do not allow deleting signed-in user
      if (selectedUser && currentUserId && String(selectedUser.id) === String(currentUserId)) {
        setStatusMessage({ title: 'Forbidden', desc: 'You cannot delete your own account.' });
        setStatusType('error');
        setShowConfirmModal(false);
        setShowStatusModal(true);
        setIsSubmitting(false);
        return;
      }

      try {
        // diverse deletion logic removed per request
        await apiClient.delete(`/admin/users/${selectedUser.id}`);

        setUsers(users.filter(u => u.id !== selectedUser.id));
        fetchAllUserKeys();
        setStatusMessage({ title: "Deleted", desc: "User successfully removed." });
        setStatusType('success');
      } catch (err) {
        logError('handleDeleteUser', err);
        setStatusMessage({ title: "Error", desc: getSafeErrorMessage(err, "Failed to delete user.") });
        setStatusType('error');
      }
      setShowConfirmModal(false);
      setShowStatusModal(true);
      setIsSubmitting(false);
      // Re-fetch from server to sync pagination and data
      fetchUsers(currentPage, searchTerm, {
        role: appliedFilterType,
        status: appliedFilterStatus,
        date: appliedFilterDate
      }, false, true);
      return; 
    }

    if (confirmType === 'add') {
      // Double-check validation before adding
      const errs = validateFormFields();
      if (Object.keys(errs).length > 0) {
        setValidationErrors(errs);
        const firstKey = Object.keys(errs)[0];
        setStatusMessage({ title: 'Validation', desc: errs[firstKey] });
        setStatusType('error');
        setShowStatusModal(true);
        setIsSubmitting(false);
        return;
      }

      try {
        const roleNames = Array.isArray(formData.role) ? formData.role : (formData.role ? [formData.role] : []);

        // Map role names to IDs
        const roleIds = roleNames.map(rn => {
          const normalized = normalizeRole(rn);
          const found = availableRoles.find(ar => normalizeRole(ar.name) === normalized || normalizeRole(ar.label) === normalized);
          if (found && (found.role_id || found.id)) return found.role_id || found.id;
          return ROLE_NAME_TO_ID[normalized] || ROLE_NAME_TO_ID[rn];
        }).filter(Boolean);

        if (roleIds.length === 0) {
          setStatusMessage({ title: 'Validation', desc: 'Please select at least one valid role.' });
          setStatusType('error');
          setShowStatusModal(true);
          setIsSubmitting(false);
          return;
        }

        const statusValue = String(formData.status).toLowerCase();

        const successes = [];
        const failures = [];
        const updateOne = async (userId) => {
          try {
            // If adding interns, only attempt create-user and DO NOT fallback to PUT on 'add' operation
            if (hasInternRole) {
              // When adding, `userId` passed in is actually the mahasiswa identifier (see fetchInternOptions)
              // but we still look up the record for extra context.
              const internObj = internOptions.find(i => String(i.id) === String(userId));
              const mahasiswaId = internObj?.id_mahasiswa ?? userId;
              // debug information when ID mismatch occurs
              if (internObj && String(internObj.userId) !== String(userId)) {
                console.debug('[UserRole] resolving add id', userId, '-> mahasiswaId', mahasiswaId, 'userId', internObj.userId);
              }
              try {
                await apiClient.post(`/admin/intern-profiles/${mahasiswaId}/create-user`, { roles: roleIds, status: statusValue });
                successes.push(userId);
              } catch (createErr) {
                const code = createErr?.response?.status;
                const msg = getSafeErrorMessage(createErr, 'Create failed');
                failures.push({ id: userId, code, reason: msg });
                console.warn('create-user failed during add for userId', userId, createErr);
              }
              return;
            }

            // Non-intern flows: try updating mahasiswa resource first, then fallback to users
            try {
              await apiClient.put(`admin/mahasiswa/${userId}`, { roles: roleIds, status: statusValue });
              successes.push(userId);
              return;
            } catch (maybeMahErr) {
              try {
                await apiClient.put(`admin/users/${userId}`, { roles: roleIds, status: statusValue });
                successes.push(userId);
                return;
              } catch (userPutErr) {
                // try per-field fallback
                try {
                  await apiClient.put(`admin/users/${userId}/roles`, { roles: roleIds });
                  await apiClient.put(`admin/users/${userId}/status`, { status: statusValue });
                  successes.push(userId);
                  return;
                } catch (err2) {
                  // last resort: try create-user (may succeed for mahasiswa ids)
                  try {
                    // final fallback – still respect mahasiswa id if we can find it
                    const internObj2 = internOptions.find(i => String(i.id) === String(userId));
                    const mahasiswaId2 = internObj2?.id_mahasiswa ?? userId;
                    await apiClient.post(`/api/admin/intern-profiles/${mahasiswaId2}/create-user`, { roles: roleIds, status: statusValue });
                    successes.push(userId);
                    return;
                  } catch (err3) {
                    const msg = getSafeErrorMessage(err3, 'Update failed');
                    failures.push({ id: userId, reason: msg });
                    console.error('Final fallback failed for userId', userId, err3);
                    return;
                  }
                }
              }
            }
          } catch (err) {
            const msg = getSafeErrorMessage(err, 'Unexpected error');
            failures.push({ id: userId, reason: msg });
            console.error('Unexpected error updating userId', userId, err);
          }
        };

        // Eksekusi secara batch (10 request sekaligus) agar tidak membuat server down/browser macet
        const batchSize = 10;
        for (let i = 0; i < selectedUserIds.length; i += batchSize) {
          const batch = selectedUserIds.slice(i, i + batchSize);
          await Promise.all(batch.map(updateOne));
        }

        // Build user-facing summary
        if (failures.length === 0) {
          setStatusMessage({ title: 'Success', desc: `${successes.length} user(s) processed successfully.` });
          setStatusType('success');
        } else if (successes.length > 0) {
          const failList = failures.map(f => `${f.id}${f.reason ? `: ${f.reason}` : ''}`).slice(0, 5).join(', ');
          setStatusMessage({ title: 'Partial Success', desc: `${successes.length} succeeded, ${failures.length} failed. ${failList}${failures.length > 5 ? ', ...' : ''}` });
          setStatusType('error');
        } else {
          const failListAll = failures.map(f => `${f.id}: ${f.reason}`).slice(0, 8).join('; ');
          setStatusMessage({ title: 'Failed', desc: `All operations failed. ${failListAll}` });
          setStatusType('error');
        }

        setShowConfirmModal(false);
        setShowStatusModal(true);
        closeForm();
        setSelectedUserIds([]);

        // Refresh list
        fetchUsers(1, searchTerm, {
          role: appliedFilterType,
          status: appliedFilterStatus,
          date: appliedFilterDate
        }, false, true);
      } catch (err) {
        console.error("Failed to update user roles:", err);
        const errMsg = getSafeErrorMessage(err, 'Failed to update user roles.');
        setStatusMessage({ title: 'Error', desc: errMsg });
        setStatusType('error');
        setShowConfirmModal(false);
        setShowStatusModal(true);
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    if (confirmType === 'save') {
      // Persist roles and status to API (with local fallback)
      try {
        const roleNames = Array.isArray(formData.role) ? formData.role : (formData.role ? [formData.role] : []);

        // Map role names to IDs using fetched roles first, then fallback
        const roleIds = roleNames.map(rn => {
          const normalized = normalizeRole(rn);
          // try find in availableRoles by name or label
          const found = availableRoles.find(ar => normalizeRole(ar.name) === normalized || normalizeRole(ar.label) === normalized);
          if (found && (found.role_id || found.id)) return found.role_id || found.id;
          // fallback to hard-coded map
          return ROLE_NAME_TO_ID[normalized] || ROLE_NAME_TO_ID[rn];
        }).filter(Boolean);

        // Validate role mapping before sending
        if (roleIds.length !== roleNames.length) {
          setStatusMessage({ title: 'Validation', desc: 'Selected roles could not be mapped to valid role IDs. Please verify selected roles.' });
          setStatusType('error');
          setShowStatusModal(true);
          setIsSubmitting(false);
          return;
        }

        const statusValue = String(formData.status).toLowerCase();

        try {
          // prefer mahasiswa endpoint when appropriate
          try {
            await apiClient.put(`admin/users/${selectedUser.id}/roles`, { roles: roleIds });
            await apiClient.put(`admin/users/${selectedUser.id}/status`, { status: statusValue });
          } catch (maybeMahErr) {
            await apiClient.put(`admin/users/${selectedUser.id}`, { roles: roleIds, status: statusValue });
          }
        } catch (updateErr) {
          console.warn('Main update failed, trying fallback endpoints...', updateErr);
          await apiClient.put(`admin/users/${selectedUser.id}/roles`, { roles: roleIds });
          await apiClient.put(`admin/users/${selectedUser.id}/status`, { status: statusValue });
        }

        setUsers(prev => prev.map(u => {
          if (String(u.id) !== String(selectedUser.id)) return u;
          return {
            ...u,
            role: roleNames.join(', '),
            status: formData.status,
            updatedAt: new Date().toISOString().split('T')[0]
          };
        }));

        setStatusMessage({ title: "Success", desc: "Changes saved successfully." });
        setStatusType('success');
        setShowConfirmModal(false);
        setShowStatusModal(true);
        // Close form BEFORE fetching so the showFormModal guard doesn't skip the fetch
        closeForm();
        await fetchUsers(currentPage, searchTerm, {
          role: appliedFilterType,
          status: appliedFilterStatus,
          date: appliedFilterDate
        }, false, true);
      } catch (err) {
        logError('handleSaveUserChanges', err);
        setStatusMessage({ title: 'Error', desc: getSafeErrorMessage(err, 'Failed to save changes.') });
        setStatusType('error');
        setShowConfirmModal(false);
        setShowStatusModal(true);
      } finally {
        setIsSubmitting(false);
      }
      return;
    }
  };

  const handleFilterToggle = (category, value) => {
    setFilter(prev => {
      const current = prev[category];
      const updated = current.includes(value) ? current.filter(item => item !== value) : [...current, value];
      return { ...prev, [category]: updated };
    });
  };

  const resetFilter = () => {
    setFilter({ role: [], status: [], date: "" });
    setAppliedFilterType([]);
    setAppliedFilterStatus([]);
    setAppliedFilterDate("");
    setShowFilterModal(false); // Close the filter modal
    // Fetch only page/per_page (no search or filters)
    fetchUsers(1, '', {}, true);
  };

  const MonthYearPicker = ({ value, onChange, placeholder = "Select Month" }) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef(null);
    const [year, setYear] = useState(value ? parseInt(value.split("-")[0], 10) : new Date().getFullYear());
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

    useEffect(() => {
      if (value) {
        const nextYear = parseInt(value.split("-")[0], 10);
        if (!Number.isNaN(nextYear)) setYear(nextYear);
      }
    }, [value]);

    useEffect(() => {
      const handleClickOutside = (event) => {
        if (containerRef.current && !containerRef.current.contains(event.target)) setIsOpen(false);
      };
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleSelect = (mIndex) => {
      const newDate = `${year}-${String(mIndex + 1).padStart(2, "0")}`;
      onChange(newDate);
      setIsOpen(false);
    };

    const displayValue = value
      ? new Date(`${value}-01`).toLocaleDateString("en-US", { month: "short", year: "numeric" }).toUpperCase()
      : placeholder;

    return (
      <div className="relative w-full" ref={containerRef}>
        <div
          onClick={() => setIsOpen(!isOpen)}
          className={`w-full pl-3 pr-3 py-3 rounded-xl border cursor-pointer select-none flex items-center justify-between transition-all duration-200 ${isOpen ? "border-[#354C8F] ring-2 ring-[#354C8F]/10 bg-white" : "border-slate-200 bg-white hover:border-slate-300"}`}
        >
          <div className="flex items-center gap-2 overflow-hidden">
            <Calendar size={18} className={isOpen ? "text-[#354C8F]" : "text-slate-400"} />
            <span className={`text-sm font-bold truncate ${value ? "text-slate-700" : "text-slate-400"}`}>
              {displayValue}
            </span>
          </div>
          <ChevronDown size={16} className={`text-slate-400 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
        </div>
        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="absolute top-full mt-2 left-0 w-full sm:w-[260px] bg-white rounded-xl shadow-xl border border-slate-100 z-50 overflow-hidden"
            >
              <div className="flex items-center justify-between p-3 border-b border-slate-100 bg-slate-50/50">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setYear(year - 1);
                  }}
                  className="p-1 hover:bg-slate-200 rounded-lg text-slate-500"
                >
                  <ChevronLeft size={16} />
                </button>
                <span className="text-sm font-extrabold text-[#27345A]">{year}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setYear(year + 1);
                  }}
                  className="p-1 hover:bg-slate-200 rounded-lg text-slate-500"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
              <div className="p-3 grid grid-cols-3 gap-2">
                {months.map((m, idx) => (
                  <button
                    key={m}
                    onClick={() => handleSelect(idx)}
                    className={`py-2 px-1 text-xs font-bold rounded-lg transition-all ${value && parseInt(value.split("-")[1], 10) - 1 === idx && parseInt(value.split("-")[0], 10) === year ? "bg-[#354C8F] text-white shadow-sm" : "text-slate-600 hover:bg-indigo-50"}`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  };

  // --- COMPONENTS ---

  const Badge = ({ text, type }) => {
    let style = "";
    const normalizedText = text.toLowerCase().trim();

    if (type === 'role') {
      if (normalizedText === 'admin') style = "text-[#1E3A8A] bg-white border-[#1E3A8A]";
      else if (normalizedText === 'mentor') style = "text-[#6D28D9] bg-white border-[#6D28D9]";
      else if (normalizedText === 'intern') style = "text-[#FF5C00]  bg-white border-[#FF5C00]";
    } else {
      if (text === 'Active') style = "bg-green-100 text-green-700 border-green-200";
      else style = "bg-slate-100 text-slate-500 border-slate-200";
    }

    return (
      <span className={`px-3 py-1 md:px-4 md:py-1.5 rounded-lg text-[10px] md:text-xs font-bold border ${style} inline-block min-w-[70px] md:min-w-[80px] text-center`}>
        {text}
      </span>
    );
  };

  return (
    <div className="bg-slate-50 min-h-screen pt-8 pb-8 pl-2 pr-2 md:pl-2 md:pr-2 w-full font-sans text-slate-800 -mt-8">

      {/* HEADER */}
      <div className="mb-6 md:mb-8 mt-4 md:mt-0">
        <h1 className={`text-xl md:text-2xl font-bold text-[${colors.textDark}] mb-1 md:mb-2`}>User Management</h1>
        <p className="text-slate-500 text-xs">Manage system access for Admin, Mentor, and Interns</p>
      </div>

      {/* ACTION BAR */}
      <div className="flex flex-row flex-wrap justify-between items-center gap-3 md:gap-4 mb-6">
        <div className="flex gap-3 w-full md:w-auto items-center">
          <div className="relative flex-1 md:w-80">
            <input
              type="text"
              placeholder="Search by Name"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 md:pl-10 pr-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#354C8F]/20 text-sm shadow-sm transition-all"
            />
            <Search className="absolute left-3 top-3.5 text-slate-400" size={18} />
          </div>
          <button onClick={() => setShowFilterModal(true)} className={`${btnPrimary} md:!px-6 w-auto`} aria-label="Open filter">
            <Filter size={16} />
            <span className={actionText}>Filter</span>
            {isFilterActive && <div className="w-2 h-2 bg-red-400 rounded-full animate-pulse ml-2"></div>}
          </button>

        </div>
        <div className="flex gap-2 justify-end w-full md:w-auto">
          <button onClick={openAddIntern} className={`${btnPrimary} md:!px-6 w-full md:w-auto flex items-center justify-center gap-2`} aria-label="Add role intern">
            <Plus size={16} />
            <span className="ml-2 text-sm font-semibold">Add Role Intern</span>
          </button>
        </div>

      </div>


      {/* TABLE */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[800px] md:min-w-full">
            <thead>
              <tr className="border-b border-slate-100 text-xs font-bold text-slate-900 bg-slate-50/50">
                <th className="px-4 py-3 w-12 md:w-16 text-center">No</th>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3 text-center">Role</th>

                <th className="px-4 py-3 w-[240px]">Email</th>

                <th className="px-4 py-3">Internship Period</th>
                <th className="px-4 py-3">Division</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="text-xs text-slate-600">
              {loadingUsers ? (
                <tr>
                  <td colSpan="8" className="p-12 text-center">
                    <div className="flex flex-col items-center justify-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#354C8F] mb-2"></div>
                      <span className="text-slate-400">Loading users...</span>
                    </div>
                  </td>
                </tr>
              ) : currentItems.length > 0 ? (
                currentItems.map((item, index) => {
                  const isSelf = item.is_self || (currentUserId && String(item.id) === String(currentUserId));
                  const periodStart = item.periodStart || item.mulai_magang || item.start_date || item.start || null;
                  const periodEnd = item.periodEnd || item.akhir_magang || item.end_date || item.end || null;
                  const periodText = item.period ? formatPeriodString(item.period) : (periodStart || periodEnd ? `${fmtDateShort(periodStart)}${periodEnd ? ' - ' + fmtDateShort(periodEnd) : ''}` : '-');
                  const division = item.division || item.divisi || item.divisionName || item.division_name || '-';
                  const sortedRoles = String(item.role || '')
                    .split(',')
                    .map((r) => normalizeRole((r || '').trim()))
                    .filter(Boolean)
                    .sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' }));
                  return (
                    <tr key={item.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 text-center font-medium">{paginationMeta.from + index}</td>

                      <td className="px-4 py-3 font-medium text-slate-700 whitespace-nowrap">{item.name}</td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex justify-center gap-2 flex-wrap">
                          {sortedRoles.map((r, idx) => (
                            <Badge key={idx} text={r} type="role" />
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3 max-w-[240px] whitespace-normal break-all leading-relaxed">{item.email}</td>

                      <td className="px-4 py-3">
                        {periodText && periodText !== '-' ? (
                          <div className="inline-flex items-center gap-2 bg-slate-50 border border-slate-100 rounded-[10px] px-3 py-1 text-xs font-semibold text-slate-700">
                            <Clock size={16} className="text-slate-400 shrink-0" />
                            <span>{periodText}</span>
                          </div>
                        ) : '-'}
                      </td>
                      <td className="px-4 py-3">{division}</td>

                      <td className="px-4 py-3 text-center"><Badge text={item.status} type="status" /></td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex justify-center gap-2">
                          <button 
                            onClick={() => isSelf ? null : openForm('edit', item)} 
                            disabled={isSelf}
                            title={isSelf ? 'You cannot edit your own account here' : 'Edit user'}
                            className={`p-2 rounded-lg transition-colors shadow-sm ${isSelf ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : 'bg-green-500 text-white hover:bg-green-600 shadow-green-200'}`}
                          >
                            <Edit2 size={14} />
                          </button>

                          <button
                            onClick={() => isSelf ? null : handleDeleteInit(item)}
                            disabled={isSelf}
                            title={isSelf ? 'You cannot delete your own account' : 'Delete user'}
                            className={`p-2 rounded-lg transition-colors shadow-sm ${isSelf ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : 'bg-red-500 text-white hover:bg-red-600 shadow-red-200'}`}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="8" className="p-8 text-center text-slate-400">No users found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* PAGINATION */}
        {paginationMeta.total > 0 && (
          <div className="flex flex-col md:flex-row justify-between items-center p-5 border-t border-slate-100 text-sm text-slate-500 gap-4">
            <p className="order-2 md:order-1">Showing {paginationMeta.from} to {paginationMeta.to} of {paginationMeta.total} entries</p>
            <div className="flex items-center gap-4 order-1 md:order-2">
              <div className="flex items-center gap-2">
                <label className="text-sm md:text-sm font-medium text-slate-600">Per page:</label>
                <select
                  value={itemsPerPage}
                  onChange={(e) => setItemsPerPage(Number(e.target.value))}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 focus:outline-none focus:border-[#354C8F] bg-white hover:border-slate-300 transition-colors"
                >
                  <option value="5">5</option>
                  <option value="10">10</option>
                  <option value="25">25</option>
                </select>
              </div>
              <div className="flex items-center gap-2">
                <button
                  disabled={currentPage === 1}
                  onClick={() => handlePageChange(currentPage - 1)}
                  className="p-2 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50 border border-slate-200 disabled:cursor-not-allowed"
                >
                  <ChevronLeft size={18} />
                </button>

                {(() => {
                  const pageCurrent = paginationMeta.current_page;
                  const pageTotal = paginationMeta.last_page || 1;
                  const getPageItems = (current, total, sibling = 1) => {
                    const totalNumbers = sibling * 2 + 5;
                    if (total <= totalNumbers) return Array.from({ length: total }, (_, i) => i + 1);
                    const left = Math.max(2, current - sibling);
                    const right = Math.min(total - 1, current + sibling);
                    const pages = [1];
                    if (left > 2) pages.push('left-ellipsis');
                    for (let i = left; i <= right; i++) pages.push(i);
                    if (right < total - 1) pages.push('right-ellipsis');
                    pages.push(total);
                    return pages;
                  };
                  return getPageItems(pageCurrent, pageTotal, 1).map((p, idx) => {
                    if (p === 'left-ellipsis' || p === 'right-ellipsis')
                      return <div key={`${p}-${idx}`} className="w-8 h-8 flex items-center justify-center rounded-lg text-xs font-bold text-slate-400">...</div>;

                    return (
                      <button
                        key={p}
                        onClick={() => handlePageChange(p)}
                        className={`w-8 h-8 flex items-center justify-center rounded-lg text-xs font-bold transition-colors ${pageCurrent === p ? "bg-slate-100 text-[#27345A] border border-slate-200" : "text-slate-500 hover:bg-slate-50 border border-transparent"}`}
                      >
                        {p}
                      </button>
                    );
                  });
                })()}

                <button
                  disabled={currentPage === paginationMeta.last_page}
                  onClick={() => handlePageChange(currentPage + 1)}
                  className="p-2 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50 border border-slate-200 disabled:cursor-not-allowed"
                >
                  <ChevronRight size={18} />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* --- MODALS SECTION --- */}
      <AnimatePresence>

        {/* 1. FILTER MODAL (z-50) */}
        {showFilterModal && (
          <ModalOverlay key="filter-modal" zIndex="z-50" onClose={() => setShowFilterModal(false)} width="max-w-md" compact>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-[18px] font-bold text-[#27345A]">User Role Filter</h3>
              <button onClick={() => setShowFilterModal(false)}><X className="text-slate-400 hover:text-slate-600" /></button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-800 mb-1">Role</label>
                <div className="flex gap-2 flex-wrap">
                  {['Admin', 'Mentor', 'Intern'].map(role => (
                    <button key={role} onClick={() => handleFilterToggle('role', role)}
                      className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all border ${filter.role.includes(role) ? 'bg-[#354C8F] text-white border-[#354C8F] shadow-md' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                      {role}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-800 mb-1">Status</label>
                <div className="flex gap-2 flex-wrap">
                  {['Active', 'Inactive'].map(status => (
                    <button key={status} onClick={() => handleFilterToggle('status', status)}
                      className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all border ${filter.status.includes(status) ? 'bg-[#354C8F] text-white border-[#354C8F] shadow-md' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                      {status}
                    </button>
                  ))}
                </div>
              </div>


            </div>

            <div className="flex gap-3 justify-end mt-6 pt-4 border-t border-slate-100">
              <button onClick={resetFilter} className={btnSecondary}>Reset</button>
              <button onClick={() => {
                setAppliedFilterType([...filter.role]);
                setAppliedFilterStatus([...filter.status]);
                setAppliedFilterDate(filter.date);
                setShowFilterModal(false);
                // Manually trigger fetch with new filters
                fetchUsers(1, searchTerm, {
                  role: filter.role,
                  status: filter.status,
                  date: filter.date
                });
              }} className={btnPrimary}>Apply</button>
            </div>
          </ModalOverlay>
        )}

        {/* 2. FORM MODAL (z-50) */}
        {showFormModal && (
          <ModalOverlay key="form-modal" zIndex="z-50" onClose={closeForm} width="max-w-lg" compact>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-[18px] font-bold text-[#27345A]">{formMode === 'add' ? 'Add User Role Intern' : 'Edit User'}</h3>
              <button onClick={closeForm}><X className="text-slate-400 hover:text-slate-600" /></button>
            </div>

            <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2 custom-scrollbar">
              {formMode === 'add' ? (
                <>
                  <div>
                    <label className="block text-sm font-bold text-slate-800 mb-2">Role <span className="text-red-500">*</span></label>
                    <div className="relative">
                      {forceInternOnly ? (
                        <div className={`flex border rounded-xl overflow-hidden p-1 gap-1 ${validationErrors.role ? 'border-red-400' : 'border-slate-300'}`}>
                          <div className="flex-1 py-2.5 text-xs font-bold rounded-lg bg-[#354C8F] text-white shadow-sm text-center">Intern</div>
                        </div>
                      ) : (
                        <div className={`flex border rounded-xl overflow-hidden p-1 gap-1 ${validationErrors.role ? 'border-red-400' : 'border-slate-300'}`}>
                          {['Admin', 'Mentor', 'Intern'].map(r => (
                            <button key={r} onClick={() => toggleFormRole(r)}
                              className={`flex-1 py-2.5 text-xs font-bold rounded-lg transition-all ${Array.isArray(formData.role) && formData.role.includes(r) ? 'bg-[#354C8F] text-white shadow-sm' : 'bg-white text-slate-600 hover:bg-slate-50'}`}>
                              {r}
                            </button>
                          ))}
                        </div>
                      )}
                      {validationErrors.role && <AlertCircle title={validationErrors.role} className="absolute right-3 top-1/2 -translate-y-1/2 text-red-500" size={16} />}
                    </div>
                    {validationErrors.role && <p className="text-xs text-red-500 mt-1">{validationErrors.role}</p>}
                    <p className="text-xs text-slate-400 mt-2">Mentors are added automatically after logging in and can be combined with admin roles.</p>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-bold text-slate-800">Select {addRoleLabel} <span className="text-red-500">*</span></label>
                    {addRoleLabel === 'Intern' && (
                      <div className="flex items-center gap-4">
                        <label className="inline-flex items-center gap-3 text-sm">
                          <input
                            type="checkbox"
                            checked={filteredAddUserOptions.length > 0 && filteredAddUserOptions.every(u => selectedUserIds.includes(u.id))}
                            onChange={(e) => {
                              if (e.target.checked) setSelectedUserIds(filteredAddUserOptions.map(u => u.id));
                              else setSelectedUserIds([]);
                              setValidationErrors(prev => { const copy = { ...prev }; delete copy.selectedUsers; return copy; });
                            }}
                            className="w-4 h-4 rounded border-slate-300"
                          />
                          <span className="text-slate-700">Select all</span>
                        </label>
                        <span className="text-xs text-slate-400">{selectedUserIds.length} selected</span>
                      </div>
                    )}
                  </div>

                  <div className="relative mb-3">
                    <input
                      type="text"
                      value={userSearch}
                      onChange={(e) => setUserSearch(e.target.value)}
                      placeholder={`Search ${addRoleLabel.toLowerCase()} name, ID, or email`}
                      className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#354C8F]/20 text-sm"
                    />
                    <Search className="absolute left-3 top-3.5 text-slate-400" size={18} />
                  </div>    

                    <div className="border border-slate-200 rounded-xl max-h-60 overflow-y-auto custom-scrollbar">
                      {(addRoleLabel === 'Intern' ? internsLoading : ssoLoading) ? (
                        <div className="p-4 text-sm text-slate-400">Loading {addRoleLabel.toLowerCase()}...</div>
                      ) : filteredAddUserOptions.length > 0 ? (
                        filteredAddUserOptions.map(u => (
                          <label key={u.id} className="flex items-start gap-3 px-4 py-3 hover:bg-slate-50 cursor-pointer border-b border-slate-100 last:border-0">
                            <input
                              type="checkbox"
                              checked={selectedUserIds.includes(u.id)}
                              onChange={() => toggleUserSelection(u.id)}
                              className="mt-1"
                            />
                            <div className="flex flex-col">
                              <span className="text-sm font-semibold text-slate-700">{u.name}</span>
                              <span className="text-xs text-slate-400">{u.nip} • {u.email}</span>
                            </div>
                          </label>
                        ))
                      ) : (
                        <div className="p-4 text-sm text-slate-400">No {addRoleLabel.toLowerCase()} found.</div>
                      )}
                    </div>
                    {validationErrors.selectedUsers && <p className="text-xs text-red-500 mt-1">{validationErrors.selectedUsers}</p>}
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-slate-800 mb-2">Status <span className="text-red-500">*</span></label>
                    <div className="flex border border-slate-300 rounded-xl overflow-hidden p-1 gap-1 w-2/3">
                      {['Active', 'Inactive'].map(s => {
                        const disableInactiveForSelfAdmin = (formMode === 'edit') && selectedUser && currentUserId && String(selectedUser.id) === String(currentUserId) && isCurrentUserAdmin && s === 'Inactive';
                        return (
                          <button
                            key={s}
                            onClick={() => { if (disableInactiveForSelfAdmin) return; setFormData({ ...formData, status: s }); }}
                            disabled={disableInactiveForSelfAdmin}
                            title={disableInactiveForSelfAdmin ? 'You cannot deactivate your own admin account' : undefined}
                            className={`flex-1 py-2.5 text-xs font-bold rounded-lg transition-all ${formData.status === s ? 'bg-[#354C8F] text-white shadow-sm' : 'bg-white text-slate-600 hover:bg-slate-50'} ${disableInactiveForSelfAdmin ? 'opacity-50 cursor-not-allowed' : ''}`}>
                            {s}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label className="block text-sm font-bold text-slate-800 mb-2">Role <span className="text-red-500">*</span></label>
                    <div className="relative">
                      <div className={`flex border rounded-xl overflow-hidden p-1 gap-1 ${validationErrors.role ? 'border-red-400' : 'border-slate-300'}`}>
                        {['Admin', 'Mentor', 'Intern'].map(r => (
                          <button key={r} onClick={() => toggleFormRole(r)}
                            className={`flex-1 py-2.5 text-xs rounded-lg transition-all ${Array.isArray(formData.role) && formData.role.includes(r) ? 'bg-[#354C8F] text-white shadow-sm font-bold' : 'bg-white text-slate-600 hover:bg-slate-50 font-medium'}`}>
                            {r}
                          </button>
                        ))}
                      </div>
                      {validationErrors.role && <AlertCircle title={validationErrors.role} className="absolute right-3 top-1/2 -translate-y-1/2 text-red-500" size={16} />}
                    </div>
                    {validationErrors.role && <p className="text-xs text-red-500 mt-1">{validationErrors.role}</p>}
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-slate-800 mb-2">Status <span className="text-red-500">*</span></label>
                    <div className="flex border border-slate-300 rounded-xl overflow-hidden p-1 gap-1 w-2/3">
                      {['Active', 'Inactive'].map(s => {
                        const isEditingSelf = selectedUser && currentUserId && String(selectedUser.id) === String(currentUserId);
                        const disableInactiveForSelfAdmin = (s === 'Inactive') && isEditingSelf && isCurrentUserAdmin;
                        return (
                          <button
                            key={s}
                            onClick={() => { if (disableInactiveForSelfAdmin) return; setFormData({ ...formData, status: s }); }}
                            disabled={disableInactiveForSelfAdmin}
                            title={disableInactiveForSelfAdmin ? 'You cannot deactivate your own admin account' : undefined}
                            className={`flex-1 py-2.5 text-xs rounded-lg transition-all ${formData.status === s ? 'bg-[#354C8F] text-white shadow-sm font-bold' : 'bg-white text-slate-600 hover:bg-slate-50 font-medium'} ${disableInactiveForSelfAdmin ? 'opacity-50 cursor-not-allowed' : ''}`}>
                            {s}
                          </button>
                        );
                      })}
                    </div>
                    {selectedUser && currentUserId && String(selectedUser.id) === String(currentUserId) && isCurrentUserAdmin && (
                      <p className="text-xs text-slate-400 mt-2">You cannot set your own admin account to Inactive.</p>
                    )}
                  </div>
                </>
              )}
            </div>

            <div className="flex gap-3 mt-6 pt-4 border-t border-slate-100 justify-end">
              <button onClick={closeForm} className={`${btnSecondary} !py-3 w-36`}>Cancel</button>
              <button onClick={handleFormSubmit} className={`${btnPrimary} !py-3 w-36`}>{formMode === 'add' ? 'Add' : 'Save'}</button>
            </div>
          </ModalOverlay>
        )}

        {/* 3. CONFIRMATION MODAL (z-60 - ABOVE FORM) */}
        {showConfirmModal && (
          <ModalOverlay key="confirm-modal" zIndex="z-[60]" onClose={() => setShowConfirmModal(false)} width="max-w-sm" compact>
            <div className="text-center p-4">
              <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${confirmType === 'delete' ? 'bg-red-50' : 'bg-yellow-50'}`}>
                {confirmType === 'delete' ? (
                  <Trash2 className="text-red-500" size={32} strokeWidth={2} />
                ) : (
                  <AlertCircle className="text-yellow-500" size={32} strokeWidth={2} />
                )}
              </div>
              <h3 className="text-xl font-bold text-[#27345A] mb-2">
                {confirmType === 'add' ? 'Add Intern Roles?' : confirmType === 'save' ? 'Save Changes?' : confirmType === 'delete' ? 'Delete User?' : 'Confirm'}
              </h3>

              <p className="text-slate-500 text-sm mb-6">
                {confirmType === 'delete'
                  ? 'Are you sure you want to remove this user?'
                  : confirmType === 'add'
                    ? 'Apply selected roles and status to the chosen interns?'
                    : 'Are you sure you want to proceed with this action?'}
              </p>

              {confirmType === 'delete' && (
                <div className="mb-4 text-left">
                  <label className="inline-flex items-start gap-3 text-sm">
                    <input
                      type="checkbox"
                      checked={deleteConfirmChecked}
                      onChange={(e) => setDeleteConfirmChecked(e.target.checked)}
                      className="mt-1 w-4 h-4 rounded border-slate-300"
                    />
                    <span className="text-slate-700 -mt-2">I confirm that I have completed the final evaluation for intern <strong>{selectedUser?.name || selectedUser?.nama || '---'}</strong></span>
                  </label>
                </div>
              )}

              <div className="flex gap-3">
                <button onClick={() => setShowConfirmModal(false)} disabled={isSubmitting} className={`${btnSecondary} w-full justify-center disabled:opacity-50 disabled:cursor-not-allowed`}>Cancel</button>
                <button onClick={executeAction} disabled={isSubmitting || (confirmType === 'delete' && (!deleteConfirmChecked || (selectedUser && currentUserId && String(selectedUser.id) === String(currentUserId))))}
                  className={`w-full py-3 px-6 rounded-xl font-bold text-sm text-white shadow-md transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed ${confirmType === 'delete' ? 'bg-[#EF4444] shadow-red-200 hover:bg-red-600' : 'bg-[#22C55E] shadow-green-200 hover:bg-green-600'}`}>
                  {isSubmitting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                      <span>Loading...</span>
                    </>
                  ) : (
                    confirmType === 'delete' ? 'Delete' : 'Confirm'
                  )}
                </button>
              </div>
            </div>
          </ModalOverlay>
        )}

        {/* 4. STATUS MODAL (z-60 - ABOVE FORM) */}
        {showStatusModal && (
          <ModalOverlay key="status-modal" zIndex="z-[60]" onClose={() => setShowStatusModal(false)} width="max-w-sm" compact>
            <div className="text-center p-4">
              <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${statusType === 'success' ? 'bg-green-50' : 'bg-red-50'}`}>
                {statusType === 'success' ? (
                  <Check className="text-green-500" size={32} strokeWidth={3} />
                ) : (
                  <X className="text-red-500" size={32} strokeWidth={3} />
                )}
              </div>
              <h3 className="text-xl font-bold text-[#27345A] mb-2">{statusMessage.title}</h3>
              <p className="text-slate-500 text-sm mb-6">{statusMessage.desc}</p>
              <button onClick={() => setShowStatusModal(false)}
                className={`w-full py-3 px-6 rounded-xl font-bold text-sm text-white shadow-md transition-all active:scale-95 ${statusType === 'success' ? 'bg-[#22C55E] shadow-green-200 hover:bg-green-600' : 'bg-[#EF4444] shadow-red-200 hover:bg-red-600'}`}>
                OK
              </button>
            </div>
          </ModalOverlay>
        )}

      </AnimatePresence>
    </div>
  );
};

// --- SUB-COMPONENTS ---

const InputGroup = ({ label, type = "text", value, onChange, placeholder, error }) => (
  <div className="relative">
    <label className="block text-sm font-bold text-slate-800 mb-2">{label} <span className="text-red-500 ml-1">*</span></label>
    <input
      type={type}
      value={value}
      onChange={onChange}
      className={`w-full px-4 py-3.5 rounded-xl border text-sm focus:outline-none transition-colors placeholder:text-slate-400 ${error ? 'pr-10 border-red-400 focus:border-red-500' : 'border-slate-300 focus:border-[#354C8F]'}`}
      placeholder={placeholder}
    />
    {error && <AlertCircle title={error} className="absolute right-3 top-3 text-red-500" size={16} />}
    {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
  </div>
);

const ModalOverlay = ({ children, onClose, width = "max-w-md", zIndex = "z-50", compact = false }) => (
  <div className={`fixed inset-0 ${zIndex} flex items-center justify-center bg-black/40 backdrop-blur-sm p-4`}>
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className={`bg-white w-[95%] md:w-full ${width} rounded-2xl shadow-2xl ${compact ? 'p-4' : 'p-6'} relative`}
    >
      {children}
    </motion.div>
  </div>
);

const DivisionSelectCell = ({ value, onChange, divisions }) => {
  const [isOpen, setIsOpen] = React.useState(false);
  const wrapperRef = React.useRef(null);

  // Close when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (event) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filtered = (divisions || []).filter(d => {
    const name = (d.name || d.nama_divis || d).toString().toLowerCase();
    const search = (value || '').toString().toLowerCase();
    return name.includes(search);
  });

  return (
    <div className="relative" ref={wrapperRef}>
      <input
        type="text"
        value={value || ''}
        placeholder="Division"
        onFocus={() => setIsOpen(true)}
        onChange={(e) => {
          onChange(e.target.value);
          setIsOpen(true);
        }}
        className="w-full h-[42px] px-3 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 text-sm"
      />

      {isOpen && (filtered.length > 0) && (
        <div className="absolute top-full left-0 w-full mt-1 bg-white border border-slate-100 rounded-xl shadow-xl z-50 max-h-40 overflow-y-auto custom-scrollbar">
          {filtered.map((div, idx) => {
            const divName = div.name || div.nama_divis || div;
            return (
              <button
                key={idx}
                className="w-full text-left px-3 py-2 text-xs text-slate-600 hover:bg-slate-50 border-b border-slate-50 last:border-0"
                onClick={() => {
                  onChange(divName);
                  setIsOpen(false);
                }}
              >
                {divName}
              </button>
            );
          })}
        </div>
      )}
      {/* "New" indicator if doesn't match exactly */}
      {isOpen && value && !filtered.some(d => (d.name || d.nama_divis || d) === value) && (
        <div className="absolute top-full left-0 w-full mt-1 bg-white border border-slate-100 rounded-xl shadow-xl z-50 px-3 py-2 text-xs text-slate-400 italic">
          New division: "{value}"
        </div>
      )}
    </div>
  );
};

export default UserRoleManagement;