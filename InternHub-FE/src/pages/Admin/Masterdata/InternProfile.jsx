import React, { useState, useEffect, useRef } from 'react';
import apiClient from '../../../api/axiosConfig';
import { fetchSecureBlob } from '../../../utils/secureFetch';
import {
  Search,
  Filter,
  Plus,
  Eye,
  Edit2,
  X,
  Check,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Calendar,
  ArrowLeft,
  Home,
  Upload,
  Download,
  FileSpreadsheet,
  Trash2,
  Clock
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import * as XLSX from 'xlsx';
import { getSafeErrorMessage, logError } from '../../../utils/errorHandler';

// --- STYLE CONSTANTS ---
const colors = {
  primary: "#354C8F",
  textDark: "#203266",
  bgLight: "#F8F9FD"
};

// Button Styles
const btnBase = "py-3 px-4 md:px-6 rounded-xl font-bold text-[14px] flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed";
const btnPrimary = `${btnBase} bg-[#354C8F] hover:bg-[#2a3c70] text-white shadow-md shadow-indigo-200`;
const btnSecondary = `${btnBase} bg-white border border-slate-300 text-slate-700 hover:bg-slate-50`;
const actionText = 'hidden sm:inline-block';
const btnSuccess = `${btnBase} bg-[#22C55E] hover:bg-[#16A34A] text-white shadow-md shadow-green-200`;
const btnDanger = `${btnBase} bg-[#EF4444] hover:bg-[#DC2626] text-white shadow-md shadow-red-200`;

// --- FUZZY MATCHING HELPERS (ALGORITMA PENCARIAN TYPO) ---

// 1. Hitung jarak perbedaan antar dua string (Levenshtein Algorithm)
const getLevenshteinDistance = (a, b) => {
  const matrix = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          Math.min(
            matrix[i][j - 1] + 1,   // insertion
            matrix[i - 1][j] + 1    // deletion
          )
        );
      }
    }
  }
  return matrix[b.length][a.length];
};

// 2. Fungsi Utama Pencocokan Cerdas
const findBestMatch = (input, options, threshold = 0.75) => {
  if (!input) return null;
  const normInput = String(input).toLowerCase().trim();

  let bestMatch = null;
  let bestScore = 0; // Skala 0 - 1

  options.forEach(opt => {
    const normOpt = String(opt.name).toLowerCase().trim();

    // A. Exact Match (Prioritas Utama)
    if (normInput === normOpt) {
      bestScore = 1.0;
      bestMatch = opt.name;
      return;
    }

    // B. Substring Match (Misal: "SBU SIER" -> "SIER")
    // Jika salah satu string ada di dalam string lainnya
    if (normInput.includes(normOpt) || normOpt.includes(normInput)) {
      // Kita beri skor tinggi (0.85)
      if (bestScore < 0.85) {
        bestScore = 0.85;
        bestMatch = opt.name;
      }
    }

    // C. Levenshtein Distance (Typo correction: "ITT" -> "IT")
    const distance = getLevenshteinDistance(normInput, normOpt);
    const maxLength = Math.max(normInput.length, normOpt.length);
    const score = 1 - (distance / maxLength); // Konversi jarak ke persentase kemiripan

    if (score > bestScore && score >= threshold) {
      bestScore = score;
      bestMatch = opt.name;
    }
  });

  return bestMatch; // Mengembalikan nama yang cocok atau null
};

// 3. Fungsi Untuk Mengambil Pencocokan Terdekat Tanpa Threshold
const getAcronym = (str) => {
  if (!str) return '';
  return String(str)
    .replace(/[^a-z0-9 ]+/gi, ' ')
    .split(' ')
    .filter(Boolean)
    .map(w => w[0])
    .join('')
    .toLowerCase();
};

const findClosestMatch = (input, options) => {
  if (!input) return null;
  const normInput = String(input).toLowerCase().trim();
  let bestMatch = null;
  let bestScore = -1;
  options.forEach(opt => {
    const normOpt = String(opt.name).toLowerCase().trim();
    if (normInput === normOpt) { bestScore = 1; bestMatch = opt.name; return; }
    if (normInput.includes(normOpt) || normOpt.includes(normInput)) {
      if (bestScore < 0.85) { bestScore = 0.85; bestMatch = opt.name; }
    }
    const distance = getLevenshteinDistance(normInput, normOpt);
    const maxLength = Math.max(normInput.length, normOpt.length);
    let score = 1 - (distance / maxLength);
    // Heuristic: short inputs like acronyms should match by initials (e.g., ITT -> IT Development)
    try {
      const acrOpt = getAcronym(normOpt);
      if (normInput.length <= 4 && (acrOpt.includes(normInput) || normInput.includes(acrOpt))) {
        score += 0.18;
      }
    } catch (e) { /* ignore */ }

    if (score > bestScore) { bestScore = score; bestMatch = opt.name; }
  });
  return bestMatch;
};


const InternProfiles = () => {
  // --- DATA ---
  const [interns, setInterns] = useState([]);
  const [loading, setLoading] = useState(false);
  const [meta, setMeta] = useState({ current_page: 1, last_page: 1, from: 0, to: 0, total: 0, per_page: 25 });

  // Search
  const [query, setQuery] = useState('');
  const searchTimeout = useRef(null);
  const restoreAttempted = useRef(false);

  // --- STATES ---
  const [viewMode, setViewMode] = useState('table'); // 'table', 'detail', 'edit'
  const [selectedIntern, setSelectedIntern] = useState(null);
  const [formData, setFormData] = useState({});
  const [inputWarnings, setInputWarnings] = useState({});
  const [isProcessing, setIsProcessing] = useState(false);
  const [fotoLoading, setFotoLoading] = useState(false);
  const [fotoKtmLoading, setFotoKtmLoading] = useState(false);

  // CSV Import
  const [showImportModal, setShowImportModal] = useState(false);
  const [showImportPreview, setShowImportPreview] = useState(false);
  const [showImportInfo, setShowImportInfo] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [importRows, setImportRows] = useState([]);
  const [importing, setImporting] = useState(false);
  const [userAppliedAutoFix, setUserAppliedAutoFix] = useState(false);

  // Division + Work Schedule options (for import preview mapping)
  const [divisions, setDivisions] = useState([]);
  const [divisionsLoading, setDivisionsLoading] = useState(false);
  const [workSchedules, setWorkSchedules] = useState([]);
  const [workSchedulesLoading, setWorkSchedulesLoading] = useState(false);
  const activeWorkSchedule = (workSchedules || []).find((w) => {
    const activeVal = w?.is_active;
    return activeVal === true || activeVal === 1 || String(activeVal).toLowerCase() === 'true';
  }) || null;

  // Sites for placement select
  const [sites, setSites] = useState([]);
  const [sitesLoading, setSitesLoading] = useState(false);

  // Filter options (API)
  const [filterOptions, setFilterOptions] = useState({ universities: [], divisions: [] });
  const [filterOptionsLoading, setFilterOptionsLoading] = useState(false);

  // Modals
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmType, setConfirmType] = useState('save'); // 'save' or 'delete'
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [previewImageUrl, setPreviewImageUrl] = useState(null);
  const [previewImageLabel, setPreviewImageLabel] = useState('');
  // Confirmation checkbox for destructive actions (delete intern + optional user account)
  const [deleteConfirmChecked, setDeleteConfirmChecked] = useState(false);

  const [statusType, setStatusType] = useState('success');
  const [statusMessage, setStatusMessage] = useState({ title: "", desc: "" });
  const [filter, setFilter] = useState({ university: "", division: "", status: [], startDate: "", endDate: "" });
  const [openDropdown, setOpenDropdown] = useState(null);

  // Applied filters
  const [appliedFilterUniversity, setAppliedFilterUniversity] = useState("");
  const [appliedFilterDivision, setAppliedFilterDivision] = useState("");
  const [appliedFilterStatus, setAppliedFilterStatus] = useState([]);
  const [appliedFilterStartDate, setAppliedFilterStartDate] = useState("");
  const [appliedFilterEndDate, setAppliedFilterEndDate] = useState("");

  // Pagination Logic
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const currentItems = interns;

  const paginationMeta = {
    current_page: meta.current_page || currentPage,
    last_page: meta.last_page || 1,
    from: meta.from || (interns.length ? 1 : 0),
    to: meta.to || interns.length,
    total: meta.total || interns.length,
    per_page: meta.per_page || 25
  };

  // Error helper
  const getErrorMessage = (err, fallback = 'Something went wrong') => {
    return getSafeErrorMessage(err, fallback);
  };

  const validateInternForm = () => {
    if (!formData.name || !String(formData.name).trim()) return 'Name is required.';
    return null;
  };

  const sanitizeAlphaNumSpace = (value = '') => String(value).replace(/[^a-zA-Z0-9\s]/g, '');
  const sanitizeAlphaNumNoSpace = (value = '') => String(value).replace(/[^a-zA-Z0-9]/g, '');
  const sanitizeDigitsOnly = (value = '') => String(value).replace(/[^0-9]/g, '');
  const sanitizeAddress = (value = '') => String(value).replace(/[^a-zA-Z0-9\s,/\-]/g, '');

  const handleSanitizedChange = (field, value, sanitizer, label) => {
    const sanitized = sanitizer(value);
    const hasInvalidChars = sanitized !== value;

    setFormData(prev => ({ ...prev, [field]: sanitized }));
    setInputWarnings(prev => ({
      ...prev,
      [field]: hasInvalidChars ? `${label}: special characters are not allowed.` : ''
    }));
  };

  // Format internship period
  const formatPeriod = (start, end) => {
    const parseDate = (val) => {
      if (!val) return null;
      const d = new Date(val);
      if (Number.isNaN(d.getTime())) return null;
      return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
    };
    const s = parseDate(start);
    const e = parseDate(end);
    if (s && e) return `${s} - ${e}`;
    if (s) return `Mulai ${s}`;
    if (e) return `Selesai ${e}`;
    return '';
  };

  const formatWorkSchedule = (ws) => {
    // Defaults
    // If there's no work schedule object, return empty so UI doesn't show a hard-coded default
    if (!ws) return [];

    const dayOrder = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
    const formatRange = (s, e) => `${String(s || '').substring(0, 5) || '08:00'} - ${String(e || '').substring(0, 5) || '17:00'}`;

    // Normalize days if provided as JSON string
    let wsDays = ws.days;
    if (wsDays && typeof wsDays === 'string') {
      try { const p = JSON.parse(wsDays); if (Array.isArray(p)) wsDays = p; } catch (e) { /* ignore */ }
    }

    // Helper: compress consecutive days into ranges (Mon - Fri) when possible
    const compressDays = (arr) => {
      if (!arr || !arr.length) return 'Mon - Fri';
      // normalize to dayOrder indices
      const idxs = arr.map(d => dayOrder.indexOf(String(d).toLowerCase())).filter(i => i >= 0).sort((a,b) => a-b);
      if (!idxs.length) return arr.map(d => String(d).slice(0,3)).join(', ');
      // check if fully consecutive
      let ranges = [];
      let start = idxs[0];
      let prev = idxs[0];
      for (let i=1;i<idxs.length;i++){
        const cur = idxs[i];
        if (cur === prev + 1) { prev = cur; continue; }
        ranges.push([start, prev]);
        start = cur; prev = cur;
      }
      ranges.push([start, prev]);
      const parts = ranges.map(([s,e]) => {
        if (s === e) return dayOrder[s].charAt(0).toUpperCase() + dayOrder[s].slice(1,3);
        return `${dayOrder[s].charAt(0).toUpperCase() + dayOrder[s].slice(1,3)} - ${dayOrder[e].charAt(0).toUpperCase() + dayOrder[e].slice(1,3)}`;
      });
      return parts.join(', ');
    };

    // If no per-day times, show single group using start_time/end_time
    if (!ws.day_times) {
      const daysLabel = compressDays(wsDays || ['mon','tue','wed','thu','fri']);
      return [{ days: daysLabel, time: formatRange(ws.start_time, ws.end_time) }];
    }

    // Group days by identical time ranges
    const groups = {};
    Object.entries(ws.day_times).forEach(([day, times]) => {
      const range = formatRange(times.start, times.end);
      if (!groups[range]) groups[range] = [];
      groups[range].push(day);
    });

    const mapped = Object.entries(groups).map(([time, days]) => ({ days: compressDays(days), time }));
    return mapped.length ? mapped : [defaultGroup];
  };

  // --- CSV IMPORT HELPERS ---
  const parseCsv = (text) => {
    const rows = [];
    let cur = '';
    let row = [];
    let inQuotes = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      const next = text[i + 1];
      if (c === '"') {
        if (inQuotes && next === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (c === ',' && !inQuotes) {
        row.push(cur);
        cur = '';
      } else if ((c === '\n' || c === '\r') && !inQuotes) {
        if (cur.length || row.length) {
          row.push(cur);
          rows.push(row);
        }
        cur = '';
        row = [];
        if (c === '\r' && next === '\n') i++;
      } else {
        cur += c;
      }
    }
    if (cur.length || row.length) {
      row.push(cur);
      rows.push(row);
    }
    return rows.map(r => r.map(v => String(v || '').trim()));
  };

  const normalizeKey = (k) => String(k || '').toLowerCase().replace(/\s+/g, ' ').trim();

  const csvHeaders = ['Full Name', 'Email', 'Position', 'Division', 'Placement Location', 'Internship Start', 'Internship End'];

  const importInfoItems = [
    'Use the template headers exactly as provided.',
    'Dates must be DD/MM/YYYY (example: 01/01/2026).',
    'Division can be typed; it will be matched to available divisions in preview.',
    'Placement Location must match Office Location; preview + Auto-fix can correct.',
    'Documents (Photo, Student ID) are not included in import file.'
  ];

  const downloadExcelTemplate = () => {
    const exampleRow = [
      'Alvian Maulana',
      'alvian@gmail.com',
      'Back End Programmer',
      'Back',
      'SBU SIER',
      '1/1/2026',
      '30/6/2026'
    ];

    const worksheet = XLSX.utils.aoa_to_sheet([csvHeaders, exampleRow]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Template");
    XLSX.writeFile(workbook, "intern_profiles_template.xlsx");
  };

  const mapToPreviewRows = (rows) => {
    if (!rows || rows.length === 0) return [];
    const header = rows[0].map(normalizeKey);
    const get = (row, key) => {
      const idx = header.indexOf(normalizeKey(key));
      return idx >= 0 ? row[idx] : '';
    };
    return rows.slice(1).filter(r => r.some(v => v && v.trim() !== '')).map((r, idx) => ({
      _id: idx + 1,
      fullName: get(r, 'Full Name'),
      nik: get(r, 'NIK'),
      nip: get(r, 'NIM'),
      educationLevel: get(r, 'Education Level'),
      institution: get(r, 'Institution'),
      major: get(r, 'Major'),
      email: get(r, 'Email'),
      whatsapp: get(r, 'WhatsApp Number'),
      address: get(r, 'Residential Address'),
      position: get(r, 'Position'),
      division: get(r, 'Division'),
      divisionOriginal: get(r, 'Division'), // Track original before fix
      divisionWasFixed: false,
      placement: get(r, 'Placement Location'),
      placementOriginal: get(r, 'Placement Location'), // Track original before fix
      placementWasFixed: false,
      internshipStart: get(r, 'Internship Start'),
      internshipEnd: get(r, 'Internship End'),
      workSchedule: get(r, 'Work Schedule'),
      workScheduleOriginal: get(r, 'Work Schedule'), // Track original before fix
      workScheduleWasFixed: false,
      emergencyName: get(r, 'Emergency Contact Name'),
      emergencyContact: get(r, 'Emergency Contact Number'),
      bankName: get(r, 'Bank Name'),
      accountHolder: get(r, 'Account Holder'),
      accountNumber: get(r, 'Account Number')
    }));
  };

  // --- AUTO FIX LOGIC (THE UPDATED PART) ---
  const autoFixAllImport = (silentMode = false) => {
    // Siapkan data referensi untuk matching
    const siteOptions = (sites || []).map(s => ({
      id: s.id_site ?? s.id,
      name: (s.nama_site || s.name || '').toString()
    }));

    const scheduleOptions = (workSchedules || []).map(w => ({
      id: w.id,
      name: (w.name || '').toString()
    }));

    // Ambil list nama divisi yang sudah ada sebagai referensi awal
    const dynamicDivisionOptions = (divisions || []).map(d => ({
      name: (d.name || d.nama_divis || d || '').toString()
    }));

    setImportRows(prev => prev.map(row => {
      let updated = { ...row };

      // --- 1. AUTO FIX PLACEMENT (SITES) ---
      if (row.placement) {
        // Prefer higher-confidence best match first
        const match = findBestMatch(row.placement, siteOptions, 0.65);
        if (match && match !== row.placement) {
          updated.placement = match;
          updated.placementWasFixed = true;
        } else {
          // try a relaxed closest match, but only apply if it differs
          const closest = findClosestMatch(row.placement, siteOptions);
          if (closest && closest !== row.placement) {
            updated.placement = closest;
            updated.placementWasFixed = true;
          }
          // otherwise leave placement as-is (do not assign the first site)
        }
      }

      // --- 2. AUTO FIX WORK SCHEDULE ---
      if (row.workSchedule) {
        const match = findBestMatch(row.workSchedule, scheduleOptions, 0.65);
        if (match && match !== row.workSchedule) {
          updated.workSchedule = match;
          updated.workScheduleWasFixed = true;
        } else {
          const closest = findClosestMatch(row.workSchedule, scheduleOptions);
          if (closest && closest !== row.workSchedule) {
            updated.workSchedule = closest;
            updated.workScheduleWasFixed = true;
          }
          // do not assign a default schedule when no reasonable match
        }
      }

      // --- 3. AUTO FIX DIVISION ---
      if (row.division) {
        const match = findBestMatch(row.division, dynamicDivisionOptions, 0.70);
        if (match && match !== row.division) {
          updated.division = match;
          updated.divisionWasFixed = true;
        } else {
          // Try closest existing division before creating a new one
          const closest = findClosestMatch(row.division, dynamicDivisionOptions);
          if (closest && closest !== row.division) {
            updated.division = closest;
            updated.divisionWasFixed = true;
          } else {
            const exists = dynamicDivisionOptions.some(d => d.name.toLowerCase() === (row.division || '').toLowerCase());
            if (!exists && row.division) {
              // keep original but add to options for future rows
              dynamicDivisionOptions.push({ name: row.division });
            } else if (!row.division && dynamicDivisionOptions.length > 0) {
              updated.division = dynamicDivisionOptions[0].name;
              updated.divisionWasFixed = true;
            }
          }
        }
      } else if (dynamicDivisionOptions.length > 0) {
        updated.division = dynamicDivisionOptions[0].name;
        updated.divisionWasFixed = true;
      }

      return updated;
    }));

    setDivisions(dynamicDivisionOptions);

    // Mark that user applied auto-fix (unless in silent mode)
    if (!silentMode) {
      setUserAppliedAutoFix(true);
    }
  };

  const parseDateToYmd = (val) => {
    if (!val) return '';
    const s = String(val).trim();
    if (!s) return '';
    
    // Check if it's already YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

    if (s.includes('/')) {
      const parts = s.split('/');
      if (parts.length === 3) {
        let [dd, mm, yyyy] = parts;
        if (yyyy.length === 2) yyyy = '20' + yyyy;
        if (yyyy && mm && dd) return `${yyyy}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
      }
    }
    
    const d = new Date(s);
    if (Number.isNaN(d.getTime())) return '';
    
    // Format using local time to prevent the -1 day shift caused by .toISOString() converting back to UTC!
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const getImageSrc = (field) => {
    const localPreview = field === 'foto' ? formData.fotoUrl : field === 'fotoKtm' ? formData.fotoKtmUrl : field === 'bank_proof' ? formData.bank_proofUrl : null;
    if (localPreview && typeof localPreview === 'string') return localPreview;

    const val = formData[field];
    if (!val) return null;
    if (typeof val === 'string' && val.startsWith('data:')) return val;
    if (typeof val === 'string' && val.startsWith('blob:')) return val;
    if (typeof val === 'string' && val.startsWith('http')) return val;

    let base = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/+$/, '');
    if (base.startsWith('/')) {
      base = `${window.location.origin}${base}`;
    }
    return `${base}/${String(val).replace(/^\/+/, '')}`;
  };

  // Fetch interns list
  const fetchInterns = async (page = 1, appliedOverride = null) => {
    setLoading(true);
    try {
      const effectiveApplied = appliedOverride || {
        university: appliedFilterUniversity,
        division: appliedFilterDivision,
        status: appliedFilterStatus,
        startDate: appliedFilterStartDate,
        endDate: appliedFilterEndDate
      };

      const params = { page, per_page: itemsPerPage };
      if (query && String(query).trim()) params.q = String(query).trim();
      if (effectiveApplied.university) params.university = effectiveApplied.university;
      if (effectiveApplied.division) params.division = effectiveApplied.division;
      if (effectiveApplied.status && effectiveApplied.status.length > 0) {
        params.status = effectiveApplied.status.map(s => String(s).toLowerCase()).join(',');
      }
      if (effectiveApplied.startDate) params.start_date = effectiveApplied.startDate;
      if (effectiveApplied.endDate) params.end_date = effectiveApplied.endDate;
      const res = await apiClient.get('/admin/intern-profiles', { params });
      const payload = res.data || {};
      const parseMentors = (input) => {
        if (!input) return [];
        const arr = Array.isArray(input) ? input : [input];
        return arr.map(m => {
          if (!m) return null;
          const id = m.id || m.user_id || m.mentor_id || m.id_mahasiswa || null;
          const name = m.nama_lengkap || m.mentor_name || m.name || m.nama || m.full_name || '';
          const email = m.email || m.email_address || '';
          return { id, name, email };
        }).filter(Boolean);
      };

      let items = (payload.data || []).map(i => ({
        id: i.id_mahasiswa || i.user?.user_id || i.user_id,
        idMahasiswa: i.id_mahasiswa,
        userId: i.user_id || i.user?.user_id || null,
        name: i.nama_lengkap || i.nama || '',
        nip: i.identifier || i.nim || '',
        university: i.universitas || '',
        division: i.division || '',
        jobPosition: i.job_position || '',
        period: formatPeriod(i.mulai_magang, i.akhir_magang),
        startDate: i.mulai_magang ? i.mulai_magang.split('T')[0] : '',
        endDate: i.akhir_magang ? i.akhir_magang.split('T')[0] : '',
        status: i.status || 'active',
        email: i.email || (i.user && i.user.email) || '',
        whatsapp: i.no_telp || (i.user && i.user.no_telp) || '',
        mentors: parseMentors(i.mentors || i.mentor || (i.user && (i.user.mentors || i.user.mentor))),
        placement: i.id_site ? String(i.id_site) : '',
        placementName: i.site?.nama_site || '',
        address: i.alamat || '',
        educationLevel: i.jenjang_pendidikan || i.jenjang || '',
        programStudi: i.jurusan || i.program_studi || '',
        emergencyName: i.nama_kontak_darurat || i.emergency_contact_name || '',
        emergencyContact: i.nomor_darurat || i.emergency_contact_number || '',
        raw: i
      }));

      // Client-side filtering fallback (if backend doesn't support filter params)
      if (effectiveApplied.university) {
        const uni = String(effectiveApplied.university).toLowerCase();
        items = items.filter(i => String(i.university || '').toLowerCase() === uni);
      }
      if (effectiveApplied.division) {
        const div = String(effectiveApplied.division).toLowerCase();
        items = items.filter(i => String(i.division || '').toLowerCase() === div);
      }
      if (effectiveApplied.status && effectiveApplied.status.length > 0) {
        const statuses = effectiveApplied.status.map(s => String(s).toLowerCase());
        items = items.filter(i => statuses.includes(String(i.status || '').toLowerCase()));
      }
      if (effectiveApplied.startDate) {
        const start = String(effectiveApplied.startDate);
        items = items.filter(i => i.startDate && i.startDate >= start);
      }
      if (effectiveApplied.endDate) {
        const end = String(effectiveApplied.endDate);
        items = items.filter(i => i.endDate && i.endDate <= end);
      }

      setInterns(items);
      setMeta({
        current_page: payload.current_page || page,
        last_page: payload.last_page || 1,
        from: payload.from || (items.length ? 1 : 0),
        to: payload.to || items.length,
        total: payload.total || items.length,
        per_page: payload.per_page || items.length
      });
    } catch (err) {
      console.error('Failed to fetch interns', err);
      setStatusType('error');
      setStatusMessage({ title: 'Load Failed', desc: getErrorMessage(err, 'Unable to load interns.') });
      setShowStatusModal(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInterns(currentPage);
    return () => { if (searchTimeout.current) clearTimeout(searchTimeout.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, itemsPerPage]);

  const fetchSites = async () => {
    setSitesLoading(true);
    try {
      const res = await apiClient.get('/sites');
      const payload = res.data || {};
      const data = payload.data || payload;
      if (Array.isArray(data)) setSites(data);
      else setSites([]);
    } catch (err) {
      console.error('Failed to fetch sites', err);
    } finally {
      setSitesLoading(false);
    }
  };

  useEffect(() => {
    fetchSites();
  }, []);

  const fetchDivisions = async () => {
    setDivisionsLoading(true);
    try {
      const res = await apiClient.get('/available-divisions');
      const data = res.data?.data || res.data || [];
      const items = Array.isArray(data) ? data.map(d => typeof d === 'string' ? { name: d } : d) : [];
      setDivisions(items);
    } catch (err) {
      console.error('Failed to fetch divisions', err);
      setDivisions([]);
    } finally {
      setDivisionsLoading(false);
    }
  };

  const fetchWorkSchedules = async () => {
    setWorkSchedulesLoading(true);
    try {
      const res = await apiClient.get('/admin/work-schedules');
      const data = res.data?.data || res.data || [];
      const items = Array.isArray(data) ? data.map(w => {
        // normalize days if returned as JSON string
        let days = w.days;
        if (days && typeof days === 'string') {
          try { const p = JSON.parse(days); if (Array.isArray(p)) days = p; } catch (e) { /* ignore */ }
        }
        return {
          ...w,
          days,
        };
      }) : [];
      setWorkSchedules(items);
    } catch (err) {
      console.error('Failed to fetch work schedules', err);
      setWorkSchedules([]);
    } finally {
      setWorkSchedulesLoading(false);
    }
  };

  useEffect(() => {
    fetchDivisions();
    fetchWorkSchedules();
  }, []);

  useEffect(() => {
    if (viewMode !== 'edit' || !activeWorkSchedule) return;
    setFormData((prev) => {
      const currentId = prev?.work_schedule?.id ?? prev?.work_schedule_id ?? null;
      if (currentId && String(currentId) === String(activeWorkSchedule.id)) return prev;
      return { ...prev, work_schedule: activeWorkSchedule, work_schedule_id: activeWorkSchedule.id };
    });
  }, [activeWorkSchedule, viewMode]);

  const fetchFilterOptions = async () => {
    try {
      setFilterOptionsLoading(true);
      const res = await apiClient.get('/admin/filters');
      const data = res.data?.data || {};
      const universities = data.universities || data?.universitas || [];
      const divisions = data.divisions || [];
      setFilterOptions({ universities, divisions });
    } catch (err) {
      console.error('Failed to fetch filter options', err);
      setFilterOptions({ universities: [], divisions: [] });
    } finally {
      setFilterOptionsLoading(false);
    }
  };

  useEffect(() => {
    fetchFilterOptions();
  }, []);

  useEffect(() => {
    return () => {
      try { if (formData.fotoUrl) URL.revokeObjectURL(formData.fotoUrl); } catch (e) { }
      try { if (formData.fotoKtmUrl) URL.revokeObjectURL(formData.fotoKtmUrl); } catch (e) { }
      try { if (formData.bank_proofUrl) URL.revokeObjectURL(formData.bank_proofUrl); } catch (e) { }
    };
  }, [formData.fotoUrl, formData.fotoKtmUrl, formData.bank_proofUrl]);

  // Handle browser back button when in edit mode
  useEffect(() => {
    if (viewMode !== 'edit') return;

    // Push a dummy state to history stack
    window.history.pushState(null, null, window.location.href);

    const handlePopState = (e) => {
      // Show confirmation modal instead of going back
      setConfirmType('cancel');
      setShowConfirmModal(true);
      // Push state again to keep user on current page
      window.history.pushState(null, null, window.location.href);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [viewMode]);

  // Import handlers
  const fileInputRef = useRef(null);

  const handleSelectImportFile = (e) => {
    const file = e.target.files?.[0];
    if (file) setImportFile(file);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDropFile = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const files = e.dataTransfer?.files;
    if (files && files[0]) {
      setImportFile(files[0]);
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) setImportFile(file);
  };

  const clearImportFile = () => {
    setImportFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const resetImport = () => {
    setImportFile(null);
    setImportRows([]);
    setShowImportPreview(false);
    setUserAppliedAutoFix(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handlePreviewImport = async () => {
    if (!importFile) return;
    setImporting(true);
    try {
      // Fetch all needed data first
      if (!divisions || divisions.length === 0) await fetchDivisions();
      if (!workSchedules || workSchedules.length === 0) await fetchWorkSchedules();
      if (!sites || sites.length === 0) await fetchSites();

        let parsed = [];
        if (importFile.name.endsWith('.csv')) {
          const text = await importFile.text();
          parsed = parseCsv(text);
        } else if (importFile.name.endsWith('.xlsx') || importFile.name.endsWith('.xls')) {
          const arrayBuffer = await importFile.arrayBuffer();
          const uint8 = new Uint8Array(arrayBuffer);
          // cellDates: true → Excel date serials become JS Date objects
          const workbook = XLSX.read(uint8, { type: 'array', cellDates: true });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

          // Normalize date cells → DD/MM/YYYY string using local time (avoids Excel serial/timezone issues)
          const normalizeCell = (cell) => {
            if (cell instanceof Date) {
              // Add 12 hours to avoid timezone shift pushing it back a day
              cell.setHours(cell.getHours() + 12);
              const d = String(cell.getDate()).padStart(2, '0');
              const m = String(cell.getMonth() + 1).padStart(2, '0');
              const y = cell.getFullYear();
              return `${d}/${m}/${y}`;
            }
            return cell;
          };

          // Filter out completely empty rows and normalize date cells
          parsed = jsonData
            .filter(row => row.some(cell => cell !== ''))
            .map(row => row.map(normalizeCell));
        } else {
          throw new Error('Unsupported file format. Please upload a .csv or .xlsx file.');
        }

        const rows = mapToPreviewRows(parsed);
        setImportRows(rows);
        setShowImportPreview(true);

        // Automatically detect issues (but don't show modal)
        setTimeout(() => {
          autoFixAllImport(true);
        }, 100);
      } catch (err) {
        logError('handlePreviewImport', err);
        setStatusType('error');
        setStatusMessage({ title: 'Import Failed', desc: getSafeErrorMessage(err, 'Unable to read file.') });
        setShowStatusModal(true);
        setShowImportPreview(false);
        setUserAppliedAutoFix(false);
      } finally {
        setImporting(false);
      }
  };

  const executeImport = async () => {
    if (!importRows || importRows.length === 0) return;
    setImporting(true);
    try {
      const payloads = importRows.map(r => ({
        nama: r.fullName || null,
        nik: r.nik || null,
        identifier: r.nip || null,
        email: r.email || null,
        no_telp: r.whatsapp || null,
        universitas: r.institution || null,
        jurusan: r.major || null,
        jenjang_pendidikan: r.educationLevel || null,
        job_position: r.position || null,
        division: r.division || null,
        mulai_magang: parseDateToYmd(r.internshipStart),
        akhir_magang: parseDateToYmd(r.internshipEnd),
        alamat: r.address || null,
        nama_kontak_darurat: r.emergencyName || null,
        nomor_darurat: r.emergencyContact || null,
        bank_name: r.bankName || null,
        account_holder: r.accountHolder || null,
        account_number: r.accountNumber || null,
        id_site: (sites || []).find(s => (s.nama_site || s.name) === r.placement)?.id_site
          ?? (sites || []).find(s => (s.nama_site || s.name) === r.placement)?.id
          ?? null,
        work_schedule_id: (workSchedules || []).find(w => (w.name || w.title || '').toString() === String(r.workSchedule))?.id
          ?? null,
        status: 'active'
      }));

      // Biar lebih cepat, kita eksekusi secara paralel dalam beberapa batch (misal 5-10 request sekaligus)
      // ketimbang menunggu satu-satu (sequential) yang memakan waktu sangat lama.
      const batchSize = 10;
      for (let i = 0; i < payloads.length; i += batchSize) {
        const batch = payloads.slice(i, i + batchSize);
        await Promise.all(batch.map(p => apiClient.post('/admin/intern-profiles', p)));
      }

      resetImport();
      setShowImportModal(false);
      setStatusType('success');
      setStatusMessage({ title: 'Imported', desc: 'Intern profiles imported successfully.' });
      setShowStatusModal(true);
      fetchInterns(1);
    } catch (err) {
      logError('executeImport', err);
      setStatusType('error');
      setStatusMessage({ title: 'Import Failed', desc: getErrorMessage(err, 'Unable to import interns.') });
      setShowStatusModal(true);
    } finally {
      setImporting(false);
    }
  };

  const handlePageChange = (page) => {
    const last = paginationMeta.last_page || 1;
    if (page >= 1 && page <= last) setCurrentPage(page);
  };

  const handleOpenDetail = (item) => {
    fetchInternById(item.id, 'detail');
  };

  const handleEditProfile = (item) => {
    fetchInternById(item.id, 'edit');
  };

  const handleBackToTable = () => {
    // Show confirmation modal only if in edit mode (form has unsaved changes potential)
    if (viewMode === 'edit') {
      setConfirmType('cancel');
      setShowConfirmModal(true);
    } else {
      // In detail view or table view, go back directly
      setViewMode("table");
      setSelectedIntern(null);
    }
  };

  const handleSaveChangesInit = (type = 'save') => {
    // reset the delete-account checkbox each time the modal is opened
    setDeleteConfirmChecked(false);
    setConfirmType(type);
    setShowConfirmModal(true);
  };

  // Fetch single intern detail
  const fetchInternById = async (id, mode = 'detail') => {
    setLoading(true);
    try {
      // Mode checks removed
      const res = await apiClient.get(`/admin/intern-profiles/${id}`);
      const payload = res.data?.data || res.data || {};
      const u = payload.user || payload; // User object
      const mahasiswa = payload.mahasiswa || {}; // Student-specific data
      const workSchedule = payload.work_schedule || mahasiswa.work_schedule || u.work_schedule || null; // Work schedule (may be id or object). Also check mahasiswa.work_schedule

      const parseMentors = (input) => {
        if (!input) return [];
        const arr = Array.isArray(input) ? input : [input];
        return arr.map(m => {
          if (!m) return null;
          const id = m.id_mahasiswa || m.id || m.user_id || m.mentor_id || null;
          const name = m.nama_lengkap || m.mentor_name || m.name || m.nama || m.full_name || '';
          const email = m.email || m.email_address || '';
          return { id, name, email };
        }).filter(Boolean);
      };

      // Always prioritize mahasiswa id for intern profile actions; keep user id separately.
      const resolvedMahasiswaId = mahasiswa?.id_mahasiswa || payload?.id_mahasiswa || u?.id_mahasiswa || null;
      const resolvedUserId = u?.user_id || mahasiswa?.user_id || u?.id || null;
      const item = {
        id: resolvedMahasiswaId ?? resolvedUserId,
        idMahasiswa: resolvedMahasiswaId ?? null,
        userId: resolvedUserId ?? null,
        name: mahasiswa.nama || mahasiswa.nama_lengkap || u.nama_lengkap || u.nama || '',
        nik: mahasiswa.nik || u.nik || '',
        nip: mahasiswa.nim || u.identifier || '',
        username: u.username || '',
        gender: mahasiswa.gender || u.gender || '',
        university: mahasiswa.universitas || u.universitas || '',
        division: mahasiswa.division || u.division || '',
        major: mahasiswa.jurusan || u.jurusan || '',
        jobPosition: mahasiswa.job_position || u.job_position || '',
        period: formatPeriod(mahasiswa.mulai_magang || u.mulai_magang, mahasiswa.akhir_magang || u.akhir_magang),
        startDate: (mahasiswa.mulai_magang || u.mulai_magang) ? (mahasiswa.mulai_magang || u.mulai_magang).split('T')[0] : '',
        endDate: (mahasiswa.akhir_magang || u.akhir_magang) ? (mahasiswa.akhir_magang || u.akhir_magang).split('T')[0] : '',
        status: (u && u.status) || mahasiswa.status || 'active',
        email: u && u.email ? u.email : (mahasiswa.email || ''),
        whatsapp: mahasiswa.no_telp || u.no_telp || '',
        mentors: parseMentors(u.mentors || u.mentor || mahasiswa.mentors || mahasiswa.mentor || []),
        placement: (mahasiswa.id_site || u.id_site) ? String(mahasiswa.id_site || u.id_site) : '',
        placementName: (mahasiswa.site?.nama_site || u.site?.nama_site) || '',
        // New Fields
        address: mahasiswa.alamat || u.alamat || '',
        educationLevel: mahasiswa.jenjang_pendidikan || u.jenjang_pendidikan || '',
        programStudi: mahasiswa.jurusan || u.jurusan || '',
        emergencyName: mahasiswa.nama_kontak_darurat || u.nama_kontak_darurat || '',
        emergencyContact: mahasiswa.nomor_darurat || u.nomor_darurat || '',
        // Bank details (support multiple backend field names)
        bank_name: mahasiswa.bank_name || u.bank_name || u.nama_bank || u.bank || '',
        account_holder: mahasiswa.bank_account_name || u.account_holder || u.bank_account_name || u.nama_pemegang_rekening || u.account_name || '',
        account_number: mahasiswa.bank_account_number || u.account_number || u.bank_account_number || u.no_rekening || u.rekening || '',
        bank_proof: (resolvedMahasiswaId ?? resolvedUserId) ? `/admin/intern-profiles/${resolvedMahasiswaId ?? resolvedUserId}/bank-proof` : (mahasiswa.bank_proof || u.bank_proof || null),
        // Foto endpoint should use mahasiswa id whenever available
        foto: (resolvedMahasiswaId ?? resolvedUserId) ? `/admin/intern-profiles/${resolvedMahasiswaId ?? resolvedUserId}/photo` : null,
        fotoKtm: (resolvedMahasiswaId ?? resolvedUserId) ? `/admin/intern-profiles/${resolvedMahasiswaId ?? resolvedUserId}/photo?type=ktm` : null,
        // Raw for reference
        work_schedule_id: workSchedule,
        raw: { user: u, mahasiswa: mahasiswa }
      };
      // If API returned only placement/work schedule IDs, try to resolve human-friendly data
      try {
        // Resolve placement name from sites list when missing
        const resolvedPlacementId = mahasiswa.id_site || u.id_site || null;
        if (resolvedPlacementId && (!item.placementName || String(item.placementName).trim() === '')) {
          const foundSite = (sites || []).find(s => {
            const sid = s.id_site ?? s.id;
            return String(sid) === String(resolvedPlacementId) || String(s.id) === String(resolvedPlacementId);
          });
          if (foundSite) {
            item.placementName = foundSite.nama_site || foundSite.name || '';
            const fid = foundSite.id_site ?? foundSite.id ?? resolvedPlacementId;
            item.placement = String(fid);
          }
        }

        // Normalize work schedule to an object with name/day_times for display
        let resolvedWs = null;
        if (workSchedule) {
          if (typeof workSchedule === 'object' && (workSchedule.name || workSchedule.day_times)) {
            resolvedWs = workSchedule;
            } else {
              let foundWs = (workSchedules || []).find(w => String(w.id) === String(workSchedule) || String(w.id) === String(workSchedule?.id));
              // If not found locally, attempt to fetch single schedule from API
              if (!foundWs) {
                try {
                  const one = await apiClient.get(`/admin/work-schedules/${workSchedule}`);
                  const onePayload = one.data?.data || one.data || null;
                  if (onePayload) foundWs = onePayload;
                } catch (e) {
                  // ignore fetch error; we'll fallback below
                }
              }
              if (foundWs) {
                // normalize days if backend returns JSON string
                try {
                  if (foundWs.days && typeof foundWs.days === 'string') {
                    const parsed = JSON.parse(foundWs.days);
                    foundWs.days = Array.isArray(parsed) ? parsed : foundWs.days;
                  }
                } catch (e) { /* ignore parse errors */ }
                resolvedWs = foundWs;
              } else resolvedWs = { id: workSchedule, name: '' };
            }
        }
        if (resolvedWs) {
          item.work_schedule = resolvedWs;
          item.work_schedule_id = resolvedWs.id ?? resolvedWs;
        }
      } catch (e) {
        console.warn('Failed to resolve placement/work-schedule from local lists', e);
      }

      setFormData(item);
      setSelectedIntern(item);
      setViewMode(mode === 'edit' ? 'edit' : 'detail');
    } catch (err) {
      console.error('Failed to fetch intern detail', err);
      setStatusType('error');
      setStatusMessage({ title: 'Load Failed', desc: getErrorMessage(err, 'Unable to load intern detail.') });
      setShowStatusModal(true);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    if (restoreAttempted.current) return;
    restoreAttempted.current = true;
    // Removed old local storage restoration code
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reset the delete-account checkbox whenever the confirm modal closes
  useEffect(() => {
    if (!showConfirmModal) setDeleteConfirmChecked(false);
  }, [showConfirmModal]);

  const handleFileChange = (e, field) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validasi tipe: image atau PDF
    const isImage = file.type && file.type.startsWith('image/');
    const isPdf = file.type === 'application/pdf';
    if (!isImage && !isPdf) {
      setStatusType('error');
      setStatusMessage({ title: 'Invalid File', desc: 'Only image or PDF files are allowed.' });
      setShowStatusModal(true);
      return;
    }

    // Batas ukuran: gambar 2MB, PDF 5MB
    const maxSize = isPdf ? 5 * 1024 * 1024 : 2 * 1024 * 1024;
    if (file.size > maxSize) {
      setStatusType('error');
      setStatusMessage({ title: 'File Too Large', desc: `Maximum file size is ${isPdf ? '5MB' : '2MB'}.` });
      setShowStatusModal(true);
      return;
    }

    const fieldKey = field === 'foto' ? 'fotoFile' : field === 'fotoKtm' ? 'fotoKtmFile' : `${field}File`;
    const previewFieldKey = field === 'foto' ? 'fotoUrl' : field === 'fotoKtm' ? 'fotoKtmUrl' : `${field}Url`;
    const objectUrl = isImage ? URL.createObjectURL(file) : null;

    setFormData(prev => {
      const prevPreview = prev[previewFieldKey];
      if (prevPreview && typeof prevPreview === 'string' && prevPreview.startsWith('blob:')) {
        try { URL.revokeObjectURL(prevPreview); } catch (err) { }
      }

      return {
        ...prev,
        [field]: objectUrl || prev[field] || null,
        [fieldKey]: file,
        [previewFieldKey]: objectUrl || prev[previewFieldKey] || null
      };
    });

  };

  const createIntern = async () => {
    const v = validateInternForm();
    if (v) { setStatusType('error'); setStatusMessage({ title: 'Validation', desc: v }); setShowStatusModal(true); return; }
    setIsProcessing(true);
    try {
      // Resolve IDs for site and work schedule before sending
      const resolveSiteId = (placement) => {
        if (!placement && placement !== 0) return null;
        if (/^\d+$/.test(String(placement))) return Number(placement);
        const found = (sites || []).find(s => (s.nama_site || s.name || '').toString() === String(placement));
        return found ? (found.id_site ?? found.id ?? null) : null;
      };

      const resolveWorkScheduleId = (ws) => {
        if (!ws) return null;
        if (typeof ws === 'object' && ws.id) return ws.id;
        if (/^\d+$/.test(String(ws))) return Number(ws);
        const found = (workSchedules || []).find(w => (w.name || '').toString() === String(ws));
        return found ? (found.id ?? null) : null;
      };

      const siteIdForSend = resolveSiteId(formData.placement);
      const workScheduleIdForSend = resolveWorkScheduleId(formData.work_schedule);

      if (formData.fotoFile || formData.fotoKtmFile || formData.bank_proofFile) {
        const fd = new FormData();
        fd.append('nama', formData.name || '');
        fd.append('nik', formData.nik || '');
        fd.append('identifier', formData.nip || '');
        fd.append('email', formData.email || '');
        fd.append('no_telp', formData.whatsapp || '');
        fd.append('gender', formData.gender || '');
        fd.append('universitas', formData.university || '');
        fd.append('jurusan', formData.programStudi || '');
        fd.append('jenjang_pendidikan', formData.educationLevel || '');
        fd.append('job_position', formData.jobPosition || '');
        fd.append('division', formData.division || '');
        fd.append('mulai_magang', formData.startDate || '');
        fd.append('akhir_magang', formData.endDate || '');
        fd.append('alamat', formData.address || '');
        fd.append('nomor_darurat', formData.emergencyContact || '');
        fd.append('nama_kontak_darurat', formData.emergencyName || '');
        fd.append('bank_name', formData.bank_name || '');
        fd.append('account_holder', formData.account_holder || '');
        fd.append('account_number', formData.account_number || '');
        fd.set('nama_bank', formData.bank_name || '');
        fd.set('bank_account_name', formData.account_holder || '');
        fd.set('bank_account_number', formData.account_number || '');
        fd.set('no_rekening', formData.account_number || '');
        fd.append('id_site', siteIdForSend ? String(siteIdForSend) : '');
        if (workScheduleIdForSend) fd.append('work_schedule', String(workScheduleIdForSend));
        fd.append('status', formData.status || 'active');
        fd.append('foto', formData.fotoFile || '');
        fd.append('foto_ktm', formData.fotoKtmFile || '');
        fd.append('bank_proof', formData.bank_proofFile || '');
        fd.append('foto_rekening', formData.bank_proofFile || '');

        await apiClient.post('/admin/intern-profiles', fd);
      } else {
        const payload = {
          nama: formData.name,
          nik: formData.nik || null,
          identifier: formData.nip,
          email: formData.email || null,
          no_telp: formData.whatsapp || null,
          gender: formData.gender || null,
          universitas: formData.university || null,
          jurusan: formData.programStudi || null,
          jenjang_pendidikan: formData.educationLevel || null,
          job_position: formData.jobPosition || null,
          division: formData.division || null,
          mulai_magang: formData.startDate || null,
          akhir_magang: formData.endDate || null,
          alamat: formData.address || null,
          nomor_darurat: formData.emergencyContact || null,
          nama_kontak_darurat: formData.emergencyName || null,
          id_site: siteIdForSend,
          work_schedule_id: workScheduleIdForSend,
          status: formData.status || 'active',
          foto: formData.foto || null,
          foto_ktm: formData.fotoKtm || null,
          bank_proof: formData.bank_proof || null,
          foto_rekening: formData.bank_proof || null
        };
        await apiClient.post('/admin/intern-profiles', payload);
      }
      setStatusType('success');
      setStatusMessage({ title: 'Created', desc: 'Intern has been added successfully.' });
      setViewMode('table');
      fetchInterns(1);
    } catch (err) {
      console.error('Create failed', err);
      setStatusType('error');
      setStatusMessage({ title: 'Create Failed', desc: getErrorMessage(err, 'Unable to create intern.') });
    } finally {
      setIsProcessing(false);
      setShowStatusModal(true);
    }
  };

  const updateIntern = async () => {
    const v = validateInternForm();
    if (v) { setStatusType('error'); setStatusMessage({ title: 'Validation', desc: v }); setShowStatusModal(true); return; }
    setIsProcessing(true);
    try {
      const mahasiswaId = selectedIntern?.idMahasiswa || formData?.idMahasiswa || selectedIntern?.raw?.mahasiswa?.id_mahasiswa || selectedIntern?.id;
      if (!mahasiswaId) throw new Error('Mahasiswa ID not found');

      const resolveSiteId = (placement) => {
        if (!placement && placement !== 0) return null;
        if (/^\d+$/.test(String(placement))) return Number(placement);
        const found = (sites || []).find(s => (s.nama_site || s.name || '').toString() === String(placement));
        return found ? (found.id_site ?? found.id ?? null) : null;
      };

      const resolveWorkScheduleId = (ws) => {
        if (!ws) return null;
        if (typeof ws === 'object' && ws.id) return ws.id;
        if (/^\d+$/.test(String(ws))) return Number(ws);
        const found = (workSchedules || []).find(w => (w.name || '').toString() === String(ws));
        return found ? (found.id ?? null) : null;
      };

      const siteIdForSend = resolveSiteId(formData.placement);
      const workScheduleIdForSend = resolveWorkScheduleId(formData.work_schedule);

      if (formData.fotoFile || formData.fotoKtmFile || formData.bank_proofFile) {
        const fd = new FormData();
        fd.append('_method', 'PUT');
        fd.append('nama_lengkap', formData.name || '');
        // also include common aliases to increase backend compatibility
        fd.append('name', formData.name || '');
        fd.append('full_name', formData.name || '');
        fd.append('nik', formData.nik || '');
        fd.append('identifier', formData.nip || '');
        fd.append('email', formData.email || '');
        fd.append('user_email', formData.email || '');
        fd.append('no_telp', formData.whatsapp || '');
        fd.append('gender', formData.gender || '');
        fd.append('universitas', formData.university || '');
        fd.append('jurusan', formData.programStudi || '');
        fd.append('jenjang_pendidikan', formData.educationLevel || '');
        fd.append('job_position', formData.jobPosition || '');
        fd.append('division', formData.division || '');
        fd.append('mulai_magang', formData.startDate || '');
        fd.append('akhir_magang', formData.endDate || '');
        fd.append('alamat', formData.address || '');
        fd.append('nomor_darurat', formData.emergencyContact || '');
        fd.append('nama_kontak_darurat', formData.emergencyName || '');
        // Detail bank
        fd.append('bank_name', formData.bank_name || '');
        fd.append('account_holder', formData.account_holder || '');
        fd.append('account_number', formData.account_number || '');
        // Juga set alias umum
        fd.set('nama_bank', formData.bank_name || '');
        fd.set('bank_account_name', formData.account_holder || '');
        fd.set('bank_account_number', formData.account_number || '');
        fd.set('no_rekening', formData.account_number || '');
        fd.append('id_site', siteIdForSend ? String(siteIdForSend) : '');
        if (workScheduleIdForSend) fd.append('work_schedule', String(workScheduleIdForSend));
        fd.append('status', formData.status || '');
        fd.append('foto', formData.fotoFile || '');
        fd.append('foto_ktm', formData.fotoKtmFile || '');
        fd.append('bank_proof', formData.bank_proofFile || '');
        fd.append('foto_rekening', formData.bank_proofFile || '');

        await apiClient.post(`/admin/intern-profiles/${mahasiswaId}`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      } else {
        const payload = {
          nama_lengkap: formData.name,
          name: formData.name,
          full_name: formData.name,
          nik: formData.nik || null,
          identifier: formData.nip,
          email: formData.email || null,
          user_email: formData.email || null,
          no_telp: formData.whatsapp || null,
          gender: formData.gender || null,
          universitas: formData.university || null,
          jurusan: formData.programStudi || null,
          jenjang_pendidikan: formData.educationLevel || null,
          job_position: formData.jobPosition || null,
          division: formData.division || null,
          mulai_magang: formData.startDate || null,
          akhir_magang: formData.endDate || null,
          alamat: formData.address || null,
          nomor_darurat: formData.emergencyContact || null,
          nama_kontak_darurat: formData.emergencyName || null,
          bank_name: formData.bank_name || null,
          account_holder: formData.account_holder || null,
          account_number: formData.account_number || null,
          id_site: siteIdForSend,
          work_schedule_id: workScheduleIdForSend,
          work_schedule: workScheduleIdForSend,
          status: formData.status || null,
          bank_proof: formData.bank_proof || null,
          foto_rekening: formData.bank_proof || null
        };
        await apiClient.put(`/admin/intern-profiles/${mahasiswaId}`, payload);
      }
      setStatusType('success');
      setStatusMessage({ title: 'Updated', desc: 'Intern has been updated successfully.' });
      // Refresh the list and detail view to reflect changes
      await fetchInterns(currentPage);
      await fetchInternById(mahasiswaId, 'detail');
      setViewMode('detail');
    } catch (err) {
      console.error('Update failed', err);
      setStatusType('error');
      setStatusMessage({ title: 'Update Failed', desc: getErrorMessage(err, 'Failed to update intern data.') });
    } finally {
      setIsProcessing(false);
      setShowStatusModal(true);
    }
  };

  const deleteIntern = async (showNotification = true) => {
    setIsProcessing(true);
    try {
      const id = selectedIntern?.id;
      if (!id) throw new Error('Missing intern id');
      // Backend route for deletion is registered under admin prefix: DELETE /api/admin/mahasiswa/{id}
      // Call the admin-prefixed route so the request matches the server registration.
      await apiClient.delete(`/admin/mahasiswa/${id}`);
      if (showNotification) {
        setStatusType('success');
        setStatusMessage({ title: 'Deleted', desc: 'Intern has been deleted successfully.' });
      }
      setViewMode('table');
      fetchInterns(1);
      return true;
    } catch (err) {
      console.error('Delete failed', err);
      if (showNotification) {
        setStatusType('error');
        setStatusMessage({ title: 'Delete Failed', desc: getErrorMessage(err, 'Unable to delete intern.') });
      }
      return false;
    } finally {
      setIsProcessing(false);
      if (showNotification) {
        setShowStatusModal(true);
      }
    }
  };

  const executeSaveChanges = async () => {
    setShowConfirmModal(false);
    if (confirmType === 'delete') {
      await deleteIntern(true);
    } else if (confirmType === 'cancel') {
      setViewMode("table");
      setSelectedIntern(null);
    } else if (confirmType === 'create') {
      await createIntern();
    } else if (confirmType === 'save') {
      if (selectedIntern && selectedIntern.id) await updateIntern();
      else await createIntern();
    }
  };

  const handleFilterToggle = (category, value) => {
    if (category === 'status') {
      setFilter(prev => {
        const current = prev.status;
        const updated = current.includes(value) ? current.filter(item => item !== value) : [...current, value];
        return { ...prev, status: updated };
      });
    } else {
      setFilter({ ...filter, [category]: value });
    }
  };

  const handleDropdownSelect = (key, value) => {
    setFilter(prev => ({ ...prev, [key]: value || "" }));
    setOpenDropdown(null);
  };

  const renderDropdown = (label, key, options, placeholder) => {
    const currentValue = filter[key];
    const resolveLabel = (val) => {
      const found = options.find(opt => (opt.value ?? opt) === val);
      return found ? (found.label ?? found.value ?? found) : placeholder;
    };

    return (
      <div className="relative">
        <label className="block text-sm font-bold text-slate-800 mb-2">{label}</label>
        <button
          type="button"
          onClick={() => setOpenDropdown(openDropdown === key ? null : key)}
          className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 bg-white shadow-sm flex items-center justify-between hover:border-[#354C8F]/50 transition-colors"
        >
          <span>{currentValue ? resolveLabel(currentValue) : placeholder}</span>
          <ChevronDown size={18} className={`text-slate-400 transition-transform ${openDropdown === key ? 'rotate-180' : ''}`} />
        </button>
        {openDropdown === key && (
          <div className="absolute inset-x-0 mt-2 bg-white rounded-xl border border-slate-100 shadow-xl z-20 overflow-hidden">
            <div className="max-h-56 overflow-y-auto">
              {options.map(opt => {
                const value = opt.value ?? opt;
                const labelText = opt.label ?? opt;
                const active = currentValue === value;
                return (
                  <button
                    key={value || 'empty'}
                    type="button"
                    onClick={() => handleDropdownSelect(key, value)}
                    className={`w-full px-4 py-2.5 text-left text-sm flex items-center justify-between hover:bg-slate-50 ${active ? 'bg-[#354C8F]/5 text-[#27345A] font-semibold' : ''}`}
                  >
                    <span>{labelText}</span>
                    {active && <Check size={16} className="text-[#354C8F]" />}
                  </button>
                );
              })}
            </div>
            {currentValue && (
              <button
                type="button"
                onClick={() => handleDropdownSelect(key, "")}
                className="w-full px-4 py-2.5 text-left text-sm text-slate-500 hover:bg-slate-50 border-t border-slate-100"
              >
                Clear selection
              </button>
            )}
          </div>
        )}
      </div>
    );
  };

  const resetFilter = () => {
    setFilter({ university: "", division: "", status: [], startDate: "", endDate: "" });
    setAppliedFilterUniversity("");
    setAppliedFilterDivision("");
    setAppliedFilterStatus([]);
    setAppliedFilterStartDate("");
    setAppliedFilterEndDate("");
    setCurrentPage(1);
    fetchInterns(1, {
      university: "",
      division: "",
      status: [],
      startDate: "",
      endDate: ""
    });
  };

  // --- ADD NEW DIVISION TO API ---
  const addNewDivision = async (divisionName) => {
    try {
      const response = await apiClient.post('/available-divisions', { name: divisionName });
      if (response.status === 201 || response.status === 200) {
        setDivisions(prev => [
          ...prev,
          { name: divisionName, id: response.data?.id || divisionName }
        ]);
        return true;
      }
    } catch (err) {
      console.error('Failed to add division:', err);
      return false;
    }
  };

  // --- COMPONENTS ---

  const CreatableDivisionSelect = ({ value, onChange, options }) => {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef(null);

    // Disable typing: only allow selecting from provided options
    const available = options || [];

    useEffect(() => {
      const handleClickOutside = (event) => {
        if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
          setIsOpen(false);
        }
      };
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
      <div ref={dropdownRef} className="relative w-full">
        <div
          onClick={() => setIsOpen(!isOpen)}
          className="w-full px-4 py-3.5 border border-slate-300 rounded-xl text-sm bg-white cursor-pointer focus:outline-none focus:border-[#354C8F] flex items-center justify-between transition-colors"
        >
          <span className={value ? "text-slate-800" : "text-slate-400"}>{value || 'Select Division'}</span>
          <ChevronDown size={16} className="text-slate-400" />
        </div>

        {isOpen && (
          <div className="absolute top-full left-0 right-0 mt-1 border border-slate-200 rounded-lg bg-white shadow-lg z-50 max-h-48 overflow-y-auto">
            <div className="py-1">
              {available.map((opt, i) => {
                const optName = typeof opt === 'string' ? opt : opt.name || '';
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => {
                      onChange(optName);
                      setIsOpen(false);
                    }}
                    className={`w-full text-left px-4 py-3 text-sm border-b border-slate-50 hover:bg-slate-50 transition-colors ${(value === optName) ? 'bg-blue-50 text-[#354C8F] font-bold' : 'text-slate-700'}`}
                  >
                    {optName}
                  </button>
                );
              })}
              {available.length === 0 && (
                <div className="px-4 py-3 text-sm text-slate-500">No divisions available</div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  const SimpleSelect = ({ value, onChange, options, label, searchable = true }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [inputValue, setInputValue] = useState('');
    const dropdownRef = useRef(null);

    const filteredOptions = (options || []).filter(opt => {
      const optName = typeof opt === 'string' ? opt : opt.name || '';
      if (!searchable) return true;
      return optName.toLowerCase().includes(inputValue.toLowerCase());
    });

    useEffect(() => {
      const handleClickOutside = (event) => {
        if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
          setIsOpen(false);
          setInputValue('');
        }
      };

      if (isOpen) document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen]);

    return (
      <div ref={dropdownRef} className="relative w-full">
        <div
          onClick={() => setIsOpen(!isOpen)}
          className="w-full h-[36px] px-3 border border-slate-200 rounded-lg text-xs bg-white cursor-pointer focus:outline-none focus:border-[#354C8F] flex items-center justify-between"
        >
          <span className="text-slate-700">{value || `Select ${label}`}</span>
          <ChevronDown size={14} className="text-slate-400" />
        </div>

        {isOpen && (
          <div className="absolute top-full left-0 right-0 mt-1 border border-slate-200 rounded-lg bg-white shadow-lg z-50 max-h-48 overflow-y-auto">
            {searchable && (
              <div className="p-2 border-b border-slate-100 sticky top-0 bg-white">
                <input
                  type="text"
                  placeholder="Search..."
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  className="w-full px-2 py-1.5 text-xs border border-slate-200 rounded focus:outline-none focus:border-[#354C8F]"
                  autoFocus
                />
              </div>
            )}

            <div className="py-1">
              {filteredOptions.map((opt, i) => {
                const optName = typeof opt === 'string' ? opt : opt.name || '';
                return (
                  <div
                    key={i}
                    onClick={() => {
                      onChange(optName);
                      setIsOpen(false);
                      setInputValue('');
                    }}
                    className={`px-3 py-2 text-xs cursor-pointer ${value === optName ? 'bg-blue-50 text-blue-700 font-medium' : 'hover:bg-slate-50'
                      }`}
                  >
                    {optName}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  };

  const CreatableSelectDropdown = ({ value, onChange, options, label, required = false, searchable = true }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [inputValue, setInputValue] = useState('');
    const dropdownRef = useRef(null);

    const filteredOptions = (searchable ? (options || []).filter(opt =>
      String(opt.name || opt).toLowerCase().includes(inputValue.toLowerCase())
    ) : (options || []));

    useEffect(() => {
      const handleClickOutside = (event) => {
        if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
          setIsOpen(false);
          setInputValue('');
        }
      };

      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
      <div>
        <label className="block text-sm font-bold text-slate-800 mb-2">{label}{required && <span className="text-red-500 ml-1">*</span>}</label>
        <div ref={dropdownRef} className="relative w-full">
          <div
            onClick={() => setIsOpen(!isOpen)}
            className="w-full px-4 py-3.5 border border-slate-300 rounded-xl text-sm bg-white cursor-pointer focus:outline-none focus:border-[#354C8F] flex items-center justify-between transition-colors"
          >
            <span className={value ? "text-slate-800" : "text-slate-400"}>{value || `Select ${label}`}</span>
            <ChevronDown size={16} className="text-slate-400" />
          </div>

          {isOpen && (
            <div className="absolute top-full left-0 right-0 mt-1 border border-slate-200 rounded-lg bg-white shadow-lg z-50 max-h-48 overflow-y-auto">
              {searchable && (
                <div className="p-2 border-b border-slate-100 sticky top-0 bg-white">
                  <input
                    type="text"
                    placeholder="Search..."
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    className="w-full px-2 py-1.5 text-xs border border-slate-200 rounded focus:outline-none focus:border-[#354C8F]"
                    autoFocus
                  />
                </div>
              )}

              <div className="py-1">
                {filteredOptions.map((opt, i) => {
                  const optName = String(opt.name || opt);
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => {
                        onChange(optName);
                        setIsOpen(false);
                        setInputValue('');
                      }}
                      className={`w-full text-left px-4 py-3 text-sm border-b border-slate-50 hover:bg-slate-50 transition-colors ${(value === optName) ? 'bg-blue-50 text-[#354C8F] font-bold' : 'text-slate-700'}`}
                    >
                      {optName}
                    </button>
                  );
                })}
                {filteredOptions.length === 0 && (
                  <div className="px-4 py-3 text-sm text-slate-500">No options</div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  const CreatableDropdown = ({ value, onChange, options, label, placeholder, disabled = false, onCreateOption, required = false, showChevron = true }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [inputValue, setInputValue] = useState('');
    const dropdownRef = useRef(null);

    const filteredOptions = options.filter(opt =>
      String(opt.name || opt).toLowerCase().includes(inputValue.toLowerCase())
    );

    const hasExactMatch = filteredOptions.some(opt =>
      String(opt.name || opt).toLowerCase() === inputValue.toLowerCase()
    );

    const handleSelect = (optionName) => {
      onChange(optionName);
      setInputValue('');
      setIsOpen(false);
    };

    const handleCreateNew = () => {
      if (inputValue.trim() && !hasExactMatch) {
        onCreateOption?.(inputValue.trim());
        handleSelect(inputValue.trim());
      }
    };

    useEffect(() => {
      const handleClickOutside = (e) => {
        if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
          setIsOpen(false);
        }
      };
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
      <div ref={dropdownRef} className="relative">
        <label className="block text-sm font-bold text-slate-800 mb-2">{label}{required && <span className="text-red-500 ml-1">*</span>}</label>
        <div className="relative">
          <input
            type="text"
            value={isOpen ? inputValue : (value || '')}
            onChange={(e) => {
              setInputValue(e.target.value);
              if (!isOpen) setIsOpen(true);
            }}
            onFocus={() => {
              setIsOpen(true);
              setInputValue('');
            }}
            disabled={disabled}
            placeholder={placeholder || `Select ${label.toLowerCase()}`}
            className="w-full px-4 py-3.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:border-[#354C8F] transition-colors disabled:bg-slate-50 disabled:text-slate-500 appearance-none bg-white"
          />
          {showChevron && <ChevronDown className="absolute right-3 top-3.5 text-slate-400 pointer-events-none" size={18} />}
        </div>

        {isOpen && !disabled && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-300 rounded-xl shadow-lg z-50 max-h-60 overflow-y-auto">
            {filteredOptions.length > 0 ? (
              filteredOptions.map((opt) => (
                <button
                  key={opt.name || opt}
                  type="button"
                  onClick={() => handleSelect(opt.name || opt)}
                  className={`w-full text-left px-4 py-3 text-sm border-b border-slate-50 hover:bg-slate-50 transition-colors ${(value === opt.name || value === opt) ? 'bg-blue-50 text-[#354C8F] font-bold' : 'text-slate-700'
                    }`}
                >
                  {opt.name || opt}
                </button>
              ))
            ) : inputValue.trim() ? (
              <div className="px-4 py-3 text-sm text-slate-500">No matches found</div>
            ) : (
              <div className="px-4 py-3 text-sm text-slate-500">Type to search or create new</div>
            )}

            {inputValue.trim() && !hasExactMatch && (
              <button
                type="button"
                onClick={handleCreateNew}
                className="w-full text-left px-4 py-3 text-sm border-t border-slate-200 bg-blue-50 text-[#354C8F] hover:bg-blue-100 transition-colors font-bold flex items-center gap-2"
              >
                <Plus size={16} />
                Create "{inputValue.trim()}"
              </button>
            )}
          </div>
        )}
      </div>
    );
  };

  const Badge = ({ text, type }) => {
    let style = "";
    if (text === 'Active') style = "bg-green-100 text-green-700 border-green-200";
    else style = "bg-slate-100 text-slate-500 border-slate-200";
    return (
      <span className={`px-3 py-1 md:px-4 md:py-1.5 rounded-lg text-[10px] md:text-xs font-bold border ${style} inline-block min-w-[70px] md:min-w-[80px] text-center`}>
        {text}
      </span>
    );
  };

  // --- VIEW: DETAIL / EDIT PAGE ---
  if (viewMode === 'detail' || viewMode === 'edit') {
    const isEdit = viewMode === 'edit';
    return (
      <div className="bg-slate-50 min-h-screen p-4 md:p-8 font-sans text-slate-800 -mt-8">

        <div className="mb-8">


          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="flex items-center gap-4">
              {/* BUTTON BACK (NEW DESIGN) */}
              <button
                onClick={handleBackToTable}
                className="w-12 h-12 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-500 opacity-70 hover:opacity-100 hover:bg-slate-50 transition-all shrink-0"
              >
                <ArrowLeft size={22} />
              </button>
              <div>
                {isEdit && !formData.name ? (
                  <>
                    <h1 className={`text-2xl md:text-3xl font-bold text-[${colors.textDark}]`}>Add New Intern</h1>
                    <p className="text-slate-500 text-sm mt-1">Fill in all required information for the new intern</p>
                  </>
                ) : (
                  <>
                    <h1 className={`text-2xl md:text-3xl font-bold text-[${colors.textDark}]`}>{formData.name}</h1>
                    <p className="text-slate-500 text-sm mt-1">{formData.nip} | {formData.university}</p>
                  </>
                )}
              </div>
            </div>

            <div className="hidden md:flex gap-3">
              {isEdit ? (
                <>
                  <button
                    onClick={() => {
                      setConfirmType('cancel');
                      setShowConfirmModal(true);
                    }}
                    className={btnSecondary}
                  >
                    Cancel
                  </button>
                  {/* Save Button is now BLUE (Primary) */}
                  <button onClick={() => handleSaveChangesInit(formData.id ? 'save' : 'create')} className={`${btnPrimary} ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}`} disabled={isProcessing}>{isProcessing ? 'Saving...' : (formData.id ? 'Save Changes' : 'Add Intern')}</button>
                </>
              ) : (
                <button
                  onClick={() => {
                    setViewMode("edit");
                    try { localStorage.setItem('intern_profile_view', 'edit'); } catch (e) { }
                  }}
                  className={btnSecondary}
                >
                  Edit Profile
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Form Content */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Left Column: Academic & Personal */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
            <h3 className="text-[14px] font-bold text-[#27345A] mb-6">Academic & Personal</h3>
            <div className="space-y-4">
              <InputGroup label="Full Name" value={formData.name} onChange={e => handleSanitizedChange('name', e.target.value, sanitizeAlphaNumSpace, 'Full Name')} disabled={!isEdit} required warning={inputWarnings.name} />
              <InputGroup label="Email" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} disabled={!isEdit} required />

              <InputGroup label="NIK" value={formData.nik} onChange={e => handleSanitizedChange('nik', e.target.value, sanitizeDigitsOnly, 'NIK')} disabled={!isEdit} warning={inputWarnings.nik} />
              <InputGroup label="Student ID" value={formData.nip} onChange={e => handleSanitizedChange('nip', e.target.value, sanitizeAlphaNumNoSpace, 'Student ID')} disabled={!isEdit} warning={inputWarnings.nip} />

              {/* Education Level Dropdown */}
              {isEdit ? (
                <CreatableDropdown
                  label="Education Level"
                  value={formData.educationLevel || ''}
                  onChange={(e) => setFormData({ ...formData, educationLevel: e })}
                  options={[
                    { name: 'SMK/SMA' },
                    { name: 'D3' },
                    { name: 'D4' },
                    { name: 'S1' },
                    { name: 'S2' }
                  ]}
                  placeholder="Select education level"
                  disabled={!isEdit}
                />
              ) : (
                <div>
                  <label className="block text-sm font-bold text-slate-800 mb-2">Education Level</label>
                  <div className="w-full px-4 py-3.5 rounded-xl border border-slate-300 text-sm bg-slate-50 text-slate-500">
                    {formData.educationLevel || 'Not Set'}
                  </div>
                </div>
              )}

              <InputGroup label="Institution" value={formData.university} onChange={e => handleSanitizedChange('university', e.target.value, sanitizeAlphaNumSpace, 'Institution')} disabled={!isEdit} warning={inputWarnings.university} />
              <InputGroup label="Major" value={formData.programStudi} onChange={e => handleSanitizedChange('programStudi', e.target.value, sanitizeAlphaNumSpace, 'Major')} disabled={!isEdit} warning={inputWarnings.programStudi} />
              <InputGroup label="WhatsApp Number" value={formData.whatsapp} onChange={e => handleSanitizedChange('whatsapp', e.target.value, sanitizeDigitsOnly, 'WhatsApp Number')} disabled={!isEdit} warning={inputWarnings.whatsapp} />

              {/* Address Textarea */}
              <div>
                <label className="block text-sm font-bold text-slate-800 mb-2">Residential Address</label>
                <textarea
                  disabled={!isEdit}
                  value={formData.address || ''}
                  onChange={e => handleSanitizedChange('address', e.target.value, sanitizeAddress, 'Residential Address')}
                  rows={3}
                  className="w-full px-4 py-3 rounded-xl border border-slate-300 text-sm focus:outline-none focus:border-[#354C8F] transition-colors disabled:bg-slate-50 disabled:text-slate-500 resize-none"
                  placeholder="Full address in Surabaya/Pasuruan"
                />
                {inputWarnings.address && <p className="mt-1 text-xs font-medium text-amber-600">{inputWarnings.address}</p>}
              </div>
            </div>
          </div>

          {/* Right Column: Internship & Placement */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
            <h3 className="text-[14px] font-bold text-[#27345A] mb-6">Internship & Placement</h3>
            <div className="space-y-4">
              <InputGroup label="Position" value={formData.jobPosition} onChange={e => handleSanitizedChange('jobPosition', e.target.value, sanitizeAlphaNumSpace, 'Position')} disabled={!isEdit} required warning={inputWarnings.jobPosition} />
              {isEdit ? (
                <CreatableSelectDropdown
                  label="Division"
                  value={formData.division || ''}
                  onChange={(val) => setFormData({ ...formData, division: val })}
                  options={divisions.map(d => ({ name: typeof d === 'string' ? d : (d.name || d.nama_divis || '') }))}
                  searchable={false}
                  required
                />
              ) : (
                <InputGroup label="Division" value={formData.division} onChange={() => { }} disabled={true} required />
              )}

              {/* Mentor (single box, show names only) */}
              <div>
                <label className="block text-sm font-bold text-slate-800 mb-2">{(formData.mentors && formData.mentors.length === 1) ? 'Mentor' : 'Mentors'}</label>
                <div>
                  <div className="w-full px-4 py-3 rounded-xl border border-slate-300 text-sm bg-slate-50 text-slate-500">
                    {(formData.mentors && formData.mentors.length) ? (
                      <div className="flex flex-col gap-1">
                        {formData.mentors.map((m, i) => (
                          <div key={i} className="text-sm text-slate-500 font-medium truncate">
                            {m.name || m.mentor_name || 'Unknown'}{m.email ? <span className="text-[11px] text-slate-400 ml-2">({m.email})</span> : ''}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400">No mentor assigned</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Select for Placement Site */}
              {isEdit ? (
                <CreatableDropdown
                  label="Placement Location"
                  value={formData.placementName || formData.placement || ''}
                  onChange={(val) => setFormData({ ...formData, placement: val, placementName: val })}
                  options={sitesLoading ? [] : sites.map(s => ({ name: s.nama_site || s.name }))}
                  placeholder="Select placement location"
                  disabled={!isEdit}
                  required
                />
              ) : (
                <div>
                  <label className="block text-sm font-bold text-slate-800 mb-2">Placement Location<span className="text-red-500 ml-1">*</span></label>
                  <div className="w-full px-4 py-3 rounded-xl border border-slate-300 text-sm bg-slate-50 text-slate-500">
                    {formData.placementName || 'Not Assigned'}
                  </div>
                </div>
              )}

              {/* Start/End Date Pickers */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-slate-800 mb-2">Internship Start<span className="text-red-500 ml-1">*</span></label>
                  <input
                    type="date"
                    disabled={!isEdit}
                    value={formData.startDate || ''}
                    onChange={e => setFormData({ ...formData, startDate: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border border-slate-300 text-sm focus:outline-none focus:border-[#354C8F] transition-colors disabled:bg-slate-50 disabled:text-slate-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-800 mb-2">Internship End<span className="text-red-500 ml-1">*</span></label>
                  <input
                    type="date"
                    disabled={!isEdit}
                    value={formData.endDate || ''}
                    onChange={e => setFormData({ ...formData, endDate: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border border-slate-300 text-sm focus:outline-none focus:border-[#354C8F] transition-colors disabled:bg-slate-50 disabled:text-slate-500"
                  />
                </div>
              </div>

              {/* Work Schedule Dropdown */}
              {isEdit ? (
                <CreatableDropdown
                  label="Work Schedule"
                  value={activeWorkSchedule?.name || formData.work_schedule?.name || ''}
                  onChange={(val) => {
                    if (activeWorkSchedule) return;
                    const selected = workSchedules.find(w => w.name === val);
                    setFormData({ ...formData, work_schedule: selected || { name: val } });
                  }}
                  options={workSchedules.map(w => ({ name: w.name }))}
                  placeholder={activeWorkSchedule ? 'Default from active schedule' : 'Select work schedule'}
                  disabled={!isEdit || !!activeWorkSchedule}
                  showChevron={!activeWorkSchedule}
                  required
                />
              ) : (
                <div>
                  <label className="block text-sm font-bold text-slate-800 mb-2">Work Schedule<span className="text-red-500 ml-1">*</span></label>
                  <div className="w-full px-4 py-3 rounded-xl border border-slate-300 text-sm bg-slate-50 text-slate-500 flex flex-col gap-3">
                      <div className="text-sm text-slate-900 font-bold border-b border-slate-200 pb-1 mb-1">
                      {formData.work_schedule?.name || (formData.work_schedule ? '' : 'Not Assigned')}
                    </div>
                    <div className="space-y-2">
                      {formatWorkSchedule(formData.work_schedule)?.map((group, idx) => (
                        <div key={idx} className="flex flex-col">
                          <span className="text-xs font-bold text-[#354C8F] uppercase tracking-wider">{group.days}</span>
                          <span className="text-sm text-slate-700 font-medium">{group.time}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
              {isEdit && activeWorkSchedule && (
                <p className="-mt-2 text-[11px] text-slate-500">Work Schedule follows active schedule: <span className="font-semibold text-[#27345A]">{activeWorkSchedule.name}</span></p>
              )}

              {/* Documents moved into Internship & Placement card */}
              <div className="bg-white p-4 rounded-xl border border-slate-100">
                <h4 className="text-sm font-bold text-[#27345A] mb-3">Documents</h4>
                <div className="grid grid-cols-2 gap-3">
                  {[{ label: 'Photo', field: 'foto' }, { label: 'Student ID', field: 'fotoKtm' }].map((doc) => (
                    <div key={doc.field} className="relative group">
                      <label
                        className={`block border border-dashed border-slate-300 rounded-xl p-3 text-center transition-all ${isEdit ? 'cursor-pointer hover:border-[#354C8F] hover:bg-slate-50' : getImageSrc(doc.field) ? 'cursor-pointer hover:border-[#354C8F] hover:bg-slate-50' : 'cursor-default'}`}
                        onClick={() => {
                          if (!isEdit && getImageSrc(doc.field)) {
                            setPreviewImageUrl(getImageSrc(doc.field));
                            setPreviewImageLabel(doc.label);
                          }
                        }}
                      >
                        {isEdit && (
                          <input
                            type="file"
                            className="hidden"
                            accept=".jpg,.jpeg,.png,image/jpeg,image/png"
                            onChange={(e) => handleFileChange(e, doc.field)}
                          />
                        )}

                        <div className="w-20 h-20 bg-slate-100 rounded-lg flex items-center justify-center mx-auto mb-2 overflow-hidden border border-slate-100">
                          {(doc.field === 'foto' ? fotoLoading : fotoKtmLoading) ? (
                            <div className="w-8 h-8 border-4 border-slate-200 border-t-[#354C8F] rounded-full animate-spin" />
                          ) : getImageSrc(doc.field) ? (
                            <SecureImage src={getImageSrc(doc.field)} alt={doc.label} className="w-full h-full object-cover" />
                          ) : (
                            <Calendar size={22} className="text-slate-400" />
                          )}
                        </div>
                        <p className="text-xs font-bold text-slate-600">
                          {doc.label}
                          {isEdit && doc.field === 'fotoKtm' && (
                            <span className="text-[10px] text-slate-400 ml-2">(Not required)</span>
                          )}
                        </p>
                        <p className="text-[10px] text-slate-400 mt-1">
                          {(() => {
                            const has = !!getImageSrc(doc.field);
                            if (isEdit) return has ? 'Click to change' : 'Click to upload';
                            return has ? 'Click to view' : 'No file uploaded';
                          })()}
                        </p>
                      </label>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          </div>

          {/* Emergency Contact Section */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
            <h3 className="text-[14px] font-bold text-[#27345A] mb-6">Emergency Contact</h3>
            <div className="space-y-4">
              <InputGroup label="Emergency Contact Name" value={formData.emergencyName} onChange={e => handleSanitizedChange('emergencyName', e.target.value, sanitizeAlphaNumSpace, 'Emergency Contact Name')} disabled={!isEdit} warning={inputWarnings.emergencyName} />
              <InputGroup label="Emergency Contact Number" value={formData.emergencyContact} onChange={e => handleSanitizedChange('emergencyContact', e.target.value, sanitizeDigitsOnly, 'Emergency Contact Number')} disabled={!isEdit} warning={inputWarnings.emergencyContact} />
            </div>
          </div>

          {/* Bank Details Section */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
            <h3 className="text-[14px] font-bold text-[#27345A] mb-6">Bank Details</h3>
            <div className="space-y-4">
              <InputGroup
                label="Bank Name"
                value={formData.bank_name}
                onChange={e => handleSanitizedChange('bank_name', e.target.value, sanitizeAlphaNumSpace, 'Bank Name')}
                disabled={!isEdit}
                warning={inputWarnings.bank_name}
              />
              <InputGroup
                label="Account Holder"
                value={formData.account_holder}
                onChange={e => handleSanitizedChange('account_holder', e.target.value, sanitizeAlphaNumSpace, 'Account Holder')}
                disabled={!isEdit}
                warning={inputWarnings.account_holder}
              />
              <InputGroup
                label="Account Number"
                value={formData.account_number}
                onChange={e => handleSanitizedChange('account_number', e.target.value, sanitizeDigitsOnly, 'Account Number')}
                disabled={!isEdit}
                warning={inputWarnings.account_number}
              />

              <div>
                <label className="block text-sm font-bold text-slate-800 mb-2">Bank Book / M-Banking Photo</label>
                <label
                  className={`block border border-dashed border-slate-300 rounded-xl p-4 text-center transition-all ${isEdit ? 'cursor-pointer hover:border-[#354C8F] hover:bg-slate-50' : getImageSrc('bank_proof') ? 'cursor-pointer hover:border-[#354C8F] hover:bg-slate-50' : 'cursor-default'}`}
                  onClick={() => {
                    if (!isEdit && getImageSrc('bank_proof')) {
                      setPreviewImageUrl(getImageSrc('bank_proof'));
                      setPreviewImageLabel('Bank Book / M-Banking Photo');
                    }
                  }}
                >
                  {isEdit && (
                    <input
                      type="file"
                      className="hidden"
                      accept=".jpg,.jpeg,.png,.webp,.svg,image/jpeg,image/png,image/webp,image/svg+xml"
                      onChange={(e) => handleFileChange(e, 'bank_proof')}
                    />
                  )}

                  <div className="w-24 h-24 bg-slate-100 rounded-lg flex items-center justify-center mx-auto mb-2 overflow-hidden border border-slate-100">
                    {getImageSrc('bank_proof') ? (
                      <SecureImage src={getImageSrc('bank_proof')} alt="Bank proof" className="w-full h-full object-cover" />
                    ) : (
                      <Upload size={24} className="text-slate-400" />
                    )}
                  </div>

                  <p className="text-xs font-bold text-slate-600">Bank Book / M-Banking Photo</p>
                  <p className="text-[10px] text-slate-400 mt-1">
                    {(() => {
                      const has = !!getImageSrc('bank_proof');
                      if (isEdit) return has ? 'Click to change' : 'Click to upload';
                      return has ? 'Click to view' : 'No file uploaded';
                    })()}
                  </p>
                </label>
              </div>
            </div>
          </div>


        </div>

        {/* Mobile action buttons: show under form on small screens */}
        {isEdit && (
          <div className="md:hidden mt-6">
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => {
                  setConfirmType('cancel');
                  setShowConfirmModal(true);
                }}
                className={`${btnSecondary} w-full`}
              >
                Cancel
              </button>
              <button
                onClick={() => handleSaveChangesInit(formData.id ? 'save' : 'create')}
                className={`${btnPrimary} w-full ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}`}
                disabled={isProcessing}
              >
                {isProcessing ? 'Saving...' : (formData.id ? 'Save Changes' : 'Add Intern')}
              </button>
            </div>
          </div>
        )}

        {/* MODALS FOR EDIT MODE */}
        <AnimatePresence>
          {/* CONFIRM MODAL - Save / Delete / Cancel / Create */}
          {showConfirmModal && (
            <ModalOverlay zIndex="z-[60]" onClose={() => confirmType === 'cancel' ? null : setShowConfirmModal(false)} width="max-w-sm" compact>
              <div className="text-center p-4">
                <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${confirmType === 'delete' ? 'bg-red-50' :
                  confirmType === 'cancel' ? 'bg-orange-50' :
                    confirmType === 'create' ? 'bg-blue-50' :
                      'bg-yellow-50'
                  }`}>
                  {confirmType === 'delete' ? (
                    <Trash2 className="text-red-500" size={32} />
                  ) : confirmType === 'cancel' ? (
                    <AlertCircle className="text-orange-500" size={32} strokeWidth={2} />
                  ) : confirmType === 'create' ? (
                    <Plus className="text-blue-500" size={32} />
                  ) : (
                    <AlertCircle className="text-yellow-500" size={32} strokeWidth={2} />
                  )}
                </div>
                <h3 className="text-xl font-bold text-[#27345A] mb-2">
                  {confirmType === 'delete' ? 'Delete Intern?' :
                    confirmType === 'cancel' ? 'Discard Changes?' :
                      confirmType === 'create' ? 'Add New Intern?' :
                        'Save Changes?'}
                </h3>
                <p className="text-slate-500 text-sm mb-4">
                  {confirmType === 'delete' ? 'This intern will be permanently deleted.' :
                    confirmType === 'cancel' ? 'Changes won\'t be saved if you discard.' :
                      confirmType === 'create' ? 'Are you sure you want to add this new intern profile?' :
                        'Are you sure you want to save these changes?'}
                </p>

                {confirmType === 'delete' && (
                  <div className="flex items-start gap-3 mb-4 w-full text-left justify-start">
                    <input
                      id="delete-user-checkbox-detail"
                      type="checkbox"
                      className="form-checkbox h-4 w-4 mt-1"
                      checked={deleteConfirmChecked}
                      onChange={(e) => setDeleteConfirmChecked(e.target.checked)}
                    />
                    <label htmlFor="delete-user-checkbox-detail" className="text-sm text-slate-600 text-left block">
                      I understand this action is permanent
                      <div className="text-xs text-slate-400 mt-1">Check to confirm deletion of this intern profile.</div>
                    </label>
                  </div>
                )}

                <div className="flex gap-3">
                  <button
                    onClick={() => setShowConfirmModal(false)}
                    className={`${btnSecondary} w-full justify-center`}
                  >
                    {confirmType === 'delete' ? 'Keep' : 'Cancel'}
                  </button>
                  <button
                    onClick={executeSaveChanges}
                    disabled={confirmType === 'delete' && !deleteConfirmChecked}
                    className={`${confirmType === 'delete' ? btnDanger :
                      confirmType === 'cancel' ? btnDanger :
                        btnSuccess
                      } w-full justify-center ${confirmType === 'delete' && !deleteConfirmChecked ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    {confirmType === 'delete' ? 'Delete' :
                      confirmType === 'cancel' ? 'Discard' :
                        confirmType === 'create' ? 'Add' :
                          'Save'}
                  </button>
                </div>
              </div>
            </ModalOverlay>
          )}

          {/* STATUS MODAL - BUTTON IS GREEN */}
          {showStatusModal && (
            <ModalOverlay zIndex="z-[60]" onClose={() => setShowStatusModal(false)} width="max-w-sm" compact>
              <div className="text-center p-4">
                <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${statusType === 'success' ? 'bg-green-50' : 'bg-red-50'}`}>
                  {statusType === 'success' ? <Check className="text-green-500" size={32} strokeWidth={3} /> : <X className="text-red-500" size={32} strokeWidth={3} />}
                </div>
                <h3 className="text-xl font-bold text-[#27345A] mb-2">{statusMessage.title}</h3>
                <p className="text-slate-500 text-sm mb-6">{statusMessage.desc}</p>
                <button
                  onClick={() => setShowStatusModal(false)}
                  className={`${statusType === 'success' ? btnSuccess : btnDanger} w-full justify-center`}
                >
                  OK
                </button>
              </div>
            </ModalOverlay>
          )}

          {/* IMAGE PREVIEW MODAL */}
          {previewImageUrl && (
            <ModalOverlay zIndex="z-[70]" onClose={() => setPreviewImageUrl(null)} width="max-w-2xl">
              <div className="flex flex-col items-center gap-4">
                <div className="flex justify-between items-center w-full mb-2">
                  <h3 className="text-lg font-bold text-[#27345A]">{previewImageLabel}</h3>
                  <button
                    onClick={() => setPreviewImageUrl(null)}
                    className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                  >
                    <X size={22} className="text-slate-500" />
                  </button>
                </div>
                <div className="w-full max-h-[70vh] bg-slate-100 rounded-xl overflow-auto flex items-center justify-center">
                  <SecureImage
                    src={previewImageUrl}
                    alt={previewImageLabel}
                    className="max-w-full max-h-full object-contain"
                  />
                </div>
                <button
                  onClick={() => setPreviewImageUrl(null)}
                  className={`${btnSecondary} w-full justify-center`}
                >
                  Close
                </button>
              </div>
            </ModalOverlay>
          )}
        </AnimatePresence>

      </div>
    );
  }

  // --- VIEW: TABLE PAGE ---
  return (
    <div className="bg-slate-50 min-h-screen pt-8 pb-8 pl-2 pr-4 md:pl-2 md:pr-2 w-full font-sans text-slate-800 -mt-8">

      {/* HEADER */}
      <div className="mb-6 md:mb-8 mt-4 md:mt-0">
        <h1 className={`text-xl md:text-2xl font-bold text-[${colors.textDark}] mb-1 md:mb-2`}>Intern Profiles</h1>
        <p className="text-slate-500 text-xs">Organize and maintain detailed academic and internship data for all Interns</p>
      </div>

      {/* ACTION BAR */}
      <div className="flex flex-col md:flex-row justify-between items-stretch md:items-center gap-3 md:gap-4 mb-6">
        <div className="flex gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-80">
            <input
              type="text"
              value={query}
              onChange={(e) => {
                const v = e.target.value;
                setQuery(v);
                if (searchTimeout.current) clearTimeout(searchTimeout.current);
                searchTimeout.current = setTimeout(() => {
                  setCurrentPage(1);
                  fetchInterns(1);
                }, 500);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  if (searchTimeout.current) clearTimeout(searchTimeout.current);
                  setCurrentPage(1);
                  fetchInterns(1);
                }
              }}
              placeholder="Search by Intern"
              className="w-full pl-9 md:pl-10 pr-9 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#354C8F]/20 text-sm shadow-sm transition-all"
            />
            <Search className="absolute left-3 top-3.5 text-slate-400" size={18} />
            {query && <button onClick={() => { setQuery(''); setCurrentPage(1); fetchInterns(1); }} className="absolute right-3 top-3.5 text-slate-400"><X size={14} /></button>}
          </div>
          <button onClick={() => setShowFilterModal(true)} className={`${btnPrimary} md:!px-6 w-auto`}>
            <Filter size={16} />
            <span className="hidden md:inline">Filter</span>
          </button>
        </div>
        <div className="grid grid-cols-2 gap-3 w-full md:flex md:gap-3 md:justify-end md:w-auto mg:hidden">
          <button onClick={() => setShowImportModal(true)} className={`${btnSecondary} md:!px-6 w-full md:w-auto`}>
            <Upload size={16} />
            <span className="md:inline">Import Excel</span>
          </button>
          <button onClick={() => { setFormData({ work_schedule: activeWorkSchedule || workSchedules[0] || null }); setSelectedIntern(null); setViewMode('edit'); }} className={`${btnPrimary} md:!px-6 w-full md:w-auto`}>
            <Plus size={16} />
            <span className=" md:inline">Add Intern</span>
          </button>
        </div>
      </div>

      {/* TABLE */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[1000px] md:min-w-full">
            <thead>
              <tr className="border-b border-slate-100 text-xs font-bold text-slate-900 bg-slate-50/50">
                <th className="px-4 py-3 w-12 md:w-16 text-center">No</th>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Institution</th>
                <th className="px-4 py-3">Division</th>
                <th className="px-4 py-3">Position</th>
                <th className="px-4 py-3">Internship Period</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="text-xs text-slate-600">
              {loading ? (
                <tr>
                  <td colSpan={8} className="p-12 text-center">
                    <div className="flex flex-col items-center justify-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#354C8F] mb-2"></div>
                      <span className="text-slate-400">Loading interns...</span>
                    </div>
                  </td>
                </tr>
              ) : currentItems.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-6 text-center text-slate-500">No interns found</td>
                </tr>
              ) : (
                currentItems.map((item, index) => (
                  <tr key={item.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 text-center font-medium">{paginationMeta.from + index}</td>
                    <td className="px-4 py-3 font-medium text-slate-700 whitespace-nowrap">{item.name}</td>
                    <td className="px-4 py-3">{item.university}</td>
                    <td className="px-4 py-3">{item.division || '-'}</td>
                    <td className="px-4 py-3">{item.jobPosition || '-'}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 bg-slate-50 px-2 py-1 rounded-lg w-fit border border-slate-100">
                        <Clock size={12} />
                        {item.period || '-'}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center"><Badge text={item.status === 'active' ? 'Active' : 'Inactive'} type="status" /></td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex justify-center gap-2">

                        {/* VIEW DETAIL BUTTON */}
                        <button
                          onClick={() => handleOpenDetail(item)}
                          className="p-2 bg-[#354C8F] text-white rounded-lg hover:bg-[#2a3c70] transition-colors shadow-sm shadow-indigo-100 active:scale-95"
                          title="View Detail"
                        >
                          <Eye size={14} />
                        </button>

                        {/* EDIT BUTTON */}
                        <button
                          onClick={() => handleEditProfile(item)}
                          className="p-2 bg-[#22C55E] text-white rounded-lg hover:bg-[#16A34A] transition-colors shadow-sm shadow-green-200 active:scale-95"
                          title="Edit Profile"
                        >
                          <Edit2 size={14} />
                        </button>
                        {/* DELETE BUTTON */}
                        <button
                          type="button"
                          onClick={() => { setSelectedIntern(item); setConfirmType('delete'); setShowConfirmModal(true); }}
                          className="p-2 bg-[#EF4444] text-white rounded-lg hover:bg-[#DC2626] transition-colors shadow-sm shadow-red-200 active:scale-95"
                          title="Delete Profile"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
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
                <button disabled={currentPage === 1} onClick={() => handlePageChange(currentPage - 1)} className="p-2 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50 border border-slate-200 disabled:cursor-not-allowed"><ChevronLeft size={18} /></button>
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
                    if (p === 'left-ellipsis' || p === 'right-ellipsis') return <div key={`${p}-${idx}`} className="w-8 h-8 flex items-center justify-center rounded-lg text-xs font-bold text-slate-400">...</div>;
                    return <button key={p} onClick={() => handlePageChange(p)} className={`w-8 h-8 flex items-center justify-center rounded-lg text-xs font-bold transition-colors ${pageCurrent === p ? "bg-slate-100 text-[#27345A] border border-slate-200" : "text-slate-500 hover:bg-slate-50 border border-transparent"}`}>{p}</button>;
                  });
                })()}
                <button disabled={currentPage === paginationMeta.last_page} onClick={() => handlePageChange(currentPage + 1)} className="p-2 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50 border border-slate-200 disabled:cursor-not-allowed"><ChevronRight size={18} /></button>
              </div>
            </div>
          </div>
        )}

        {/* CONFIRM MODAL (table view) - ensure delete confirms while table is visible */}
        <AnimatePresence>
          {showConfirmModal && (
            <ModalOverlay zIndex="z-[60]" onClose={() => confirmType === 'cancel' ? null : setShowConfirmModal(false)} width="max-w-sm" compact>
              <div className="text-center p-4">
                <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${confirmType === 'delete' ? 'bg-red-50' :
                  confirmType === 'cancel' ? 'bg-orange-50' :
                    confirmType === 'create' ? 'bg-blue-50' :
                      'bg-yellow-50'
                  }`}>
                  {confirmType === 'delete' ? (
                    <Trash2 className="text-red-500" size={32} />
                  ) : confirmType === 'cancel' ? (
                    <AlertCircle className="text-orange-500" size={32} strokeWidth={2} />
                  ) : confirmType === 'create' ? (
                    <Plus className="text-blue-500" size={32} />
                  ) : (
                    <AlertCircle className="text-yellow-500" size={32} strokeWidth={2} />
                  )}
                </div>
                <h3 className="text-xl font-bold text-[#27345A] mb-2">
                  {confirmType === 'delete' ? 'Delete Intern?' :
                    confirmType === 'cancel' ? 'Discard Changes?' :
                      confirmType === 'create' ? 'Add New Intern?' :
                        'Save Changes?'}
                </h3>
                <p className="text-slate-500 text-sm mb-4">
                  {confirmType === 'delete' ? 'This intern will be permanently deleted.' :
                    confirmType === 'cancel' ? 'Changes won\'t be saved if you discard.' :
                      confirmType === 'create' ? 'Are you sure you want to add this new intern profile?' :
                        'Are you sure you want to save these changes?'}
                </p>

                {confirmType === 'delete' && (
                  <div className="flex items-start gap-3 mb-4 w-full text-left justify-start">
                    <input
                      id="delete-user-checkbox-table"
                      type="checkbox"
                      className="form-checkbox h-4 w-4 mt-1"
                      checked={deleteConfirmChecked}
                      onChange={(e) => setDeleteConfirmChecked(e.target.checked)}
                    />
                    <label htmlFor="delete-user-checkbox-table" className="text-sm text-slate-600 text-left block">
                      I understand this action is permanent
                      <div className="text-xs text-slate-400 mt-1">Check to confirm deletion of this intern profile.</div>
                    </label>
                  </div>
                )}

                <div className="flex gap-3">
                  <button
                    onClick={() => setShowConfirmModal(false)}
                    className={`${btnSecondary} w-full justify-center`}
                  >
                    {confirmType === 'delete' ? 'Keep' : 'Cancel'}
                  </button>
                  <button
                    onClick={executeSaveChanges}
                    disabled={confirmType === 'delete' && !deleteConfirmChecked}
                    className={`${confirmType === 'delete' ? btnDanger :
                      confirmType === 'cancel' ? btnDanger :
                        btnSuccess
                      } w-full justify-center ${confirmType === 'delete' && !deleteConfirmChecked ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    {confirmType === 'delete' ? 'Delete' :
                      confirmType === 'cancel' ? 'Discard' :
                        confirmType === 'create' ? 'Add' :
                          'Save'}
                  </button>
                </div>
              </div>
            </ModalOverlay>
          )}
        </AnimatePresence>
      </div>

      {/* --- FILTER MODAL --- */}
      <AnimatePresence>
        {showImportModal && (
          <ModalOverlay zIndex="z-50" onClose={() => { setShowImportModal(false); resetImport(); }} width="max-w-md">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-[18px] font-bold text-[#27345A]">Import Intern Profiles</h3>
              <button onClick={() => { setShowImportModal(false); resetImport(); }}><X className="text-slate-400 hover:text-slate-600" /></button>
            </div>

            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl flex items-start gap-3">
                <FileSpreadsheet className="text-[#354C8F]" size={36} />
                <div>
                  <p className="text-sm font-bold text-[#27345A]">Download Template</p>
                  <p className="text-xs text-slate-500 mt-1">Use the standard template. Documents are excluded.</p>
                  <div className="flex flex-wrap gap-3 mt-2">
                    <button onClick={downloadExcelTemplate} className="text-xs font-bold text-[#354C8F] hover:underline flex items-center gap-1">
                      <Download size={12} /> Download .xlsx
                    </button>
                  </div>
                  <div className="mt-3">
                    <button
                      type="button"
                      onClick={() => setShowImportInfo(prev => !prev)}
                      className="text-xs font-bold text-[#354C8F] hover:underline flex items-center gap-1"
                    >
                      <ChevronDown size={12} className={`transition-transform ${showImportInfo ? 'rotate-180' : ''}`} />
                      Information
                    </button>
                    {showImportInfo && (
                      <div className="mt-2 bg-white/70 border border-blue-100 rounded-lg p-3">
                        <ul className="list-decimal pl-4 space-y-1 text-xs text-slate-600">
                          {importInfoItems.map((item, idx) => (
                            <li key={idx}>{item}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              </div>

                <div
                  className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center hover:bg-slate-50 transition-colors cursor-pointer"
                  onDrop={handleDropFile}
                  onDragOver={handleDragOver}
                  onClick={() => fileInputRef.current?.click()}
                >
                <input ref={fileInputRef} type="file" accept=".csv,text/csv,.xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel" className="hidden" onChange={handleFileSelect} />
                <Upload className="mx-auto text-slate-400 mb-3" size={32} />
                {!importFile ? (
                  <>
                    <p className="text-sm font-bold text-slate-600">Click to upload file</p>
                    <p className="text-xs text-slate-400 mt-1">or drag and drop file here</p>
                    <p className="text-xs text-slate-400 mt-2">Supports .csv and .xlsx files.</p>
                  </>
                ) : (
                  <div className="w-full bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-3">
                    <div className="flex-1">
                      <p className="text-sm font-bold text-slate-600 text-left">{importFile.name}</p>
                      <p className="text-xs text-slate-400 text-left">{(importFile.size / 1024).toFixed(1)} KB</p>
                    </div>
                    <button
                      type="button"
                      aria-label="Remove file"
                      onClick={(e) => { e.stopPropagation(); clearImportFile(); }}
                      className="p-2 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                    >
                      <X size={16} />
                    </button>
                  </div>
                )}
              </div>

            </div>

            <div className="flex gap-3 justify-end mt-6">
              <button onClick={() => { setShowImportModal(false); resetImport(); }} className={btnSecondary}>Cancel</button>
              <button onClick={handlePreviewImport} disabled={!importFile || importing} className={`${btnPrimary} ${(!importFile || importing) ? 'opacity-50 cursor-not-allowed' : ''}`}>Preview</button>
            </div>
          </ModalOverlay>
        )}

        {showImportPreview && (
          <ModalOverlay zIndex="z-50" onClose={() => setShowImportPreview(false)} width="max-w-5xl">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-[18px] font-bold text-[#27345A]">Import Preview</h3>
              <button onClick={() => setShowImportPreview(false)}><X className="text-slate-400 hover:text-slate-600" /></button>
            </div>

            <div className="text-xs text-slate-500 mb-4 -mt-4">Preview focuses on Internship & Placement fields. Other details are hidden.</div>
            <div className="relative border border-slate-100 rounded-xl">
              <div className="overflow-x-auto">
                <div className="max-h-[360px] overflow-y-auto">
                  <table className="w-full text-left text-xs min-w-full">
                <thead className="bg-slate-50 border-b border-slate-100 text-slate-600 text-[12px]">
                  <tr className="sticky top-0 bg-slate-50 z-10">
                    <th className="p-2">#</th>
                    <th className="p-2">Full Name</th>
                    <th className="p-2">Email</th>
                    <th className="p-2">Position</th>
                    <th className="p-2">Division</th>
                    <th className="p-2">Placement Location</th>
                    <th className="p-2">Internship Start</th>
                    <th className="p-2">Internship End</th>
                  </tr>
                </thead>
                <tbody className="text-slate-600">
                  {importRows.map((row, idx) => (
                    <tr key={row._id} className="border-b border-slate-100 align-top min-h-[100px]">
                      <td className="p-2 align-top">{idx + 1}</td>
                      <td className="p-2 align-top font-medium text-slate-700">{row.fullName}</td>
                      <td className="p-2 align-top text-slate-600">{row.email || '-'}</td>
                      <td className="p-2 align-top">
                        <div className="text-xs text-slate-700">{row.position || '-'}</div>
                      </td>
                      <td className="p-2">
                        <div className="space-y-1.5">
                          <CreatableDivisionSelect
                            value={row.division || ''}
                            onChange={(v) => {
                              setImportRows(prev => prev.map((r, i) => i === idx ? { ...r, division: v } : r));
                            }}
                            options={divisions.map(d => ({ name: typeof d === 'string' ? d : (d.name || d.nama_divis || '') }))}
                          />
                          {row.divisionWasFixed && row.divisionOriginal && String(row.divisionOriginal).trim().toLowerCase() !== String(row.division || '').trim().toLowerCase() && (
                            <div className="text-[10px] text-slate-600 bg-blue-50 px-2 py-1.5 rounded border border-blue-100">
                              <span className="text-slate-500">Original: </span>
                              <strong className="text-slate-700">{row.divisionOriginal}</strong>
                              <span className="text-slate-500"> → </span>
                              <strong className="text-blue-600">{row.division}</strong>
                            </div>
                          )}
                          {row.divisionWasFixed && (
                            <div className="mt-1">
                              <button
                                type="button"
                                onClick={() => setImportRows(prev => prev.map((r, i) => i === idx ? { ...r, division: r.divisionOriginal || '', divisionWasFixed: false } : r))}
                                className="text-xs text-slate-500 hover:underline mt-1"
                              >
                                Undo
                              </button>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="p-2">
                        <div className="space-y-1.5">
                          <SimpleSelect
                            value={row.placement || ''}
                            onChange={(v) => {
                              setImportRows(prev => prev.map((r, i) => i === idx ? { ...r, placement: v, userEdited: true } : r));
                            }}
                            options={sites.map(s => ({ name: s.nama_site || s.name }))}
                            label="Location"
                          />
                          {row.placementWasFixed && row.placementOriginal && String(row.placementOriginal).trim().toLowerCase() !== String(row.placement || '').trim().toLowerCase() && (
                            <div className="text-[10px] text-slate-600 bg-blue-50 px-2 py-1.5 rounded border border-blue-100">
                              <span className="text-slate-500">Original: </span>
                              <strong className="text-slate-700">{row.placementOriginal}</strong>
                              <span className="text-slate-500"> → </span>
                              <strong className="text-blue-600">{row.placement}</strong>
                            </div>
                          )}
                          {row.placementWasFixed && (
                            <div className="mt-1">
                              <button
                                type="button"
                                onClick={() => setImportRows(prev => prev.map((r, i) => i === idx ? { ...r, placement: r.placementOriginal || '', placementWasFixed: false, userEdited: true } : r))}
                                className="text-xs text-slate-500 hover:underline mt-1"
                              >
                                Undo
                              </button>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="p-2">
                        <input
                          type="date"
                          value={parseDateToYmd(row.internshipStart)}
                            onChange={(e) => {
                            const v = e.target.value;
                            setImportRows(prev => prev.map((r, i) => i === idx ? { ...r, internshipStart: v, userEdited: true } : r));
                          }}
                          className="h-[36px] px-3 border border-slate-200 rounded-lg text-xs"
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="date"
                          value={parseDateToYmd(row.internshipEnd)}
                          onChange={(e) => {
                            const v = e.target.value;
                            setImportRows(prev => prev.map((r, i) => i === idx ? { ...r, internshipEnd: v, userEdited: true } : r));
                          }}
                          className="h-[36px] px-3 border border-slate-200 rounded-lg text-xs"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
                  </table>
                </div>
              </div>

              <div className="w-full sticky bottom-0 z-20 bg-white border-t border-slate-100 p-4 flex gap-3 justify-end mt-6">
                <button onClick={() => setShowImportPreview(false)} className={btnSecondary}>Back</button>
                <button onClick={executeImport} disabled={importing || importRows.length === 0} className={`${btnPrimary} ${importing || importRows.length === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}>
                  Confirm Import
                </button>
              </div>
            </div>
          </ModalOverlay>
        )}

        {showFilterModal && (
          <ModalOverlay zIndex="z-50" onClose={() => setShowFilterModal(false)} compact>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-[18px] font-bold text-[#27345A]"> Intern Profiles Filter</h3>
              <button onClick={() => setShowFilterModal(false)}><X className="text-slate-400 hover:text-slate-600" /></button>
            </div>
            <div className="space-y-4">

              {/* DROPDOWNS */}
              {renderDropdown(
                'Institution',
                'university',
                [{ value: '', label: 'All Institutions' }, ...(filterOptionsLoading ? [] : filterOptions.universities).map(u => ({ value: u, label: u }))],
                filterOptionsLoading ? 'Loading institutions...' : 'All Institutions'
              )}

              {renderDropdown(
                'Division',
                'division',
                [{ value: '', label: 'All Divisions' }, ...(filterOptionsLoading ? [] : filterOptions.divisions).map(d => ({ value: d, label: d }))],
                filterOptionsLoading ? 'Loading divisions...' : 'All Divisions'
              )}

              {/* DATE RANGE */}
              <div>
                <label className="block text-sm font-bold text-slate-800 mb-1">Period</label>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-slate-500 mb-1 block">Start Date</label>
                    <div className="relative">
                      <input type="date" value={filter.startDate} onChange={e => handleFilterToggle('startDate', e.target.value)} onClick={(e) => e.target.showPicker && e.target.showPicker()} className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#354C8F]/20 cursor-pointer [&::-webkit-calendar-picker-indicator]:hidden" />
                      <Calendar className="absolute left-3 top-3 text-slate-400 pointer-events-none" size={18} />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 mb-1 block">End Date</label>
                    <div className="relative">
                      <input type="date" value={filter.endDate} onChange={e => handleFilterToggle('endDate', e.target.value)} onClick={(e) => e.target.showPicker && e.target.showPicker()} className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#354C8F]/20 cursor-pointer [&::-webkit-calendar-picker-indicator]:hidden" />
                      <Calendar className="absolute left-3 top-3 text-slate-400 pointer-events-none" size={18} />
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-800 mb-3">Status</label>
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
                const nextApplied = {
                  university: filter.university,
                  division: filter.division,
                  status: [...filter.status],
                  startDate: filter.startDate,
                  endDate: filter.endDate
                };
                setAppliedFilterUniversity(nextApplied.university);
                setAppliedFilterDivision(nextApplied.division);
                setAppliedFilterStatus(nextApplied.status);
                setAppliedFilterStartDate(nextApplied.startDate);
                setAppliedFilterEndDate(nextApplied.endDate);
                setCurrentPage(1);
                fetchInterns(1, nextApplied);
                setShowFilterModal(false);
              }} className={btnPrimary}>Apply</button>
            </div>
          </ModalOverlay>
        )}

        {showStatusModal && (
          <ModalOverlay zIndex="z-[60]" onClose={() => setShowStatusModal(false)} width="max-w-sm" compact>
            <div className="text-center p-4">
              <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${statusType === 'success' ? 'bg-green-50' : 'bg-red-50'}`}>
                {statusType === 'success' ? <Check className="text-green-500" size={32} strokeWidth={3} /> : <X className="text-red-500" size={32} strokeWidth={3} />}
              </div>
              <h3 className="text-xl font-bold text-[#27345A] mb-2">{statusMessage.title}</h3>
              <p className="text-slate-500 text-sm mb-6">{statusMessage.desc}</p>
              <button
                onClick={() => setShowStatusModal(false)}
                className={`${statusType === 'success' ? btnSuccess : btnDanger} w-full justify-center`}
              >
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

const InputGroup = ({ label, value, onChange, disabled, icon, required = false, warning = '' }) => (
  <div>
    <label className="block text-sm font-bold text-slate-800 mb-2">{label}{required && <span className="text-red-500 ml-1">*</span>}</label>
    <div className="relative">
      <input
        type="text"
        value={value ?? ''}
        onChange={onChange}
        disabled={disabled}
        className={`w-full px-4 py-3.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:border-[#354C8F] transition-colors placeholder:text-slate-400 disabled:bg-slate-50 disabled:text-slate-500 ${icon ? 'pl-10' : ''}`}
      />
      {icon && <div className="absolute left-3 top-3.5 pointer-events-none">{icon}</div>}
    </div>
    {warning && <p className="mt-1 text-xs font-medium text-amber-600">{warning}</p>}
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

// --- SECURE IMAGE COMPONENT ---
const SecureImage = ({ src, alt, className }) => {
  const [imgUrl, setImgUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    if (!src) {
      setImgUrl(null);
      setLoading(false);
      setError(false);
      return () => { active = false; };
    }

    // 1. Base64 (uploaded preview)
    if (typeof src === 'string' && src.startsWith('data:')) {
      setImgUrl(src);
      setLoading(false);
      setError(false);
      return () => { active = false; };
    }

    // 2. HTTP URL (Secure) — use fetch() to avoid browser logging 404s
    if (typeof src === 'string' && src.startsWith('http')) {
      setLoading(true);
      setError(false);
      fetchSecureBlob(src)
        .then(blobUrl => {
          if (active) {
            if (blobUrl) setImgUrl(blobUrl);
            else setError(true);
          }
        })
        .finally(() => {
          if (active) setLoading(false);
        });
      return () => { active = false; };
    }

    // 3. Fallback for unexpected format 
    setImgUrl(src);
    setLoading(false);
    setError(false);

    return () => { active = false; };
  }, [src]);

  // Cleanup blob URLs
  useEffect(() => {
    return () => {
      if (imgUrl && typeof imgUrl === 'string' && imgUrl.startsWith('blob:')) {
        URL.revokeObjectURL(imgUrl);
      }
    };
  }, [imgUrl]);

  if (loading) return <div className={`animate-pulse bg-slate-200 ${className}`} />;
  if (!imgUrl || error) return null;

  return <img src={imgUrl} alt={alt} className={className} />;
};

export default InternProfiles;
