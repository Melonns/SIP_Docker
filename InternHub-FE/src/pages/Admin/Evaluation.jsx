import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  Filter,
  Eye,
  Edit, // Icon Edit/Review
  X,
  Check,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  FileText, // Icon Certificate
  Award,    // Icon Stats
  Clock,
  CheckCircle2,
  AlertTriangle,
  ChevronDown,
  UploadCloud
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import apiClient from '../../api/axiosConfig';
import { fetchSecureBlob } from '../../utils/secureFetch';
import { getSafeErrorMessage, logError } from '../../utils/errorHandler';

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
const btnSuccess = `${btnBase} bg-[#22C55E] hover:bg-[#16A34A] text-white shadow-md shadow-green-200`;

const Evaluation = () => {
  const navigate = useNavigate();
  // --- API-driven state ---
  const [interns, setInterns] = useState([]);
  const [loadingInterns, setLoadingInterns] = useState(true);
  const [errorInterns, setErrorInterns] = useState(null);
  // Controlled input (immediate) vs debounced query (used by fetch)
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const [statsData, setStatsData] = useState({ total_completed: 0, done: 0, need_review: 0, not_yet: 0 });
  const [loadingStats, setLoadingStats] = useState(true);
  const [errorStats, setErrorStats] = useState(null);

  // Divisions list for filters (fetched from backend)
  const [divisions, setDivisions] = useState([]);
  const [loadingDivisions, setLoadingDivisions] = useState(false);

  // Mentors for filters (fetched from backend)
  const [mentors, setMentors] = useState([{ value: '', label: 'All Mentors' }]);
  const [loadingMentors, setLoadingMentors] = useState(false);

  // Evaluation components (criteria) fetched from backend
  const [evaluationComponents, setEvaluationComponents] = useState([]);
  const [loadingComponents, setLoadingComponents] = useState(false);

  // Bulk certificate generation state (active interns only)
  const [bulkAllInterns, setBulkAllInterns] = useState(false);
  const [bulkSelectedInterns, setBulkSelectedInterns] = useState([]);
  const [activeInterns, setActiveInterns] = useState([]);
  const [loadingActiveInterns, setLoadingActiveInterns] = useState(false);
  const [internSearch, setInternSearch] = useState('');

  // Evaluation status cache: id -> boolean (true = has evaluation, false = missing)
  const [evaluationStatus, setEvaluationStatus] = useState({});
  const [checkingStatus, setCheckingStatus] = useState(false);

  // Bulk modal file inputs (expects single-column CSV of certificate numbers)
  const [showBulkGenerateModal, setShowBulkGenerateModal] = useState(false);
  const [bulkTemplateFile, setBulkTemplateFile] = useState(null);
  const [bulkNumbersFile, setBulkNumbersFile] = useState(null); // csv single-column list of numbers
  const [bulkHasHeader, setBulkHasHeader] = useState(true);
  const [bulkLoading, setBulkLoading] = useState(false);

  // derive stats for UI
  const stats = [
    { label: "Total Intern", value: statsData.total_completed ?? 0, icon: <UsersIcon />, color: "bg-blue-50 text-blue-600" },
    { label: "Done Review", value: statsData.done ?? 0, icon: <CheckCircle2 />, color: "bg-green-50 text-green-600" },
    { label: "Need Review", value: statsData.need_review ?? 0, icon: <AlertCircle />, color: "bg-orange-50 text-orange-600" },
    { label: "Waiting Mentor", value: statsData.not_yet ?? 0, icon: <Clock />, color: "bg-red-50 text-red-500" },
  ];

  // loading state for form actions
  const [formLoading, setFormLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Per-user certificate generation modal state (per-intern uses manual input)
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [certTemplateFile, setCertTemplateFile] = useState(null);
  const [certNumber, setCertNumber] = useState('');
  const [certLoading, setCertLoading] = useState(false);
  // Persistent templates (admin uploaded once, reused for future generations)
  const [certTemplateFront, setCertTemplateFront] = useState(null);
  const [certTemplateBack, setCertTemplateBack] = useState(null);
  const [savingTemplates, setSavingTemplates] = useState(false);
  const [certTemplateFrontUrl, setCertTemplateFrontUrl] = useState(null);
  const [certTemplateBackUrl, setCertTemplateBackUrl] = useState(null);
  // Loading indicators when fetching preview blobs
  const [certTemplateFrontLoading, setCertTemplateFrontLoading] = useState(false);
  const [certTemplateBackLoading, setCertTemplateBackLoading] = useState(false);

  const prevFrontUrlRef = useRef(null);
  const prevBackUrlRef = useRef(null);

  // Filter (moved up so fetch functions can reference appliedFilter)
  const initialFilter = { division: "", mentor: "", status: [] };
  const [filter, setFilter] = useState(initialFilter);
  const [appliedFilter, setAppliedFilter] = useState(initialFilter);
  const isFilterActive = appliedFilter.division !== "" || appliedFilter.mentor !== "" || (appliedFilter.status && appliedFilter.status.length > 0);
  const [openDropdown, setOpenDropdown] = useState(null);

  // --- API helpers ---
  const formatDate = (value) => {
    if (!value) return null;
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return String(value);
    return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const resolvePeriod = (item) => {
    const start = item?.mulai_magang || item?.start_date || item?.startDate || item?.mulaiMagang;
    const end = item?.akhir_magang || item?.end_date || item?.endDate || item?.akhirMagang;
    if (!end) return '-';
    const startLabel = formatDate(start);
    const endLabel = formatDate(end);
    if (startLabel && endLabel) return `${startLabel} - ${endLabel}`;
    return endLabel || '-';
  };

  const resolveMentorName = (item) => (
    item?.mentor_name ||
    item?.mentor?.nama_lengkap ||
    item?.mentor?.nama ||
    item?.mentor_name_full ||
    item?.mentor_full_name ||
    item?.mentorName ||
    item?.mentor ||
    item?.pembimbing ||
    '-'
  );

  const fetchDashboard = async () => {
    try {
      setLoadingStats(true);
      setErrorStats(null);
      const res = await apiClient.get('/admin/evaluations/dashboard');
      if (res.data && res.data.success) setStatsData(res.data.data);
      else setStatsData({ total_completed: 0, done: 0, need_review: 0, not_yet: 0 });
    } catch (err) {
      console.error('Failed to load dashboard stats', err);
      setErrorStats('Failed to load stats');
    } finally {
      setLoadingStats(false);
    }
  };

  const fetchInterns = async () => {
    try {
      setLoadingInterns(true);
      setErrorInterns(null);
      const params = {};
      if (searchQuery) params.search = searchQuery;
      if (appliedFilter.division) params.division = appliedFilter.division;
      if (appliedFilter.status && appliedFilter.status.length > 0) {
        params.status = appliedFilter.status.map(s => {
          if (s === 'Waiting Mentor') return 'not_yet';
          return s.toLowerCase().replace(' ', '_');
        }).join(',');
      }
      const res = await apiClient.get('/admin/evaluations/interns', { params });
      if (res.data && res.data.success && Array.isArray(res.data.data)) {
        // Only include interns that are active (robust check for several possible field names)
        const checkActive = (val) => {
          if (val === undefined || val === null) return false;
          if (typeof val === 'boolean') return val;
          if (typeof val === 'number') return val === 1;
          return String(val).toLowerCase() === '1' || String(val).toLowerCase() === 'true';
        };

        const onlyActive = res.data.data.filter(i => {
          const raw = i.is_active ?? i['is active'] ?? i.active ?? i.isActive ?? i.active_flag ?? i.status_active;
          return checkActive(raw);
        });

        const mapped = onlyActive.map(i => ({
          id: i.user_id,
          name: i.nama_lengkap || i.nama,
          division: typeof i.division === 'object' ? (i.division?.name || i.division?.nama || '-') : (i.division || '-'),
          mentor: resolveMentorName(i),
          period: resolvePeriod(i),
          jobPosition: i.job_position || i.posisi || i.position || '-',
          institution: i.institution || i.universitas || i.university || i.univ || i.instansi || '-',
          major: i.major || i.jurusan || '-',
          evaluationId: i.evaluation_id,
          // Map admin_review_status to display status
          status: i.admin_review_status === 'done' ? 'Done' : i.admin_review_status === 'need_review' ? 'Need Review' : i.admin_review_status === 'not_yet' ? 'Waiting Mentor' : '-',
          can_view: !!i.can_view,
          can_edit: !!i.can_edit
        }));
        setInterns(mapped);
      } else {
        setInterns([]);
      }
    } catch (err) {
      console.error('Failed to load interns', err);
      setErrorInterns('Failed to load interns');
    } finally {
      setLoadingInterns(false);
    }
  };

  // Debounce search: update debounced query when user stops typing
  useEffect(() => {
    const t = setTimeout(() => {
      setSearchQuery(searchInput.trim());
    }, 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  // Fetch when debounced search or applied filters change
  useEffect(() => {
    fetchDashboard();
    fetchInterns();
  }, [searchQuery, appliedFilter]);

  const fetchDivisions = async () => {
    setLoadingDivisions(true);
    try {
      // endpoint: /available-divisions
      const res = await apiClient.get('/available-divisions');
      const data = res?.data?.data ?? res?.data ?? [];
      const opts = Array.isArray(data) ? data.map(d => {
        const val = typeof d === 'object' ? (d.name || d.nama || d.slug || JSON.stringify(d)) : d;
        return { value: val, label: val };
      }) : [];
      setDivisions([{ value: '', label: 'All Divisions' }, ...opts]);
    } catch (err) {
      console.warn('Could not fetch /available-divisions:', err);
      setDivisions([{ value: '', label: 'All Divisions' }]);
    } finally {
      setLoadingDivisions(false);
    }
  };

  const fetchMentors = async () => {
    setLoadingMentors(true);
    try {
      const res = await apiClient.get('/admin/mentors');
      const data = res?.data?.data ?? res?.data ?? [];
      const opts = Array.isArray(data)
        ? data.map(m => ({ value: m.id ?? m.user_id ?? m.value ?? m.name ?? m.nama_lengkap ?? m.nama ?? m, label: m.name ?? m.nama_lengkap ?? m.nama ?? String(m) }))
        : [];
      setMentors([{ value: '', label: 'All Mentors' }, ...opts]);
    } catch (err) {
      console.warn('Could not fetch /admin/mentors:', err);
      setMentors([{ value: '', label: 'All Mentors' }]);
    } finally {
      setLoadingMentors(false);
    }
  };

  const fetchEvaluationComponents = async () => {
    setLoadingComponents(true);
    try {
      const res = await apiClient.get('admin/evaluations/komponen-penilaian');
      if (res.data && res.data.success && Array.isArray(res.data.data)) {
        setEvaluationComponents(res.data.data);
      }
    } catch (err) {
      console.warn('Could not fetch evaluation components:', err);
      setEvaluationComponents([]);
    } finally {
      setLoadingComponents(false);
    }
  };

 const fetchActiveInterns = async () => {
    setLoadingActiveInterns(true);
    try {
      const res = await apiClient.get('/admin/evaluations/interns');
      const data = res?.data?.data ?? res?.data ?? [];
      const list = Array.isArray(data) ? data : [];

      const checkActive = (val) => {
        if (val === undefined || val === null) return false;
        if (typeof val === 'boolean') return val;
        if (typeof val === 'number') return val === 1;
        return String(val).toLowerCase() === '1' || String(val).toLowerCase() === 'true';
      };

      const filtered = list.filter(i => {
        const raw = i.is_active ?? i['is active'] ?? i.active ?? i.isActive ?? i.active_flag ?? i.status_active;
        return checkActive(raw);
      });

      const normalized = filtered.map((i) => ({
        id: i.user_id ?? i.id ?? i.value ?? i,
        name: i.nama_lengkap ?? i.nama ?? String(i),

        // PERBAIKAN: Ambil status langsung dari field 'status' (yang bernilai "final")
        // Jika 'status' kosong, baru cek 'admin_review_status'
        admin_status: i.status || i.admin_review_status || 'not_yet'
      }));
      setActiveInterns(normalized);
    } catch (err) {
      console.warn('Could not fetch /done-interns:', err);
      setActiveInterns([]);
    } finally {
      setLoadingActiveInterns(false);
    }
  };

  useEffect(() => {
    // fetch divisions, mentors, components and active interns once on mount
    fetchDivisions();
    fetchMentors();
    fetchEvaluationComponents();
    fetchActiveInterns();
  }, []);

  // --- TEMPLATE MANAGEMENT ---
  const fetchTemplates = async () => {
    try {
      const res = await apiClient.get('/admin/sertifikat/templates');
      if (res.data && res.data.success) {
        const templates = res.data.data;
        const front = templates.find(t => t.side === 'front');
        const back = templates.find(t => t.side === 'back');

        if (front) {
          setCertTemplateFront({ name: front.name, id: front.id, isRemote: true });
          // Fetch blob for preview (show loading)
          setCertTemplateFrontLoading(true);
          const frontUrl = await fetchSecureBlob('/admin/sertifikat/templates/view/front');
          if (prevFrontUrlRef.current) URL.revokeObjectURL(prevFrontUrlRef.current);
          if (frontUrl) {
            prevFrontUrlRef.current = frontUrl;
            setCertTemplateFrontUrl(frontUrl);
          } else {
            prevFrontUrlRef.current = null;
            setCertTemplateFrontUrl(null);
          }
          setCertTemplateFrontLoading(false);
        } else {
          setCertTemplateFront(null);
          if (prevFrontUrlRef.current) {
            URL.revokeObjectURL(prevFrontUrlRef.current);
            prevFrontUrlRef.current = null;
          }
          setCertTemplateFrontUrl(null);
          setCertTemplateFrontLoading(false);
        }

        if (back) {
          setCertTemplateBack({ name: back.name, id: back.id, isRemote: true });
          setCertTemplateBackLoading(true);
          const backUrl = await fetchSecureBlob('/admin/sertifikat/templates/view/back');
          if (prevBackUrlRef.current) URL.revokeObjectURL(prevBackUrlRef.current);
          if (backUrl) {
            prevBackUrlRef.current = backUrl;
            setCertTemplateBackUrl(backUrl);
          } else {
            prevBackUrlRef.current = null;
            setCertTemplateBackUrl(null);
          }
          setCertTemplateBackLoading(false);
        } else {
          setCertTemplateBack(null);
          if (prevBackUrlRef.current) {
            URL.revokeObjectURL(prevBackUrlRef.current);
            prevBackUrlRef.current = null;
          }
          setCertTemplateBackUrl(null);
          setCertTemplateBackLoading(false);
        }
      }
    } catch (err) {
      console.error('Failed to fetch templates', err);
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

  // Revoke object URLs on unmount
  useEffect(() => {
    return () => {
      if (prevFrontUrlRef.current) {
        try { URL.revokeObjectURL(prevFrontUrlRef.current); } catch (e) {}
        prevFrontUrlRef.current = null;
      }
      if (prevBackUrlRef.current) {
        try { URL.revokeObjectURL(prevBackUrlRef.current); } catch (e) {}
        prevBackUrlRef.current = null;
      }
    };
  }, []);

  // utility helpers for client-side image resizing/compression
  const loadImageElement = (file) => new Promise((resolve, reject) => {
    const imageUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(imageUrl);
      resolve(image);
    };
    image.onerror = (error) => {
      URL.revokeObjectURL(imageUrl);
      reject(error);
    };
    image.src = imageUrl;
  });

  const canvasToBlob = (canvas, mimeType, quality) => new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Failed to create image blob.'));
    }, mimeType, quality);
  });

  const optimizeTemplateImage = async (file) => {
    try {
      if (!file || !file.type?.startsWith('image/')) return file;
      const image = await loadImageElement(file);
      const sourceWidth = image.naturalWidth || image.width;
      const sourceHeight = image.naturalHeight || image.height;
      if (!sourceWidth || !sourceHeight) return file;
      const MAX_TEMPLATE_DIMENSION = 3508;
      const TARGET_TEMPLATE_MAX_BYTES = 4 * 1024 * 1024;
      const resizeScale = Math.min(1, MAX_TEMPLATE_DIMENSION / Math.max(sourceWidth, sourceHeight));
      const nextWidth = Math.max(1, Math.round(sourceWidth * resizeScale));
      const nextHeight = Math.max(1, Math.round(sourceHeight * resizeScale));
      const shouldResize = resizeScale < 1;
      const shouldTryCompress = file.size > TARGET_TEMPLATE_MAX_BYTES;
      if (!shouldResize && !shouldTryCompress) return file;
      const canvas = document.createElement('canvas');
      canvas.width = nextWidth;
      canvas.height = nextHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) return file;
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(image, 0, 0, nextWidth, nextHeight);
      const mimeType = file.type || 'image/png';
      let optimizedBlob;
      if (mimeType === 'image/jpeg' || mimeType === 'image/webp') {
        let quality = 0.95;
        optimizedBlob = await canvasToBlob(canvas, mimeType, quality);
        while (optimizedBlob.size > TARGET_TEMPLATE_MAX_BYTES && quality > 0.75) {
          quality -= 0.05;
          optimizedBlob = await canvasToBlob(canvas, mimeType, quality);
        }
      } else {
        optimizedBlob = await canvasToBlob(canvas, mimeType);
      }
      if (!optimizedBlob || optimizedBlob.size >= file.size * 0.98) {
        return shouldResize ? new File([await canvasToBlob(canvas, mimeType)], file.name, { type: mimeType, lastModified: Date.now() }) : file;
      }
      return new File([optimizedBlob], file.name, { type: mimeType, lastModified: Date.now() });
    } catch (e) {
      console.warn('optimizeTemplateImage failed', e);
      return file;
    }
  };

  const handleUploadTemplate = async (side, file) => {
    if (!file) return;

    // optionally optimize image so it fits within server limits
    let uploadFile = file;
    try {
      uploadFile = await optimizeTemplateImage(file);
      console.debug('upload template; original size', file.size, 'optimized size', uploadFile.size);
    } catch (e) {
      console.warn('template optimization error', e);
    }

    // Create form data
    const formData = new FormData();
    formData.append('name', `Sertifikat Internship - ${side === 'front' ? 'Depan' : 'Belakang'}`);
    formData.append('side', side);
    formData.append('image', uploadFile);

    setSavingTemplates(true);
    try {
      // Immediately show local preview so user sees upload result instantly
      const localUrl = URL.createObjectURL(file);
      if (side === 'front') {
        if (prevFrontUrlRef.current) URL.revokeObjectURL(prevFrontUrlRef.current);
        prevFrontUrlRef.current = localUrl;
        setCertTemplateFrontUrl(localUrl);
        setCertTemplateFront({ name: file.name, id: null, isRemote: false });
      } else {
        if (prevBackUrlRef.current) URL.revokeObjectURL(prevBackUrlRef.current);
        prevBackUrlRef.current = localUrl;
        setCertTemplateBackUrl(localUrl);
        setCertTemplateBack({ name: file.name, id: null, isRemote: false });
      }

      const res = await apiClient.post('/admin/sertifikat/templates', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      if (res.data && res.data.success) {
        // Refresh canonical templates in background (replace local preview if server returns blob)
        fetchTemplates().catch(() => {});
      }
    } catch (err) {
      logError('handleTemplateUpload', err);
      setStatusType('error');
      setStatusMessage({ title: 'Error', desc: getSafeErrorMessage(err, 'Failed to upload template.') });
      setShowStatusModal(true);
    } finally {
      setSavingTemplates(false);
    }
  };

  const handleClearTemplate = async (side, id) => {
    if (!id) {
      // Just clear local preview if not saved remotely (edge case)
      if (side === 'front') { setCertTemplateFront(null); setCertTemplateFrontUrl(null); }
      if (side === 'back') { setCertTemplateBack(null); setCertTemplateBackUrl(null); }
      return;
    }

    setTemplateToDelete({ side, id });
    setConfirmType('delete_template');
    setShowConfirmModal(true);
  };


  // Create object URLs for previewing selected files (and revoke when changed)
  // MOVED: logic integration into fetchTemplates and handleUpload

 useEffect(() => {
    // Check status for active interns directly
    if (activeInterns.length > 0) {
      const updates = {};
      activeInterns.forEach(intern => {
        // Ambil string status dan jadikan huruf kecil semua
        const statusStr = String(intern.admin_status || '').toLowerCase();

        // LOGIKA BARU: Murni cek status.
        // JSON Anda mengembalikan "final", jadi kita masukkan 'final' di sini.
        const isDone = statusStr === 'final' || statusStr === 'done' || statusStr === 'completed';

        // Set true jika statusnya final/done
        updates[String(intern.id)] = isDone;
      });
      setEvaluationStatus(prev => ({ ...prev, ...updates }));
    }
  }, [activeInterns]);


  // --- STATES ---
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [showFormModal, setShowFormModal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);

  // Form Data
  const [selectedIntern, setSelectedIntern] = useState(null);
  const [formData, setFormData] = useState({
    scores: {},
    feedback: ""
  });
  const [evaluationComponentsSnapshot, setEvaluationComponentsSnapshot] = useState([]); // Snapshot of components from loaded evaluation (preserves original nama_komponen)
  const [finalScore, setFinalScore] = useState(0);
  const [predicate, setPredicate] = useState("-");

  // Status & Confirm
  const [confirmType, setConfirmType] = useState('save'); // 'save' | 'generate_cert' | 'final' | 'delete_template'
  const [statusType, setStatusType] = useState('success');
  const [statusMessage, setStatusMessage] = useState({ title: "", desc: "" });
  const [confirmConsent, setConfirmConsent] = useState(false); // user acknowledges before finalizing
  const [templateToDelete, setTemplateToDelete] = useState(null); // stores {side, id} when deleting


  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const totalEntries = interns.length;
  const totalPages = Math.ceil(totalEntries / itemsPerPage);
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = interns.slice(indexOfFirstItem, indexOfLastItem);

  const paginationMeta = {
    current_page: currentPage,
    last_page: totalPages,
    from: totalEntries === 0 ? 0 : indexOfFirstItem + 1,
    to: Math.min(indexOfLastItem, totalEntries),
    total: totalEntries
  };

  // --- LOGIC: AUTO CALCULATE ---
  useEffect(() => {
    if (showFormModal) {
      const values = Object.values(formData.scores).map(Number).filter(v => !isNaN(v));
      if (values.length === 0) {
        setFinalScore(0);
        setPredicate("C");
        return;
      }
      const sum = values.reduce((a, b) => a + b, 0);
      const avg = (sum / values.length).toFixed(1);
      const finalScoreNum = isNaN(avg) ? 0 : Number(avg);

      setFinalScore(finalScoreNum);

      // Predicate Logic
      if (finalScoreNum >= 86) setPredicate("A");
      else if (finalScoreNum >= 71) setPredicate("B");
      else setPredicate("C");
    }
  }, [formData.scores, showFormModal]);

  // --- HANDLERS ---

  const handlePageChange = (page) => {
    if (page >= 1 && page <= totalPages) setCurrentPage(page);
  };

  const openEvaluationForm = async (intern) => {
    setSelectedIntern(intern);
    setFormLoading(true);
    try {
      // If there is an evaluation id, fetch detail from admin endpoint
      if (intern.evaluationId) {
        const res = await apiClient.get(`/admin/evaluations/${intern.evaluationId}`);
        if (res.data && res.data.success) {
          const d = res.data.data;

          // Parse scores from pivot table structure (components array)
          const scores = {};
          let componentsSnapshot = []; // Store original components with nama_komponen

          if (d.components && Array.isArray(d.components)) {
            d.components.forEach((comp, idx) => {
              const key = `q${idx + 1}`;
              scores[key] = (comp.score != null && String(comp.score).trim() !== '') ? Number(comp.score) : 0;
              // Store snapshot with original nama_komponen (won't change even if master data changes)
              componentsSnapshot.push({
                idx: idx + 1,
                key: key,
                nama_komponen: comp.nama_komponen,
                score: scores[key]
              });
            });
            setEvaluationComponentsSnapshot(componentsSnapshot);
          } else if (d.integrity_score != null) {
            // Fallback for old structure (backward compatibility)
            scores.q1 = Number(d.integrity_score) || 0;
            scores.q2 = Number(d.punctuality_score) || 0;
            scores.q3 = Number(d.expertise_score) || 0;
            scores.q4 = Number(d.teamwork_score) || 0;
            scores.q5 = Number(d.communication_score) || 0;
            scores.q6 = Number(d.it_proficiency_score) || 0;
            scores.q7 = Number(d.self_development_score) || 0;
            setEvaluationComponentsSnapshot([]);
          }

          setFormData({
            scores: scores,
            feedback: d.mentor_notes || ''
          });
          setSelectedIntern(prev => ({ ...prev, evaluationId: d.id || prev.evaluationId, status: d.status || prev.status }));
        } else {
          // fallback to provided intern data
          setFormData({ scores: { ...intern.scores }, feedback: intern.feedback || '' });
          setEvaluationComponentsSnapshot([]);
        }
      } else {
        setFormData({ scores: { ...intern.scores }, feedback: intern.feedback || '' });
        setEvaluationComponentsSnapshot([]);
      }
      setShowFormModal(true);
    } catch (err) {
      console.error('Failed to load evaluation detail for admin', err);
      setStatusType('error');
      setStatusMessage({ title: 'Error', desc: 'Failed to load evaluation details.' });
      setShowStatusModal(true);
    } finally {
      setFormLoading(false);
    }
  };

  const handleScoreChange = (key, value) => {
    // Limit input 0-100
    let numVal = parseInt(value) || 0;
    if (numVal > 100) numVal = 100;
    if (numVal < 0) numVal = 0;

    setFormData(prev => ({
      ...prev,
      scores: { ...prev.scores, [key]: numVal }
    }));
  };

  const handleSaveInit = () => {
    setConfirmType('save');
    setConfirmConsent(false);
    setShowConfirmModal(true);
  };

  const handleFinalInit = () => {
    setConfirmType('final');
    setConfirmConsent(false);
    setShowConfirmModal(true);
  };

  const handleGenerateCertInit = () => {
    if (!selectedIntern) return;
    // Open the Generate Certificate page for this single intern
    navigate('/admin/generate-sertif', {
      state: {
        selectedInterns: [selectedIntern],
        mode: 'single',
        fromFinalEvaluation: true,
        formData,
        finalScore,
        predicate,
        certNumber
      }
    });
  };

  const executeAction = async () => {
    // Require explicit consent for finalizing actions
    if (confirmType === 'final' || confirmType === 'save') {
      if (!confirmConsent) {
        setStatusType('error');
        setStatusMessage({ title: 'Confirmation required', desc: 'Please confirm the acknowledgement before finalizing.' });
        setShowStatusModal(true);
        return;
      }
    }

    setShowConfirmModal(false);

    if (confirmType === 'delete_template' && templateToDelete) {
      try {
        const res = await apiClient.delete(`/admin/sertifikat/templates/${templateToDelete.id}`);
        if (res.data && res.data.success) {
          await fetchTemplates();
          setStatusType('success');
          setStatusMessage({ title: 'Deleted', desc: 'Template deleted successfully.' });
          setShowStatusModal(true);
        }
      } catch (err) {
        console.error('Delete failed', err);
        setStatusType('error');
        setStatusMessage({ title: 'Error', desc: 'Failed to delete template.' });
        setShowStatusModal(true);
      }
      setTemplateToDelete(null);
      return;
    }

    if (confirmType === 'final') {
      await handleSaveReview(true);
      return;
    }

    if (confirmType === 'generate_bulk') {
      await handleGenerateBulk();
      return;
    }

    // legacy placeholder for non-API flows (kept for compatibility)
    setTimeout(() => {
      setStatusType('success');
      setStatusMessage({ title: "Done", desc: "Action completed." });
      setShowStatusModal(true);
    }, 500);
  };

  // Admin: Save or mark reviewed
  const handleSaveReview = async (markReviewed = false) => {
    if (!selectedIntern || !selectedIntern.evaluationId) return;
    setSaving(true);
    try {
      const payload = { notes: formData.feedback || '' };
      const res = await apiClient.put(`/admin/evaluations/${selectedIntern.evaluationId}/review`, payload);
      if (res.data && res.data.success) {
        setStatusType('success');
        setStatusMessage({ title: markReviewed ? 'Reviewed' : 'Saved', desc: markReviewed ? 'Evaluation has been marked as reviewed.' : 'Feedback saved successfully.' });
        setShowStatusModal(true);
        setShowFormModal(false);
        await fetchInterns();
        await fetchDashboard();
        // Refresh active interns list and update evaluation cache for this intern
        try { await fetchActiveInterns(); } catch (e) { /* ignore */ }
        if (markReviewed && selectedIntern) {
          const idKey = String(selectedIntern.id);
          setEvaluationStatus(prev => ({ ...prev, [idKey]: true }));
          setSelectedIntern(prev => prev ? ({ ...prev, status: 'Done' }) : prev);
        }
      } else {
        throw new Error(res.data?.message || 'Failed to save review');
      }
    } catch (err) {
      console.error('Save review error', err);
      let errorMsg = 'Failed to save review. Please try again.';
      if (err.response?.status === 422) {
        const validationErrors = err.response.data?.errors;
        if (validationErrors && typeof validationErrors === 'object') {
          errorMsg = Object.values(validationErrors).join(', ');
        } else {
          errorMsg = getSafeErrorMessage(err, errorMsg);
        }
      } else if (err.response?.status === 403) {
        errorMsg = 'You do not have permission to review this evaluation.';
      } else if (err.response?.status === 404) {
        errorMsg = 'Evaluation not found.';
      } else {
        errorMsg = getSafeErrorMessage(err, errorMsg);
      }
      setStatusType('error');
      setStatusMessage({ title: 'Error', desc: errorMsg });
      setShowStatusModal(true);
    } finally {
      setSaving(false);
    }
  };

  // Bulk certificate generation (scoped)
  const handleGenerateBulk = async () => {
    setFormLoading(true);
    setTimeout(() => {
      setStatusType('success');
      setStatusMessage({ title: 'Success', desc: 'Simulasi: bulk sertifikat berhasil digenerate (dummy).' });
      setShowStatusModal(true);
      setFormLoading(false);
    }, 600);
  };

  // Generate single certificate for selected intern (template file + certificate number)
  const handleGenerateSingle = async () => {
    if (!certTemplateFile) {
      setStatusType('error');
      setStatusMessage({ title: 'Error', desc: 'Please upload a certificate template (PDF).' });
      setShowStatusModal(true);
      return;
    }
    if (!certNumber || !certNumber.trim()) {
      setStatusType('error');
      setStatusMessage({ title: 'Error', desc: 'Please enter a certificate number.' });
      setShowStatusModal(true);
      return;
    }

    setCertLoading(true);
    setTimeout(() => {
      setStatusType('success');
      setStatusMessage({ title: 'Success', desc: 'Simulasi: sertifikat berhasil digenerate (dummy).' });
      setShowStatusModal(true);
      setShowGenerateModal(false);
      setCertLoading(false);
    }, 600);
  };

  // Submit bulk generation with template + numbers file
  const handleGenerateBulkSubmit = async () => {
    if (bulkSelectedInterns.length === 0) {
      setStatusType('error');
      setStatusMessage({ title: 'Error', desc: 'Please select at least one intern.' });
      setShowStatusModal(true);
      return;
    }
    if (!bulkTemplateFile) {
      setStatusType('error');
      setStatusMessage({ title: 'Error', desc: 'Please upload a certificate template (PDF).' });
      setShowStatusModal(true);
      return;
    }
    if (!bulkNumbersFile) {
      setStatusType('error');
      setStatusMessage({ title: 'Error', desc: 'Please upload a numbers file (CSV) with certificate numbers.' });
      setShowStatusModal(true);
      return;
    }

    setBulkLoading(true);
    setTimeout(() => {
      setStatusType('success');
      setStatusMessage({ title: 'Success', desc: 'Simulasi: bulk sertifikat berhasil digenerate (dummy).' });
      setShowStatusModal(true);
      setShowBulkGenerateModal(false);
      setBulkLoading(false);
    }, 600);
  };

  // --- RENDER HELPERS ---

  const Badge = ({ text }) => {
    const base = "inline-flex items-center justify-center min-w-[120px] h-[34px] px-3 rounded-lg text-xs font-extrabold border whitespace-nowrap";
    if (text === 'Done') return <span className={`${base} bg-green-50 text-green-600 border-green-200`}>{text}</span>;
    if (text === 'Need Review') return <span className={`${base} bg-orange-50 text-orange-600 border-orange-200`}>{text}</span>;
    return <span className={`${base} bg-red-50 text-red-600 border-red-200`}>{text}</span>;
  };

  const handleDropdownSelect = (key, value) => {
    setFilter(prev => ({ ...prev, [key]: prev[key] === value ? "" : value }));
    setOpenDropdown(null);
  };

  const handleStatusToggle = (status) => {
    setFilter(prev => {
      const current = prev.status || [];
      const updated = current.includes(status) ? current.filter(s => s !== status) : [...current, status];
      return { ...prev, status: updated };
    });
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
          <div className="absolute inset-x-0 mt-2 bg-white rounded-xl border border-slate-100 shadow-xl z-20 overflow-hidden max-h-56 overflow-y-auto">
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
    setFilter(initialFilter);
    setAppliedFilter(initialFilter);
    setShowFilterModal(false);
  };

  const applyFilter = () => {
    setAppliedFilter(filter);
    setShowFilterModal(false);
  };

  return (
    <div className="bg-slate-50 min-h-screen p-4 md:p-8 font-sans text-slate-800 -mt-8 -ml-5 -mr-7">

      {/* HEADER */}
      <div className="mb-8 mt-4 md:mt-0">
        <h1 className={`text-2xl md:text-3xl font-bold text-[${colors.textDark}] mb-1 md:mb-2`}>Internship Evaluation</h1>
        <p className="text-slate-500 text-xs md:text-sm">Review performance and provide final assessments for active interns.</p>
      </div>

      {/* STATS CARDS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {stats.map((stat, idx) => (
          <div key={idx} className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${stat.color}`}>
              {React.cloneElement(stat.icon, { size: 24 })}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-slate-400 font-medium">{stat.label}</p>
              <p className="text-xl font-bold text-[#27345A]">{stat.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ACTION BAR */}
      <div className="flex flex-row flex-wrap justify-between items-center gap-3 mb-6">
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-80">
            <input
              type="text"
              placeholder="Search Intern"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { setSearchQuery(searchInput.trim()); } }}
              className="w-full pl-10 pr-4 py-3.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#354C8F]/20 text-sm shadow-sm transition-all"
            />
            <Search className="absolute left-3 top-3.5 text-slate-400" size={18} />
          </div>

          <button
            onClick={() => {
              setFilter(appliedFilter);
              setShowFilterModal(true);
            }}
            className="bg-[#354C8F] hover:bg-[#2a3c70] text-white py-3.5 px-6 rounded-xl font-bold text-sm shadow-md shadow-indigo-200 flex items-center justify-center gap-2 transition-all active:scale-95"
          >
            <Filter size={18} />
            <span className="hidden md:inline">Filter</span>
            {isFilterActive && <div className="ml-2 w-2 h-2 bg-red-400 rounded-full animate-pulse"></div>}
          </button>
        </div>
      </div>

      {/* TABLE */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-full md:min-w-[1000px]">
            <thead>
              <tr className="border-b border-slate-100 text-xs md:text-sm font-bold text-slate-900 bg-slate-50/50">
                <th className="p-3 md:p-3 w-16 text-center">No</th>
                <th className="p-3 md:p-3">Name</th>

                <th className="p-3 md:p-3">Internship Period</th>

                <th className="p-3 md:p-3">Job Position</th>
                <th className="p-3 md:p-3">Mentor</th>
                <th className="p-3 md:p-3">Division</th>
                <th className="p-3 md:p-3">Institution</th>
                <th className="p-3 md:p-3 text-center">Status</th>
                <th className="p-3 md:p-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="text-xs md:text-sm text-slate-600">
              {loadingInterns ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-slate-400">Loading interns...</td>
                </tr>
              ) : errorInterns ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-red-500">{errorInterns}</td>
                </tr>
              ) : currentItems.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-slate-400">No data available.</td>
                </tr>
              ) : (
                currentItems.map((item, index) => (
                  <tr key={item.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                    <td className="p-3 md:p-3 text-center font-medium">{paginationMeta.from + index}</td>

                    <td className="p-3 md:p-3 font-medium text-slate-700">
                      <div>{item.name}</div>
                      <div className="text-[10px] text-slate-400 md:hidden">{item.jobPosition}</div>
                    </td>
                    <td className="p-3 md:p-3 whitespace-nowrap">{item.period}</td>

                    <td className="p-3 md:p-3 text-slate-600 hidden md:table-cell whitespace-normal break-words max-w-[180px]">{item.jobPosition}</td>
                    <td className="p-3 md:p-3 text-slate-600 whitespace-normal break-words max-w-[180px]">{item.mentor || '-'}</td>
                    <td className="p-3 md:p-3 whitespace-normal break-words max-w-[180px]">{item.division}</td>
                    <td className="p-3 md:p-3 text-slate-600 whitespace-normal break-words max-w-[200px]">{item.institution}</td>
                    <td className="p-3 md:p-3 text-center"><Badge text={item.status} /></td>
                    <td className="p-3 md:p-3 text-center">
                      {(() => {
                        // Allow viewing when can_view is true OR when status is 'Not Yet'
                        const isViewEnabled = item.can_view || item.status === 'Not Yet';
                        // Default button colors (admin primary)
                        let bgClass = 'bg-[#354C8F]';
                        let hoverClass = 'hover:bg-[#2a3c70]';

                        // When status is 'Need Review', use green full fill
                        if (item.status === 'Need Review') {
                          bgClass = 'bg-[#22C55E]';
                          hoverClass = 'hover:bg-[#16A34A]';
                        }

                        const cursorClass = isViewEnabled ? 'cursor-pointer' : 'cursor-not-allowed opacity-60';

                        const title = isViewEnabled
                          ? (item.status === 'Done' ? 'View Result' : item.status === 'Not Yet' ? 'Evaluate' : 'Review')
                          : 'Not available';

                        return (
                          <button
                            onClick={() => isViewEnabled ? openEvaluationForm(item) : null}
                            disabled={!isViewEnabled}
                            className={`inline-flex items-center justify-center w-9 h-9 rounded-lg transition-colors active:scale-95 shadow-sm text-white ${bgClass} ${hoverClass} ${cursorClass}`}
                            title={title}
                          >
                            {item.status === 'Need Review' ? <Edit size={18} /> : <Eye size={18} />}
                          </button>
                        );
                      })()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* PAGINATION */}
        {totalEntries > 0 && (
          <div className="flex flex-col md:flex-row justify-between items-center p-5 border-t border-slate-100 text-sm text-slate-500 gap-4">
            <p className="order-2 md:order-1">Showing {paginationMeta.from} to {paginationMeta.to} of {paginationMeta.total} entries</p>
            <div className="flex items-center gap-4 order-1 md:order-2">
                <div className="flex items-center gap-2">
                    <label className="text-sm md:text-sm font-medium text-slate-600">Per page:</label>
                    <select
                        value={itemsPerPage}
                        onChange={(e) => setItemsPerPage(Number(e.target.value))}
                        className="px-2 py-1.5 rounded-lg border border-slate-200 text-sm md:text-sm font-medium text-slate-700 bg-white hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#354C8F]/20 cursor-pointer transition-all"
                    >
                        <option value={5}>5</option>
                        <option value={10}>10</option>
                        <option value={25}>25</option>
                    </select>
                </div>
            <div className="flex items-center gap-2">
              {(() => {
                const pageCurrent = currentPage;
                const pageTotal = totalPages;
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

                return (
                  <>
                    <button onClick={() => handlePageChange(pageCurrent - 1)} disabled={pageCurrent === 1} className="p-2 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50 border border-slate-200 disabled:cursor-not-allowed"><ChevronLeft size={18} /></button>
                    {getPageItems(pageCurrent, pageTotal, 1).map((p, idx) => {
                      if (p === 'left-ellipsis' || p === 'right-ellipsis') return <div key={`${p}-${idx}`} className="w-8 h-8 flex items-center justify-center rounded-lg text-xs font-bold text-slate-400">...</div>;
                      return <button key={p} onClick={() => handlePageChange(p)} className={`w-8 h-8 flex items-center justify-center rounded-lg text-xs font-bold transition-colors ${pageCurrent === p ? "bg-slate-100 text-[#27345A] border border-slate-200" : "text-slate-500 hover:bg-slate-50 border border-transparent"}`}>{p}</button>;
                    })}
                    <button onClick={() => handlePageChange(pageCurrent + 1)} disabled={pageCurrent === pageTotal} className="p-2 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50 border border-slate-200 disabled:cursor-not-allowed"><ChevronRight size={18} /></button>
                  </>
                );
              })()}
            </div>
           </div>
          </div>
        )}
      </div>


      {/* BAGIAN UTAMA YANG DIPERBAIKI: Layout Kiri (List Intern) & Kanan (Upload) */}
      {/* =================================================================================== */}

      <div className="mt-6 p-4 bg-white border-t border-slate-100 rounded-2xl">
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <label className="text-[14px] font-bold text-slate-700">Generate Certificates & Templates</label>
          </div>

          {/* CONTAINER FLEX ROW UTAMA: Membungkus List Intern dan Upload */}
          <div className="flex flex-col md:flex-row md:items-stretch gap-6">

            {/* --- KOLOM KIRI: Select Interns (Lebar Fixed/Terbatas) --- */}
            <div className="flex flex-col w-full md:w-[350px] shrink-0">
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-semibold text-slate-500">Select Interns (single/multiple)</label>
                
                <label className="inline-flex items-center gap-2  px-3 py-1 text-[11px] font-semibold text-slate-600 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded text-[#354C8F] focus:ring-[#354C8F]/30"
                    checked={activeInterns.length > 0 &&
                      activeInterns.filter(i => evaluationStatus[String(i.id)] !== false).length > 0 &&
                      activeInterns.filter(i => evaluationStatus[String(i.id)] !== false).every(i => bulkSelectedInterns.includes(String(i.id)))
                    }
                    onChange={(e) => {
                      const checked = e.target.checked;
                      if (checked) {
                        const validIds = activeInterns
                          .filter(i => evaluationStatus[String(i.id)] !== false)
                          .map(i => String(i.id));
                        setBulkSelectedInterns(validIds);
                        setBulkAllInterns(true);
                      } else {
                        setBulkSelectedInterns([]);
                        setBulkAllInterns(false);
                      }
                    }}
                  />
                  Select All
                </label>
              </div>
              <input
                type="text"
                value={internSearch}
                onChange={(e) => setInternSearch(e.target.value)}
                placeholder="Search intern..."
                className="mb-2 px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#354C8F]/20 disabled:bg-slate-100"
              />
              {/* List Intern Container */}
              <div className="flex-1 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-2 text-sm shadow-inner custom-scrollbar">
                {loadingActiveInterns ? (
                  <div className="text-slate-400 text-xs px-2 py-3">Loading interns...</div>
                ) : activeInterns.length === 0 ? (
                  <div className="text-slate-400 text-xs px-2 py-3">No done interns</div>
                ) : (
                  activeInterns
                    .filter((i) => i.name.toLowerCase().includes(internSearch.toLowerCase()))
                    .sort((a, b) => {
                      const aStatus = evaluationStatus[String(a.id)];
                      const bStatus = evaluationStatus[String(b.id)];
                      const aMissing = aStatus === false ? 1 : 0;
                      const bMissing = bStatus === false ? 1 : 0;
                      if (aMissing !== bMissing) return bMissing - aMissing;
                      return String(a.name).localeCompare(String(b.name));
                    })
                    .map((i) => {
                      const value = String(i.id);
                      const checked = bulkSelectedInterns.includes(value);
                      const status = evaluationStatus[value];
                      const isMissing = status === false;
                      return (
                        <label
                          key={i.id}
                          className={`flex items-start gap-3 px-3 py-3 rounded-xl border transition-all mb-2 cursor-pointer ${checked ? 'bg-[#354C8F]/10 border-[#354C8F]/30' : 'border-transparent hover:bg-slate-50'
                            } ${isMissing ? 'opacity-60 cursor-not-allowed bg-slate-50 relative overflow-hidden' : ''}`}
                        >
                          {isMissing && <div className="absolute left-0 top-0 bottom-0 w-1 bg-rose-400/50"></div>}
                          <input
                            type="checkbox"
                            className="h-4 w-4 mt-0.5 rounded border-slate-300 text-[#354C8F] focus:ring-[#354C8F]/30"
                            checked={checked}
                            disabled={isMissing}
                            onChange={(e) => {
                              if (isMissing) return;
                              const value = String(i.id);
                              const newSelected = e.target.checked
                                ? [...new Set([...bulkSelectedInterns, value])]
                                : bulkSelectedInterns.filter((v) => v !== value);
                              setBulkSelectedInterns(newSelected);
                              const readyCount = activeInterns.filter(i => evaluationStatus[String(i.id)] === true).length;
                              setBulkAllInterns(newSelected.length === readyCount && readyCount > 0);
                            }}
                          />
                          <div className="flex flex-col flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <span className={`text-slate-700 font-bold truncate ${isMissing ? 'text-slate-500' : ''}`}>{i.name}</span>
                              {status === false && <span className="text-[10px] text-rose-600 font-bold bg-rose-50 px-2 py-0.5 rounded ml-auto whitespace-nowrap border border-rose-100">Missing Eval</span>}
                            </div>
                            {status === undefined && checked && <span className="text-[10px] text-slate-400">Checking...</span>}
                          </div>
                        </label>
                      );
                    })
                )}
              </div>
            </div>

            {/* --- KOLOM KANAN: Upload Templates (Modified UI) --- */}
            <div className="flex-1 flex flex-col h-full">
              <div className="bg-white rounded-2xl border border-slate-200 p-5 h-full flex flex-col shadow-sm relative overflow-hidden">

                {/* HEADER: Judul + Tombol Action Kecil di sini */}
                <div className="flex items-center justify-between mb-5 pb-4 border-b border-slate-50">
                  <div>
                    <label className="text-sm font-bold text-slate-800 flex items-center gap-2">
                      Certificate Templates
                    </label>
                    <p className="text-[11px] text-slate-500 mt-1">Upload persistent templates for all certificates</p>
                  </div>

                  {/* Tombol Refresh / Loading */}
                  <div className="flex items-center gap-4">
                    {savingTemplates && <span className="text-xs text-[#354C8F] font-bold animate-pulse">Saving...</span>}
                  </div>
                </div>

                {/* CONTENT: Input File */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 -mt-3">
                  {/* Front Template Box */}
                  <div className={`group relative p-4 border-2 border-dashed rounded-2xl transition-all duration-200 ${certTemplateFront ? 'border-[#354C8F]/30 bg-[#354C8F]/5' : 'border-slate-200 bg-slate-50/50 hover:bg-white hover:border-[#354C8F]/30'}`}>
                    <div className="flex justify-between items-center mb-3">
                      <label className="text-[12px] font-bold text-slate-700 flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#354C8F]"></span> Front Side <span className="text-red-500">*</span>
                      </label>
                      {certTemplateFront && (
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-green-700 font-bold bg-green-100 px-2 py-0.5 rounded-full flex items-center gap-1"><CheckCircle2 size={10} /> Saved</span>
                          <button onClick={() => handleClearTemplate('front', certTemplateFront.id)} className="text-slate-400 hover:text-red-500"><X size={14} /></button>
                        </div>
                      )}
                    </div>

                    <div className="relative h-40 w-full bg-white rounded-xl border border-slate-100 flex flex-col items-center justify-center overflow-hidden cursor-pointer shadow-sm group-hover:shadow-md transition-all">
                      <input
                        className="absolute inset-0 opacity-0 z-10 cursor-pointer"
                        type="file"
                        accept="image/png, image/jpeg, image/jpg"
                        onChange={(e) => {
                          if (e.target.files && e.target.files[0]) {
                            handleUploadTemplate('front', e.target.files[0]);
                          }
                        }}
                      />

                      {certTemplateFrontLoading ? (
                        <div className="flex items-center justify-center h-full">
                          <span className="text-sm text-slate-400 animate-pulse">Loading preview...</span>
                        </div>
                      ) : certTemplateFrontUrl ? (
                        <img src={certTemplateFrontUrl} alt="front preview" className="w-full h-full object-contain p-2" />
                      ) : (
                        <div className="text-center p-4">
                          <div className="w-10 h-10 bg-[#354C8F]/5 text-[#354C8F] rounded-full flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform duration-200">
                            <UploadCloud size={20} />
                          </div>
                          <p className="text-[11px] font-bold text-slate-600 mb-1">Upload Template</p>
                          <span className="text-[10px] text-slate-400">Image (A4 Landscape)</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Back Template Box */}
                  <div className={`group relative p-4 border-2 border-dashed rounded-2xl transition-all duration-200 ${certTemplateBack ? 'border-[#354C8F]/30 bg-[#354C8F]/5' : 'border-slate-200 bg-slate-50/50 hover:bg-white hover:border-[#354C8F]/30'}`}>
                    <div className="flex justify-between items-center mb-3">
                      <label className="text-[12px] font-bold text-slate-700 flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-300"></span> Back Side
                      </label>
                      {certTemplateBack && (
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-green-700 font-bold bg-green-100 px-2 py-0.5 rounded-full flex items-center gap-1"><CheckCircle2 size={10} /> Saved</span>
                          <button onClick={() => handleClearTemplate('back', certTemplateBack.id)} className="text-slate-400 hover:text-red-500"><X size={14} /></button>
                        </div>
                      )}
                    </div>

                    <div className="relative h-40 w-full bg-white rounded-xl border border-slate-100 flex flex-col items-center justify-center overflow-hidden cursor-pointer shadow-sm group-hover:shadow-md transition-all">
                      <input
                        className="absolute inset-0 opacity-0 z-10 cursor-pointer"
                        type="file"
                        accept="image/png, image/jpeg, image/jpg"
                        onChange={(e) => {
                          if (e.target.files && e.target.files[0]) {
                            handleUploadTemplate('back', e.target.files[0]);
                          }
                        }}
                      />

                      {certTemplateBackLoading ? (
                        <div className="flex items-center justify-center h-full">
                          <span className="text-sm text-slate-400 animate-pulse">Loading preview...</span>
                        </div>
                      ) : certTemplateBackUrl ? (
                        <img src={certTemplateBackUrl} alt="back preview" className="w-full h-full object-contain p-2" />
                      ) : (
                        // FIX: Added proper wrapping div for the "empty state"
                        <div className="text-center p-4">
                          <div className="w-10 h-10 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform duration-200">
                            <UploadCloud size={20} />
                          </div>
                          <p className="text-[11px] font-bold text-slate-600 mb-1">Upload Template</p>
                          <span className="text-[10px] text-slate-400">Back side (Optional)</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Removed Redundant Footer Buttons */}
              </div>
            </div>

          </div>
          {/* AKHIR DARI CONTAINER FLEX ROW */}

          {/* ACTION FOOTER */}
          <div className="sticky bottom-0 bg-white/95 backdrop-blur border-t border-slate-100 rounded-xl p-3 flex items-center justify-between shadow-sm mt-2">
            <div className="text-sm font-semibold text-slate-700">
              Selected: {bulkAllInterns ? activeInterns.filter(i => evaluationStatus[String(i.id)] === true).length : bulkSelectedInterns.length} Intern(s)
              <div className="text-xs text-slate-500 mt-1">
                {(() => {
                  const selectedIds = (bulkAllInterns ? activeInterns.map(i => String(i.id)) : bulkSelectedInterns);
                  const evaluated = selectedIds.filter(id => evaluationStatus[String(id)] === true).length;
                  const missing = selectedIds.length - evaluated;
                  return `${evaluated} ready · ${missing} awaiting final review/mentor`;
                })()}
              </div>
            </div>
            <button
              onClick={() => {
                const selected = bulkAllInterns
                  ? activeInterns.filter(i => evaluationStatus[String(i.id)] === true)
                  : activeInterns.filter(i => bulkSelectedInterns.includes(String(i.id)));
                if (!selected || selected.length === 0) return;

                // compute missing ones (status !== true = not finalized)
                const missing = selected.filter(i => evaluationStatus[String(i.id)] !== true);

                navigate('/admin/generate-sertif', {
                  state: { selectedInterns: selected, missingSelected: missing }
                });
              }}
              disabled={bulkSelectedInterns.length === 0}
              className={`${btnPrimary} ${bulkSelectedInterns.length === 0 ? 'opacity-60 cursor-not-allowed' : ''}`}
              title="Hanya intern dengan evaluation status 'Done' (sudah di-final admin) yang bisa generate"
            >
              <FileText size={16} className="inline -mt-0.5 mr-2" /> Create Sertificate
            </button>
          </div>
        </div>
      </div>

      {/* --- MODALS (Code below remains unchanged) --- */}
      <AnimatePresence>

        {/* Bulk Generate Modal */}
        {showBulkGenerateModal && (
          <ModalOverlay zIndex="z-[60]" onClose={() => setShowBulkGenerateModal(false)} width="max-w-lg">
            <div className="p-4">
              <h3 className="text-xl font-bold text-[#27345A] mb-2">Generate Certificates (Bulk)</h3>
              <p className="text-sm text-slate-500 mb-4">Upload a certificate template (PDF) and a CSV file that contains only certificate numbers (one number per row). The numbers will be assigned in order to the selected interns or all interns.</p>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Template (PDF)</label>
                  <input type="file" accept="application/pdf" onChange={(e) => setBulkTemplateFile(e.target.files && e.target.files[0] ? e.target.files[0] : null)} />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Numbers file (CSV)</label>
                  <input type="file" accept=".csv,text/csv" onChange={(e) => setBulkNumbersFile(e.target.files && e.target.files[0] ? e.target.files[0] : null)} />
                </div>

                <div className="flex items-center gap-3">
                  <input id="bulk-hdr" type="checkbox" checked={bulkHasHeader} onChange={(e) => setBulkHasHeader(e.target.checked)} />
                  <label htmlFor="bulk-hdr" className="text-sm text-slate-600">First row contains headers</label>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button onClick={() => setShowBulkGenerateModal(false)} className={`${btnSecondary} w-full`}>Cancel</button>
                <button onClick={async () => { await handleGenerateBulkSubmit(); }} disabled={bulkLoading || !bulkTemplateFile || !bulkNumbersFile} className={`${btnPrimary} w-full ${bulkLoading || !bulkTemplateFile || !bulkNumbersFile ? 'opacity-60 cursor-not-allowed' : ''}`}>{bulkLoading ? 'Generating...' : 'Generate'}</button>
              </div>
            </div>
          </ModalOverlay>
        )}

        {/* 1. FILTER MODAL */}
        {showFilterModal && (
          <ModalOverlay zIndex="z-50" onClose={() => setShowFilterModal(false)}>
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-[18px] font-bold text-[#27345A]"> Evaluation Filter</h3>
              <button onClick={() => setShowFilterModal(false)}><X className="text-slate-400 hover:text-slate-600" /></button>
            </div>
            <div className="space-y-6">
              {renderDropdown("Division", "division", (divisions && divisions.length) ? divisions : [{ value: "", label: "All Divisions" }], loadingDivisions ? "Loading divisions..." : "All Divisions")}

              {renderDropdown("Mentor", "mentor", mentors, loadingMentors ? "Loading mentors..." : "All Mentors")}

              <div>
                <label className="block text-sm font-bold text-slate-800 mb-3">Status</label>
                <div className="flex gap-2 flex-wrap text-[13px]">
                  {['Done', 'Need Review', 'Waiting Mentor'].map(status => (
                    <button key={status} onClick={() => handleStatusToggle(status)}
                      className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all border ${filter.status && filter.status.includes(status) ? 'bg-[#354C8F] text-white border-[#354C8F] shadow-md' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                      {status}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex gap-3 justify-end mt-8 pt-6 border-t border-slate-100">
              <button onClick={resetFilter} className={btnSecondary}>Reset</button>
              <button onClick={applyFilter} className={btnPrimary}>Apply</button>
            </div>
          </ModalOverlay>
        )}

        {/* 2. EVALUATION FORM MODAL (Large & Complex) */}
        {showFormModal && selectedIntern && (
          <ModalOverlay zIndex="z-50" onClose={() => setShowFormModal(false)} width="max-w-2xl">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-[18px] font-bold text-[#27345A]">Final Performance Evaluation</h3>
              <button onClick={() => setShowFormModal(false)}><X className="text-slate-400 hover:text-slate-600" /></button>
            </div>

            <div className="space-y-6 max-h-[70vh] overflow-y-auto pr-2 custom-scrollbar">
              {/* Header Info */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 mb-4">
                <h4 className="text-sm font-bold text-slate-800 mb-3 border-b border-slate-200 pb-2">Intern Data</h4>
                <div className="grid grid-cols-1 gap-y-2 text-sm pl-2">
                  <div className="grid grid-cols-[140px_10px_1fr]">
                    <span className="text-slate-500 font-medium">Name</span>
                    <span className="text-slate-500">:</span>
                    <span className="font-bold text-[#27345A]">{selectedIntern.name}</span>
                  </div>
                  <div className="grid grid-cols-[140px_10px_1fr]">
                    <span className="text-slate-500 font-medium">Job Position</span>
                    <span className="text-slate-500">:</span>
                    <span className="font-bold text-[#27345A]">{selectedIntern.jobPosition}</span>
                  </div>
                  <div className="grid grid-cols-[140px_10px_1fr]">
                    <span className="text-slate-500 font-medium">Division</span>
                    <span className="text-slate-500">:</span>
                    <span className="font-bold text-[#27345A]">{selectedIntern.division}</span>
                  </div>
                  <div className="grid grid-cols-[140px_10px_1fr]">
                    <span className="text-slate-500 font-medium">Internship Period</span>
                    <span className="text-slate-500">:</span>
                    <span className="font-bold text-[#27345A] bg-slate-100 px-2 py-0.5 rounded text-xs w-fit">{selectedIntern.period || '-'}</span>
                  </div>
                  <div className="grid grid-cols-[140px_10px_1fr]">
                    <span className="text-slate-500 font-medium">Major</span>
                    <span className="text-slate-500">:</span>
                    <span className="font-bold text-[#27345A]">{selectedIntern.major || '-'}</span>
                  </div>
                  <div className="grid grid-cols-[140px_10px_1fr]">
                    <span className="text-slate-500 font-medium">Institution</span>
                    <span className="text-slate-500">:</span>
                    <span className="font-bold text-[#27345A]">{selectedIntern.institution || '-'}</span>
                  </div>
                </div>
              </div>

              {/* A. Quantitative Score */}
              <div>
                <h4 className="text-sm font-bold text-slate-800 mb-3">A. Quantitative Score (0-100)</h4>
                <div className="space-y-3">
                  {evaluationComponentsSnapshot.length > 0 ? (
                    // Use snapshot if available (preserves original nama_komponen from evaluation)
                    evaluationComponentsSnapshot.map((comp) => (
                      <ScoreInput
                        key={comp.key}
                        label={comp.nama_komponen}
                        value={formData.scores[comp.key] || 0}
                        onChange={(e) => handleScoreChange(comp.key, e.target.value)}
                        disabled={true}
                      />
                    ))
                  ) : evaluationComponents.length > 0 ? (
                    // Fallback to master data if no snapshot (new evaluation)
                    evaluationComponents.map((comp, idx) => {
                      const key = `q${idx + 1}`;
                      return (
                        <ScoreInput
                          key={key}
                          label={comp.nama_komponen}
                          value={formData.scores[key] || 0}
                          onChange={(e) => handleScoreChange(key, e.target.value)}
                          disabled={true}
                        />
                      );
                    })
                  ) : (
                    <p className="text-sm text-slate-400">Loading evaluation criteria...</p>
                  )}
                </div>
              </div>

              {/* B. Automatic Calculation */}
              <div className="bg-[#354C8F]/5 p-4 rounded-xl border border-[#354C8F]/10">
                <h4 className="text-sm font-bold text-[#354C8F] mb-3 flex items-center gap-2"><Award size={16} /> B. Automatic Calculation</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-slate-500 uppercase font-bold tracking-wider">Final Score</p>
                    <p className="text-2xl font-bold text-[#27345A]">{finalScore}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 uppercase font-bold tracking-wider">Predicate</p>
                    <p className="text-2xl font-bold text-[#27345A]">{predicate}</p>
                  </div>
                </div>
                <p className="text-[10px] text-slate-400 mt-2">
                  A: 86-100 | B: 71-85 | C: &lt;=70
                </p>
              </div>

              {/* C. Qualitative Feedback */}
              <div>
                <h4 className="text-sm font-bold text-slate-800 mb-2">C. Qualitative Feedback</h4>
                <textarea
                  className="w-full px-4 py-3 rounded-xl border border-slate-300 text-sm focus:outline-none focus:border-[#354C8F] bg-white transition-colors h-24 resize-none"
                  placeholder="Provide feedback and comments for the intern..."
                  value={formData.feedback}
                  onChange={(e) => setFormData({ ...formData, feedback: e.target.value })}
                  disabled={!selectedIntern?.can_edit}
                ></textarea>
              </div>
            </div>

            <div className="flex justify-between items-center mt-6 pt-4">
              {selectedIntern?.status === 'Done' ? (
                <>
                  <p className="text-xs text-green-600 font-bold flex items-center gap-1"><CheckCircle2 size={14} /> Evaluation Completed</p>
                  <button onClick={handleGenerateCertInit} className={btnPrimary}>
                    <FileText size={16} /> Generate Certificate
                  </button>
                </>
              ) : selectedIntern?.can_edit ? (
                <div className="flex gap-3 w-full justify-end">
                  <button onClick={() => setShowFormModal(false)} className={`${btnSecondary} min-w-[140px] h-11`}>Cancel</button>
                  <button onClick={handleFinalInit} disabled={saving} className={`${btnSuccess} min-w-[140px] h-11`}>{saving ? 'Saving...' : 'Final'}</button>
                </div>
              ) : (
                // For statuses that are not editable and not Done (e.g., 'Not Yet', 'Need Review'), show Close only — no Generate
                <div className="flex w-full justify-end">
                  <button onClick={() => setShowFormModal(false)} className={btnSecondary}>Close</button>
                </div>
              )}
            </div>
          </ModalOverlay>
        )}

        {/* Generate Certificate Modal (per intern) */}
        {showGenerateModal && (
          <ModalOverlay zIndex="z-[60]" onClose={() => setShowGenerateModal(false)} width="max-w-sm">
            <div className="p-4">
              <h3 className="text-xl font-bold text-[#27345A] mb-2">Generate Certificate</h3>
              <p className="text-sm text-slate-500 mb-4">Upload a certificate template (PDF) and enter the certificate number for this intern.</p>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Template (PDF)</label>
                  <input type="file" accept="application/pdf" onChange={(e) => setCertTemplateFile(e.target.files && e.target.files[0] ? e.target.files[0] : null)} />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Certificate Number</label>
                  <input type="text" value={certNumber} onChange={(e) => setCertNumber(e.target.value)} className="w-full px-3 py-2 rounded-xl border border-slate-200" />
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button onClick={() => setShowGenerateModal(false)} className={`${btnSecondary} w-full`}>Cancel</button>
                <button onClick={handleGenerateSingle} disabled={certLoading || !certTemplateFile || !certNumber.trim()} className={`${btnPrimary} w-full ${certLoading || !certTemplateFile || !certNumber.trim() ? 'opacity-60 cursor-not-allowed' : ''}`}>{certLoading ? 'Generating...' : 'Generate'}</button>
              </div>
            </div>
          </ModalOverlay>
        )}

        {/* 3. CONFIRM MODAL */}
        {showConfirmModal && (
          <ModalOverlay zIndex="z-[60]" onClose={() => { setShowConfirmModal(false); setConfirmConsent(false); setTemplateToDelete(null); }} width="max-w-sm" compact>
            <div className="text-center p-4">
              <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${confirmType === 'delete_template' ? 'bg-red-50' : 'bg-yellow-50'}`}>
                <AlertCircle className={confirmType === 'delete_template' ? 'text-red-500' : 'text-yellow-500'} size={32} strokeWidth={2} />
              </div>
              <h3 className="text-xl font-bold text-[#27345A] mb-2">
                {confirmType === 'final'
                  ? 'Finalize Review?'
                  : confirmType === 'save'
                    ? 'Finalize Evaluation?'
                    : confirmType === 'delete_template'
                      ? 'Delete Template?'
                      : 'Download Certificate?'}
              </h3>
              <p className="text-slate-500 text-sm mb-4">
                {confirmType === 'final'
                  ? 'This will finalize the review and lock further edits.'
                  : confirmType === 'save'
                    ? 'This action cannot be undone. The intern will be marked as "Done".'
                    : confirmType === 'delete_template'
                      ? `Are you sure you want to delete the ${templateToDelete?.side || ''} template? This action cannot be undone.`
                      : 'Are you sure you want to generate and download the certificate?'}
              </p>

              {(confirmType === 'final' || confirmType === 'save') && (
                <div className="flex items-start gap-3 mb-4 text-left">
                  <input
                    id="confirm-consent"
                    type="checkbox"
                    checked={confirmConsent}
                    onChange={(e) => setConfirmConsent(e.target.checked)}
                    className="h-4 w-4 mt-1 rounded text-[#354C8F] focus:ring-[#354C8F]/30"
                  />
                  <label htmlFor="confirm-consent" className="text-sm text-slate-600">
                    I declare that I sincerely provide this final evaluation voluntarily and I take responsibility for its results.
                  </label>
                </div>
              )}

              <div className="flex gap-3">
                <button onClick={() => { setShowConfirmModal(false); setConfirmConsent(false); setTemplateToDelete(null); }} className={`${btnSecondary} w-full justify-center`}>Cancel</button>
                <button
                  onClick={executeAction}
                  disabled={(confirmType === 'final' || confirmType === 'save') && !confirmConsent}
                  className={`${confirmType === 'delete_template' ? "bg-[#EF4444] hover:bg-[#DC2626] text-white py-3.5 rounded-xl font-bold text-sm shadow-md shadow-red-200 transition-all active:scale-95" : btnSuccess} w-full justify-center ${((confirmType === 'final' || confirmType === 'save') && !confirmConsent) ? 'opacity-60 cursor-not-allowed' : ''}`}
                >
                  {confirmType === 'final' ? 'Yes, Finalize' : confirmType === 'save' ? 'Finalize' : confirmType === 'delete_template' ? 'Delete' : 'Download'}
                </button>
              </div>
            </div>
          </ModalOverlay>
        )}


        {/* 4. STATUS MODAL */}
        {showStatusModal && (
          <ModalOverlay zIndex="z-[60]" onClose={() => setShowStatusModal(false)} width="max-w-sm" compact>
            <div className="text-center p-4">
              <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${statusType === 'success' ? 'bg-green-50' : 'bg-red-50'}`}>
                {statusType === 'success' ? <Check className="text-green-500" size={32} strokeWidth={3} /> : <X className="text-red-500" size={32} strokeWidth={3} />}
              </div>
              <h3 className="text-xl font-bold text-[#27345A] mb-2">{statusMessage.title}</h3>
              <p className="text-slate-500 text-sm mb-6">{statusMessage.desc}</p>
              <button onClick={() => setShowStatusModal(false)} className={`${btnSuccess} w-full justify-center`}>OK</button>
            </div>
          </ModalOverlay>
        )}

      </AnimatePresence>
    </div>
  );

};

// --- SUB-COMPONENTS ---

const ScoreInput = ({ label, value, onChange, disabled }) => (
  <div className="flex items-center justify-between bg-white border border-slate-200 p-3 rounded-xl">
    <span className="text-sm font-medium text-slate-700">{label}</span>
    <input
      type="number"
      min="0"
      max="100"
      value={value}
      onChange={onChange}
      disabled={disabled}
      className="w-20 px-2 py-1.5 rounded-lg border border-slate-300 text-sm text-center font-bold text-[#354C8F] focus:outline-none focus:border-[#354C8F] focus:ring-1 focus:ring-[#354C8F]/20 disabled:bg-slate-50 disabled:text-slate-500 transition-all"
    />
  </div>
);

const UsersIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
);

const ModalOverlay = ({ children, onClose, width = "max-w-md", zIndex = "z-50", paddingClass = "p-6" }) => (
  <div className={`fixed inset-0 ${zIndex} flex items-center justify-center bg-black/40 backdrop-blur-sm p-4`}>
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className={`bg-white w-[95%] md:w-full ${width} rounded-2xl shadow-2xl ${paddingClass} relative`}
    >
      {children}
    </motion.div>
  </div>
);

export default Evaluation;