import React, { useState, useEffect, useRef } from 'react';
import axios from '../../api/axiosConfig';
import {
  Search,
  Filter,
  X,
  Eye,
  Edit,
  ChevronLeft,
  ChevronRight,
  Calendar,
  ChevronDown,
  Check,
  AlertCircle,
  FileText,
  AlertTriangle,
  Loader2,
  Download
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { set } from 'date-fns';

// --- STYLES CONSTANTS ---
const btnPrimaryClass = "bg-[#354C8F] hover:bg-[#2a3c70] text-white py-3.5 px-6 rounded-xl font-bold text-sm shadow-md shadow-indigo-200 flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed";
const btnSecondaryClass = "bg-white border border-slate-300 text-slate-700 py-3.5 px-6 rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-slate-50 transition-all active:scale-95";
const btnSuccessClass = "bg-[#22C55E] hover:bg-[#16A34A] text-white py-3.5 px-6 rounded-xl font-bold text-sm shadow-md shadow-green-200 flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed";
const textDarkBlue = "text-[#203266]";

const PermissionApproval = () => {
  // --- STATES ---
  const [searchTerm, setSearchTerm] = useState("");
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isActionModalOpen, setIsActionModalOpen] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isSuccessOpen, setIsSuccessOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const [selectedRequest, setSelectedRequest] = useState(null);
  const [confirmAction, setConfirmAction] = useState(null);
  const [isFailedOpen, setIsFailedOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]); // IDs selected for bulk actions
  const [showBulkConfirm, setShowBulkConfirm] = useState(false);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalEntries, setTotalEntries] = useState(0);
  const [showingFrom, setShowingFrom] = useState(0);
  const [showingTo, setShowingTo] = useState(0);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // Filter States
  const [filterType, setFilterType] = useState([]);
  const [filterStatus, setFilterStatus] = useState([]);
  // Translator maps (display -> API)
  const typeDisplayToApi = {
    'Sick': 'sakit',
    'On Leave': 'izin'
  };
  const statusDisplayToApi = {
    'Approved': 'approved',
    'Need Approval': 'pending',
    'Waiting Admin': 'pending',
    'Pending': 'pending',
    'Rejected': 'rejected'
  };
  const mapTypesForApi = (types) => types.map(t => typeDisplayToApi[t] || t.toLowerCase());
  const mapStatusForApi = (statuses) => statuses.map(s => statusDisplayToApi[s] || s.toLowerCase());

  // Helper: Map API jenis_izin to display format
  const mapJenisIzinDisplay = (jenis_izin) => {
    if (jenis_izin === 'sakit') return 'Sick';
    if (jenis_izin === 'izin') return 'On Leave';
    return jenis_izin;
  };

    const getCleanFileName = (path) => {
        if (!path) return "File";
        // Handle both forward and backward slashes just in case
        let baseName = String(path).split(/[\\/]+/).pop();
        // Match pattern: _<userId>_<timestamp>_<uniqid>_<realFileName>
        const match = baseName.match(/_\d+_\d+_[a-f0-9]+_(.+)$/i);
        if (match) return match[1];
        // Fallback for cases without original filename
        const match2 = baseName.match(/_\d+_\d+_[a-f0-9]+(\.[a-zA-Z0-9]+)?$/i);
        if (match2) return `lampiran${match2[1] || ''}`;
        return baseName;
    };

  // Month/Year filter (empty string = not applied)
  const [filterMonth, setFilterMonth] = useState('');
  const [filterYear, setFilterYear] = useState('');
  // Applied filters (only used when user clicks Apply)
  const [appliedFilterType, setAppliedFilterType] = useState([]);
  const [appliedFilterStatus, setAppliedFilterStatus] = useState([]);
  const [appliedFilterMonth, setAppliedFilterMonth] = useState('');
  const [appliedFilterYear, setAppliedFilterYear] = useState('');

  // Data State
  const [data, setData] = useState([]);
  const [displayData, setDisplayData] = useState([]);

  // --- DOWNLOAD LAMPIRAN (BLOB) ---
  const handleDownloadLampiran = async (idIzin, idx, fileName) => {
    try {
      const res = await axios.get(`/izin/${idIzin}/download-lampiran/${idx}`, {
        responseType: 'blob',
        validateStatus: status => (status >= 200 && status < 300) || status === 204,
      });
      if (res.status === 204) {
        setIsSuccessOpen(true);
        setConfirmAction('download');
        return;
      }
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', fileName || `lampiran_${idIzin}_${idx}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      setIsSuccessOpen(true);
      setConfirmAction('download');
    } catch (err) {
      // Treat 204 from server as success even if it ends up in catch for some cases
      if (err?.response?.status === 204) {
        setIsSuccessOpen(true);
        setConfirmAction('download');
        return;
      }
      // Some download managers or network interruptions may abort the request —
      // assume success if the error message indicates the request was cancelled/intercepted
      const msg = String(err?.message || '').toLowerCase();
      if (msg.includes('network error') || msg.includes('canceled') || msg.includes('cancelled') || msg.includes('aborted')) {
        setIsSuccessOpen(true);
        setConfirmAction('download');
        return;
      }
      setIsFailedOpen(true);
      setConfirmAction('download');
    }
  };


  // Helper for status formatting
  function capitalizeStatus(status) {
    if (!status) return '-';
    if (status === 'pending_admin') return 'Pending Admin';
    if (status === 'pending_mentor') return 'Pending Mentor';
    return status.charAt(0).toUpperCase() + status.slice(1);
  }

  const formatLocalDate = (value) => {
    if (!value) return null;
    const raw = String(value).trim();
    const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (match) {
      return `${match[3]}/${match[2]}/${match[1]}`;
    }
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return null;
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  };

  // Fetch data from API (server-side pagination)
  const fetchData = async (page = 1) => {
    setLoading(true);
    try {
      const params = { page, per_page: itemsPerPage };
      if (searchTerm) params.q = searchTerm;
      if (appliedFilterType.length > 0) params.type = mapTypesForApi(appliedFilterType).join(',');

      if (appliedFilterStatus.length > 0) {
        // Map status names to specific API values now that backend supports them 
        // e.g. "Approved" -> "approved", "Need Approval" -> "need_approval"
        const apiStatusObj = {
          'Approved': 'approved',
          'Need Approval': 'need_approval',
          'Waiting Admin': 'waiting_admin',
          'Pending': 'need_approval',
          'Rejected': 'rejected'
        };
        const mappedStatuses = appliedFilterStatus.map(s => apiStatusObj[s] || s.toLowerCase());
        params.status = mappedStatuses.join(',');
      }

      if (appliedFilterMonth) params.bulan = appliedFilterMonth; // 1-12
      if (appliedFilterYear) params.tahun = appliedFilterYear;

      const res = await axios.get('/mentor/izin', { params });
      
      // Handle different response shapes robustly
      let apiData = [];
      let meta = {};
      if (res.data?.data) {
        const payload = res.data.data;
        if (Array.isArray(payload)) {
          apiData = payload;
          meta = res.data?.meta || {};
        } else if (typeof payload === 'object') {
          apiData = Array.isArray(payload.data) ? payload.data : [];
          meta = payload;
        }
      } else {
        apiData = res.data || [];
        meta = res.data?.meta || {};
      }

      const mapped = apiData.map(item => {
        // Compute readable dates when backend provides a range or multiple izin items
        const rangeInfo = (() => {
          const list = [];
          let hasRange = false;

          // If izin is an array, expand each izin entry
          if (Array.isArray(item.izin) && item.izin.length) {
            item.izin.forEach(iz => {
              const s = iz.tanggal_mulai ?? iz.start_date ?? iz.tanggal ?? iz.date ?? iz.tgl_mulai ?? null;
              const e = iz.tanggal_selesai ?? iz.end_date ?? iz.end ?? iz.tgl_selesai ?? null;
              const sLocal = formatLocalDate(s);
              const eLocal = formatLocalDate(e);
              if (sLocal && eLocal && sLocal !== eLocal) {
                list.push(`${sLocal} - ${eLocal}`);
                hasRange = true;
              } else if (sLocal) {
                list.push(sLocal);
              } else if (eLocal) {
                list.push(eLocal);
              }
            });
          } else if (item.tanggal_mulai && item.tanggal_selesai) {
            const sLocal = formatLocalDate(item.tanggal_mulai);
            const eLocal = formatLocalDate(item.tanggal_selesai);
            if (sLocal && eLocal) {
              list.push(`${sLocal} - ${eLocal}`);
              hasRange = sLocal !== eLocal;
            }
          } else if (item.tanggal_mulai) {
            const sLocal = formatLocalDate(item.tanggal_mulai);
            if (sLocal) list.push(sLocal);
          } else if (item.tanggal) {
            // Support comma/slash separated dates in a single field
            const parts = String(item.tanggal).split(/[,;\\|\\/]+/).map(s => s.trim()).filter(Boolean);
            parts.forEach(p => {
              const dLocal = formatLocalDate(p);
              if (dLocal) list.push(dLocal);
            });
          }

          return { list, hasRange: hasRange || list.length > 1 };
        })();

        const startLocal = formatLocalDate(item.tanggal_mulai);
        const endLocal = formatLocalDate(item.tanggal_selesai);
        const datesList = rangeInfo.list;
        const dateDisplay = datesList.length ? datesList.join(', ') : (startLocal ? startLocal : '-');
        const startDateIso = startLocal || (datesList.length ? datesList[0] : '-');
        const endDateIso = endLocal || (datesList.length ? datesList[datesList.length - 1] : '-');

        return {
          id: item.id_izin,
          name: item.user?.nama_lengkap || item.user?.nama,
          jobPosition: item.user?.mahasiswa?.job_position || item.user?.job_position || '-',
          university: item.user?.mahasiswa?.universitas || '-',
          date: dateDisplay,
          dateDisplay: dateDisplay,
          datesList: datesList,
          hasDateRange: rangeInfo.hasRange,
          type: mapJenisIzinDisplay(item.jenis_izin),
          statusMentor: item.status_mentor ? capitalizeStatus(item.status_mentor) : '-',
          statusAdmin: item.status_admin ? capitalizeStatus(item.status_admin) : '-',
          startDate: startDateIso,
          endDate: endDateIso,
          reason: item.keterangan || '-',
          files: (() => {
            if (!item.lampiran) return [];
            let names = [];
            if (typeof item.lampiran === 'string') {
              try {
                const parsed = JSON.parse(item.lampiran);
                if (Array.isArray(parsed)) names = parsed;
                else names = [item.lampiran];
              } catch {
                names = [item.lampiran];
              }
            } else if (Array.isArray(item.lampiran)) {
              names = item.lampiran;
            }
            return names.map(n => ({
              name: typeof n === 'string' ? getCleanFileName(n) : '',
              size: ''
            }));
          })(),
          raw: item
        };
      });

      setData(mapped);
      setDisplayData(mapped);
      // Pagination meta
      setCurrentPage(meta.current_page || page);
      setTotalPages(meta.last_page || Math.max(1, Math.ceil((meta.total || mapped.length) / itemsPerPage)));
      setTotalEntries(meta.total || mapped.length);
      setShowingFrom(meta.from || (mapped.length ? (page - 1) * itemsPerPage + 1 : 0));
      setShowingTo(meta.to || (meta.to ? meta.to : ((page - 1) * itemsPerPage + mapped.length)));

    } catch (err) {
      setData([]);
      setDisplayData([]);
      setTotalEntries(0);
      setTotalPages(1);
      setShowingFrom(0);
      setShowingTo(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(1);
  }, []);

  // Refetch when per-page changes
  const _perPageFirstRun = useRef(true);
  useEffect(() => {
    if (_perPageFirstRun.current) { _perPageFirstRun.current = false; return; }
    fetchData(1);
  }, [itemsPerPage]);

  // --- FILTER & SEARCH (server-side) ---
  useEffect(() => {
    const t = setTimeout(() => fetchData(1), 400); // debounce
    return () => clearTimeout(t);
  }, [searchTerm]);

  // --- PAGINATION LOGIC (server-side) ---
  const currentItems = displayData; // displayData is set by fetchData per page

  const handlePageChange = (pageNumber) => {
    if (pageNumber >= 1 && pageNumber <= totalPages) {
      fetchData(pageNumber);
    }
  }

  // --- ACTIONS ---
  const toggleFilter = (state, setState, value) => {
    if (state.includes(value)) setState(state.filter(item => item !== value));
    else setState([...state, value]);
  };

  const handleResetFilter = () => {
    setFilterType([]);
    setFilterStatus([]);
    setFilterMonth('');
    setFilterYear('');
    setAppliedFilterType([]);
    setAppliedFilterStatus([]);
    setAppliedFilterMonth('');
    setAppliedFilterYear('');
    setIsFilterOpen(false);
  };

  // Selection helpers for bulk-approve
  const toggleSelect = (id) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const toggleSelectAllOnPage = () => {
    const pendingIds = displayData.filter(d => getTableStatus(d) === 'Need Approval').map(d => d.id);
    const allSelected = pendingIds.length > 0 && pendingIds.every(id => selectedIds.includes(id));
    if (allSelected) {
      setSelectedIds(prev => prev.filter(id => !pendingIds.includes(id)));
    } else {
      setSelectedIds(prev => Array.from(new Set([...prev, ...pendingIds])));
    }
  };

  const handleOpenDetail = (item) => {
    setSelectedRequest(item);
    setIsActionModalOpen(true);
  };

  const initiateApproval = (action) => {
    setConfirmAction(action);
    setIsConfirmOpen(true);
  };

  const confirmApproval = async () => {
    setActionLoading(true);
    try {
      // single approve/reject
      await axios.put(`/mentor/izin/${selectedRequest.id}/status`, {
        status: confirmAction === 'approve' ? 'approved' : 'rejected',
        catatan_approval: ""
      });
      await fetchData(currentPage); // refetch current page dari API
      setIsConfirmOpen(false);
      setIsActionModalOpen(false);
      setIsSuccessOpen(true);
    } catch (error) {
      setIsConfirmOpen(false);
      setIsFailedOpen(true);
    } finally {
      setActionLoading(false);
    }
  };

  // Bulk approve selected (used by dedicated bulk modal)
  const executeBulkApprove = async () => {
    setShowBulkConfirm(false);
    if (selectedIds.length === 0) return;
    setBulkLoading(true);
    try {
      await Promise.all(selectedIds.map(id => axios.put(`/mentor/izin/${id}/status`, { status: 'approved', catatan_approval: "" })));
      setConfirmAction('approve');
      setSelectedIds([]);
      await fetchData(currentPage);
      setIsSuccessOpen(true);
    } catch (err) {
      setIsFailedOpen(true);
    } finally {
      setBulkLoading(false);
    }
  };


  // --- FILE VIEWER LOGIC ---
  const handleViewLampiran = (index, idIzin) => {
    const url = `${window.location.origin}/izin/view/${idIzin}/${index}`;
    window.open(url, "_blank");
  };

  // --- STATUS DETAIL HELPERS ---
  const findTimestampForRole = (raw, role) => {
    if (!raw) return null;

    // Try explicit approved/rejected keys first
    const approvedKey = `approved_at_${role}`;
    const rejectedKey = `rejected_at_${role}`;

    if (raw[approvedKey]) return raw[approvedKey];
    if (raw[rejectedKey]) return raw[rejectedKey];

    // Generic keys
    if (raw.approved_at && typeof raw.approved_at !== 'object') return raw.approved_at;
    if (raw.rejected_at && typeof raw.rejected_at !== 'object') return raw.rejected_at;

    // Case-insensitive map to find variants
    const lowerMap = Object.keys(raw).reduce((acc, k) => { acc[k.toLowerCase()] = k; return acc; }, {});
    if (lowerMap[approvedKey]) return raw[lowerMap[approvedKey]];
    if (lowerMap[rejectedKey]) return raw[lowerMap[rejectedKey]];
    if (lowerMap['approved_at']) return raw[lowerMap['approved_at']];
    if (lowerMap['rejected_at']) return raw[lowerMap['rejected_at']];

    // Look for any key containing approved/rejected + role
    for (const k of Object.keys(raw)) {
      const lk = k.toLowerCase();
      if (((lk.includes('approved') || lk.includes('rejected')) && lk.includes(role)) || lk.includes(`approved_at_${role}`) || lk.includes(`rejected_at_${role}`)) {
        if (raw[k]) return raw[k];
      }
    }

    // Fallback: any approved/rejected-like key
    for (const k of Object.keys(raw)) {
      const lk = k.toLowerCase();
      if ((lk.includes('approved_at') || lk === 'approved' || lk.includes('approved') || lk.includes('rejected_at') || lk === 'rejected' || lk.includes('rejected')) && raw[k]) return raw[k];
    }

    return null;
  };

  const formatApprovalTime = (role) => {
    const ts = findTimestampForRole(selectedRequest?.raw, role);
    if (!ts) return null;
    const date = new Date(ts);
    if (!isNaN(date.getTime())) return date.toLocaleString();
    const n = Number(ts);
    if (!isNaN(n)) {
      const d = new Date(n);
      if (!isNaN(d.getTime())) return d.toLocaleString();
    }
    return String(ts);
  };

  const getTableStatus = (item) => {
    if (!item) return '-';
    // If mentor still pending, show Need Approval (intern just submitted)
    if (item.statusMentor === 'Pending' || item.statusMentor === 'Pending Mentor') return 'Need Approval';
    // If mentor already approved but admin still pending -> show Waiting Admin
    if (item.statusMentor === 'Approved' && item.statusAdmin === 'Pending') return 'Waiting Admin';
    // Prefer admin status when present
    if (item.statusAdmin && item.statusAdmin !== '-') return item.statusAdmin;
    if (item.statusMentor && item.statusMentor !== '-') {
      if (item.statusMentor === 'Pending') return 'Need Approval';
      return item.statusMentor;
    }
    return '-';
  };

  // --- MONTH-YEAR PICKER (Dashboard style) ---
  const MonthYearPicker = ({ value, onChange, placeholder = "Select Date" }) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef(null);
    const [year, setYear] = useState(value ? parseInt(value.split("-")[0]) : new Date().getFullYear());
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

    useEffect(() => {
      const handleClickOutside = (event) => {
        if (containerRef.current && !containerRef.current.contains(event.target)) setIsOpen(false);
      };
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleSelect = (mIndex) => {
      const newDate = `${year}-${String(mIndex + 1).padStart(2, "0")}`;
      onChange && onChange(newDate);
      setIsOpen(false);
    };

    const displayValue = value
      ? new Date(value + "-01").toLocaleDateString("en-US", { month: "short", year: "numeric" }).toUpperCase()
      : placeholder;

    return (
      <div className="relative w-full sm:w-40" ref={containerRef}>
        <div onClick={() => setIsOpen(!isOpen)} className={`w-full pl-3 pr-3 py-2.5 rounded-xl border cursor-pointer select-none flex items-center justify-between transition-all duration-200 ${isOpen ? "border-[#354C8F] ring-2 ring-[#354C8F]/10 bg-white" : "border-slate-200 bg-white hover:border-slate-300"}`}>
          <div className="flex items-center gap-2 overflow-hidden">
            <Calendar size={16} className={isOpen ? "text-[#354C8F]" : "text-slate-400"} />
            <span className={`text-xs font-bold truncate ${value ? "text-slate-700" : "text-slate-400"}`}>{displayValue}</span>
          </div>
          <ChevronDown size={14} className={`text-slate-400 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
        </div>
        <AnimatePresence>
          {isOpen && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} className="absolute top-full mt-2 left-0 w-[240px] bg-white rounded-xl shadow-xl border border-slate-100 z-50 overflow-hidden">
              <div className="flex items-center justify-between p-3 border-b border-slate-100 bg-slate-50/50">
                <button onClick={(e) => { e.stopPropagation(); setYear(year - 1); }} className="p-1 hover:bg-slate-200 rounded-lg text-slate-500"><ChevronLeft size={16} /></button>
                <span className="text-sm font-extrabold text-[#27345A]">{year}</span>
                <button onClick={(e) => { e.stopPropagation(); setYear(year + 1); }} className="p-1 hover:bg-slate-200 rounded-lg text-slate-500"><ChevronRight size={16} /></button>
              </div>
              <div className="p-2 grid grid-cols-4 gap-1">
                {months.map((m, idx) => (
                  <button key={m} onClick={() => handleSelect(idx)} className={`py-2 px-1 text-[10px] font-bold rounded-lg transition-all ${value && parseInt(value.split("-")[1]) - 1 === idx && parseInt(value.split("-")[0]) === year ? "bg-[#354C8F] text-white shadow-sm" : "text-slate-600 hover:bg-indigo-50"}`}>{m}</button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  };

  const getFileIcon = (fileName) => {
    const isPdf = fileName?.toLowerCase().endsWith('.pdf');
    return (
      <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center shadow-sm shrink-0 border border-slate-100">
        <div className={`${isPdf ? "bg-red-500" : "bg-blue-500"} text-white text-[9px] font-bold px-1 rounded-sm`}>
          {isPdf ? "PDF" : "IMG"}
        </div>
      </div>
    );
  };

  // --- COMPONENT BADGE ---
  const Badge = ({ text, small = false, isStatus = false }) => {
    let styles = "";
    if (text === 'Approved') styles = "bg-green-50 text-green-600 border-green-200";
    else if (text === 'Need Approval') styles = "bg-[#FFF7ED] text-[#F97316] border-[#FFD8A8]";
    else if (text === 'Waiting Admin' || text === 'Pending' || text === 'Pending Admin') styles = "bg-[#FFFBEB] text-[#F59E0B] border-[#FEF3C7]";
    else if (text === 'Rejected') styles = "bg-red-50 text-red-600 border-red-200";
    else if (text === 'Sick') styles = "bg-blue-50 text-blue-600 border-blue-200";
    else if (text === 'On Leave') styles = "bg-slate-100 text-slate-600 border-slate-200 leading-tight";
    else styles = "bg-gray-50 text-gray-600 border-gray-200";

    const sizeClass = small ? 'w-[100px] px-2 text-[12px]' : isStatus ? 'min-w-[140px] px-3 text-[13px]' : 'min-w-[140px] px-3 text-xs';

    return (
      <span className={`inline-flex items-center justify-center ${sizeClass} h-[34px] rounded-lg font-bold border whitespace-nowrap ${styles}`}>
        {text}
      </span>
    );
  };

  // Pre-compute approval timestamps for modal display (null if not found)
  const mentorApprovedTime = selectedRequest ? formatApprovalTime('mentor') : null;
  const adminApprovedTime = selectedRequest ? formatApprovalTime('admin') : null;

  // Trigger fetch when applied filters change (apply-only behavior)
  const _appliedFirstRun = useRef(true);
  useEffect(() => {
    if (_appliedFirstRun.current) { _appliedFirstRun.current = false; return; }
    fetchData(1);
  }, [appliedFilterType, appliedFilterStatus, appliedFilterMonth, appliedFilterYear]);

  return (
    <div className="bg-slate-50 ml-2 -mr-2 -mt-1 pb-6 min-h-screen font-sans text-slate-800 text-[12px]">

      {/* Header & Action Bar */}
      <div className="mb-8">
        <h1 className={`text-3xl font-bold ${textDarkBlue} mb-2`}>Leave Request</h1>
        <p className="text-slate-500 text-sm -mt-1">Check your intern leave request</p>
      </div>

      <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-6">
        <div className="flex flex-row gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-80">
            <input
              type="text"
              placeholder="Search Intern"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#354C8F]/20 text-sm shadow-sm transition-all"
            />
            <Search className="absolute left-3 top-3.5 text-slate-400" size={18} />
          </div>

          <button onClick={() => setIsFilterOpen(true)} className={`${btnPrimaryClass} !px-6`}>
            <Filter size={18} />
            <span className="hidden md:inline">Filter</span>
            {(appliedFilterType.length > 0 || appliedFilterStatus.length > 0 || appliedFilterMonth || appliedFilterYear) && (
              <div className="w-2 h-2 bg-red-400 rounded-full animate-pulse"></div>
            )}
          </button>
        </div>
        <button
          onClick={() => { if (selectedIds.length > 0) { setShowBulkConfirm(true); } }}
          disabled={selectedIds.length === 0 || bulkLoading}
          className={`${btnSuccessClass} w-full md:w-auto ${selectedIds.length === 0 ? 'opacity-50 cursor-not-allowed' : ''} ${bulkLoading ? 'opacity-70 cursor-wait' : ''}`}
        >
          {bulkLoading ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
          {bulkLoading ? `Approving... (${selectedIds.length})` : `Approve Selected (${selectedIds.length})`}
        </button>
      </div>

      {/* Table Section */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-100 text-sm font-bold text-slate-900 bg-slate-50/50">
                <th className="p-3 w-20 text-center">
                  <div className="flex items-center justify-center gap-2">
                    <input
                      type="checkbox"
                      onChange={(e) => toggleSelectAllOnPage()}
                      checked={(() => { const pending = displayData.filter(d => getTableStatus(d) === 'Need Approval').map(d => d.id); return pending.length > 0 && pending.every(id => selectedIds.includes(id)); })()}
                      className="form-checkbox h-4 w-4"
                    />
                    <span>No</span>
                  </div>
                </th>
                <th className="p-3">Name</th>
                <th className="p-3">Date</th>
                <th className="p-3 text-center">Type</th>
                <th className="p-3">Job Position</th>
                <th className="p-3">Institution</th>
                <th className="p-3 text-center">Status</th>
                <th className="p-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="text-[12px] text-slate-600">
              {loading ? (
                <tr><td colSpan="8" className="p-12 text-center"><div className="flex flex-col items-center justify-center"><Loader2 className="animate-spin text-[#354C8F] mb-2" size={24} /><span className="text-slate-400">Loading data...</span></div></td></tr>
              ) : displayData.length > 0 ? (
                currentItems.map((item, index) => (
                  <tr key={item.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                    <td className="p-3 text-center font-medium">
                      <div className="flex items-center justify-center gap-2">
                        {getTableStatus(item) === 'Need Approval' ? (
                          <input
                            type="checkbox"
                            checked={selectedIds.includes(item.id)}
                            onChange={() => toggleSelect(item.id)}
                            onClick={(e) => e.stopPropagation()}
                            className="form-checkbox h-4 w-4"
                          />
                        ) : <div className="w-4"></div>}
                        <span>{(showingFrom ? showingFrom + index : ((currentPage - 1) * itemsPerPage + index + 1))}</span>
                      </div>
                    </td>
                    <td className="p-3">
                      <div className="font-medium text-slate-700">{item.name}</div>
                    </td>
                    <td className="p-3 whitespace-nowrap">{item.date}</td>
                    <td className="p-3 text-center"><Badge text={item.type} small /></td>

                    <td className="p-3 whitespace-nowrap">{item.jobPosition}</td>
                    <td className="p-3 whitespace-nowrap">{item.university}</td>
                    <td className="p-3 text-center">
                      <Badge text={getTableStatus(item)} isStatus />
                    </td>
                    <td className="p-3 text-center">
                      {getTableStatus(item) === 'Need Approval' ? (
                        <button
                          onClick={() => handleOpenDetail(item)}
                          className="inline-flex items-center justify-center h-[34px] w-[34px] bg-[#22C55E] text-white rounded-lg hover:bg-[#16A34A] transition-colors shadow-sm shadow-green-200 active:scale-95 group relative"
                          title="Edit"
                        >
                          <Edit size={16} className="group-hover:scale-110 transition-transform" />
                        </button>
                      ) : (
                        <button
                          onClick={() => handleOpenDetail(item)}
                          className="inline-flex items-center justify-center h-[34px] w-[34px] bg-[#354C8F] text-white rounded-lg hover:bg-[#2a3c70] transition-colors shadow-sm shadow-indigo-100 active:scale-95 group relative"
                          title="View Detail"
                        >
                          <Eye size={16} className="group-hover:scale-110 transition-transform" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr><td colSpan="8" className="p-8 text-center text-slate-400">No data available.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {!isActionModalOpen && !isConfirmOpen && !isSuccessOpen && totalEntries > 0 && (
          <div className="flex flex-col md:flex-row justify-between items-center p-5 border-t border-slate-100 text-sm text-slate-500 gap-4">
            <p className="order-2 md:order-1">Showing {showingFrom} to {showingTo} of {totalEntries} entries</p>
            <div className="flex items-center gap-4 order-1 md:order-2">
              <div className="flex items-center gap-2">
                <label className="text-xs md:text-sm font-medium text-slate-600">Per page:</label>
                <select
                  value={itemsPerPage}
                  onChange={(e) => setItemsPerPage(Number(e.target.value))}
                  className="px-2 py-1.5 rounded-lg border border-slate-200 text-xs md:text-sm font-medium text-slate-700 bg-white hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#354C8F]/20 cursor-pointer transition-all"
                >
                  <option value={5}>5</option>
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                </select>
              </div>
              <div className="flex items-center gap-2 flex-wrap justify-center">
                {(() => {
                  const pageCurrent = (typeof pagination !== 'undefined' && pagination.current_page) ? pagination.current_page : currentPage;
                  const pageTotal = (typeof pagination !== 'undefined' && pagination.last_page) ? pagination.last_page : totalPages;

                  // Only show pagination buttons if we have more than 1 page
                  if (pageTotal <= 1) return null;

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
                      <button onClick={() => handlePageChange(pageCurrent - 1)} disabled={pageCurrent === 1} className="p-2 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50 border border-slate-200"><ChevronLeft size={18} /></button>
                      {getPageItems(pageCurrent, pageTotal, 1).map((p, idx) => {
                        if (p === 'left-ellipsis' || p === 'right-ellipsis') return <div key={`${p}-${idx}`} className="w-8 h-8 flex items-center justify-center rounded-lg text-xs font-bold text-slate-400">...</div>;
                        return <button key={p} onClick={() => handlePageChange(p)} className={`w-8 h-8 flex items-center justify-center rounded-lg text-xs font-bold transition-colors ${pageCurrent === p ? "bg-slate-100 text-[#27345A] border border-slate-200" : "text-slate-500 hover:bg-slate-50 border border-transparent"}`}>{p}</button>;
                      })}
                      <button onClick={() => handlePageChange(pageCurrent + 1)} disabled={pageCurrent === pageTotal} className="p-2 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50 border border-slate-200"><ChevronRight size={18} /></button>
                    </>
                  );
                })()}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* --- MODAL FILTER --- */}
      <AnimatePresence>
        {isFilterOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-white w-full max-w-md rounded-2xl shadow-2xl p-5 relative">
              <div className="flex justify-between items-center mb-6"><h3 className="text-[18px] font-bold text-[#27345A]">Leave Request Filter</h3><button onClick={() => setIsFilterOpen(false)}><X size={24} className="text-slate-400 hover:text-slate-600" /></button></div>
              <div className="space-y-6">
                <div><label className="block text-[14px] font-bold text-slate-800 mb-2">Type</label><div className="flex flex-wrap gap-2">{['Sick', 'On Leave'].map(type => (<button key={type} onClick={() => toggleFilter(filterType, setFilterType, type)} className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all border ${filterType.includes(type) ? 'bg-[#354C8F] text-white border-[#354C8F] shadow-md' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}>{type}</button>))}</div></div>
                <div><label className="block text-[14px] font-bold text-slate-800 mb-2">Status</label><div className="flex flex-wrap gap-2">{['Approved', 'Need Approval', 'Waiting Admin', 'Rejected'].map(status => (<button key={status} onClick={() => toggleFilter(filterStatus, setFilterStatus, status)} className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all border ${filterStatus.includes(status) ? 'bg-[#354C8F] text-white border-[#354C8F] shadow-md' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}>{status}</button>))}</div></div>

                <div>
                  <label className="block text-[14px] font-bold text-slate-800 mb-2">Month</label>
                  <div className="flex items-center gap-2">
                    <MonthYearPicker value={filterYear && filterMonth ? `${filterYear}-${String(filterMonth).padStart(2, '0')}` : ''} onChange={(val) => {
                      if (val) {
                        const [y, m] = val.split('-');
                        setFilterYear(y);
                        setFilterMonth(String(parseInt(m, 10)));
                      } else {
                        setFilterYear('');
                        setFilterMonth('');
                      }
                    }} placeholder="All months" />
                  </div>
                </div>
              </div>
              <hr className="my-6 border-slate-100" />
              <div className="flex gap-3 justify-end"><button onClick={handleResetFilter} className={btnSecondaryClass}>Reset</button><button onClick={() => {
                setAppliedFilterType(filterType);
                setAppliedFilterStatus(filterStatus);
                setAppliedFilterMonth(filterMonth);
                setAppliedFilterYear(filterYear);
                setIsFilterOpen(false);
              }} className={btnPrimaryClass} >Apply</button></div>
            </motion.div>
          </div>
        )}

      </AnimatePresence>

      {/* --- FAILED MODAL --- */}
      <AnimatePresence>
        {isFailedOpen && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="bg-white rounded-2xl shadow-2xl p-8 text-center max-w-sm w-full">
              <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 bg-red-50">
                <AlertCircle className="text-red-500" size={40} strokeWidth={3} />
              </div>
              <h3 className="text-xl font-bold text-[#27345A] mb-2">
                {confirmAction === 'download' ? 'Gagal Download File' : 'Gagal Update Status'}
              </h3>
              <p className="text-slate-500 text-sm mb-8">
                {confirmAction === 'download' ? 'Terjadi kesalahan saat mendownload file. Silakan coba lagi.' : 'Terjadi kesalahan saat mengupdate status izin. Silakan coba lagi.'}
              </p>
              <button onClick={() => setIsFailedOpen(false)} className="w-full bg-[#EF4444] hover:bg-[#DC2626] text-white py-3.5 rounded-xl font-bold text-sm shadow-md shadow-red-200 transition-all active:scale-95 flex items-center justify-center">Tutup</button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* --- MODAL ACTION / VIEW DETAIL --- */}
      <AnimatePresence>
        {isActionModalOpen && selectedRequest && (
          <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} className="bg-white w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
              <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-white">
                <h3 className="text-[18px] font-bold text-[#27345A]">Action Leave Request Form</h3>
                <button onClick={() => setIsActionModalOpen(false)}><X size={24} className="text-slate-400 hover:text-slate-600" /></button>
              </div>

              <div className="p-8 overflow-y-auto custom-scrollbar">
                <div className="space-y-6 -mt-4">
                  <div><label className="block text-sm font-bold text-slate-800 mb-2">Type</label><Badge text={selectedRequest.type} small /></div>

                  <div>
                    <label className="block text-sm font-bold text-slate-800 mb-2">Detail Status</label>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 rounded-xl border border-slate-200 bg-slate-50">
                        <div className="flex items-center justify-between mb-2">
                          <div className="text-sm font-bold text-slate-700">Mentor</div>
                          <Badge text={selectedRequest.statusMentor} isStatus />
                        </div>
                        {selectedRequest.statusMentor && (selectedRequest.statusMentor.includes('Approved') || selectedRequest.statusMentor.includes('Rejected')) ? (
                          mentorApprovedTime ? (
                            <div className="text-[12px] text-slate-500">{selectedRequest.statusMentor.includes('Rejected') ? 'Rejected at ' : 'Approved at '}{mentorApprovedTime}</div>
                          ) : (
                            <div className="text-[12px] text-slate-400">{selectedRequest.statusMentor || '-'}</div>
                          )
                        ) : (
                          <div className="text-[12px] text-slate-400">{selectedRequest.statusMentor || '-'}</div>
                        )}
                      </div>

                      <div className="p-4 rounded-xl border border-slate-200 bg-slate-50">
                        <div className="flex items-center justify-between mb-2">
                          <div className="text-sm font-bold text-slate-700">Admin</div>
                          <Badge text={selectedRequest.statusAdmin} isStatus />
                        </div>
                        {selectedRequest.statusAdmin && (selectedRequest.statusAdmin.includes('Approved') || selectedRequest.statusAdmin.includes('Rejected')) ? (
                          adminApprovedTime ? (
                            <div className="text-[12px] text-slate-500">{selectedRequest.statusAdmin.includes('Rejected') ? 'Rejected at ' : 'Approved at '}{adminApprovedTime}</div>
                          ) : (
                            <div className="text-[12px] text-slate-400">{selectedRequest.statusAdmin || '-'}</div>
                          )
                        ) : (
                          <div className="text-[12px] text-slate-400">{selectedRequest.statusAdmin || '-'}</div>
                        )}
                      </div>
                    </div>
                  </div>

                  {selectedRequest?.hasDateRange || (selectedRequest?.datesList && selectedRequest.datesList.length > 1) ? (
                    <div>
                      <label className="block text-sm font-bold text-slate-800 mb-2">Dates</label>
                      <div className="flex items-center px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-600 text-sm font-medium whitespace-pre-wrap">{selectedRequest.dateDisplay}</div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-4">
                      <div><label className="block text-sm font-bold text-slate-800 mb-2">Start Date</label><div className="flex items-center px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-600 text-sm font-medium"><Calendar size={16} className="mr-3 text-slate-400" />{selectedRequest.startDate}</div></div>
                      <div><label className="block text-sm font-bold text-slate-800 mb-2">End Date</label><div className="flex items-center px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-600 text-sm font-medium"><Calendar size={16} className="mr-3 text-slate-400" />{selectedRequest.endDate}</div></div>
                    </div>
                  )}
                  <div><label className="block text-sm font-bold text-slate-800 mb-2">Reason</label><textarea readOnly value={selectedRequest.reason} className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-600 text-sm leading-relaxed resize-none focus:outline-none" rows="3" /></div>

                  {/* ATTACHMENT SECTION */}
                  <div>
                    <label className="block text-sm font-bold text-slate-800 mb-2">Attachments</label>
                    {selectedRequest.files && selectedRequest.files.length > 0 ? (
                      <div className="space-y-3">
                        {selectedRequest.files.map((file, idx) => (
                          <div
                            key={idx}
                            className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-xl group hover:border-[#354C8F]/30 transition-all cursor-pointer"
                            onClick={() => handleViewLampiran(idx, selectedRequest.id)}
                          >
                            <div className="flex items-center gap-3 overflow-hidden flex-1">
                              {getFileIcon(file.name)}
                              <div className="min-w-0">
                                <p className="text-sm font-bold text-slate-700 truncate group-hover:text-[#354C8F] transition-colors">{file.name}</p>
                                <p className="text-[10px] text-slate-400">Click to preview</p>
                              </div>
                            </div>
                            <div className="p-2 text-slate-400 group-hover:text-[#354C8F]">
                              <button
                                type="button"
                                onClick={e => {
                                  e.stopPropagation();
                                  handleDownloadLampiran(selectedRequest.id, idx, file.name);
                                }}
                                className="flex items-center justify-center focus:outline-none"
                              >
                                <Download size={18} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center p-6 bg-slate-50 rounded-xl border border-dashed border-slate-300 text-slate-400 text-sm">No attachments provided.</div>
                    )}
                  </div>

                </div>
              </div>
              <div className="p-4 border-t border-slate-100 bg-white flex justify-end gap-3 sticky bottom-0 z-10">
                {(selectedRequest.statusMentor === 'Pending' || selectedRequest.statusMentor === 'Need Approval') ? (
                  <>
                    <div className="flex gap-3 justify-end">
                      {/* Tombol Reject (Outline) */}
                      <button
                        onClick={() => initiateApproval('reject')}
                        className="w-36 border border-[#EF4444] text-[#EF4444] hover:bg-red-50 py-3 rounded-xl font-bold text-sm transition-all active:scale-95"
                      >
                        Reject
                      </button>

                      {/* Tombol Approve (Solid) */}
                      <button
                        onClick={() => initiateApproval('approve')}
                        className="w-36 bg-[#22C55E] hover:bg-[#16A34A] text-white py-3 rounded-xl font-bold text-sm shadow-md shadow-green-100 transition-all active:scale-95"
                      >
                        Approve
                      </button>
                    </div>
                  </>
                ) : (
                  <button onClick={() => setIsActionModalOpen(false)} className={btnSecondaryClass}>Close</button>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* --- BULK APPROVE SELECTED MODAL --- */}
      <AnimatePresence>
        {showBulkConfirm && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="bg-white rounded-2xl shadow-2xl p-8 text-center max-w-sm w-full">
              <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 bg-yellow-50">
                <AlertCircle className="text-yellow-500" size={40} strokeWidth={2} />
              </div>
              <h3 className="text-xl font-bold text-[#27345A] mb-2">Approve Selected?</h3>
              <p className="text-slate-500 text-sm mb-8">Approve all selected pending permissions on this page?</p>
              <div className="flex gap-3">
                <button onClick={() => setShowBulkConfirm(false)} className={btnSecondaryClass + " w-full"}>Cancel</button>
                <button onClick={executeBulkApprove} disabled={bulkLoading} className={`${btnSuccessClass} w-full ${bulkLoading ? 'opacity-70 cursor-wait' : ''}`}>
                  {bulkLoading && <Loader2 size={16} className="animate-spin" />}
                  {bulkLoading ? 'Approving...' : 'Approve All'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* --- CONFIRM MODAL --- */}
      <AnimatePresence>
        {isConfirmOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="bg-white rounded-2xl shadow-2xl p-8 text-center max-w-sm w-full">
              <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 ${confirmAction === 'approve' ? 'bg-green-50' : 'bg-red-50'}`}>
                <AlertTriangle className={confirmAction === 'approve' ? 'text-green-500' : 'text-red-500'} size={40} strokeWidth={2.5} />
              </div>
              <h3 className="text-[20px] font-bold text-[#27345A] mb-2">{confirmAction === 'approve' ? 'Approve Permission?' : 'Reject Permission?'}</h3>
              <p className="text-slate-500 text-sm mb-8">Your action cannot be changed, do you wish to continue?</p>
              <div className="flex gap-3">
                <button onClick={() => setIsConfirmOpen(false)} disabled={actionLoading} className={btnSecondaryClass + " w-full"}>Cancel</button>
                <button disabled={actionLoading} onClick={confirmApproval} className={`flex items-center justify-center gap-2 w-full py-3.5 px-6 rounded-xl font-bold text-sm shadow-md text-white transition-all active:scale-95 disabled:opacity-70 disabled:cursor-wait ${confirmAction === 'approve' ? 'bg-[#22C55E] hover:bg-[#16A34A] shadow-green-200' : 'bg-[#EF4444] hover:bg-[#DC2626] shadow-red-200'}`}>
                  {actionLoading && <Loader2 size={16} className="animate-spin" />}
                  {actionLoading ? (confirmAction === 'approve' ? 'Approving...' : 'Rejecting...') : (confirmAction === 'approve' ? 'Approve' : 'Reject')}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* --- SUCCESS MODAL --- */}
      <AnimatePresence>
        {isSuccessOpen && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="bg-white rounded-2xl shadow-2xl p-8 text-center max-w-sm w-full">
              <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 bg-green-50`}>
                <Check className="text-green-500" size={40} strokeWidth={3} />
              </div>
              <h3 className="text-xl font-bold text-[#27345A] mb-2">
                {confirmAction === 'approve' ? 'Approved'
                  : confirmAction === 'reject' ? 'Rejected'
                    : confirmAction === 'download' ? 'Download Success' : 'Success'}
              </h3>
              <p className="text-slate-500 text-sm mb-8">
                {confirmAction === 'approve' || confirmAction === 'reject'
                  ? 'The permission status has been updated successfully.'
                  : confirmAction === 'download'
                    ? 'The file has been downloaded successfully.'
                    : 'Operation completed successfully.'}
              </p>
              <button onClick={() => setIsSuccessOpen(false)} className="w-full bg-[#22C55E] hover:bg-[#16A34A] text-white py-3.5 rounded-xl font-bold text-sm shadow-md shadow-green-200 transition-all active:scale-95 flex items-center justify-center">OK</button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
};

export default PermissionApproval;