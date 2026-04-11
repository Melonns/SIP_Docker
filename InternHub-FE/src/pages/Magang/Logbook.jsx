import React, { useState, useRef, useEffect } from "react";
import {
  Search,
  Filter,
  Plus,
  Eye,
  Edit,
  Trash2,
  MessageSquare,
  X,
  UploadCloud,
  FileText,
  Calendar,
  Check,
  AlertCircle,
  Save,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Download
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import imageCompression from "browser-image-compression";
import apiClient from "../../api/axiosConfig";

// --- STYLE CONSTANTS ---
const btnPrimary = "bg-[#354C8F] hover:bg-[#2a3c70] text-white py-2.5 px-5 rounded-xl font-bold text-sm shadow-md shadow-indigo-200 transition-all active:scale-95 flex items-center gap-2";
const btnSecondary = "bg-white border border-slate-300 text-slate-700 py-2.5 px-5 rounded-xl font-bold text-sm hover:bg-slate-50 transition-all active:scale-95 flex items-center gap-2";
const btnSecondaryClass = "bg-white border border-slate-300 text-slate-700 py-3.5 px-6 rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-slate-50 transition-all active:scale-95";
const btnConfirmClass = "bg-[#22C55E] hover:bg-[#16A34A] text-white py-3.5 px-6 rounded-xl font-bold text-sm shadow-md shadow-green-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"; 
const btnDanger = "bg-[#EF4444] hover:bg-[#DC2626] text-white py-2.5 px-5 rounded-xl font-bold text-sm shadow-md shadow-red-200 transition-all active:scale-95";
// Small action buttons (filled like Permission page)
const iconActionBase = "inline-flex items-center justify-center w-9 h-9 rounded-lg transition-colors active:scale-95 shadow-sm text-white disabled:opacity-70 disabled:cursor-not-allowed";
const iconActionView = `${iconActionBase} bg-[#354C8F] hover:bg-[#2a3c70] shadow-indigo-100`;
const iconActionEdit = `${iconActionBase} bg-emerald-600 hover:bg-emerald-700 shadow-emerald-100`;
const iconActionFeedback = `${iconActionBase} bg-amber-500 hover:bg-amber-600 shadow-amber-100`;
const iconActionDelete = `${iconActionBase} bg-red-500 hover:bg-red-600 shadow-red-100`;
// subtle outlined add button for 'Not Yet' state to reduce visual noise
const iconActionAddOutline = "inline-flex items-center justify-center w-9 h-9 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 transition-colors active:scale-95";
// Debug toggle: insert one dummy 'Not Yet' row for visual testing
const DEBUG_INSERT_DUMMY_NOT_YET = false;

const DailyActivitiesPage = () => {
  // --- DATA ---
  const [logbooks, setLogbooks] = useState([]);
  const [attendancePeriod, setAttendancePeriod] = useState(null);
  const [dailySummaryMissingDays, setDailySummaryMissingDays] = useState([]);
  const [loadingList, setLoadingList] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ open: false, percent: 0, indeterminate: true });
  const formRef = useRef(null);
  const uploadMetaRef = useRef(null);
  const isInitialMountRef = useRef(true);

  // --- STATES ---
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [selectedDetail, setSelectedDetail] = useState(null);

  const [selectedLogbook, setSelectedLogbook] = useState(null); // For Edit/View
  const [formMode, setFormMode] = useState("add"); // 'add' or 'edit'
  const [statusModal, setStatusModal] = useState({ open: false, type: "success", title: "", desc: "" });
  // Server-side pagination metadata
  const [serverMeta, setServerMeta] = useState(null); // { current_page, last_page, total, per_page, from, to }

  // Filter state
  const [searchTerm, setSearchTerm] = useState("");
  const [filter, setFilter] = useState({ status: [], startDate: "", endDate: "" });
  const [appliedFilter, setAppliedFilter] = useState({ status: [], startDate: "", endDate: "" });
  const isFilterActive = Boolean(filter.status.length > 0 || filter.startDate || filter.endDate);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const pageSize = serverMeta?.per_page ?? itemsPerPage;
  const totalEntries = serverMeta?.total ?? logbooks.length;
  const totalPages = serverMeta?.last_page ?? Math.max(1, Math.ceil(totalEntries / pageSize));
  const indexOfLastItem = currentPage * pageSize;
  const indexOfFirstItem = indexOfLastItem - pageSize;
  const currentItems = serverMeta ? logbooks : logbooks.slice(indexOfFirstItem, indexOfLastItem);
  const paginationMeta = serverMeta ? {
    current_page: serverMeta.current_page ?? currentPage,
    last_page: serverMeta.last_page ?? totalPages,
    from: serverMeta.from ?? (totalEntries === 0 ? 0 : indexOfFirstItem + 1),
    to: serverMeta.to ?? Math.min(indexOfLastItem, totalEntries),
    total: serverMeta.total ?? totalEntries,
  } : {
    current_page: currentPage,
    last_page: totalPages,
    from: totalEntries === 0 ? 0 : indexOfFirstItem + 1,
    to: Math.min(indexOfLastItem, totalEntries),
    total: totalEntries,
  };

  const formatDateForApi = (value) => {
    if (!value) return value;
    const raw = String(value);
    // If already MM/DD/YYYY, keep as-is
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(raw)) return raw;
    // Convert YYYY-MM-DD -> MM/DD/YYYY
    const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (match) {
      const [, yyyy, mm, dd] = match;
      return `${mm}/${dd}/${yyyy}`;
    }
    return raw;
  };

  const buildFilterParams = (source) => {
    const params = {};
    if (source.startDate) params.start_date = formatDateForApi(source.startDate);
    if (source.endDate) params.end_date = formatDateForApi(source.endDate);
    if (source.status && source.status.length > 0) {
      // Send UI labels directly; backend normalizes
      params.status_verifikasi = source.status.map(s => String(s || '').trim()).join(',');
    }
    return params;
  };

  const getStoredMahasiswaId = () => {
    try {
      const rawUser = localStorage.getItem('user');
      const rawProfile = localStorage.getItem('user_profile');
      const user = rawUser ? JSON.parse(rawUser) : null;
      const profile = rawProfile ? JSON.parse(rawProfile) : null;
      
      // Prioritize id_mahasiswa for interns, then fall back to user_id (as fallback for regular logbooks)
      return profile?.id_mahasiswa || user?.id_mahasiswa || user?.user_id || user?.id || user?.user?.id || profile?.user_id || profile?.id || profile?.user?.id || null;
    } catch (err) {
      return null;
    }
  };

  const mapDailyStatus = (rawStatus) => {
    const s = String(rawStatus || '').toLowerCase();
    if (s === 'approved' || s === 'verified') return 'Approved';
    if (s === 'pending') return 'Pending';
    if (s.includes('revision')) return 'Revision';
    return 'Draft';
  };

  const formatWorkHours = (timeStr) => {
    if (!timeStr || timeStr === '-') return { hours: 0, minutes: 0 };
    const parts = String(timeStr).split(':');
    if (parts.length !== 2) return { hours: 0, minutes: 0 };
    const hours = parseInt(parts[0], 10);
    const minutes = parseInt(parts[1], 10);
    if (isNaN(hours) || isNaN(minutes)) return { hours: 0, minutes: 0 };
    return { hours, minutes };
  };

  const handlePageChange = (page) => {
    if (page < 1) return;
    // Determine the active maximum page from the current pagination meta (server or client)
    const maxPage = (typeof paginationMeta !== 'undefined' && paginationMeta?.last_page) ? paginationMeta.last_page : totalPages;
    if (page > maxPage) return;
    setCurrentPage(page);
    // Server pagination: fetch the specific page
    fetchLogbooks({ page, per_page: itemsPerPage, user_id: getStoredMahasiswaId(), ...buildFilterParams(appliedFilter) });
  };

  // --- HANDLERS ---
  const handleOpenForm = async (mode, data = null) => {
    setFormMode(mode);
    const statusKey = String(data?.rawStatus || data?.status || '').toLowerCase();
    if (mode === 'edit' && (statusKey === 'verified' || statusKey === 'pending')) {
      showStatus('error', 'Cannot Edit', 'Only draft or revision logbooks can be edited.');
      return;
    }

    if (mode === 'edit' && data?.id) {
      try {
        const res = await apiClient.get(`/logbook/${data.id}`);
        const d = res?.data?.data ?? res?.data ?? {};
        const outputs = buildPreviewOutputs(normalizeOutputsFromItem(d));
        const normalized = {
          id: d.id_logbook ?? d.id,
          date: d.tanggal,
          summary: d.deskripsi_kegiatan || d.deskripsi || d.activity_description || d.activity || '',
          output: Array.isArray(d.bukti_kegiatan) ? d.bukti_kegiatan.join(',') : (d.bukti_kegiatan || ''),
          outputs,
          status: normalizeStatus(d.status_verifikasi || d.status),
          rawStatus: d.status_verifikasi || d.status || 'draft',
          feedback: d.feedback || ''
        };
        setSelectedLogbook(normalized);
      } catch (err) {
        console.warn('Could not fetch logbook detail, using list data', err);
        setSelectedLogbook(data);
      }
    } else {
      setSelectedLogbook(data);
    }
    setIsFormOpen(true);
  };

  const handleDeleteClick = (data) => {
    const statusKey = String(data?.rawStatus || data?.status || '').toLowerCase();
    if (!['draft'].includes(statusKey)) {
      showStatus('error', 'Cannot Delete', 'Only draft logbooks can be deleted.');
      return;
    }
    setSelectedLogbook(data);
    setIsDeleteOpen(true);
  };

  const showStatus = (type, title, desc) => {
    setStatusModal({ open: true, type, title, desc });
  };

  const handleDeleteConfirm = async () => {
    if (!selectedLogbook) return;
    try {
      setIsDeleteOpen(false);
      const deleteId = selectedLogbook.id ?? selectedLogbook.id_logbook;
      await apiClient.delete(`/logbook/${deleteId}`);
      await fetchLogbooks({ page: 1, per_page: itemsPerPage, daily: 1, user_id: getStoredMahasiswaId(), ...buildFilterParams(appliedFilter) });
      setCurrentPage(1);
      showStatus("success", "Deleted", "Submission removed successfully.");
    } catch (err) {
      console.error('Error deleting logbook:', err);
      const serverData = err.response?.data;
      const message = serverData?.message || 'Could not delete submission.';
      showStatus('error', 'Error', message);
    } finally {
      setSelectedLogbook(null);
    }
  };

  const handleFormAction = async (action, payload, files = []) => {
    const startedAt = Date.now();
    const uploadAnimRef = { current: null };

    const animateToPercent = (target, speed = 60) => {
      // speed = ms per frame
      if (uploadAnimRef.current) clearInterval(uploadAnimRef.current);
      setUploadProgress((p) => ({ ...p, indeterminate: false }));
      uploadAnimRef.current = setInterval(() => {
        setUploadProgress((p) => {
          if (!p?.open) return p;
          const curr = typeof p.percent === 'number' ? p.percent : 0;
          if (curr >= target) {
            clearInterval(uploadAnimRef.current);
            uploadAnimRef.current = null;
            return { ...p, percent: target, indeterminate: false };
          }
          const diff = target - curr;
          const step = Math.max(1, Math.ceil(diff / 6));
          return { ...p, percent: Math.min(100, curr + step), indeterminate: false };
        });
      }, speed);
    };

    const startFakeProgress = () => {
      // quick bump so user sees activity immediately
      setUploadProgress({ open: true, percent: 3, indeterminate: false });
      animateToPercent(85, 80);
    };

    const stopFakeProgress = () => {
      if (uploadAnimRef.current) {
        clearInterval(uploadAnimRef.current);
        uploadAnimRef.current = null;
      }
    };

    setUploadProgress({ open: true, percent: 0, indeterminate: false });
    startFakeProgress();

    const isDraft = action === 'draft';
    const form = new FormData();
    form.append('tanggal', payload?.date);
    form.append('deskripsi_kegiatan', payload?.summary || '');
    // Duration input removed from UI; keep sending zeros for API compatibility.
    form.append('durasi_jam', '0');
    form.append('durasi_menit', '0');
    form.append('is_draft', isDraft ? '1' : '0');

    const fileList = files || [];
    if (fileList.length > 0) {
      fileList.forEach(f => {
        if (f instanceof File) {
          form.append('bukti_kegiatan[]', f, f.name);
        }
      });
      // Prepare metadata for per-file progress estimation
      try {
        const filesForUpload = fileList.filter(f => f instanceof File);
        if (filesForUpload.length > 0) {
          const sizes = filesForUpload.map(f => ({ name: f.name, size: f.size || 0 }));
          const total = sizes.reduce((s, it) => s + (it.size || 0), 0) || 0;
          uploadMetaRef.current = { sizes, total };
          // notify form modal to mark files as uploading
          if (formRef?.current?.setFilesUploading) formRef.current.setFilesUploading();
        }
      } catch (e) { /* ignore */ }
    } else if (payload?.id && payload?.existingOutputs) {
      const existingList = Array.isArray(payload.existingOutputs)
        ? payload.existingOutputs
        : String(payload.existingOutputs).split(',').map(s => s.trim()).filter(Boolean);
      const existingUrls = buildPreviewOutputs(existingList);

      if (existingUrls.length > 0) {
        try {
          await Promise.all(existingUrls.map(async (url) => {
            const res = await apiClient.get(url, { responseType: "blob" });
            const fileName = String(url).split("?")[0].split("/").pop() || "bukti-kegiatan";
            const file = new File([res.data], fileName, { type: res.data.type || "application/octet-stream" });
            form.append('bukti_kegiatan[]', file, file.name);
          }));
        } catch (err) {
          console.warn("Failed to reattach existing evidence files:", err);
        }
      }
    }

    try {
      if (payload?.id) {
        await apiClient.post(`/logbook/${payload.id}`, form, {
          onUploadProgress: (evt) => {
            const total = typeof evt?.total === 'number' ? evt.total : 0;
            const loaded = typeof evt?.loaded === 'number' ? evt.loaded : 0;
            if (!total) {
              // keep animated fake progress running
              setUploadProgress((p) => ({ ...p, indeterminate: true }));
              return;
            }
            // We have real total: compute percent and animate towards it
            stopFakeProgress();
            const next = Math.max(0, Math.min(100, Math.round((loaded * 100) / total)));
            // Update overall animated progress
            animateToPercent(next, 40);
            // Update per-file estimated progress if we know file sizes
            try {
              const meta = uploadMetaRef.current;
              if (meta && meta.total > 0 && formRef?.current?.updateFileProgress) {
                const totalSize = meta.total;
                const progressUpdates = meta.sizes.map(s => {
                  const size = s.size || 0;
                  const loadedForFile = Math.min(size, Math.round((loaded * size) / totalSize));
                  const pct = size > 0 ? Math.max(0, Math.min(100, Math.round((loadedForFile * 100) / size))) : 0;
                  return { name: s.name, percent: pct };
                });
                formRef.current.updateFileProgress(progressUpdates);
              }
            } catch (e) { /* ignore */ }
          }
        });
        showStatus('success', 'Updated', isDraft ? 'Draft saved.' : 'Logbook submitted for review.');
      } else {
        await apiClient.post('/logbook', form, {
          onUploadProgress: (evt) => {
            const total = typeof evt?.total === 'number' ? evt.total : 0;
            const loaded = typeof evt?.loaded === 'number' ? evt.loaded : 0;
            if (!total) {
              // keep animated fake progress running
              setUploadProgress((p) => ({ ...p, indeterminate: true }));
              return;
            }
            // We have real total: compute percent and animate towards it
            stopFakeProgress();
            const next = Math.max(0, Math.min(100, Math.round((loaded * 100) / total)));
            // Update overall animated progress
            animateToPercent(next, 40);
            // Update per-file estimated progress if we know file sizes
            try {
              const meta = uploadMetaRef.current;
              if (meta && meta.total > 0 && formRef?.current?.updateFileProgress) {
                const totalSize = meta.total;
                const progressUpdates = meta.sizes.map(s => {
                  const size = s.size || 0;
                  const loadedForFile = Math.min(size, Math.round((loaded * size) / totalSize));
                  const pct = size > 0 ? Math.max(0, Math.min(100, Math.round((loadedForFile * 100) / size))) : 0;
                  return { name: s.name, percent: pct };
                });
                formRef.current.updateFileProgress(progressUpdates);
              }
            } catch (e) { /* ignore */ }
          }
        });
        showStatus('success', 'Created', isDraft ? 'Draft saved.' : 'Logbook submitted for review.');
      }
      stopFakeProgress();
      setUploadProgress({ open: true, percent: 100, indeterminate: false });
      // Keep modal visible briefly so users can actually see the progress.
      const elapsed = Date.now() - startedAt;
      const minVisible = 1000;
      const waitMs = Math.max(250, minVisible - elapsed);
      setTimeout(() => setUploadProgress({ open: false, percent: 0, indeterminate: true }), waitMs);

      setIsFormOpen(false);
      setCurrentPage(1);
      await fetchLogbooks({ page: 1, per_page: itemsPerPage, daily: 1, user_id: getStoredMahasiswaId(), ...buildFilterParams(appliedFilter) });
    } catch (err) {
      console.error('Error saving logbook:', err);
      stopFakeProgress();
      setUploadProgress({ open: false, percent: 0, indeterminate: true });
      const serverData = err.response?.data;
      const validationErrors = serverData?.errors;
      if (validationErrors?.tanggal) {
        showStatus('error', 'Invalid Date', validationErrors.tanggal.join(' '));
      } else if (validationErrors?.bukti_kegiatan) {
        showStatus('error', 'File Error', validationErrors.bukti_kegiatan.join(' '));
      } else if (serverData?.message) {
        showStatus('error', 'Error', serverData.message);
      } else {
        showStatus('error', 'Error', 'Failed to save logbook.');
      }
    }
  };

  const handleFeedbackClick = (data) => {
    setSelectedLogbook(data);
    setIsFeedbackOpen(true);
  };

  const resetFilter = async () => {
    const cleared = { status: [], startDate: "", endDate: "" };
    setFilter(cleared);
    setAppliedFilter(cleared);
    setCurrentPage(1);
    setIsFilterOpen(false);
    await fetchLogbooks({ page: 1, per_page: itemsPerPage, daily: 1, user_id: getStoredMahasiswaId(), ...buildFilterParams(cleared) });
  };

  const handleViewFile = (logbookId, fileUrl, displayName) => {
    // Extract filename: "storage/logbooks/123_abc.pdf" -> "123_abc.pdf"
    const fileName = String(fileUrl).split('/').pop();
    // Construct secure API endpoint
    const secureEndpoint = `/logbook/${logbookId}/file/${fileName}`;
    // Open FileViewer with secure URL and display name
    window.open(`/magang/file-viewer?url=${encodeURIComponent(secureEndpoint)}&name=${encodeURIComponent(displayName || fileName)}`, '_blank');
  };

  const handleDownloadFile = async (logbookId, fileUrl, displayName) => {
    try {
      const fileName = String(fileUrl).split('/').pop();
      // Use the dedicated download endpoint
      const res = await apiClient.get(`/logbook/${logbookId}/file/${fileName}?download=1`, { responseType: "blob" });
      const blobUrl = URL.createObjectURL(res.data);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = displayName || fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.error("Error downloading file:", err);
      showStatus("error", "Error", "Failed to download file.");
    }
  };

  const normalizeStatus = (rawStatus) => {
    const s = String(rawStatus || '').toLowerCase();
    if (s === 'approved' || s === 'verified') return 'Approved';
    if (s === 'pending') return 'Pending';
    if (s.includes('revision')) return 'Revision';
    if (s === 'not_yet' || s === 'not yet' || (s.includes('not') && s.includes('yet'))) return 'Not Yet';
    return 'Draft';
  };

  const findTimestampByKeywords = (obj, keywords = []) => {
    if (!obj || !keywords.length) return null;
    const keys = Object.keys(obj);
    for (const key of keys) {
      const lower = key.toLowerCase();
      if (keywords.every(k => lower.includes(k))) return obj[key];
    }
    return null;
  };

  const formatTimestamp = (value) => {
    if (!value) return '';
    try {
      const d = new Date(value);
      if (Number.isNaN(d.getTime())) return String(value);
      return d.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch (e) {
      return String(value);
    }
  };

  const normalizeOutputsFromItem = (item) => {
    if (!item) return [];
    if (Array.isArray(item.bukti_kegiatan)) return item.bukti_kegiatan;
    if (item.bukti_kegiatan && typeof item.bukti_kegiatan === 'string') return [item.bukti_kegiatan];
    if (item.output && typeof item.output === 'string') {
      return item.output.split(',').map(s => s.trim()).filter(Boolean);
    }
    return [];
  };

  const mapLogbookItem = (item) => {
    const rawStatus = item.status_verifikasi ?? item.status ?? 'draft';
    const status = normalizeStatus(rawStatus);
    const outputs = buildPreviewOutputs(normalizeOutputsFromItem(item));
    const approvedAt = item.approved_at || item.verified_at || item.approved_at_mentor || item.verified_at_mentor || item.approvedAt || item.verifiedAt || findTimestampByKeywords(item, ['approve', 'at']) || findTimestampByKeywords(item, ['verify', 'at']) || null;
    const revisionRequestedAt = item.rejected_at || item.rejected_at_mentor || item.rejectedAt || findTimestampByKeywords(item, ['revision', 'at']) || ((String(rawStatus || '').toLowerCase().includes('revision')) ? (item.status_updated_at || item.statusUpdatedAt || item.updated_at || item.updatedAt || null) : null);
    const submittedAt = item.submitted_at || item.submittedAt || item.created_at || item.createdAt || findTimestampByKeywords(item, ['submit', 'at']) || item.updated_at || null;
    const resubmittedAt = item.resubmitted_at || item.resubmittedAt || findTimestampByKeywords(item, ['resubmit', 'at']) || null;

    return {
      id: item.id_logbooks ?? item.id_logbook ?? item.logbook_id ?? item.id,
      date: item.tanggal,
      summary: item.deskripsi_kegiatan || item.deskripsi || item.activity_description || item.activity || '',
      output: Array.isArray(item.bukti_kegiatan) ? item.bukti_kegiatan.join(',') : (item.bukti_kegiatan || item.output || ''),
      outputs,
      status,
      rawStatus,
      feedback: item.feedback || '',
      approvedAt,
      revisionRequestedAt,
      submittedAt,
      resubmittedAt
    };
  };

  const buildPreviewOutputs = (outputs) => {
    const base = apiClient.defaults.baseURL || '';
    const baseNoApi = base.replace(/\/api\/?$/i, '');
    return (outputs || []).map(f => {
      if (!f) return f;
      if (String(f).startsWith('http') || String(f).startsWith('data:')) return f;
      const cleaned = String(f)
        .replace(/^\/api\//i, '/')
        .replace(/^api\//i, '');
      const root = baseNoApi.replace(/\/$/, '');
      return `${root}/${cleaned.replace(/^\//, '')}`;
    });
  };

  const fetchLogbooks = async (params = {}) => {
    setLoadingList(true);
    try {
      const mahasiswaId = params.mahasiswa_id || params.id_mahasiswa || params.user_id || getStoredMahasiswaId();
      if (!mahasiswaId) {
        showStatus('error', 'Missing User', 'User ID not found. Please re-login and try again.');
        setServerMeta(null);
        setLogbooks([]);
        return [];
      }

      const statusFilter = params.status_verifikasi ?? buildFilterParams(appliedFilter).status_verifikasi ?? '';
      const containsNotYet = String(statusFilter).toLowerCase().includes('not yet');
      const dailyFlag = typeof params.daily !== 'undefined' ? params.daily : (containsNotYet ? 1 : undefined);

      // Use the dedicated intern daily summary endpoint: GET /api/logbook/summary/{id}
      let res;
      const { daily, ...filteredParams } = params; // Remove 'daily' flag from params passed to API
      const commonParams = {
        page: params.page ?? currentPage,
        per_page: params.per_page ?? itemsPerPage,
        start_date: params.start_date ?? formatDateForApi(appliedFilter.startDate) ?? undefined,
        end_date: params.end_date ?? formatDateForApi(appliedFilter.endDate) ?? undefined,
        id_mahasiswa: mahasiswaId, // Add explicit id_mahasiswa param
        ...filteredParams
      };

      try {
        res = await apiClient.get(`/logbook/summary/${mahasiswaId}`, { params: commonParams });
      } catch (err) {
        console.error('Failed to fetch logbook summary:', err);
        // Minimal fallback if the primary endpoint fails
        res = await apiClient.get('/logbook', { params: { id_mahasiswa: mahasiswaId, include_daily_summary: 1, ...commonParams } });
      }

      const raw = res?.data ?? {};
      const payload = raw?.data ?? raw;
      // capture top-level missing days when include_daily_summary=1 is used
      const missing = payload?.daily_summary_missing_days ?? raw?.daily_summary_missing_days ?? payload?.data?.daily_summary_missing_days ?? [];
      setDailySummaryMissingDays(Array.isArray(missing) ? missing : []);
      const period = payload?.attendance_period ?? raw?.attendance_period ?? null;
      setAttendancePeriod(period);

      const isDailyResponse = Boolean(payload?.daily_summary) || Boolean(dailyFlag);
      let summary = payload?.daily_summary ?? payload?.data ?? payload?.items ?? [];
      if (summary && Array.isArray(summary?.data)) summary = summary.data;
      if (!Array.isArray(summary) && Array.isArray(payload?.data?.data)) summary = payload.data.data;

      const metaSource = payload?.meta ?? payload?.pagination ?? (payload?.current_page ? payload : null);
      if (metaSource) {
        const meta = {
          current_page: metaSource.current_page ?? metaSource.currentPage ?? 1,
          last_page: metaSource.last_page ?? metaSource.lastPage ?? metaSource.total_pages ?? 1,
          per_page: metaSource.per_page ?? metaSource.perPage ?? itemsPerPage,
          from: metaSource.from ?? undefined,
          to: metaSource.to ?? undefined,
          total: metaSource.total ?? metaSource.total_items ?? (Array.isArray(summary) ? summary.length : 0)
        };
        setServerMeta(meta);
      } else {
        setServerMeta(null);
      }

      const mapped = (summary || []).map((row, idx) => {
        if (!isDailyResponse) {
          const mappedLog = mapLogbookItem(row || {});
          return {
            ...mappedLog,
            _rowType: 'logbook',
            _hasLogbook: true,
            _logbook: row,
            _flags: { isNotSubmit: false, isNotYet: false }
          };
        }

        const logbook = row?.logbooks || row?.logbook || null;
        const attendance = row?.attendance || row?.daily_summary?.attendance || null;
        const date = row?.tanggal || row?.date || '';
        const isNotSubmit = Boolean(row?.is_not_submit || (row?.daily_summary && row.daily_summary.is_not_submit));
        const isNotYet = Boolean(row?.is_not_yet || (row?.daily_summary && row.daily_summary.is_not_yet));

        // Check logbook-level status first, then fall back to row-level status
        const rawStatusValue = logbook?.status_verifikasi ?? logbook?.status
          ?? row?.status_verifikasi ?? row?.status ?? '';

        const statusLabel = isNotSubmit
          ? 'No logbook submitted'
          : (isNotYet ? 'Not Yet' : mapDailyStatus(rawStatusValue));

        // Capture potential reasoning for missing logbook
        const attendanceReason = row?.status || attendance?.status || attendance?.attendance_status || (row?.attendance_reason || row?.daily_summary?.attendance_reason) || '';
        const descKegiatan = (logbook?.deskripsi_kegiatan || logbook?.deskripsi || logbook?.activity_description || logbook?.activity) || (row?.deskripsi_kegiatan || row?.deskripsi || row?.activity_description || row?.activity);
        
        const finalActivitySummary = descKegiatan 
          ? descKegiatan 
          : (isNotSubmit && attendanceReason ? `Submission disabled: ${attendanceReason}` : '-');

        return {
          id: logbook?.logbooks_id ?? logbook?.logbook_id ?? logbook?.id_logbooks ?? logbook?.id_logbook ?? logbook?.id ?? row?.logbooks?.logbooks_id ?? row?.id_logbooks ?? row?.id_logbook ?? row?.id ?? `daily-${date}-${idx}`,
          date,
          jam_masuk: attendance?.jam_masuk || '-',
          jam_pulang: attendance?.jam_pulang || '-',
          durasi_kerja: attendance?.durasi_kerja || attendance?.work_duration?.formatted || '-',
          summary: finalActivitySummary,
          output: Array.isArray(logbook?.bukti_kegiatan) ? logbook.bukti_kegiatan.join(',') : (logbook?.bukti_kegiatan || row?.bukti_kegiatan || logbook?.output || row?.output || ''),
          outputs: buildPreviewOutputs(normalizeOutputsFromItem(logbook || row)),
          status: statusLabel,
          rawStatus: logbook?.status_verifikasi || logbook?.status || row?.status_verifikasi || row?.status || '',
          feedback: logbook?.feedback || row?.feedback || '',
          dailySummary: row?.daily_summary ?? null,
          _rowType: logbook ? 'logbook' : (row?.logbooks?.logbooks_id || row?.id_logbooks || row?.id_logbook || row?.id ? 'logbook' : 'missing'),
          _hasLogbook: Boolean(logbook || row?.logbooks?.logbooks_id || row?.id_logbooks || row?.id_logbook || row?.id),
          _logbook: logbook || row,
          _flags: { isNotSubmit, isNotYet }
        };
      });

      // Optionally inject a single dummy 'Not Yet' row for preview/testing
      if (DEBUG_INSERT_DUMMY_NOT_YET) {
        const today = new Date().toISOString().split('T')[0];
        const dummy = {
          id: 'debug-notyet-1',
          date: today,
          summary: 'No submission yet (dummy)',
          output: '',
          outputs: [],
          status: 'Not Yet',
          rawStatus: 'not_yet',
          feedback: '',
          _rowType: 'missing',
          _hasLogbook: false,
          _logbook: null,
          _flags: { isNotSubmit: false, isNotYet: true }
        };
        mapped.unshift(dummy);
      }

      setLogbooks(mapped);
      return mapped;
    } catch (err) {
      console.error('Error fetching logbooks:', err);
      showStatus('error', 'Error', 'Failed to load logbooks.');
    } finally {
      setLoadingList(false);
    }
  };

  // Initial fetch on mount only - MUST be declared first to execute first
  useEffect(() => {
    if (!isInitialMountRef.current) return;
    isInitialMountRef.current = false;
    
    fetchLogbooks({ page: 1, per_page: itemsPerPage, user_id: getStoredMahasiswaId(), ...buildFilterParams(appliedFilter) });
  }, []);

  // Debounced fetch on search, filter, or items per page changes
  useEffect(() => {
    // Skip on initial mount, only trigger on dependency changes
    if (isInitialMountRef.current) return;

    // Debounced fetch for search term changes
    const timeoutId = setTimeout(() => {
      setCurrentPage(1);
      fetchLogbooks({ page: 1, per_page: itemsPerPage, user_id: getStoredMahasiswaId(), ...buildFilterParams(appliedFilter) });
    }, searchTerm.trim() ? 400 : 0); // Debounce only if searching

    return () => clearTimeout(timeoutId);
  }, [searchTerm, appliedFilter, itemsPerPage]);

  const handleOpenDetail = async (item) => {
    const source = item?._logbook || item;
    const logbookId = source?.logbook_id || source?.id_logbook || source?.id || item?.id;
    if (!logbookId) {
      showStatus('error', 'No Logbook', 'No logbook submitted for this date.');
      return;
    }
    const initial = mapLogbookItem(source);
    if (item?.date) initial.date = item.date;
    setSelectedDetail(initial);
    setIsDetailOpen(true);
    try {
      const res = await apiClient.get(`/logbook/${logbookId}`);
      const d = res?.data?.data ?? res?.data ?? null;
      if (d) {
        const mapped = mapLogbookItem(d);
        if (item?.date) mapped.date = item.date;
        setSelectedDetail(mapped);
      }
    } catch (err) {
      console.warn('Could not fetch logbook detail timestamps', err);
    }
  };

  // --- COMPONENT: STATUS BADGE (unified size) ---
  const StatusBadge = ({ status }) => {
    const s = String(status || '').toLowerCase();
    let styles = "bg-slate-100 text-slate-500 border-slate-200";
    let label = status;
    
    if (s.includes('approved') || s.includes('verified')) {
      styles = "bg-green-50 text-green-600 border-green-200";
      label = "Approved";
    } else if (s.includes('pending')) {
      styles = "bg-yellow-100 text-yellow-600 border-yellow-200";
      label = "Pending";
    } else if (s.includes('revision')) {
      styles = "bg-red-50 text-red-600 border-red-200";
      label = "Revision";
    } else if (s.includes('not yet')) {
      styles = "bg-slate-100 text-slate-600 border-slate-200";
      label = "Not Yet";
    } else if (s.includes('no logbook') || s.includes('not submitted') || s.includes('absent')) {
      styles = "bg-red-50 text-red-600 border-red-200";
      label = "No Logbook";
    } else if (s.includes('rejected')) {
      styles = "bg-red-50 text-red-500 border-red-200";
      label = "Rejected";
    } else if (s.includes('draft')) {
      styles = "bg-indigo-50 text-indigo-600 border-indigo-200";
      label = "Draft";
    }
      
    return (
      <span className={`inline-flex items-center justify-center min-w-[140px] h-[34px] px-3 rounded-lg text-[13px] font-bold border whitespace-nowrap shadow-sm ${styles}`}>
        {label}
      </span>
    );
  };

  return (
    <div className="bg-slate-50 -ml-2 -mr-6 min-h-screen p-6 font-sans text-slate-800 -mt-1">

      {/* HEADER */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-[#27345A] mb-2 -mt-2">Your Daily Activities (Logbook)</h1>
        <p className="text-slate-500 text-sm">Monitor the status of your activities and submit your progress here.</p>
        {attendancePeriod?.start && attendancePeriod?.end && (
          <p className="text-slate-500 text-sm mt-1">
            Period: <span className="font-semibold text-slate-700">{attendancePeriod.start}</span> to <span className="font-semibold text-slate-700">{attendancePeriod.end}</span>
          </p>
        )}
        {dailySummaryMissingDays && dailySummaryMissingDays.length > 0 && (
          <div className="mt-3 flex items-center gap-3">
            <div className="text-xs text-rose-600 font-semibold">Missing logbook days: {dailySummaryMissingDays.length}</div>
            <button onClick={() => { /* TODO: implement remind action or navigation */ }} className="text-xs bg-white border border-rose-100 text-rose-600 px-2 py-1 rounded-lg shadow-sm">Remind</button>
          </div>
        )}
      </div>

      {/* ACTION BAR */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-6">
        <div className="flex gap-3 w-full md:w-auto items-center">
          <div className="relative flex-1 md:w-80">
            <input
              type="text"
              placeholder="Search by Activity Preview.."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-12 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#354C8F]/20 text-sm shadow-sm transition-all"
            />
            <Search className="absolute left-3 top-3.5 text-slate-400" size={18} />

            {/* Mobile-only filter icon (inside search) */}
            <button aria-label="Open filter" onClick={() => setIsFilterOpen(true)} className="absolute right-2 top-1/2 -translate-y-1/2 md:hidden inline-flex items-center justify-center w-10 h-10 rounded-lg bg-[#354C8F] text-white hover:bg-[#2a3c70]">
              <Filter size={16} />
              {isFilterActive && <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-400 rounded-full animate-pulse"></span>}
            </button>

          </div>

          {/* Desktop/tablet full button */}
          <button onClick={() => setIsFilterOpen(true)} className={`${btnPrimaryClass} hidden md:inline-flex !bg-[#354C8F] !text-white !shadow-none !px-4`}>
            <Filter size={16} /> Filter
            {isFilterActive && <div className="w-2 h-2 bg-red-400 rounded-full animate-pulse ml-1"></div>}
          </button>
        </div>
        <button onClick={() => handleOpenForm("add")} className={`${btnPrimaryClass} w-full md:w-auto`}>
          <Plus size={18} /> Add New
        </button>
      </div>

      {/* TABLE */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left table-fixed">
            <thead>
              <tr className="border-b border-slate-100 text-[13px] font-bold text-slate-900 bg-slate-50/50">
                <th className="px-3 py-4 w-14 text-center">No</th>
                <th className="px-3 py-4 w-[110px] whitespace-nowrap text-center">Date</th>
                <th className="pl-3 pr-3 py-4 text-center">Activity Preview</th>
                <th className="px-3 py-4 w-24 text-center">Clock In</th>
                <th className="px-3 py-4 w-24 text-center">Clock Out</th>
                <th className="px-3 py-4 w-24 text-center">Work Hours</th>
                <th className="px-3 py-4 w-36 text-center">Status</th>
                <th className="px-3 py-4 w-40 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="text-[13px] text-slate-600">
              {loadingList ? (
                <tr>
                  <td colSpan="8" className="p-12 text-center">
                    <div className="flex flex-col items-center justify-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#354C8F] mb-2"></div>
                      <span className="text-slate-400">Loading activities...</span>
                    </div>
                  </td>
                </tr>
              ) : currentItems.length === 0 ? (
                <tr>
                  <td colSpan="8" className="p-8 text-center text-slate-400">No daily activities found.</td>
                </tr>
              ) : (
                currentItems.map((item, index) => (
                  <tr key={item.id} className={`border-b border-slate-50 transition-colors ${item.status === 'No logbook submitted' ? 'bg-red-50 hover:bg-red-50' : 'hover:bg-slate-50'}`}>
                    <td className="px-3 py-4 text-center font-medium">{paginationMeta.from + index}</td>
                    <td className="px-3 py-4 whitespace-nowrap text-center">
                      <div className="font-medium">{item.date}</div>
                    </td>
                    <td className="pl-3 pr-3 py-4 text-slate-700" title={item.summary}>
                      <div className="whitespace-normal break-words text-sm leading-relaxed" style={{ textAlign: 'justify' }}>{item.summary}</div>
                    </td>
                    <td className="px-3 py-4 text-center text-slate-700 font-medium">{item.jam_masuk || '-'}</td>
                    <td className="px-3 py-4 text-center text-slate-700 font-medium">{item.jam_pulang || '-'}</td>
                    <td className="px-3 py-4 text-center">
                      {item.durasi_kerja && item.durasi_kerja !== '-' ? (
                        (() => {
                          const { hours, minutes } = formatWorkHours(item.durasi_kerja);
                          return (
                            <div className="text-[12px] font-medium leading-tight">
                              <div>{hours} hours</div>
                              <div>{minutes} minutes</div>
                            </div>
                          );
                        })()
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>
                    <td className="px-3 py-4 text-center">
                      {(item.status === 'No logbook submitted' || item.status === "Can't submit logbook") ? (
                        <div className="flex justify-center items-center min-h-[34px]">
                          <div className="text-[11px] font-bold text-red-600 max-w-[100px] leading-tight text-center">
                            {item.status === 'No logbook submitted' ? "Can't submit logbook" : item.status}
                          </div>
                        </div>
                      ) : (
                        <StatusBadge status={item.status} />
                      )}
                    </td>
                    <td className="px-3 py-4">
                      <div className="flex justify-center gap-2">
                        {/* View: only if logbook exists */}
                        {item._hasLogbook && (
                          <button
                            onClick={() => handleOpenDetail(item)}
                            className={iconActionView}
                            title="View"
                            aria-label="View"
                          >
                            <Eye size={18} />
                          </button>
                        )}

                        {item._flags?.isNotYet && !item._hasLogbook && (
                          <button
                            onClick={() => handleOpenForm("add", { date: item.date, summary: '' })}
                            className={iconActionAddOutline}
                            title="Add Logbook"
                            aria-label="Add Logbook"
                          >
                            <Plus size={16} />
                          </button>
                        )}

                        {/* Revision: only Edit + View */}
                        {(item.status === 'Revision' || item.status === 'Draft') && (
                          <button
                            onClick={() => handleOpenForm("edit", item)}
                            className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-green-500 hover:bg-green-600 transition-colors active:scale-95 shadow-sm text-white"
                            title="Edit"
                            aria-label="Edit"
                          >
                            <Edit size={16} />
                          </button>
                        )}

                        {/* Draft: allow Delete */}
                        {item.status === 'Draft' && (
                          <button
                            onClick={() => handleDeleteClick(item)}
                            className={iconActionDelete}
                            title="Delete"
                            aria-label="Delete"
                          >
                            <Trash2 size={18} />
                          </button>
                        )}

                        {/* Pending/Approved(Verified): Feedback + View */}
                        {(item.status === 'Approved' || item.status === 'Pending') && (
                          <button
                            onClick={() => handleFeedbackClick(item)}
                            className={`${iconActionFeedback} relative`}
                            title="Feedback"
                            aria-label="Feedback"
                          >
                            <MessageSquare size={18} />
                            {item.feedback && item.feedback.trim() && (
                              <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
                            )}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )))}
            </tbody>
          </table>
        </div>
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
                <button disabled={currentPage === 1} onClick={() => handlePageChange(currentPage - 1)} className="p-2 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50 border border-slate-200 disabled:cursor-not-allowed"><ChevronLeft size={18} /></button>
                {(() => {
                  const pageCurrent = currentPage;
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
                    return (
                      <button
                        key={p}
                        onClick={() => handlePageChange(p)}
                        aria-current={pageCurrent === p ? 'page' : undefined}
                        className={`w-8 h-8 flex items-center justify-center rounded-lg text-xs font-bold transition-colors ${pageCurrent === p ? "bg-slate-100 text-[#27345A]" : "text-slate-500 hover:bg-slate-100 border border-transparent"}`}
                      >
                        {p}
                      </button>
                    );
                  });
                })()}
                <button disabled={currentPage === (paginationMeta?.last_page ?? totalPages)} onClick={() => handlePageChange(currentPage + 1)} className="p-2 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50 border border-slate-200 disabled:cursor-not-allowed"><ChevronRight size={18} /></button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* --- MODALS SECTION --- */}

      {/* 1. FILTER MODAL */}
      <AnimatePresence>
        {isFilterOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 relative">
              <div className="flex justify-between items-center mb-6"><h3 className="text-[18px] font-bold text-[#27345A]">Logbook Filter</h3><button onClick={() => setIsFilterOpen(false)}><X className="text-slate-400 hover:text-slate-600" size={24} /></button></div>
              <div className="space-y-5">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Status</label>
                  <div className="flex flex-wrap gap-2">
                    {['Approved', 'Revision', 'Pending', 'Not Yet', 'Draft'].map(s => (
                      <button
                        key={s}
                        onClick={() => setFilter(prev => ({
                          ...prev,
                          status: prev.status.includes(s)
                            ? prev.status.filter(item => item !== s)
                            : [...prev.status, s]
                        }))}
                        className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all border ${filter.status.includes(s)
                            ? 'bg-[#354C8F] text-white border-[#354C8F] shadow-md'
                            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                          }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Start Date</label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-3 text-slate-400" size={18} />
                    <input
                      type="date"
                      value={filter.startDate}
                      onChange={(e) => setFilter(prev => ({ ...prev, startDate: e.target.value }))}
                      onClick={(e) => e.target.showPicker && e.target.showPicker()}
                      className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#354C8F]/20 cursor-pointer [&::-webkit-calendar-picker-indicator]:hidden"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">End Date</label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-3 text-slate-400" size={18} />
                    <input
                      type="date"
                      value={filter.endDate}
                      onChange={(e) => setFilter(prev => ({ ...prev, endDate: e.target.value }))}
                      onClick={(e) => e.target.showPicker && e.target.showPicker()}
                      className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#354C8F]/20 cursor-pointer [&::-webkit-calendar-picker-indicator]:hidden"
                    />
                  </div>
                </div>
              </div>
              <div className="mt-8 pt-6 border-t border-slate-100 flex gap-3 justify-end">
                <button onClick={resetFilter} className={btnSecondaryClass}>Reset</button>
                <button onClick={() => {
                  setIsFilterOpen(false);
                  setAppliedFilter(filter);
                  const params = buildFilterParams(filter);
                  fetchLogbooks({ page: 1, per_page: itemsPerPage, user_id: getStoredUserId(), ...params });
                }} className={btnPrimaryClass}>Apply</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 2. FEEDBACK MODAL */}
      <AnimatePresence>
        {isFeedbackOpen && selectedLogbook && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 relative">
              <div className="flex justify-between items-center mb-6"><h3 className="text-xl font-bold text-[#27345A]">Your Feedback - {selectedLogbook.date}</h3><button onClick={() => setIsFeedbackOpen(false)}><X className="text-slate-400 hover:text-slate-600" size={24} /></button></div>
              <div className="space-y-4">
                <div><label className="block text-sm font-bold text-slate-700 mb-2">Activity Summary</label><div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-600">{selectedLogbook.summary}</div></div>
                <div><label className="block text-sm font-bold text-slate-700 mb-2">Feedback</label><div className="p-4 bg-yellow-50 border border-yellow-100 rounded-xl text-sm text-slate-700 min-h-[80px]">{selectedLogbook.feedback || "No feedback provided yet."}</div></div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 4. DETAIL VIEW MODAL */}
      <AnimatePresence>
        {isDetailOpen && selectedDetail && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="bg-white w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
              <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-white">
                <h3 className="text-xl font-bold text-[#27345A]">Logbook Detail</h3>
                <button onClick={() => setIsDetailOpen(false)} className="text-slate-400 hover:text-slate-600"><X size={24} /></button>
              </div>
              <div className="p-8 overflow-y-auto custom-scrollbar flex-1">
                <div className="space-y-6">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1">Date</p>
                      <p className="text-lg font-bold text-slate-800">{selectedDetail.date}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1">Status</p>
                      <StatusBadge status={selectedDetail.status} />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-4 p-4 bg-slate-50 rounded-xl border border-slate-100">
                    <div>
                      <p className="text-xs text-slate-400 font-bold uppercase mb-1">Activity Description</p>
                      <p className="text-sm text-slate-600 leading-relaxed bg-white p-3 rounded-lg border border-slate-100">{selectedDetail.summary}</p>
                    </div>
                    {selectedDetail.feedback && (
                      <div>
                        <p className="text-xs text-slate-400 font-bold uppercase mb-1">Feedback</p>
                        <p className="text-sm text-slate-600 leading-relaxed bg-yellow-50 p-3 rounded-lg border border-yellow-100">{selectedDetail.feedback}</p>
                      </div>
                    )}
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 font-bold uppercase mb-3">Output/Evidence Files</p>
                    {selectedDetail.outputs && selectedDetail.outputs.length > 0 ? (
                      <div className="space-y-3">
                        {selectedDetail.outputs.map((fileUrl, idx) => {
                          const rawName = String(fileUrl).split('/').pop();
                          // Remove timestamp (digits) or hash (hex) prefix if present
                          // e.g. 1738202020_file.pdf or 697accd48e92a_file.pdf
                          const cleanName = rawName.replace(/^([\da-fA-F]+_){1,2}/, '');
                          const ext = cleanName.split('.').pop().toLowerCase();
                          const extLabel = ext.toUpperCase();
                          const isPdf = ext === 'pdf';
                          const isImage = ['png', 'jpg', 'jpeg'].includes(ext);
                          const badgeLabel = isPdf ? 'PDF' : (isImage ? 'IMG' : extLabel || 'FILE');
                          const badgeClasses = isPdf
                            ? 'bg-red-500 text-white'
                            : isImage
                              ? 'bg-blue-500 text-white'
                              : 'bg-slate-300 text-slate-700';

                          return (
                            <div key={idx} className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-xl group hover:border-[#354C8F] hover:shadow-md transition-all">
                              <div
                                className="flex items-center gap-4 overflow-hidden cursor-pointer flex-1"
                                onClick={() => handleViewFile(selectedDetail.id, fileUrl, cleanName)}
                              >
                                <div className="w-12 h-12 bg-white rounded-lg flex items-center justify-center shrink-0 border border-slate-200 shadow-sm">
                                  <div className={`text-[10px] font-extrabold px-2 py-1 rounded ${badgeClasses}`}>
                                    {badgeLabel}
                                  </div>
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className="text-sm font-bold text-slate-700 truncate group-hover:text-[#354C8F] transition-colors mb-0.5" title={cleanName}>
                                    {cleanName}
                                  </p>
                                  <p className="text-[11px] text-slate-400 flex items-center gap-1">
                                    Click to preview
                                  </p>
                                </div>
                              </div>
                              <button
                                onClick={() => handleDownloadFile(selectedDetail.id, fileUrl, cleanName)}
                                className="p-2.5 text-slate-400 hover:text-[#354C8F] hover:bg-slate-50 rounded-lg transition-all"
                                title="Download"
                              >
                                <Download size={20} />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="text-center p-6 bg-slate-50 rounded-xl border border-dashed border-slate-300 text-slate-400 text-sm">No output files.</div>
                    )}
                  </div>
                  <div className="grid grid-cols-1 gap-3 p-4 bg-white rounded-xl border border-slate-100">
                    <p className="text-xs text-slate-400 font-bold uppercase">Evidence Timeline</p>
                    {(() => {
                      const entries = [
                        { label: "Submitted", value: selectedDetail.submittedAt },
                        { label: "Revision Requested (Mentor)", value: selectedDetail.revisionRequestedAt },
                        { label: "Resubmitted", value: selectedDetail.resubmittedAt },
                        { label: "Approved (Mentor)", value: selectedDetail.approvedAt }
                      ].filter(entry => entry.value);
                      if (!entries.length) {
                        return <div className="text-slate-400 text-sm">No timeline available.</div>;
                      }
                      return entries.map((entry) => (
                        <div key={entry.label} className="flex items-center justify-between text-sm">
                          <span className="text-slate-500">{entry.label}</span>
                          <span className="text-slate-700 font-medium">{formatTimestamp(entry.value) || '-'}</span>
                        </div>
                      ));
                    })()}
                  </div>
                </div>
              </div>
              <div className="p-4 border-t border-slate-100 bg-white flex justify-end gap-3 sticky bottom-0 z-10">
                <button onClick={() => setIsDetailOpen(false)} className={btnSecondaryClass}>Close</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 5. DELETE CONFIRMATION MODAL */}
      <AnimatePresence>
        {isDeleteOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }} className="bg-white rounded-2xl shadow-2xl p-8 text-center max-w-sm w-full">
              <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6"><Trash2 className="text-red-500" size={40} strokeWidth={2.5} /></div>
              <h3 className="text-xl font-bold text-[#27345A] mb-2">Delete this Submission?</h3>
              <p className="text-slate-500 text-sm mb-8">The submission will be permanently deleted. Continue?</p>
              <div className="flex gap-3">
                <button onClick={() => setIsDeleteOpen(false)} className={`${btnSecondary} w-full justify-center`}>Cancel</button>
                <button onClick={handleDeleteConfirm} className={`${btnDanger} w-full justify-center`}>Delete</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 4. FORM MODAL (ADD / EDIT) */}
      <AnimatePresence>
        {isFormOpen && <LogbookFormModal ref={formRef} mode={formMode} initialData={selectedLogbook} onClose={() => setIsFormOpen(false)} onAction={handleFormAction} />}
      </AnimatePresence>

      {/* STATUS MODAL */}
      <AnimatePresence>
        {statusModal.open && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-8 text-center relative">
              <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 ${statusModal.type === "success" ? "bg-green-50" : "bg-red-50"}`}>
                {statusModal.type === "success" ? <Check className="text-green-500" size={40} strokeWidth={3} /> : <AlertCircle className="text-red-500" size={40} strokeWidth={3} />}
              </div>
              <h3 className="text-xl font-bold text-[#27345A] mb-2">{statusModal.title}</h3>
              <p className="text-slate-500 text-sm mb-8">{statusModal.desc}</p>
              <button onClick={() => setStatusModal(prev => ({ ...prev, open: false }))} className={`w-full py-3.5 rounded-xl font-bold text-sm shadow-md transition-all active:scale-95 ${statusModal.type === "success" ? "bg-[#22C55E] hover:bg-[#16A34A] text-white shadow-green-200" : "bg-[#EF4444] hover:bg-[#DC2626] text-white shadow-red-200"}`}>OK</button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>



    </div>
  );
};

// --- SUB-COMPONENT: LOGBOOK FORM (Complex Logic) ---
const LogbookFormModal = React.forwardRef(({ mode, initialData, onClose, onAction }, ref) => {
  const [formData, setFormData] = useState({
    date: initialData?.date || "",
    description: initialData?.summary || "",
  });

  React.useImperativeHandle(ref, () => ({
    setFilesUploading: () => {
      setFiles((prev) => prev.map((f) => f.fileObj ? { ...f, status: 'uploading', progress: 3 } : f));
    },
    updateFileProgress: (updates) => {
      setFiles((prev) => prev.map((f) => {
        if (!f.fileObj) return f;
        const upd = updates.find(u => u.name === f.name);
        if (!upd) return f;
        const p = Math.max(0, Math.min(100, upd.percent || 0));
        return { ...f, progress: p, status: p >= 100 ? 'completed' : 'uploading' };
      }));
    }
  }));
  const [dateError, setDateError] = useState("");

  // Block-submission states: if date is covered by Sick/On Leave/Absent, disallow submit/draft
  const [dateBlockedReason, setDateBlockedReason] = useState(null); // 'Sick' | 'On Leave' | 'Absent' | null
  const [checkingDate, setCheckingDate] = useState(false);
  const dateStatusCacheRef = useRef({});

  // Check attendance / permission status for a specific date. Returns reason string or null.
  const checkDateForBlocking = async (dateStr) => {
    if (!dateStr) return null;
    if (dateStatusCacheRef.current[dateStr] !== undefined) return dateStatusCacheRef.current[dateStr];
    setCheckingDate(true);
    try {
      const res = await apiClient.get('/absensi/riwayat', { params: { per_page: 1000, limit: 1000, pagination: 0 } });
      const raw = res.data?.data?.data || res.data?.data || [];
      const rows = Array.isArray(raw) ? raw : (raw ? [raw] : []);

      const match = rows.find(r => {
        const candidates = [r.tanggal, r.tanggal_pulang, r.server_date, r.date, r.date_time, r.created_at];
        for (const c of candidates) {
          if (!c) continue;
          const s = String(c);
          const m = s.match(/\d{4}-\d{2}-\d{2}/);
          if (m && m[0] === dateStr) return true;
        }
        return false;
      });

      if (!match) { dateStatusCacheRef.current[dateStr] = null; return null; }

      const rawStatus = String(match.status || match.keterangan || match.type || '').toLowerCase();
      if (rawStatus.includes('sakit')) { dateStatusCacheRef.current[dateStr] = 'Sick'; return 'Sick'; }
      if (rawStatus.includes('izin') || rawStatus.includes('leave') || rawStatus.includes('on leave')) { dateStatusCacheRef.current[dateStr] = 'On Leave'; return 'On Leave'; }

      const hasIn = Boolean(match.jam_masuk || match.clock_in || match.masuk);
      const hasOut = Boolean(match.jam_pulang || match.clock_out || match.pulang);
      if (!hasIn && !hasOut) { dateStatusCacheRef.current[dateStr] = 'Absent'; return 'Absent'; }

      dateStatusCacheRef.current[dateStr] = null;
      return null;
    } catch (err) {
      console.warn('Failed to check date status:', err);
      dateStatusCacheRef.current[dateStr] = null;
      return null;
    } finally {
      setCheckingDate(false);
    }
  };

  // Validate if date is valid for logbook (not weekend, not future)
  const isValidLogbookDate = (dateStr) => {
    if (!dateStr) return false;
    const date = new Date(dateStr + "T00:00:00");
    const dayOfWeek = date.getDay(); // 0=Sunday, 6=Saturday
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const isFuture = date > new Date();
    return !isWeekend && !isFuture;
  };

  // Get today's date in YYYY-MM-DD format
  const getTodayStr = () => {
    const today = new Date();
    return today.toISOString().split("T")[0];
  };
  const parseExistingFiles = (outputOrList) => {
    if (!outputOrList) return [];
    const list = Array.isArray(outputOrList)
      ? outputOrList
      : String(outputOrList).split(",").map((nameRaw) => nameRaw.trim()).filter(Boolean);
    return list.map((item, idx) => {
      const raw = String(item);
      const name = raw.split("/").pop();
      const ext = (name.split('.').pop() || '').toLowerCase();
      const imageExts = ['jpg', 'jpeg', 'png'];
      let type = 'application/octet-stream';
      if (imageExts.includes(ext)) type = `image/${ext === 'jpg' ? 'jpeg' : ext}`;
      else if (ext === 'pdf') type = 'application/pdf';
      return { id: `existing-${idx}-${name}`, name, sizeFormatted: "Completed", progress: 100, status: "completed", type, url: raw };
    });
  };

  const [files, setFiles] = useState(() => parseExistingFiles(initialData?.outputs || initialData?.output));
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);
  const [confirmState, setConfirmState] = useState(null); // { action: 'submit'|'resubmit', payload }
  const [confirmDraftState, setConfirmDraftState] = useState(null); // { action: 'draft', payload }
  const [fileErrorModal, setFileErrorModal] = useState({ open: false, message: "" });
  const [fileError, setFileError] = useState("");

  // When editing or opening the modal with an initial date, check whether that date blocks submissions
  useEffect(() => {
    let mounted = true;
    (async () => {
      const dateToCheck = initialData?.date;
      if (dateToCheck) {
        const reason = await checkDateForBlocking(dateToCheck);
        if (mounted) setDateBlockedReason(reason);
      } else {
        setDateBlockedReason(null);
      }
    })();
    return () => { mounted = false; };
  }, [initialData]);

  const validMimeTypes = ["image/jpeg", "image/png", "image/jpg", "application/pdf"];
  const validExtensions = [".jpg", ".jpeg", ".png", ".pdf"];
  const maxFileSize = 5 * 1024 * 1024; // 5MB

  const formatBytes = (bytes) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };
  const isFormValid = () => {
    if (!formData.date) {
      setFileErrorModal({ open: true, message: "Please select a date." });
      return false;
    }
    if (!isValidLogbookDate(formData.date)) {
      setFileErrorModal({ open: true, message: dateError || "Please select a valid date (weekdays only, not in the future)." });
      return false;
    }
    if (!formData.description.trim()) {
      setFileErrorModal({ open: true, message: "Activity description is required." });
      return false;
    }
    if (files.length === 0) {
      setFileErrorModal({ open: true, message: "Please upload at least one photo (JPEG/PNG) as evidence." });
      return false;
    }
    const hasImage = files.some(f => (f.type && String(f.type).startsWith('image/')) || /\.(jpe?g|png)$/i.test(String(f.name)));
    if (!hasImage) {
      setFileErrorModal({ open: true, message: "At least one photo (JPEG/PNG) is required as evidence." });
      return false;
    }
    return true;
  };

  const handleAction = async (actionType) => {
    if (actionType !== "delete" && !isFormValid()) return;

    const dateToCheck = formData.date || initialData?.date;
    if (dateToCheck && actionType !== 'delete') {
      const reason = await checkDateForBlocking(dateToCheck);
      if (reason) {
        setFileErrorModal({ open: true, message: `Cannot ${actionType === 'draft' ? 'save' : 'submit'} logbook for this date because attendance status is "${reason}".` });
        return;
      }
    }

    const filesToUpload = files.filter(f => f.fileObj).map(f => f.fileObj);
    const payload = {
      id: initialData?.id,
      date: formData.date || initialData?.date,
      summary: formData.description || "",
      durasi_jam: 0,
      durasi_menit: 0,
      output: files.length ? files.map((f) => f.name).join(", ") : initialData?.output || "attachment",
      existingOutputs: initialData?.outputs || initialData?.output,
      feedback: initialData?.feedback || ""
    };
    const actionToSend = actionType === "submit" && mode === "edit" ? "resubmit" : actionType;

    if (actionToSend === "submit" || actionToSend === "resubmit") {
      setConfirmState({ action: actionToSend, payload, files: filesToUpload });
      return;
    }

    if (actionType === "draft") {
      setConfirmDraftState({ action: "draft", payload, files: filesToUpload });
      return;
    }

    if (onAction) {
      onAction(actionToSend, payload, filesToUpload);
    }
    onClose();
  };

  const handleFileChange = async (e) => {
    setFileError("");
    const selectedFiles = Array.from(e.target.files || []);
    const validMimeTypes = [
      "image/jpeg",
      "image/png",
      "image/jpg",
      "application/pdf",
      "application/x-pdf",
      "application/acrobat",
      "application/octet-stream"
    ];
    const validExtensions = [".jpg", ".jpeg", ".png", ".pdf"];
    const maxSize = 5 * 1024 * 1024;

    if (selectedFiles.length === 0) return;

    // Quick optimistic placeholders so UI shows activity immediately
    setFiles((prev) => [
      ...prev,
      ...selectedFiles.map(f => ({ id: Date.now() + Math.random(), name: f.name, size: f.size, type: f.type, status: 'processing', progress: 0 }))
    ]);

    // Compress/process in parallel (do not await serially)
    const compressionPromises = selectedFiles.map(async (file) => {
      const fileExt = "." + String(file.name).split('.').pop().toLowerCase();
      const isValidType = validExtensions.includes(fileExt) || validMimeTypes.includes(file.type) || ((file.type === "" || file.type === "application/octet-stream") && validExtensions.includes(fileExt));
      if (!isValidType) throw new Error(`invalid:${file.name}`);
      if (file.size > maxSize) throw new Error(`toolarge:${file.name}`);

      let finalFile = file;
      if (file.type && file.type.startsWith('image/')) {
        const options = { maxSizeMB: 1, maxWidthOrHeight: 1920, useWebWorker: true };
        try {
          const compressed = await imageCompression(file, options);
          finalFile = new File([compressed], file.name, { type: file.type, lastModified: Date.now() });
        } catch (err) {
          // fallback to original file if compression fails
          finalFile = file;
        }
      }

      return {
        id: Date.now() + Math.random(),
        fileObj: finalFile,
        name: finalFile.name,
        size: finalFile.size,
        type: finalFile.type,
        sizeFormatted: formatBytes(finalFile.size),
        progress: 100,
        status: 'completed'
      };
    });

    try {
      const settled = await Promise.allSettled(compressionPromises);
      const successful = settled.filter(s => s.status === 'fulfilled').map(s => s.value);
      const failed = settled.filter(s => s.status === 'rejected');
      if (failed.length) {
        // Pick first error to display
        const reason = failed[0].reason ? String(failed[0].reason) : 'Error processing files.';
        if (reason.startsWith('invalid:')) setFileError('Some files are invalid (only JPG/PNG/PDF allowed).');
        else if (reason.startsWith('toolarge:')) setFileError('Some files exceed the 5MB size limit.');
        else setFileError('Error processing files.');
      }

      // Merge processed files into state (remove placeholders with status 'processing')
      setFiles((prev) => {
        const filtered = prev.filter(p => p.status !== 'processing');
        return [...filtered, ...successful];
      });

    } catch (err) {
      console.warn('Unexpected error during file processing:', err);
      setFileError('Error processing files.');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const dropped = Array.from(e.dataTransfer.files || []);
    handleFileChange({ target: { files: dropped } });
  };

  const removeFile = (id) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-fade-in">
      <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="bg-white rounded-2xl shadow-2xl w-full max-w-lg relative flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex justify-between items-center p-5 border-b border-slate-100">
          <h3 className="text-xl font-bold text-[#27345A]">{mode === "add" ? "Add Logbook Form" : "Edit Logbook Form"}</h3>
          <button onClick={onClose}><X className="text-slate-400 hover:text-slate-600" size={24} /></button>
        </div>

        {/* Scrollable Content */}
        <div className="p-6 overflow-y-auto">
          <form className="space-y-5">
            {/* Date */}
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">Date <span className="text-red-500">*</span></label>
              <div className="relative">
                <Calendar className="absolute left-3 top-3 text-slate-400" size={18} />
                <input
                  type="date"
                  value={formData.date}
                  max={getTodayStr()}
                  onChange={(e) => {
                    const selectedDate = e.target.value;
                    setFormData({ ...formData, date: selectedDate });
                    setDateBlockedReason(null);
                    if (selectedDate) {
                      const date = new Date(selectedDate + "T00:00:00");
                      const dayOfWeek = date.getDay();
                      if (dayOfWeek === 0 || dayOfWeek === 6) {
                        setDateError("Cannot select weekends (Saturday/Sunday)");
                      } else if (date > new Date()) {
                        setDateError("Cannot select future dates");
                      } else {
                        setDateError("");
                        // Check whether this date should block logbook submissions
                        checkDateForBlocking(selectedDate).then(reason => {
                          setDateBlockedReason(reason);
                        }).catch(() => setDateBlockedReason(null));
                      }
                    } else {
                      setDateError("");
                      setDateBlockedReason(null);
                    }
                  }}
                  onClick={(e) => e.currentTarget.showPicker?.()}
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#354C8F]/20 cursor-pointer"
                />
              </div>
              {dateError && <p className="text-xs text-red-500 mt-2">{dateError}</p>}
              {dateBlockedReason && <p className="text-xs text-red-500 mt-2">You cannot submit a logbook for this date because attendance status is "{dateBlockedReason}".</p>}
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">Activity Description <span className="text-red-500">*</span></label>
              <textarea rows="4" required placeholder="Describe your activity details here" value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} className="w-full p-4 rounded-xl border border-slate-200 text-sm bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#354C8F]/20 resize-none transition-colors"></textarea>
            </div>

            {/* Output / Result Upload */}
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">Output or Result <span className="text-red-500">*</span></label>
              <p className="text-xs text-slate-500 mb-3 bg-blue-50 border border-blue-100 rounded-lg p-2.5">
                <span className="font-semibold text-blue-700">Required: upload at least one photo (selfie) taken during the work as evidence. Only JPEG/PNG accepted for evidence photos.</span>
              </p>

              <div
                onClick={() => fileInputRef.current.click()}
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center text-center transition-colors cursor-pointer ${isDragging ? "border-[#354C8F] bg-blue-50" : "border-slate-300 hover:bg-slate-50"}`}
              >
                <div className="w-12 h-12 bg-white rounded-full shadow-sm flex items-center justify-center mb-3">
                  <UploadCloud className="text-[#354C8F]" size={24} />
                </div>
                <p className="text-sm font-bold text-slate-700 mb-1">Choose a file or drag & drop it here</p>
                <p className="text-xs text-slate-400 mb-4">JPEG, PNG, PDF formats, up to 5MB</p>
                <button type="button" onClick={(e) => { e.stopPropagation(); fileInputRef.current.click(); }} className="px-4 py-2 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-700 hover:bg-slate-50 transition-all">Browse Files</button>
                <input type="file" multiple accept=".png,.jpg,.jpeg,.pdf" ref={fileInputRef} onChange={handleFileChange} className="hidden" />
              </div>
              {fileError && (
                <div className="flex items-center gap-2 text-red-500 text-sm mt-3 bg-red-50 p-2 rounded-lg border border-red-100 animate-pulse">
                  <AlertCircle size={16} />
                  <span>{fileError}</span>
                </div>
              )}

              {/* File List Items */}
              {files.length > 0 && (
                <div className="mt-4 space-y-3">
                  {files.map((f) => (
                    <div key={f.id} className="bg-[#EFF4FF] rounded-xl p-3 flex items-center gap-3 border border-slate-100 relative overflow-hidden">
                      {f.status === "uploading" && (
                        <div className="absolute bottom-0 left-0 h-1 bg-blue-500 transition-all duration-300 ease-out" style={{ width: `${f.progress}%` }}></div>
                      )}
                      <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center shrink-0 border border-slate-200 shadow-sm">
                        {(() => {
                          const name = String(f.name || '');
                          const ext = (name.split('.').pop() || '').toLowerCase();
                          const isPdf = ext === 'pdf';
                          const isImage = ['png', 'jpg', 'jpeg'].includes(ext);
                          const badgeLabel = isPdf ? 'PDF' : (isImage ? 'IMG' : (ext.toUpperCase() || 'FILE'));
                          const badgeClasses = isPdf ? 'bg-red-500 text-white' : isImage ? 'bg-blue-500 text-white' : 'bg-slate-300 text-slate-700';
                          return <div className={`text-[10px] font-extrabold px-2 py-1 rounded ${badgeClasses}`}>{badgeLabel}</div>;
                        })()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-slate-700 truncate">{f.name}</p>
                        <div className="flex items-center gap-2 text-xs text-slate-500">
                          <span>{f.sizeFormatted || f.size}</span>
                          <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                          {f.status === "uploading" ? (
                            <span className="text-blue-600 font-medium flex items-center gap-1"><Loader2 size={10} className="animate-spin" /> Uploading {Math.min(f.progress, 100)}%</span>
                          ) : f.status === 'uploading' ? (
                            <span className="text-blue-600 font-medium flex items-center gap-1"><Loader2 size={10} className="animate-spin" /> Uploading {Math.min(f.progress, 100)}%</span>
                          ) : f.status === 'completed' ? (
                            <span className="text-emerald-600 font-medium flex items-center gap-1"><Check size={10} /> Completed</span>
                          ) : (
                            <span className="text-green-600 font-medium flex items-center gap-1"><Check size={10} /> Completed</span>
                          )}
                        </div>
                      </div>
                      <button type="button" onClick={() => removeFile(f.id)} className="p-2 text-slate-400 hover:text-red-500"><X size={16} /></button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </form>
        </div>

        {/* Footer Actions */}
        <div className="p-6 border-t border-slate-100 flex justify-end gap-3 bg-white rounded-b-2xl">
          <button type="button" onClick={() => handleAction("draft")} disabled={checkingDate || Boolean(dateBlockedReason)} title={dateBlockedReason ? `Cannot save draft: attendance = ${dateBlockedReason}` : ''} className={`${btnSecondaryClass} ${checkingDate || dateBlockedReason ? 'opacity-50 cursor-not-allowed' : ''}`}>Save As Draft</button>
          <button
            type="button"
            onClick={() => handleAction("submit")}
            disabled={checkingDate || Boolean(dateBlockedReason) || !formData.date || !formData.description.trim() || files.some(f => f.status === "uploading") || !files.some(f => (f.type && String(f.type).startsWith('image/')) || /\.(jpe?g|png)$/i.test(String(f.name)))}
            title={dateBlockedReason ? `Cannot submit: attendance = ${dateBlockedReason}` : ''}
            className={`${btnPrimaryClass} ${checkingDate || dateBlockedReason ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {mode === 'add' ? 'Submit Request' : 'Re-Submit'}
          </button>
        </div>

        {/* Confirm Submit / Resubmit */}
        <AnimatePresence>
          {confirmState && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
              <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }} className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center relative">
                <button onClick={() => setConfirmState(null)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"><X size={20} /></button>
                <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-amber-50 flex items-center justify-center"><AlertCircle className="text-amber-500" size={40} strokeWidth={2.5} /></div>
                <h3 className="text-xl font-bold text-[#27345A] mb-2">Submit Confirmation</h3>
                <p className="text-sm text-slate-600 mb-6">After submitting, this logbook cannot be edited or deleted. Proceed?</p>
                <div className="flex gap-3">
                  <button onClick={() => setConfirmState(null)} className={`${btnSecondary} w-full justify-center`}>Cancel</button>
                  <button
                    onClick={() => {
                      if (confirmState) {
                        // set file states to uploading so the UI shows per-file progress
                        setFiles((prev) => prev.map((f) => ({ ...f, status: 'uploading', progress: 3 })));
                        // allow the browser to paint the updated UI before starting upload
                        setTimeout(() => {
                          if (onAction) onAction(confirmState.action, confirmState.payload, confirmState.files || []);
                        }, 60);
                      }
                      setConfirmState(null);
                      onClose();
                    }}
                    className={`${btnConfirmClass} w-full justify-center`}
                  >
                    Yes, Submit
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Confirm Save as Draft */}
        <AnimatePresence>
          {confirmDraftState && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
              <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }} className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center relative">
                <button onClick={() => setConfirmDraftState(null)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"><X size={20} /></button>
                <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-blue-50 flex items-center justify-center"><Save className="text-blue-500" size={40} strokeWidth={2.5} /></div>
                <h3 className="text-xl font-bold text-[#27345A] mb-2">Save as Draft?</h3>
                <p className="text-sm text-slate-600 mb-6">Your logbook will be saved as draft and can be edited later. Continue?</p>
                <div className="flex gap-3">
                  <button onClick={() => setConfirmDraftState(null)} className={`${btnSecondary} w-full justify-center`}>Cancel</button>
                  <button
                    onClick={() => {
                      if (onAction && confirmDraftState) onAction(confirmDraftState.action, confirmDraftState.payload, confirmDraftState.files || []);
                      setConfirmDraftState(null);
                      onClose();
                    }}
                    className={`${btnPrimary} w-full justify-center`}
                  >
                    Yes, Save
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* File Error Modal */}
        <AnimatePresence>
          {fileErrorModal.open && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
              onClick={() => setFileErrorModal({ open: false, message: "" })}
            >
              <motion.div
                initial={{ scale: 0.9 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0.9 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-white rounded-2xl p-8 text-center max-w-sm w-full shadow-2xl relative"
              >
                <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6"><AlertCircle className="text-red-500" size={40} strokeWidth={2.5} /></div>
                <h3 className="text-xl font-bold text-[#27345A] mb-2">Invalid File</h3>
                <p className="text-slate-500 text-sm mb-6">{fileErrorModal.message}</p>
                <button onClick={() => setFileErrorModal({ open: false, message: "" })} className={`${btnPrimaryClass} w-full`}>OK</button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

      </motion.div>
    </div>
  );
});

// Constant for reuse
const btnPrimaryClass = "bg-[#354C8F] hover:bg-[#1F2B4D] text-white py-3.5 px-6 rounded-xl active:scale-95 transition-all font-bold text-sm shadow-md shadow-indigo-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-slate-400 disabled:shadow-none";

export default DailyActivitiesPage;