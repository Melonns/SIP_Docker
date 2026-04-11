import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import { motion, AnimatePresence } from 'framer-motion';
import 'leaflet/dist/leaflet.css';
import axios from '../../api/axiosConfig';
import {
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Calendar,
  Eye,
  X,
  MapPin,
  FileText,
  Download,
  Loader2
} from 'lucide-react';

import SecureImage from '../../components/SecureImage';

// --- STYLE CONSTANTS ---
const btnPrimaryClass = "bg-[#354C8F] hover:bg-[#1F2B4D] text-white py-3.5 px-6 rounded-xl active:scale-95 transition-all font-bold text-sm shadow-md shadow-indigo-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed";
const btnSecondaryClass = "bg-white border border-slate-300 text-slate-700 py-3.5 px-6 rounded-xl active:scale-95 transition-all font-bold text-sm flex items-center justify-center gap-2 hover:bg-slate-50";

// --- FETCHED DATA STATE ---
// Data dari BE akan di-mapping ke format tabel di bawah

// --- COMPONENTS ---

const StatusBadge = ({ status }) => {
  const s = String(status || '').toLowerCase();
  let styles = "bg-gray-100 text-gray-500 border-gray-200";
  let label = status;

  if (s.includes('on time') || s.includes('ontime')) styles = "bg-green-50 text-green-600 border-green-200";
  else if (s.includes('late')) styles = "bg-[#FFF4E5] text-orange-500 border-orange-200";
  else if (s.includes('sick')) styles = "bg-blue-50 text-blue-600 border-blue-200";
  else if (s.includes('absent')) styles = "bg-red-50 text-red-500 border-red-200";
  else if (s.includes('leave') || s.includes('on leave')) styles = "bg-slate-100 text-slate-600 border-slate-200 leading-tight";
  else if (s.includes('early')) styles = "bg-yellow-50 text-yellow-700 border-yellow-200";

  return (
    <span className={`inline-flex items-center justify-center px-4 py-2 rounded-lg text-xs font-bold border whitespace-nowrap min-w-[100px] ${styles}`}>
      {label}
    </span>
  );
};

// --- MAIN PAGE COMPONENT ---

const MentorAttendanceLogs = () => {
  const [logs, setLogs] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalEntries, setTotalEntries] = useState(0);
  const [showingFrom, setShowingFrom] = useState(0);
  const [showingTo, setShowingTo] = useState(0);
  // Keep full meta from API for pagination rendering
  const [paginationMeta, setPaginationMeta] = useState({ current_page: 1, last_page: 1, from: 0, to: 0, total: 0 });
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [filterOptions, setFilterOptions] = useState({ universities: [], divisions: [], sites: [] });
  const [filterOptionsLoading, setFilterOptionsLoading] = useState(false);

  // Modal States
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [selectedLog, setSelectedLog] = useState(null);
  const [loadingDetailId, setLoadingDetailId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [viewLoadingId, setViewLoadingId] = useState(null);

  // Filter States (applied vs modal-local)
  const [appliedFilterUniversity, setAppliedFilterUniversity] = useState("");
  const [appliedFilterDivision, setAppliedFilterDivision] = useState("");
  const [appliedFilterLocation, setAppliedFilterLocation] = useState("");
  const [appliedFilterStatus, setAppliedFilterStatus] = useState([]);

  // Modal-local filter state (changed selections won't trigger fetch until Apply)
  const [modalUniversity, setModalUniversity] = useState("");
  const [modalDivision, setModalDivision] = useState("");
  const [modalLocation, setModalLocation] = useState("");
  const [modalStatus, setModalStatus] = useState([]);

  // Month filter
  const [selectedMonth, setSelectedMonth] = useState(new Date());

  // Fetch dari BE dan mapping ke format tabel
  const parseTimeToMinutes = (timeStr) => {
    if (!timeStr) return null;
    const parts = String(timeStr).split(':');
    if (parts.length < 2) return null;
    const [h, m] = parts.map(Number);
    if (Number.isNaN(h) || Number.isNaN(m)) return null;
    return h * 60 + m;
  };

  const getCutoffMinutes = (dateStr) => {
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return 8 * 60 + 10; // default Mon-Thu cutoff
    const day = d.getDay();
    return day === 5 ? 7 * 60 + 10 : 8 * 60 + 10; // Friday uses 07:10
  };

  const formatDateDMY = (value) => {
    if (!value) return null;
    const raw = String(value).trim();
    const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (match) {
      return `${match[3]}/${match[2]}/${match[1]}`;
    }
    const d = new Date(raw);
    if (!Number.isNaN(d.getTime())) {
      const dd = String(d.getDate()).padStart(2, '0');
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const yyyy = d.getFullYear();
      return `${dd}/${mm}/${yyyy}`;
    }
    return raw;
  };

  const formatDateRangeDisplay = (rawValue, startValue, endValue) => {
    const start = formatDateDMY(startValue || null);
    const end = formatDateDMY(endValue || null);
    if (start && end) return `${start} - ${end}`;
    if (start) return start;
    if (end) return end;

    const raw = rawValue ? String(rawValue).trim() : '';
    if (raw.includes(' / ')) {
      const [left, right] = raw.split(' / ').map(part => part.trim());
      return `${formatDateDMY(left)} - ${formatDateDMY(right)}`;
    }
    if (raw.includes(' - ')) {
      const [left, right] = raw.split(' - ').map(part => part.trim());
      return `${formatDateDMY(left)} - ${formatDateDMY(right)}`;
    }
    return formatDateDMY(raw);
  };

  const deriveStatus = (item) => {
    const raw = String(item.status || '').toLowerCase();
    const isCorrection = raw.includes('koreksi') || raw.includes('correction');

    if (isCorrection) {
      if (item.lama_telat !== undefined && item.lama_telat !== null) {
        if (item.lama_telat > 0) return { key: 'late', label: `Late (${item.lama_telat} m)` };
        return { key: 'ontime', label: 'On Time' };
      }

      const cutoff = getCutoffMinutes(item.tanggal);
      const clockInMinutes = parseTimeToMinutes(item.jam_masuk);
      if (clockInMinutes !== null) {
        const lateBy = clockInMinutes - cutoff;
        if (lateBy > 0) return { key: 'late', label: `Late (${lateBy} m)` };
        return { key: 'ontime', label: 'On Time' };
      }
      return { key: 'ontime', label: 'On Time' };
    }

    // Prefer backend-provided status jika ada
    if (raw.includes('absent') || raw === 'absent') return { key: 'absent', label: 'Absent' };
    if (raw.includes('late') || raw === 'late') {
      const mins = item.lama_telat ?? null;
      return { key: 'late', label: mins ? `Late (${mins} m)` : 'Late' };
    }
    if (raw.includes('ontime') || raw.includes('on time') || raw === 'ontime') return { key: 'ontime', label: 'On Time' };
    if (raw.includes('izin') && raw.includes('sakit')) return { key: 'sick', label: 'Sick' };
    if (raw.includes('sakit') || raw === 'sick') return { key: 'sick', label: 'Sick' };
    if (raw.includes('izin') || raw.includes('leave') || raw.includes('on leave')) return { key: 'on_leave', label: 'On Leave' };
    if (raw.includes('early')) return { key: 'early', label: 'Early Out' };
    // Fallback: infer dari field lain
    if (item.lama_telat && item.lama_telat > 0) return { key: 'late', label: `Late (${item.lama_telat} m)` };
    if (item.jam_masuk) return { key: 'ontime', label: 'On Time' };
    return { key: 'absent', label: 'Absent' };
  };

  // Map client-facing status labels to API values that backend expects (e.g., 'izin','late','ontime','absent')
  const mapStatusForApi = (statuses = []) => {
    const map = {
      'On Time': 'ontime',
      'Late': 'late',
      'Absent': 'absent',
      'Sick': 'sakit', // backend treats sickness as izin
      'On Leave': 'izin',
      'Early': 'early',
      'Early Out': 'early',
    };
    const mapped = statuses.map(s => map[s] || String(s).toLowerCase()).filter(Boolean);
    // unique
    return Array.from(new Set(mapped));
  };

  // Track the current in-flight request controller to cancel stale calls
  const currentFetchControllerRef = useRef(null);

  const fetchData = async () => {
    // Cancel any previous in-flight request to avoid race conditions / stale responses
    try {
      if (currentFetchControllerRef.current) {
        try { currentFetchControllerRef.current.abort(); } catch (e) { /* ignore */ }
      }
      const controller = new AbortController();
      currentFetchControllerRef.current = controller;

      setLoading(true);

      const params = {
        page: currentPage,
        per_page: itemsPerPage,
      };
      if (searchTerm) params.q = searchTerm;
      if (appliedFilterUniversity) params.universitas = appliedFilterUniversity;
      if (appliedFilterDivision) params.division = appliedFilterDivision;
      if (appliedFilterLocation) {
        // If filterLocation is numeric id (site id), send as site_id, otherwise send as location string for backward compatibility
        if (/^\d+$/.test(String(appliedFilterLocation))) params.id_site = appliedFilterLocation;
        else params.location = appliedFilterLocation;
      }
      if (appliedFilterStatus.length > 0) {
        const mapped = mapStatusForApi(appliedFilterStatus);
        if (mapped.length > 0) params.status = mapped.join(',');
      }
      // Month filter (send numeric month and year)
      if (selectedMonth) {
        params.month = selectedMonth.getMonth() + 1; // 1-12
        params.year = selectedMonth.getFullYear();
      }

      const res = await axios.get('/mentor/absensi/rekap', { params, signal: controller.signal });
      const apiData = res.data?.data || [];
      const meta = res.data?.meta || {};

      const mapped = apiData.map(item => {
        const status = deriveStatus(item);
        const dateDisplay = formatDateRangeDisplay(
          item.tanggal,
          item.tanggal_mulai || item.start_date,
          item.tanggal_selesai || item.end_date
        );
        return ({
          id: (item.id_mahasiswa ?? item.user_id ?? item.id) + '-' + item.tanggal,
          name: item.nama_lengkap || item.nama,
          jobPosition: item.job_position || item.user?.mahasiswa?.job_position || item.user?.job_position || '-'.trim(),
          university: item.universitas,
          date: item.tanggal,
          dateDisplay,
          inTime: item.jam_masuk || '-',
          outTime: item.jam_pulang || '-',
          status: status.label,
          statusKey: status.key,
          division: item.division,
          reason: item.reason || '-', // bisa diisi jika ada field alasan
          hasFile: !!item.file || !!item.foto_masuk || !!item.foto_pulang,
          fileName: item.file || null,
          location: item.lokasi || '-', // bisa diisi jika ada lokasi
          photoUrl: item.foto_masuk || null,
          raw: item
        });
      });

      setLogs(mapped);
      setCurrentPage(meta.current_page || currentPage);
      setTotalPages(meta.last_page || Math.max(1, Math.ceil((meta.total || mapped.length) / itemsPerPage)));
      setTotalEntries(meta.total || mapped.length);
      setShowingFrom(meta.from || (mapped.length ? (currentPage - 1) * itemsPerPage + 1 : 0));
      setShowingTo(meta.to || (meta.to ? meta.to : ((currentPage - 1) * itemsPerPage + mapped.length)));

      setPaginationMeta({
        current_page: meta.current_page || currentPage,
        last_page: meta.last_page || Math.max(1, Math.ceil((meta.total || mapped.length) / itemsPerPage)),
        from: meta.from || (mapped.length ? (currentPage - 1) * itemsPerPage + 1 : 0),
        to: meta.to || (meta.to ? meta.to : ((currentPage - 1) * itemsPerPage + mapped.length)),
        total: meta.total || mapped.length
      });
    } catch (err) {
      // If the request was aborted, just ignore and don't overwrite UI state
      if (err && err.name === 'CanceledError') {
        return;
      }
      if (err && err.code === 'ERR_CANCELED') {
        return;
      }

      setLogs([]);
      setTotalEntries(0);
      setTotalPages(1);
      setShowingFrom(0);
      setShowingTo(0);
    } finally {
      currentFetchControllerRef.current = null;
      setLoading(false);
    }
  };

  const fetchFilterOptions = async () => {
    try {
      setFilterOptionsLoading(true);
      const res = await axios.get('/mentor/filters');
      const data = res.data?.data || {};
      const options = {
        universities: data.universities || data?.universitas || [],
        divisions: data.divisions || [],
        sites: data.sites || [],
      };
      setFilterOptions(options);
      return options;
    } catch (err) {
      setFilterOptions({ universities: [], divisions: [], sites: [] });
      return { universities: [], divisions: [], sites: [] };
    } finally {
      setFilterOptionsLoading(false);
    }
  }

  // --- FILTER / MODAL HELPERS ---
  const handleOpenFilter = () => {
    // initialize modal selections from applied filters
    setModalUniversity(appliedFilterUniversity);
    setModalDivision(appliedFilterDivision);
    setModalLocation(appliedFilterLocation);
    setModalStatus(appliedFilterStatus);
    setIsFilterOpen(true);
  };

  const toggleModalStatus = (status) => {
    if (modalStatus.includes(status)) setModalStatus(modalStatus.filter(s => s !== status));
    else setModalStatus([...modalStatus, status]);
  };

  const resetModalFilters = () => {
    // 1. Reset Modal local states
    setModalUniversity("");
    setModalDivision("");
    setModalLocation("");
    setModalStatus([]);

    // 2. Clear Applied Filters
    setAppliedFilterUniversity("");
    setAppliedFilterDivision("");
    setAppliedFilterLocation("");
    setAppliedFilterStatus([]);

    // 3. Reset Pagination & Close Modal
    setCurrentPage(1);
    setIsFilterOpen(false);
  };

  const applyModalFilters = () => {
    setAppliedFilterUniversity(modalUniversity);
    setAppliedFilterDivision(modalDivision);
    setAppliedFilterLocation(modalLocation);
    setAppliedFilterStatus(modalStatus);
    setCurrentPage(1); // Explicitly reset page
    setIsFilterOpen(false);
  };

  // ---- Custom Select (styled dropdown to match design) ----
  const CustomSelect = ({ value, onChange, options = [], placeholder = "Select" }) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef(null);

    useEffect(() => {
      const handleClickOutside = (event) => {
        if (containerRef.current && !containerRef.current.contains(event.target)) setIsOpen(false);
      };
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const selected = options.find(o => String(o.value) === String(value));

    return (
      <div className="relative w-full" ref={containerRef}>
        <div onClick={() => setIsOpen(!isOpen)} className={`w-full pl-4 pr-3 py-3 rounded-xl border cursor-pointer select-none flex items-center justify-between transition-all duration-150 ${isOpen ? 'border-[#354C8F] ring-2 ring-[#354C8F]/10 bg-white' : 'border-slate-200 bg-white hover:border-slate-300'}`}>
          <div className="flex items-center gap-2 overflow-hidden">
            <span className={`text-sm font-bold truncate ${selected ? 'text-slate-700' : 'text-slate-400'}`}>{selected ? selected.label : placeholder}</span>
          </div>
          <ChevronDown size={16} className={`text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
        </div>

        <AnimatePresence>
          {isOpen && (
            <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 6 }} className="absolute top-full mt-2 left-0 w-full bg-white rounded-xl shadow-xl border border-slate-100 z-50 overflow-auto max-h-56">
              <div className="py-1">
                {options.length === 0 ? (
                  <div className="p-3 text-sm text-slate-400">No options</div>
                ) : (
                  options.map((opt) => (
                    <button key={opt.value} onClick={() => { onChange(opt.value); setIsOpen(false); }} className={`w-full text-left px-4 py-3 text-sm hover:bg-slate-50 transition-colors ${String(opt.value) === String(value) ? 'bg-slate-50 font-bold text-[#203266]' : 'text-slate-600'}`}>
                      {opt.label}
                    </button>
                  ))
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // --- Month Picker Component (copied from History.jsx) ---
  const MonthYearPicker = ({ value, onChange }) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef(null);
    const [year, setYear] = useState(value ? value.getFullYear() : new Date().getFullYear());
    const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

    useEffect(() => {
      const handleClickOutside = (event) => {
        if (containerRef.current && !containerRef.current.contains(event.target)) setIsOpen(false);
      };
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleSelect = (mIndex) => {
      const newDate = new Date(year, mIndex, 1);
      onChange(newDate);
      setIsOpen(false);
    };

    return (
      <div className="relative w-full sm:w-64" ref={containerRef}>
        <div onClick={() => setIsOpen(!isOpen)} className={`w-full pl-12 pr-10 py-2.5 rounded-xl border cursor-pointer select-none flex items-center justify-between transition-all duration-200 ${isOpen ? 'border-[#354C8F] ring-2 ring-[#354C8F]/10 bg-white' : 'border-slate-200 bg-white hover:border-slate-300'}`}>
          <div className="absolute left-4 text-slate-400"><Calendar size={18} className={isOpen ? 'text-[#354C8F]' : ''} /></div>
          <span className={`text-sm font-bold truncate ${value ? 'text-slate-700' : 'text-slate-400'}`}>{value.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }).toUpperCase()}</span>
          <div className="absolute right-4 text-slate-400 flex items-center"><ChevronDown size={16} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} /></div>
        </div>
        <AnimatePresence>
          {isOpen && (
            <motion.div initial={{ opacity: 0, y: 10, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: 0.95 }} className="absolute top-full mt-2 left-0 w-full sm:w-[280px] bg-white rounded-2xl shadow-xl border border-slate-100 z-50 overflow-hidden">
              <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50/50">
                <button onClick={() => setYear(year - 1)} className="p-1.5 hover:bg-slate-200 rounded-lg text-slate-500 transition-colors"><ChevronLeft size={18} /></button>
                <span className="text-base font-extrabold text-[#27345A]">{year}</span>
                <button onClick={() => setYear(year + 1)} className="p-1.5 hover:bg-slate-200 rounded-lg text-slate-500 transition-colors"><ChevronRight size={18} /></button>
              </div>
              <div className="p-3 grid grid-cols-3 gap-2">
                {months.map((m, idx) => {
                  const isSelected = value && value.getMonth() === idx && value.getFullYear() === year;
                  return (
                    <button key={m} onClick={() => handleSelect(idx)} className={`py-2 px-1 text-xs font-bold rounded-lg transition-all ${isSelected ? 'bg-[#354C8F] text-white shadow-md' : 'text-slate-600 hover:bg-indigo-50 hover:text-[#354C8F]'}`}>{m.substring(0, 3)}</button>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  };

  useEffect(() => {
    // Debounce search, applied filters & month changes (filters applied only when Apply clicked)
    setLoading(true); // Seemingly redundant but this catches changes before the 400ms timeout fires
    const t = setTimeout(() => fetchData(), 400);
    return () => clearTimeout(t);
  }, [searchTerm, appliedFilterUniversity, appliedFilterDivision, appliedFilterLocation, appliedFilterStatus, selectedMonth, currentPage, itemsPerPage]);

  // Abort any in-flight fetch when component unmounts to avoid memory leaks / stale updates
  useEffect(() => {
    return () => {
      try {
        if (currentFetchControllerRef?.current) currentFetchControllerRef.current.abort();
      } catch (e) { /* ignore */ }
    };
  }, []);

  // Initial load
  useEffect(() => { 
    // Data is fetched by the debounce effect above on mount due to dependencies, 
    // so we only need to fetch filter options here once
    fetchFilterOptions(); 
  }, []);

  // Fetch filter options when modal opened (ensure fresh data)
  useEffect(() => {
    if (isFilterOpen) fetchFilterOptions();
  }, [isFilterOpen]);

  // Helper: Check if any applied filter is active
  const isFilterActive = appliedFilterUniversity || appliedFilterDivision || appliedFilterLocation || appliedFilterStatus.length > 0;

  // --- HANDLERS ---
  // Fetch detail absensi dari BE saat klik View
  const handleOpenDetail = async (log) => {
    if (viewLoadingId === log.id) return;
    setViewLoadingId(log.id);
    try {
      const res = await axios.get(`/mentor/detail/${log.id.split('-')[0]}/${log.date}`);
      const detail = res.data?.data || {};
      // Use foto paths from the detail response directly (served via authenticated endpoint)
      const fotoMasukPath = detail.foto_masuk ? `absensi/foto-masuk/${detail.foto_masuk.split('/').pop()}` : null;
      const fotoPulangPath = detail.foto_pulang ? `absensi/foto-pulang/${detail.foto_pulang.split('/').pop()}` : null;
      setSelectedLog({
        ...log,
        // Overwrite/extend with detail fields jika ada
        reason: detail.alasan || log.reason,
        hasFile: !!detail.file,
        fileName: detail.file || null,
        location: detail.lokasi || log.location,
        photoUrl: detail.foto || log.photoUrl,
        foto_masuk: fotoMasukPath,
        foto_pulang: fotoPulangPath,
        longitude: detail.longitude_masuk ?? detail.longitude,
        latitude: detail.latitude_masuk ?? detail.latitude,
        longitude_pulang: detail.longitude_pulang,
        latitude_pulang: detail.latitude_pulang,
        jam_masuk: detail.jam_masuk,
        jam_pulang: detail.jam_pulang
      });
    } catch (err) {
      setSelectedLog(log); // fallback
    } finally {
      setViewLoadingId(null);
    }
    setIsDetailOpen(true);
  };

  const handleCloseDetail = () => {
    setIsDetailOpen(false);
    setSelectedLog(null);
  };

  // Centralized page change handler used by pagination controls
  const handlePageChange = (page) => {
    if (!page) return;
    const last = paginationMeta.last_page || totalPages || 1;
    const p = Math.max(1, Math.min(page, last));
    setCurrentPage(p);
  };

  const handlePerPageChange = (event) => {
    const next = Number(event.target.value) || 5;
    setItemsPerPage(next);
    setCurrentPage(1);
  };

  // Delegate to modal handlers so changes won't trigger fetch until Apply clicked
  const toggleStatusFilter = (status) => {
    toggleModalStatus(status);
  };

  const resetFilters = () => {
    // Reset modal filters (kept local until Apply)
    resetModalFilters();
  };

  // Filtering and pagination are handled server-side; `logs` contains current page items.

  // Pagination handled server-side. `logs` contains current page items.
  const currentItems = logs;

  return (
    <div className="w-full ml-2 -mr-4 pb-6 bg-[#F8FAFC] min-h-screen font-sans text-slate-800 -mt-1">

      {/* 1. Page Header */}
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-[#203266] mb-2">Time & Attendance Records</h2>
        <p className="text-slate-500 text-sm -mt-1">Comprehensive view of student punctuality and real-time attendance tracking.</p>
      </div>

      {/* 2. Action Bar (Search & Filter) */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div className="flex flex-row gap-3 w-full md:w-auto">

          {/* Search Input */}
          <div className="relative flex-1 md:w-80">
            <input
              type="text"
              placeholder="Search Intern"
              className="w-full pl-10 pr-4 py-3.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#354C8F]/20 text-sm shadow-sm transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <Search className="absolute left-3 top-3.5 text-slate-400" size={18} />
          </div>

          {/* Filter Button */}
          <button
            onClick={handleOpenFilter}
            className={`${btnPrimaryClass} !px-6 relative shrink-0`}
          >
            <Filter size={18} />
            <span className="hidden md:inline">Filter</span>

            {/* Red Dot Indicator */}
            {isFilterActive && (
              <div className="absolute top-3 right-3 md:top-2 md:right-2 w-2.5 h-2.5 bg-red-400 rounded-full border-2 border-[#354C8F]"></div>
            )}
          </button>
        </div>
      </div>

      {/* 3. Table Card */}
      <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-4 sm:p-6 border-b border-slate-100 flex flex-row justify-between items-center gap-3">
          <div className="shrink-0">
            <MonthYearPicker value={selectedMonth} onChange={setSelectedMonth} />
          </div>
          {/* <div className="flex gap-2 shrink-0">
            <button onClick={() => setSelectedMonth(new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() - 1, 1))} className="p-2 sm:p-2.5 hover:bg-slate-50 border border-slate-200 rounded-xl text-slate-500 hover:text-[#27345A] transition-colors">
              <ChevronLeft size={18} className="sm:w-[20px] sm:h-[20px]" />
            </button>
            <button onClick={() => setSelectedMonth(new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() + 1, 1))} className="p-2 sm:p-2.5 hover:bg-slate-50 border border-slate-200 rounded-xl text-slate-500 hover:text-[#27345A] transition-colors">
              <ChevronRight size={18} className="sm:w-[20px] sm:h-[20px]" />
            </button>
          </div> */}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead>
              <tr className="text-sm font-bold text-slate-900 border-b border-slate-100 bg-slate-50/30">
                <th className="p-3 w-16 text-center">No</th>
                <th className="p-3 min-w-[200px]">Name</th>
                                <th className="p-3">Date</th>
        <th className="p-3 text-center">In</th>
                <th className="p-3 text-center">Out</th>
                <th className="p-3">Job Position</th>
                <th className="p-3">Division</th>
                <th className="p-3">Institution</th>
        
                <th className="p-3 text-center">Status</th>
                <th className="p-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="text-sm text-slate-600">
              {loading ? (
                <tr>
                  <td colSpan="10" className="p-12 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                       <Loader2 className="animate-spin text-[#354C8F] mb-2" size={32} />
                      <p>Loading logs...</p>
                    </div>
                  </td>
                </tr>
              ) : currentItems.length > 0 ? (
                currentItems.map((item, index) => (
                  <tr key={item.id} className="hover:bg-slate-50 transition-colors border-b border-slate-50 last:border-none">
                    <td className="p-3 font-medium text-slate-800 text-center">
                      {(showingFrom ? showingFrom + index : ((currentPage - 1) * itemsPerPage + index + 1))}
                    </td>
                    <td className="p-3 font-medium text-slate-800 whitespace-nowrap">
                      {item.name}
                    </td>
                                        <td className="p-3 whitespace-nowrap">{item.dateDisplay || item.date}</td>

                <td className="p-3 text-center">{item.inTime}</td>
                    <td className="p-3 text-center">{item.outTime}</td>
                    <td className="p-3">{item.jobPosition}</td>
                    <td className="p-3 whitespace-nowrap">{item.division}</td>
                    <td className="p-3 whitespace-nowrap">{item.university}</td>
                  

                    {/* Status Column (1 Baris) */}
                    <td className="p-3 text-center">
                      <StatusBadge status={item.status} />
                    </td>

                    {/* Action Column (View Button) */}
                    <td className="p-3 text-center">
                      <button
                        onClick={() => handleOpenDetail(item)}
                        disabled={viewLoadingId === item.id}
                        className="inline-flex items-center justify-center h-[34px] w-[34px] bg-[#354C8F] text-white rounded-lg hover:bg-[#2a3c70] transition-colors shadow-sm shadow-indigo-100 active:scale-95 group relative disabled:opacity-70 disabled:cursor-wait"
                        title="View Details"
                      >
                        {viewLoadingId === item.id ? (
                          <Loader2 size={16} className="animate-spin" />
                        ) : (
                          <Eye size={16} className="group-hover:scale-110 transition-transform" />
                        )}
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="10" className="p-12 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <p>No records found matching your criteria.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* PAGINATION */}
        {totalEntries > 0 && (
          <div className="flex flex-col md:flex-row justify-between items-center p-5 border-t border-slate-100 text-sm text-slate-500 gap-4">

            {/* Teks Info: Di Mobile Pindah ke Bawah (order-2) */}
            <p className="order-2 md:order-1">Showing {paginationMeta.from} to {paginationMeta.to} of {paginationMeta.total} entries</p>
            <div className="flex items-center gap-4 order-1 md:order-2">
              <div className="flex items-center gap-2">
                <label className="text-xs md:text-sm font-medium text-slate-600">Per page:</label>
                <select
                  value={itemsPerPage}
                  onChange={handlePerPageChange}
                  disabled={loading}
                  title={loading ? 'Loading...' : 'Items per page'}
                  className={`px-2 py-1.5 rounded-lg border border-slate-200 text-xs md:text-sm font-medium text-slate-700 bg-white hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#354C8F]/20 cursor-pointer transition-all ${loading ? 'opacity-70 cursor-wait' : ''}`}
                >
                  <option value={5}>5</option>
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                </select>
              </div>

              {/* Tombol Previous */}
              <button
                disabled={currentPage === 1}
                onClick={() => handlePageChange(currentPage - 1)}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50 border border-slate-200 disabled:cursor-not-allowed shrink-0"
              >
                <ChevronLeft size={18} />
              </button>

              {/* Logic Angka */}
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
                  // Render Titik-titik (...)
                  if (p === 'left-ellipsis' || p === 'right-ellipsis') {
                    return (
                      <div key={`${p}-${idx}`} className="w-8 h-8 flex items-center justify-center rounded-lg text-xs font-bold text-slate-400 shrink-0">
                        ...
                      </div>
                    );
                  }

                  // Render Angka
                  return (
                    <button
                      key={p}
                      onClick={() => handlePageChange(p)}
                      className={`w-8 h-8 flex items-center justify-center rounded-lg text-xs font-bold transition-colors shrink-0 
                ${pageCurrent === p
                          ? "bg-slate-100 text-[#27345A] border border-slate-200"
                          : "text-slate-500 hover:bg-slate-50 border border-transparent"
                        }`}
                    >
                      {p}
                    </button>
                  );
                });
              })()}

              {/* Tombol Next */}
              <button
                disabled={currentPage === paginationMeta.last_page}
                onClick={() => handlePageChange(currentPage + 1)}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50 border border-slate-200 disabled:cursor-not-allowed shrink-0"
              >
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* --- MODAL: FILTER --- */}
      {isFilterOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">

            {/* Header */}
            <div className="flex justify-between items-center px-6 py-5 border-b border-slate-100">
              <h3 className="text-[18px] font-bold text-[#203266] flex items-center gap-2">
                <span>Attendance Logs Filter</span>
                {filterOptionsLoading && <Loader2 size={16} className="text-slate-400 animate-spin" />}
              </h3>
              <button onClick={() => setIsFilterOpen(false)} className="text-slate-400 hover:text-slate-600 p-1 transition-colors">
                <X size={24} />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-6 overflow-y-auto">

              {/* University */}
              <div>
                <label className="block text-[14px] font-bold text-slate-700 mb-2">Institution</label>
                <CustomSelect
                  value={modalUniversity}
                  onChange={setModalUniversity}
                  options={(filterOptions?.universities || []).map(u => ({ value: u, label: u }))}
                  placeholder="All Universities"
                />
              </div>

              {/* Division */}
              <div>
                <label className="block text-[14px] font-bold text-slate-700 mb-2">Division</label>
                <CustomSelect
                  value={modalDivision}
                  onChange={setModalDivision}
                  options={(filterOptions?.divisions || []).map(d => ({ value: d, label: d }))}
                  placeholder="All Divisions"
                />
              </div>

              {/* Office Location */}
              <div>
                <label className="block text-[14px] font-bold text-slate-700 mb-2">Site</label>
                <CustomSelect
                  value={modalLocation}
                  onChange={setModalLocation}
                  options={(filterOptions?.sites || []).map(s => ({ value: s.id_site ?? s.nama_site ?? s.name, label: s.nama_site ?? s.nama ?? s.name }))}
                  placeholder="All Sites"
                />
              </div>

              {/* Attendance Status */}
              <div>
                <label className="block text-[14px] font-bold text-slate-700 mb-2">Attendance Status</label>
                <div className="flex flex-wrap gap-2">
                  {['On Time', 'Late', 'Absent', 'Sick', 'On Leave', 'Early Out'].map(status => (
                    <button
                      key={status}
                      onClick={() => toggleModalStatus(status)}
                      className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all border ${modalStatus.includes(status)
                        ? 'bg-[#354C8F] text-white border-[#354C8F] shadow-md'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                    >
                      {status}
                    </button>
                  ))}
                </div>
              </div>

            </div>

            {/* Footer */}
            <div className="p-6 border-t border-slate-100 flex justify-end gap-3 bg-slate-50">
              <button
                onClick={resetModalFilters}
                className={btnSecondaryClass}
              >
                Reset
              </button>
              <button
                onClick={applyModalFilters}
                className={btnPrimaryClass}
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL: DETAIL (VIEW) --- */}
      {isDetailOpen && selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-3xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">

            <div className="flex justify-between items-center px-8 py-5 border-b border-slate-100 shrink-0">
              <h3 className="text-[18px] font-bold text-[#203266]">Status Detail - {selectedLog.dateDisplay || selectedLog.date}</h3>
              <button onClick={handleCloseDetail} className="text-slate-400 hover:text-slate-600 p-1 transition-colors">
                <X size={24} />
              </button>
            </div>

            <div className="p-8 overflow-y-auto -mt-4">

              <div className="mb-6">
                <p className="text-[14px] font-bold text-slate-900 mb-2">Attendance Status</p>
                <div className="inline-block">
                  <StatusBadge status={selectedLog.status} />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                {/* Live Photo */}
                <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
                  <p className="text-[14px] font-bold text-slate-900 mb-3">Live Photo</p>
                  <div className="space-y-4">
                    {/* Clock In Photo */}
                    <div>
                      <p className="text-xs font-semibold text-slate-700 mb-1 text-center">Clock In</p>
                      <div className="aspect-video w-full bg-slate-100 rounded-lg overflow-hidden flex items-center justify-center border border-slate-100 relative group">
                        <SecureImage src={selectedLog.foto_masuk} alt="Clock In Photo" className="w-full h-full object-cover" />
                      </div>
                      {selectedLog.foto_masuk && selectedLog.jam_masuk && (
                        <p className="text-xs text-slate-500 mt-2 text-center">Captured at: {selectedLog.jam_masuk}</p>
                      )}
                    </div>
                    {/* Clock Out Photo */}
                    <div>
                      <p className="text-xs font-semibold text-slate-700 mb-1 text-center">Clock Out</p>
                      <div className="aspect-video w-full bg-slate-100 rounded-lg overflow-hidden flex items-center justify-center border border-slate-100 relative group">
                        <SecureImage src={selectedLog.foto_pulang} alt="Clock Out Photo" className="w-full h-full object-cover" />
                      </div>
                      {selectedLog.foto_pulang && selectedLog.jam_pulang && (
                        <p className="text-xs text-slate-500 mt-2 text-center">Captured at: {selectedLog.jam_pulang}</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Location */}
                <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
                  <p className="text-[14px] font-bold text-slate-900 mb-3">Location</p>
                  <div className="space-y-4">
                    {/* Clock In Map */}
                    {(selectedLog.longitude && selectedLog.latitude) && (
                      <div>
                        <p className="text-xs font-semibold text-slate-700 mb-1 text-center">Clock In</p>
                        {/* {selectedLog.jam_masuk && (
                          <p className="text-xs text-slate-500 text-center mb-1">Time: {selectedLog.jam_masuk}</p>
                        )} */}
                        <div className="aspect-video w-full bg-slate-100 rounded-lg overflow-hidden flex items-center justify-center relative border border-slate-100" style={{ minHeight: '160px' }}>
                          <div className="absolute inset-0 bg-slate-100 opacity-50"></div>
                          <div className="absolute inset-0 w-full h-full">
                            <MapContainer
                              center={[parseFloat(selectedLog.latitude), parseFloat(selectedLog.longitude)]}
                              zoom={17}
                              style={{ height: '100%', width: '100%', zIndex: 1 }}
                              scrollWheelZoom={false}
                              dragging={false}
                              doubleClickZoom={false}
                              zoomControl={false}
                              attributionControl={false}
                            >
                              <TileLayer
                                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                              />
                              <Marker position={[parseFloat(selectedLog.latitude), parseFloat(selectedLog.longitude)]}>
                                <Popup>
                                  {selectedLog.name}<br />{selectedLog.dateDisplay || selectedLog.date}<br />Clock In
                                </Popup>
                              </Marker>
                            </MapContainer>
                          </div>
                        </div>
                        <p className="text-xs text-slate-500 text-center mt-1">Long: {selectedLog.longitude}, Lat: {selectedLog.latitude}</p>
                      </div>
                    )}
                    {/* Clock Out Map */}
                    {(selectedLog.longitude_pulang && selectedLog.latitude_pulang) && (
                      <div>
                        <p className="text-xs font-semibold text-slate-700 mb-1 text-center">Clock Out</p>
                        {/* {selectedLog.jam_pulang && (
                          <p className="text-xs text-slate-500 text-center mb-1">Time: {selectedLog.jam_pulang}</p>
                        )} */}
                        <div className="aspect-video w-full bg-slate-100 rounded-lg overflow-hidden flex items-center justify-center relative border border-slate-100" style={{ minHeight: '160px' }}>
                          <div className="absolute inset-0 bg-slate-100 opacity-50"></div>
                          <div className="absolute inset-0 w-full h-full">
                            <MapContainer
                              center={[parseFloat(selectedLog.latitude_pulang), parseFloat(selectedLog.longitude_pulang)]}
                              zoom={17}
                              style={{ height: '100%', width: '100%', zIndex: 1 }}
                              scrollWheelZoom={false}
                              dragging={false}
                              doubleClickZoom={false}
                              zoomControl={false}
                              attributionControl={false}
                            >
                              <TileLayer
                                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                              />
                              <Marker position={[parseFloat(selectedLog.latitude_pulang), parseFloat(selectedLog.longitude_pulang)]}>
                                <Popup>
                                  {selectedLog.name}<br />{selectedLog.dateDisplay || selectedLog.date}<br />Clock Out
                                </Popup>
                              </Marker>
                            </MapContainer>
                          </div>
                        </div>
                        <p className="text-xs text-slate-500 text-center mt-1">Long: {selectedLog.longitude_pulang}, Lat: {selectedLog.latitude_pulang}</p>
                      </div>
                    )}
                    {/* Jika tidak ada dua-duanya */}
                    {!(selectedLog.longitude && selectedLog.latitude) && !(selectedLog.longitude_pulang && selectedLog.latitude_pulang) && (
                      <div className="aspect-video w-full bg-slate-100 rounded-lg overflow-hidden flex items-center justify-center relative border border-slate-100 min-h-[160px]">
                        <p className="text-sm font-semibold text-slate-400 relative z-10">No data</p>
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 text-center mt-2">{selectedLog.location || '-'}</p>
                </div>
              </div>

              {/* Attached Output */}
              <div className="mb-6">
                <p className="text-[14px] font-bold text-slate-900 mb-2">Attached Output</p>
                <div className="border border-slate-200 rounded-xl p-4 flex items-center bg-white shadow-sm min-h-[80px]">
                  {selectedLog.hasFile ? (
                    <div className="flex items-center gap-4 w-full group cursor-pointer hover:bg-slate-50 p-2 -m-2 rounded-lg transition-colors">
                      <div className="w-10 h-10 rounded-lg bg-red-100 text-red-500 flex items-center justify-center shrink-0">
                        <FileText size={20} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-slate-800 truncate">{selectedLog.fileName || 'Document.pdf'}</p>
                        <p className="text-xs text-slate-400">234 KB</p>
                      </div>
                      <button className="p-2 text-slate-400 hover:text-[#354C8F] transition-colors">
                        <Download size={20} />
                      </button>
                    </div>
                  ) : (
                    <p className="text-sm text-slate-400 w-full text-center font-medium">No attached document</p>
                  )}
                </div>
              </div>

              {/* Reason */}
              <div>
                <p className="text-[14px] font-bold text-slate-900 mb-2">Reason</p>
                <div className="border border-slate-200 rounded-xl p-4 bg-slate-50 min-h-[80px] flex items-center">
                  {selectedLog.reason && selectedLog.reason !== '-' ? (
                    <p className="text-sm text-slate-700 leading-relaxed w-full">{selectedLog.reason}</p>
                  ) : (
                    <p className="text-sm text-slate-400 w-full text-center font-medium">No reason provided</p>
                  )}
                </div>
              </div>

            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default MentorAttendanceLogs;