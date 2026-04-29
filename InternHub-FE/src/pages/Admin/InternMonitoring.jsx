import React, { useState, useEffect, useRef } from 'react';
import {
    Search,
    Filter,
    X,
    Eye,
    ChevronDown,
    Calendar,
    ChevronLeft,
    ChevronRight,
    Check,
    Loader2,
    Clock
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import apiClient from '../../api/axiosConfig';
import { fetchSecureBlob } from '../../utils/secureFetch';

// --- STYLES CONSTANTS (Agar Konsisten) ---
const btnPrimaryClass =
    "bg-[#354C8F] hover:bg-[#1F2B4D] text-white py-3.5 px-6 rounded-xl active:scale-95 transition-all font-bold text-sm shadow-md shadow-indigo-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed";
const btnSecondaryClass =
    "bg-white border border-slate-300 text-slate-700 py-3.5 px-6 rounded-xl active:scale-95 transition-all font-bold text-sm flex items-center justify-center gap-2 hover:bg-slate-50";
const textDarkBlue = "text-[#203266]";

// --- SECURE IMAGE COMPONENT ---
const SecureImage = ({ src, alt, className, onClick }) => {
    const [imgUrl, setImgUrl] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!src) {
            setImgUrl(null);
            setLoading(false);
            return;
        }

        let active = true;
        setLoading(true);

        if (src.startsWith('data:') || src.startsWith('blob:')) {
            setImgUrl(src);
            setLoading(false);
            return;
        }

        fetchSecureBlob(src)
            .then(blobUrl => {
                if (active) setImgUrl(blobUrl);
            })
            .finally(() => {
                if (active) setLoading(false);
            });

        return () => {
            active = false;
            if (imgUrl && !src.startsWith('data:') && !src.startsWith('blob:')) {
                URL.revokeObjectURL(imgUrl);
            }
        };
    }, [src]);

    if (loading) return <div className={`bg-slate-100 animate-pulse ${className}`} />;
    if (!imgUrl) return null;

    return <img src={imgUrl} alt={alt} className={className} onClick={onClick} />;
};

// --- COMPONENT: CUSTOM MONTH YEAR PICKER ---
const MonthYearPicker = ({ value, onChange, placeholder }) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef(null);

    // State internal untuk navigasi tahun di dropdown
    const [viewYear, setViewYear] = useState(value ? value.getFullYear() : new Date().getFullYear());

    const months = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
    ];

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (containerRef.current && !containerRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleMonthSelect = (monthIndex) => {
        const newDate = new Date(viewYear, monthIndex, 1);
        onChange(newDate);
        setIsOpen(false);
    };

    const displayValue = value
        ? value.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }).toUpperCase()
        : placeholder;

    return (
        <div className="relative w-full sm:w-64" ref={containerRef}>
            {/* Trigger Button (Input Lookalike) - Height py-3.5 matched */}
            <div
                onClick={() => setIsOpen(!isOpen)}
                className={`w-full pl-12 pr-4 py-3.5 rounded-xl border cursor-pointer select-none flex items-center justify-between transition-all duration-200 ${isOpen ? 'border-[#354C8F] ring-2 ring-[#354C8F]/10 bg-white' : 'border-slate-200 bg-white hover:border-slate-300'}`}
            >
                <div className="absolute left-4 text-slate-400">
                    <Calendar size={18} className={isOpen ? 'text-[#354C8F]' : ''} />
                </div>
                <span className={`text-sm font-bold truncate ${value ? 'text-slate-700' : 'text-slate-400'}`}>
                    {displayValue}
                </span>
                <ChevronDown size={16} className={`text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </div>

            {/* Dropdown Panel */}
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        className="absolute top-full mt-2 left-0 w-full min-w-[280px] bg-white rounded-2xl shadow-xl border border-slate-100 z-50 overflow-hidden"
                    >
                        {/* Header: Year Navigation */}
                        <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50/50">
                            <button onClick={() => setViewYear(viewYear - 1)} className="p-1.5 hover:bg-slate-200 rounded-lg text-slate-500 transition-colors"><ChevronLeft size={18} /></button>
                            <span className="text-base font-extrabold text-[#27345A]">{viewYear}</span>
                            <button onClick={() => setViewYear(viewYear + 1)} className="p-1.5 hover:bg-slate-200 rounded-lg text-slate-500 transition-colors"><ChevronRight size={18} /></button>
                        </div>

                        {/* Body: Months Grid */}
                        <div className="p-3 grid grid-cols-3 gap-2">
                            {months.map((m, idx) => {
                                const isSelected = value && value.getMonth() === idx && value.getFullYear() === viewYear;
                                return (
                                    <button
                                        key={m}
                                        onClick={() => handleMonthSelect(idx)}
                                        className={`py-2 px-1 text-xs font-bold rounded-lg transition-all ${isSelected ? 'bg-[#354C8F] text-white shadow-md' : 'text-slate-600 hover:bg-indigo-50 hover:text-[#354C8F]'}`}
                                    >
                                        {m.substring(0, 3)}
                                    </button>
                                );
                            })}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

// --- COMPONENT: PROGRESS BAR ---
const ProgressBar = ({ percentage }) => {
    const raw = typeof percentage === 'object' ? (percentage?.percent_submitted ?? percentage?.percent ?? percentage?.percentSubmitted) : percentage;
    const pct = Number(raw);
    const clamped = isNaN(pct) ? 0 : Math.max(0, Math.min(100, pct));

    let bgColor = "bg-green-500"; // Green
    if (clamped < 50) bgColor = "bg-red-500"; // Red
    else if (clamped < 80) bgColor = "bg-yellow-500"; // Yellow

    return (
        <div className="flex items-center gap-2 w-full">
            <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
                <div className={`h-full ${bgColor} transition-all duration-300`} style={{ width: `${clamped}%` }}></div>
            </div>
            <span className="text-xs font-bold text-slate-600 whitespace-nowrap">{Math.round(clamped)}%</span>
        </div>
    );
};

// --- COMPONENT: CIRCULAR PROGRESS ---
const CircularProgress = ({ percentage }) => {
    const radius = 18;
    const circumference = 2 * Math.PI * radius;

    // Defensive parsing: accept objects or strings from API
    const raw = typeof percentage === 'object' ? (percentage?.percent_submitted ?? percentage?.percent ?? percentage?.percentSubmitted) : percentage;
    const pct = Number(raw);
    const clamped = isNaN(pct) ? 0 : Math.max(0, Math.min(100, pct));

    const strokeDashoffset = circumference - (clamped / 100) * circumference;

    let color = "#22C55E"; // Green
    if (clamped < 50) color = "#EF4444"; // Red
    else if (clamped < 80) color = "#EAB308"; // Yellow

    return (
        <div className="relative flex items-center justify-center w-12 h-12">
            <svg className="transform -rotate-90 w-full h-full">
                <circle cx="24" cy="24" r={radius} stroke="#E2E8F0" strokeWidth="4" fill="transparent" />
                <circle
                    cx="24" cy="24" r={radius} stroke={color} strokeWidth="4" fill="transparent"
                    strokeDasharray={circumference} strokeDashoffset={strokeDashoffset} strokeLinecap="round"
                />
            </svg>
            <span className="absolute text-[10px] font-bold text-slate-700">{Math.round(clamped)}%</span>
        </div>
    );
};

// --- CUSTOM: SELECT (reused from Logs.jsx) ---
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
};

const InternMonitoring = () => {
    // --- STATES ---
    // 1. Filter Period (Using Date Objects now)
    const today = new Date();
    const currentMonth = today.getMonth(); // 0-11
    const currentYear = today.getFullYear();
    
    // Period logic: Jan-Jun (0-5) or Jul-Dec (6-11)
    let defaultStart, defaultEnd;
    if (currentMonth < 6) {
        defaultStart = new Date(currentYear, 0, 1); // Jan 1st
        defaultEnd = new Date(currentYear, 5, 30);  // Jun 30th
    } else {
        defaultStart = new Date(currentYear, 6, 1);  // Jul 1st
        defaultEnd = new Date(currentYear, 11, 31); // Dec 31st
    }

    const [startDate, setStartDate] = useState(defaultStart);
    const [endDate, setEndDate] = useState(defaultEnd);
    const [searchTerm, setSearchTerm] = useState("");

    // 2. Modal States
    const [isFilterOpen, setIsFilterOpen] = useState(false);

    // 3. Filter Criteria (Inside Modal)
    const [filterUniversity, setFilterUniversity] = useState("All");
    // const [filterStatus, setFilterStatus] = useState([]); // REMOVED: Attendance Status Filter State
    const [filterProgress, setFilterProgress] = useState(null);

    // Server-side pagination states
    const [displayInterns, setDisplayInterns] = useState([]);
    const [loading, setLoading] = useState(true);

    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalEntries, setTotalEntries] = useState(0);
    const [showingFrom, setShowingFrom] = useState(0);
    const [showingTo, setShowingTo] = useState(0);
    const [itemsPerPage, setItemsPerPage] = useState(10);

    const [availUni, setAvailUni] = useState([]);

    // Guard refs to avoid duplicate/overlapping requests
    const initialFetched = useRef(false);
    const inFlightKey = useRef(null);
    const abortControllerRef = useRef(null);
    const dateChangedByUser = useRef(false);

    // Modal-local filter state (don't apply until user clicks Apply)
    const [modalUniversity, setModalUniversity] = useState("All");
    const [modalProgress, setModalProgress] = useState(null);
    const [modalStatus, setModalStatus] = useState("All");

    // Applied filter states
    const [filterStatus, setFilterStatus] = useState("All");

    const handleOpenFilter = () => {
        setModalUniversity(filterUniversity);
        setModalProgress(filterProgress);
        setModalStatus(filterStatus);
        setIsFilterOpen(true);
    };

    const resetModalFilters = () => {
        setModalUniversity("All");
        setModalProgress(null);
        setModalStatus("All");
    };

    const applyModalFilters = () => {
        setFilterUniversity(modalUniversity);
        setFilterProgress(modalProgress);
        setFilterStatus(modalStatus);
        setIsFilterOpen(false);
        // pass overrides so fetch uses the just-selected modal values immediately
        fetchInterns(1, { university: modalUniversity, progress: modalProgress, status: modalStatus === 'All' ? null : modalStatus });
    };

    // Fetch interns (server-side, paginated) with dedupe + abort
    // Accept `overrides` so callers (e.g., modal Apply) can pass filters immediately
    const fetchInterns = async (page = 1, overrides = {}) => {
        const startStr = startDate ? `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}` : null;
        const endStr = endDate ? `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, '0')}` : null;

        const universityVal = overrides.university !== undefined ? overrides.university : filterUniversity;
        const progressVal = overrides.progress !== undefined ? overrides.progress : filterProgress;
        const statusVal = overrides.status !== undefined ? overrides.status : filterStatus;

        const key = JSON.stringify({ page, startStr, endStr, q: searchTerm, university: universityVal, progress: progressVal, status: statusVal, per_page: itemsPerPage });

        // Prevent issuing the same request if it's already in-flight
        if (inFlightKey.current === key) return;

        // Abort previous request if any (we prefer latest params)
        if (abortControllerRef.current) {
            try { abortControllerRef.current.abort(); } catch (e) { /* ignore */ }
            abortControllerRef.current = null;
            inFlightKey.current = null;
        }

        inFlightKey.current = key;
        const controller = new AbortController();
        abortControllerRef.current = controller;

        setLoading(true);
        try {
            const params = { include_progress: 1, page, per_page: itemsPerPage, as_role: 'admin' };
            if (startStr) params.start_date = startStr;
            if (endStr) params.end_date = endStr;
            if (searchTerm) params.search = searchTerm;
            if (universityVal && universityVal !== 'All') params.universitas = universityVal;
            // Status here refers to account status (active/inactive). Send as `status` param lowercased.
            if (statusVal && statusVal !== 'All') {
                const statusParam = typeof statusVal === 'string' ? statusVal.toLowerCase() : statusVal;
                params.status = statusParam;
            }
            if (progressVal) {
                if (progressVal === "< 50%") params.max_progress = 49;
                else if (progressVal === "50 - 80 %") { params.min_progress = 50; params.max_progress = 80; }
                else if (progressVal === "> 80%") params.min_progress = 81;
            }

            // Use admin endpoint to fetch all interns for admin view
            const res = await apiClient.get('/admin/interns', { params, signal: controller.signal });

            // normalize response shapes
            let list = [];
            let meta = {};
            if (res.data?.data) {
                const payload = res.data.data;
                if (Array.isArray(payload)) {
                    list = payload;
                    meta = res.data?.meta || {};
                } else if (typeof payload === 'object') {
                    list = Array.isArray(payload.data) ? payload.data : [];
                    meta = payload;
                }
            } else {
                list = res.data || [];
                meta = res.data?.meta || {};
            }

            const mapped = list.map((i) => {
                const resolvedId = i.id_mahasiswa ?? i.user_id ?? i.id ?? i._id ?? i.user?.id ?? i.user?.user_id ?? i.user?._id ?? null;
                return {
                    id: resolvedId,
                    name: i.nama_lengkap || i.name || i.nama || '-',
                    university: i.universitas || i.university || i.instansi || '-',
                    major: i.jurusan || i.major || i.program_studi || '-',
                    progressDetails: i.progress || null,
                    progress: (typeof i.progress === 'number') ? i.progress : (i.progress?.percent_submitted ?? i.progress?.percent ?? i.progress?.percentSubmitted ?? 0),
                    // Map verified and expected workdays from progress when available
                    verifiedLogbook: i.progress?.verified ?? i.verified_logbook ?? i.logbook_verified ?? 0,
                    expectedWorkdays: i.progress?.expected_workdays ?? i.total_logbook ?? i.logbook_count ?? 0,
                    date: i.mulai_magang ? new Date(i.mulai_magang) : (i.start_date ? new Date(i.start_date) : (i.date ? new Date(i.date) : new Date())),
                    endDate: i.akhir_magang ? new Date(i.akhir_magang) : (i.end_date ? new Date(i.end_date) : null),
                    profileImage: (i.id_mahasiswa && (i.foto || i.user?.foto || i.profile_image || i.avatar)) 
                        ? `/mahasiswa/${i.id_mahasiswa}/foto` 
                        : null,
                    siteName: i.site?.nama_site || i.site?.name || null,
                    // Normalize account status (active/inactive/etc.) and boolean for convenience
                    status: (i.status || i.user?.status || 'active'),
                    isActive: String(i.status || i.user?.status || 'active').toLowerCase() === 'active'
                };
            });

            setDisplayInterns(mapped);
            setCurrentPage(meta.current_page || page);
            setTotalPages(meta.last_page || Math.max(1, Math.ceil((meta.total || mapped.length) / itemsPerPage)));
            setTotalEntries(meta.total || mapped.length);
            setShowingFrom(meta.from || (mapped.length ? (page - 1) * itemsPerPage + 1 : 0));
            setShowingTo(meta.to || (meta.to ? meta.to : ((page - 1) * itemsPerPage + mapped.length)));
        } catch (err) {
            // Ignore abort-related errors
            const isAbort = err && (err.name === 'CanceledError' || err.message === 'canceled' || err === 'canceled');
            if (!isAbort) console.error('Failed to fetch interns', err);
            setDisplayInterns([]);
            setTotalEntries(0);
            setTotalPages(1);
            setShowingFrom(0);
            setShowingTo(0);
        } finally {
            inFlightKey.current = null;
            abortControllerRef.current = null;
            setLoading(false);
        }
    };

    const isFirstRender = useRef(true);

    useEffect(() => {
        if (isFirstRender.current) {
            isFirstRender.current = false;
            fetchInterns(1);
            return;
        }
        
        // Debounce subsequent filter changes
        const t = setTimeout(() => fetchInterns(1), 400);
        return () => clearTimeout(t);
    }, [startDate, endDate, searchTerm, itemsPerPage]);

    const handlePageChange = (page) => {
        if (page >= 1 && page <= totalPages) {
            fetchInterns(page);
        }
    };

    // Navigation to detail page
    const navigate = useNavigate();
    const goToDetail = (item) => {
        navigate(`/admin/interns/${item.id}`, { state: { intern: item } });
    };

    // Wrapper for view button (kept separate for future modal support)
    const handleOpenDetail = (item) => {
        goToDetail(item);
    };

    // --- LOGIC FILTERING ---
    /* REMOVED: toggleStatusFilter
    const toggleStatusFilter = (status) => {
        if (filterStatus.includes(status)) {
            setFilterStatus(filterStatus.filter(s => s !== status));
        } else {
            setFilterStatus([...filterStatus, status]);
        }
    };
    */

    const fetchFilterUniversities = async () => {
        try {
            // Admin endpoint for universities
            const res = await apiClient.get('/admin/universitas');
            // robustly accept res.data.data or res.data
            const payload = res.data?.data || res.data || [];
            setAvailUni(Array.isArray(payload) ? payload : []);
        } catch (err) {
            console.error('Failed to fetch universities', err);
            setAvailUni([]);
        }
    };

    // Fetch universities when modal opens — but only if we don't already have them
    useEffect(() => {
        if (isFilterOpen && (!availUni || availUni.length === 0)) {
            fetchFilterUniversities();
        }
    }, [isFilterOpen, availUni]);


    // Filtering moved to server-side (handled by fetchInterns)

    const formatPeriodDate = (date) => {
        if (!date) return '-';
        // Use English short month names (e.g., "07 Feb 2026")
        return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    };

    const resetModalFilter = () => {
        setFilterUniversity("All");
        setFilterProgress(null);
        setFilterStatus("All");
        // call fetch with overrides so it uses the reset values immediately
        fetchInterns(1, { university: 'All', progress: null, status: null });
    };

    return (
        <div className="pt-8 pb-8 pl-2 w-full bg-slate-50 min-h-screen font-sans text-slate-800 -mt-8">

            {/* 1. Page Title */}
            <div className="mb-8 mt-4 md:mt-0">
                <h2 className="text-2xl md:text-3xl font-bold text-[#203266] mb-1 md:mb-2">Intern Monitoring</h2>
                <p className="text-slate-500 text-xs md:text-sm">Monitor your intern progress</p>
            </div>

            {/* 2. FILTER & ACTION BAR */}
            <div className="flex flex-col xl:flex-row gap-4 mb-6 items-start xl:items-end">

                {/* SECTION 1: PERIOD (Stack di Mobile, Row di Desktop) */}
                <div className="w-full xl:w-auto -mt-4">
                    <h3 className={`text-sm font-bold ${textDarkBlue} mb-2`}>
                        Period Internship
                    </h3>
                    <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
                        <MonthYearPicker
                            value={startDate}
                            onChange={setStartDate}
                            placeholder="Start Period"
                        />
                        <span className="hidden sm:block text-slate-400 font-bold px-1">-</span>
                        <MonthYearPicker
                            value={endDate}
                            onChange={setEndDate}
                            placeholder="End Period"
                        />
                    </div>
                </div>

                {/* SECTION 2: SEARCH & FILTER (Sejajar di Mobile) */}
                <div className="flex flex-row gap-3 w-full xl:w-auto xl:flex-1 items-center">

                    {/* Search Input (Expand) */}
                    <div className="relative flex-1">
                        <input
                            type="text"
                            placeholder="Search by name.."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-9 md:pl-10 pr-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#354C8F]/20 text-sm shadow-sm transition-all"
                        />
                        <Search className="absolute left-3 top-3.5 text-slate-400" size={18} />
                    </div>

                    {/* Filter Button (Icon Only di Mobile, Full Text di Desktop) */}
                    <div className="shrink-0">
                        <button
                            onClick={handleOpenFilter}
                            className={`${btnPrimaryClass} !px-0 sm:!px-6 w-[3.25rem] sm:w-auto`} // Fixed width di mobile agar kotak
                            aria-label="Filter"
                        >
                            <Filter size={18} />
                            <span className="hidden sm:inline">Filter</span>

                            {/* Indicator Red Dot (Updated logic) */}
                            {(filterUniversity !== "All" || filterProgress || filterStatus !== "All") && (
                                <div className="absolute top-3 right-3 sm:static sm:top-auto sm:right-auto w-2 h-2 bg-red-400 rounded-full animate-pulse border border-white sm:border-none"></div>
                            )}
                        </button>
                    </div>
                </div>

            </div>

            {/* 3. Table Section */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="text-xs font-bold text-slate-900 border-b border-slate-100 bg-slate-50/50">
                                <th className="p-4 w-12 text-center">No</th>
                                <th className="p-4">Intern Name</th>
                                <th className="p-4">Institution</th>
                                <th className="p-4">Major</th>
                                <th className="p-4">Logbook Progress</th>
                                <th className="p-4 text-center">Verified Logbook</th>
                                <th className="p-4">Internship Period</th>
                                <th className="p-4 text-center">Action</th>
                            </tr>
                        </thead>
                        <tbody className="text-xs md:text-sm text-slate-600">
                            {loading ? (
                                Array.from({ length: 5 }).map((_, idx) => (
                                    <tr key={`skeleton-${idx}`} className="border-b border-slate-50 animate-pulse">
                                        <td className="p-4 text-center"><div className="w-6 h-4 bg-slate-200 rounded mx-auto"></div></td>
                                        <td className="p-4">
                                            <div className="flex items-center gap-2">
                                                <div className="w-8 h-8 bg-slate-200 rounded-full"></div>
                                                <div className="w-32 h-4 bg-slate-200 rounded"></div>
                                            </div>
                                        </td>
                                        <td className="p-4"><div className="w-28 h-4 bg-slate-200 rounded"></div></td>
                                        <td className="p-4"><div className="w-24 h-4 bg-slate-200 rounded"></div></td>
                                        <td className="p-4"><div className="w-16 h-16 bg-slate-200 rounded-full"></div></td>
                                        <td className="p-4 text-center"><div className="w-10 h-6 bg-slate-200 rounded mx-auto"></div></td>
                                        <td className="p-4"><div className="w-32 h-4 bg-slate-200 rounded"></div></td>
                                        <td className="p-4 text-center"><div className="w-8 h-8 bg-slate-200 rounded-lg mx-auto"></div></td>
                                    </tr>
                                ))
                            ) : displayInterns.length > 0 ? (
                                displayInterns.map((item, index) => (
                                    <tr key={item.id} className={`transition-colors border-b border-slate-50 last:border-none font-medium ${item.isActive ? 'hover:bg-slate-50' : 'bg-slate-200 text-slate-500'}`}>
                                        <td className="p-4 text-center">{(showingFrom ? showingFrom + index : ((currentPage - 1) * itemsPerPage + index + 1))}</td>
                                        <td className="p-4">
                                            <div className="flex flex-col items-center justify-center w-fit text-center gap-2 mx-auto sm:mx-0 sm:flex-row sm:text-left">
                                                <div className="w-8 h-8 rounded-full overflow-hidden bg-slate-100 flex-shrink-0 border border-slate-200">
                                                    <SecureImage src={item.profileImage} alt={item.name} className="w-full h-full object-cover" />
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span
                                                      className={`w-2 h-2 rounded-full ${item.isActive ? 'bg-emerald-400' : 'bg-slate-400'} cursor-help hover:scale-110 transition-transform`}
                                                      title={item.isActive ? 'Active' : 'Inactive'}
                                                      role="img"
                                                      aria-label={item.isActive ? 'Active' : 'Inactive'}
                                                    />
                                                    <span className={`font-medium ${item.isActive ? 'text-slate-800' : 'text-slate-500'} text-xs sm:text-sm`}>{item.name}</span>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-4 whitespace-nowrap">{item.university}</td>
                                        <td className="p-4">{item.major}</td>
                                        <td className="p-4">
                                            <ProgressBar percentage={item.progress} />
                                        </td>
                                        <td className="p-4 text-center">
                                            <span className="text-xs font-bold text-slate-700 bg-slate-100 px-2 py-1 rounded-lg inline-block">
                                                {item.verifiedLogbook} / {item.expectedWorkdays} 
                                            </span>
                                        </td>
                                        {/* REMOVED: Attendance Status Column Data */}
                                        <td className="p-4">
                                            <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 bg-slate-50 px-2 py-1 rounded-lg w-fit border border-slate-100">
                                                <Clock size={12} />
                                                {item.date && item.endDate
                                                    ? `${formatPeriodDate(item.date)} - ${formatPeriodDate(item.endDate)}`
                                                    : '-'}
                                            </div>
                                        </td>
                                        <td className="p-4 text-center">
                                            {item.isActive ? (
                                                <button
                                                    onClick={() => handleOpenDetail(item)}
                                                    className="inline-flex items-center justify-center h-8 w-8 bg-[#354C8F] text-white rounded-lg hover:bg-[#2a3c70] transition-colors shadow-sm shadow-indigo-100 active:scale-95 group relative"
                                                    title="View Details"
                                                >
                                                    <Eye size={14} className="group-hover:scale-110 transition-transform" />
                                                </button>
                                            ) : (
                                                <button
                                                    disabled
                                                    className="inline-flex items-center justify-center h-8 w-8 bg-[#354C8F] text-white rounded-lg opacity-50 cursor-not-allowed shadow-none"
                                                    title="Not available"
                                                >
                                                    <Eye size={14} />
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    {/* Updated colSpan from 7 to 8 */}
                                    <td colSpan="8" className="p-8 text-center text-slate-400">
                                        No interns found for the selected criteria.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                <div className="p-4 flex flex-col md:flex-row items-center justify-between gap-4 md:gap-0">

                    {/* Bagian Teks Info */}
                    <div className="text-sm text-slate-500 text-center md:text-left order-2 md:order-1">
                        Showing {showingFrom} to {showingTo} of {totalEntries} entries
                    </div>

                    {/* Bagian Tombol Pagination + Per Page Selector */}
                    <div className="flex items-center gap-4 order-1 md:order-2">
                        {/* Per Page Selector */}
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

                        {/* Tombol Pagination */}
                        <div className="flex items-center gap-2 flex-wrap justify-center">
                        {(() => {
                            const pageCurrent = (typeof pagination !== 'undefined' && pagination.current_page) ? pagination.current_page : currentPage;
                            const pageTotal = (typeof pagination !== 'undefined' && pagination.last_page) ? pagination.last_page : totalPages;

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
                                    {/* Tombol Previous */}
                                    <button
                                        onClick={() => handlePageChange(pageCurrent - 1)}
                                        disabled={pageCurrent === 1}
                                        className="p-2 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50 border border-slate-200"
                                    >
                                        <ChevronLeft size={18} />
                                    </button>

                                    {/* Angka Halaman */}
                                    {getPageItems(pageCurrent, pageTotal, 1).map((p, idx) => {
                                        if (p === 'left-ellipsis' || p === 'right-ellipsis') {
                                            return (
                                                <div key={`${p}-${idx}`} className="w-8 h-8 flex items-center justify-center rounded-lg text-xs font-bold text-slate-400">
                                                    ...
                                                </div>
                                            );
                                        }
                                        return (
                                            <button
                                                key={p}
                                                onClick={() => handlePageChange(p)}
                                                className={`w-8 h-8 flex items-center justify-center rounded-lg text-xs font-bold transition-colors 
                                    ${pageCurrent === p
                                                        ? "bg-slate-100 text-[#27345A] border border-slate-200"
                                                        : "text-slate-500 hover:bg-slate-50 border border-transparent"
                                                    }`}
                                            >
                                                {p}
                                            </button>
                                        );
                                    })}

                                    {/* Tombol Next */}
                                    <button
                                        onClick={() => handlePageChange(pageCurrent + 1)}
                                        disabled={pageCurrent === pageTotal}
                                        className="p-2 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50 border border-slate-200"
                                    >
                                        <ChevronRight size={18} />
                                    </button>
                                </>
                            );
                        })()}
                    </div>
                </div>
            </div>

            {/* --- 4. MODAL FILTER (INTERACTIVE) --- */}
            {isFilterOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl p-6 relative">

                        {/* Modal Header */}
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-[18px] font-bold text-[#27345A]">Filter Interns</h3>
                            <button onClick={() => setIsFilterOpen(false)} className="text-slate-400 hover:text-slate-600">
                                <X size={24} />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="space-y-6">

                            {/* University Dropdown */}
                            <div>
                                <label className="block text-sm font-bold text-slate-800 mb-2">Institution</label>
                                <div>
                                    <CustomSelect
                                        value={modalUniversity}
                                        onChange={setModalUniversity}
                                        options={[{ value: 'All', label: 'All Institutions' }, ...(availUni || []).map(u => { const v = (u && (u.nama_universitas || u.nama || u.universitas || u.name)) ? (u.nama_universitas || u.nama || u.universitas || u.name) : u; return { value: v, label: v }; })]}
                                        placeholder="All Institutions"
                                    />
                                </div>
                            </div>

                            {/* Status Filter (Active / Inactive) */}
                            <div>
                                <label className="block text-sm font-bold text-slate-800 mb-2">Status</label>
                                <div className="flex flex-wrap gap-2">
                                    {['All', 'Active', 'Inactive'].map((s) => (
                                        <button
                                            key={s}
                                            onClick={() => setModalStatus(modalStatus === s ? 'All' : s)}
                                            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all border ${modalStatus === s
                                                ? 'bg-[#354C8F] text-white border-[#354C8F] shadow-md'
                                                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                                                }`}
                                        >
                                            {s}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Logbook Progress (Clickable) */}
                            <div>
                                <label className="block text-sm font-bold text-slate-800 mb-2">Logbook Progress</label>
                                <div className="flex flex-wrap gap-2">
                                    {['< 50%', '50 - 80 %', '> 80%'].map((prog) => (
                                        <button
                                            key={prog}
                                            onClick={() => setModalProgress(modalProgress === prog ? null : prog)}
                                            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all border ${modalProgress === prog
                                                ? 'bg-[#354C8F] text-white border-[#354C8F] shadow-md'
                                                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                                                }`}
                                        >
                                            {prog}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <hr className="border-slate-200 mt-4" />

                            {/* Modal Actions */}
                            <div className="flex gap-3 justify-end mt-2">
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
                </div>
            )}

            </div>
        </div>
    );
};

export default InternMonitoring;