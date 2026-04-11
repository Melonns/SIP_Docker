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

// --- STYLES CONSTANTS ---
const btnPrimaryClass = "bg-[#354C8F] hover:bg-[#2a3c70] text-white py-3.5 px-6 rounded-xl font-bold text-sm shadow-md shadow-indigo-200 flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed";
const btnSecondaryClass = "bg-white border border-slate-300 text-slate-700 py-3.5 px-6 rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-slate-50 transition-all active:scale-95";
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

    // Translator maps
    const typeDisplayToApi = { 'Sick': 'sakit', 'On Leave': 'izin' };
    const statusDisplayToApi = { 
        'Approved': 'approved', 
        'Need Approval': 'waiting_admin', 
        'Waiting Mentor': 'need_approval', 
        'Rejected': 'rejected' 
    };
    const mapTypesForApi = (types) => types.map(t => typeDisplayToApi[t] || t.toLowerCase());
    const mapStatusForApi = (statuses) => statuses.map(s => statusDisplayToApi[s] || s.toLowerCase());

    // Helper: Map API jenis_izin to display format
    const mapJenisIzinDisplay = (jenis) => {
        if (jenis === 'sakit') return 'Sick';
        if (jenis === 'izin') return 'On Leave';
        return jenis;
    };

    // Month/Year filter
    const [filterMonth, setFilterMonth] = useState('');
    const [filterYear, setFilterYear] = useState('');

    // Selection for bulk actions
    const [selectedIds, setSelectedIds] = useState([]);

    // Applied filters
    const [appliedFilterType, setAppliedFilterType] = useState([]);
    const [appliedFilterStatus, setAppliedFilterStatus] = useState([]);
    const [appliedFilterMonth, setAppliedFilterMonth] = useState('');
    const [appliedFilterYear, setAppliedFilterYear] = useState('');

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

    // Data State
    const [data, setData] = useState([]);
    const [displayData, setDisplayData] = useState([]);

    // --- DOWNLOAD HELPER ---
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
            if (err?.response?.status === 204) {
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
        if (!status) return 'Pending';
        if (status === 'pending_admin') return 'Pending Admin';
        if (status === 'pending_mentor') return 'Pending Mentor';
        return status.charAt(0).toUpperCase() + status.slice(1);
    }

    // --- LOGIC UTAMA: STATUS HIERARKI ADMIN ---
    const getTableStatus = (item) => {
        if (!item) return '-';

        const sAdmin = (item.statusAdmin || '').toLowerCase();
        const sMentor = (item.statusMentor || '').toLowerCase();

        // 1. Final Status
        if (sAdmin === 'approved') return 'Approved';
        if (sAdmin === 'rejected') return 'Rejected';

        // 2. Pending Logic
        if (sAdmin === 'pending' || sAdmin === 'pending admin') {
            if (sMentor === 'rejected') return 'Rejected';
            if (sMentor === 'approved') return 'Need Approval';
            if (sMentor === 'pending' || sMentor === 'pending mentor') return 'Waiting Mentor';
        }

        return capitalizeStatus(item.statusAdmin);
    };

    // Helper Timestamp
    const formatTimestamp = (dateString) => {
        if (!dateString) return '-';
        const safeDate = dateString.replace(' ', 'T');
        const date = new Date(safeDate);
        return isNaN(date.getTime()) ? '-' : date.toLocaleString('en-US', {
            month: 'numeric',
            day: 'numeric',
            year: 'numeric',
            hour: 'numeric',
            minute: 'numeric',
            second: 'numeric',
            hour12: true
        });
    };

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

    // --- FETCH DATA ---
    const fetchData = async (page = 1) => {
        setLoading(true);
        try {
            const params = { page, per_page: itemsPerPage };
            if (searchTerm) params.q = searchTerm;
            if (appliedFilterType.length > 0) params.type = mapTypesForApi(appliedFilterType).join(',');

            // Send all selected statuses to backend
            if (appliedFilterStatus.length > 0) {
                params.status = mapStatusForApi(appliedFilterStatus).join(',');
            }

            if (appliedFilterMonth) params.bulan = appliedFilterMonth;
            if (appliedFilterYear) params.tahun = appliedFilterYear;

            const res = await axios.get('/admin/izin', { params });

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
                    name: (
                        item.user?.nama ||
                        item.user?.nama_lengkap ||
                        item.user?.name ||
                        item.user?.user_name ||
                        '-'
                    ),
                    studentId: item.user?.identifier || '-',
                    date: dateDisplay,
                    dateDisplay: dateDisplay,
                    datesList: datesList,
                    hasDateRange: rangeInfo.hasRange,
                    type: mapJenisIzinDisplay(item.jenis_izin),
                    statusMentor: capitalizeStatus(item.status_mentor),
                    statusAdmin: capitalizeStatus(item.status_admin),
                    approvedAtMentor: item.approved_at_mentor,
                    approvedAtAdmin: item.approved_at_admin,
                    startDate: startDateIso,
                    endDate: endDateIso,
                    reason: item.keterangan || '-',
                    // Prefer nested mahasiswa under user when available
                    jobPosition: item.user?.mahasiswa?.job_position || item.user?.jabatan || item.user?.position || item.user?.job_position || '-',
                    division: item.user?.mahasiswa?.division || item.user?.mahasiswa?.divisi || item.user?.divisi || item.user?.division || item.user?.department || '-',
                    institution: item.user?.mahasiswa?.universitas || item.user?.mahasiswa?.institution || item.universitas || item.user?.universitas || item.user?.institution || '-',
                    files: (() => {
                        if (!item.lampiran) return [];
                        let names = [];
                        if (typeof item.lampiran === 'string') {
                            try {
                                if (item.lampiran.startsWith('[') || item.lampiran.includes('\\')) {
                                    names = JSON.parse(item.lampiran);
                                } else {
                                    names = [item.lampiran];
                                }
                            } catch {
                                names = [item.lampiran];
                            }
                        } else if (Array.isArray(item.lampiran)) {
                            names = item.lampiran;
                        }
                        return (Array.isArray(names) ? names : [names]).map(n => ({
                            name: typeof n === 'string' ? getCleanFileName(n) : '',
                            path: n
                        }));
                    })(),
                    raw: item
                };
            });

            setData(mapped);
            setDisplayData(mapped);

            // Use server-side pagination metadata if available
            if (meta && (meta.total !== undefined || meta.last_page !== undefined)) {
                setCurrentPage(meta.current_page || page);
                setTotalPages(meta.last_page || 1);
                setTotalEntries(meta.total || 0);
                setShowingFrom(meta.from || 0);
                setShowingTo(meta.to || 0);
            } else {
                // Fallback for non-paginated responses
                const total = filteredByStatus.length;
                setCurrentPage(1);
                setTotalPages(1);
                setTotalEntries(total);
                setShowingFrom(total ? 1 : 0);
                setShowingTo(total);
            }

        } catch (err) {
            console.error(err);
            setData([]);
            setDisplayData([]);
            setTotalEntries(0);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData(1);
    }, []);

    const _appliedFirstRun = useRef(true);
    useEffect(() => {
        if (_appliedFirstRun.current) { _appliedFirstRun.current = false; return; }
        fetchData(1);
    }, [appliedFilterType, appliedFilterStatus, appliedFilterMonth, appliedFilterYear]);

    useEffect(() => {
        const t = setTimeout(() => fetchData(1), 400);
        return () => clearTimeout(t);
    }, [searchTerm, itemsPerPage]);

    const handlePageChange = (pageNumber) => {
        if (pageNumber >= 1 && pageNumber <= totalPages) fetchData(pageNumber);
    }

    // --- Selection helpers (bulk actions) ---
    const isEligibleForBulkApprove = (item) => getTableStatus(item) === 'Need Approval';

    const toggleSelect = (id) => {
        // Prevent selecting items that are not eligible
        const item = displayData.find(d => d.id === id);
        if (item && !isEligibleForBulkApprove(item)) return;
        setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
    };

    const toggleSelectAll = () => {
        const eligibleIds = displayData.filter(isEligibleForBulkApprove).map(i => i.id);
        if (eligibleIds.length === 0) return;
        const allSelected = eligibleIds.every(id => selectedIds.includes(id));
        if (allSelected) setSelectedIds([]);
        else setSelectedIds(eligibleIds);
    };

    // Keep selected ids in sync with current page (remove ids not on this page)
    useEffect(() => {
        setSelectedIds(prev => prev.filter(id => displayData.some(d => d.id === id)));
    }, [displayData]);

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

    const handleOpenDetail = (item) => {
        setSelectedRequest(item);
        setIsActionModalOpen(true);
    };

    const initiateApproval = (action) => {
        setConfirmAction(action);
        setIsConfirmOpen(true);
    };

    const confirmApproval = async () => {
        try {
            if (confirmAction === 'approve_selected') {
                setLoading(true);
                const idsToApprove = selectedIds.slice();
                const promises = idsToApprove.map(id => axios.put(`/admin/izin/${id}/status`, {
                    status: 'approved',
                    catatan_approval: ""
                }).catch(e => e));
                await Promise.all(promises);
                await fetchData(currentPage);
                setSelectedIds([]);
                setIsConfirmOpen(false);
                setIsSuccessOpen(true);
            } else {
                await axios.put(`/admin/izin/${selectedRequest.id}/status`, {
                    status: confirmAction === 'approve' ? 'approved' : 'rejected',
                    catatan_approval: ""
                });
                await fetchData(currentPage);
                setIsConfirmOpen(false);
                setIsActionModalOpen(false);
                setIsSuccessOpen(true);
            }
        } catch (error) {
            setIsConfirmOpen(false);
            setIsFailedOpen(true);
        } finally {
            setLoading(false);
        }
    };

    const handleViewLampiran = (index, idIzin) => {
        const url = `${window.location.origin}/izin/view/${idIzin}/${index}`;
        window.open(url, "_blank");
    };

    // --- UI COMPONENTS ---

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

    const Badge = ({ text, small = false }) => {
        let styles = "bg-gray-50 text-gray-600 border-gray-200";
        const statusLower = text ? text.toString().toLowerCase() : "";

        if (statusLower === 'approved') styles = "bg-green-50 text-green-600 border-green-200 text-[13px] ";
        else if (statusLower.includes('need approval')) styles = "bg-[#FFF7ED] text-[#F97316] border-[#FFD8A8] text-[13px] ";
        else if (statusLower.includes('waiting mentor') || statusLower.includes('waiting admin') || statusLower.includes('pending')) styles = "bg-[#FFFBEB] text-[#F59E0B] border-[#FEF3C7] text-[13px] ";
        else if (statusLower === 'rejected') styles = "bg-red-50 text-red-600 border-red-200 text-[13px] ";
        else if (statusLower === 'sick') styles = "bg-blue-50 text-blue-600 border-blue-200 text-[13px] ";
        else if (statusLower === 'on leave') styles = "bg-slate-100 text-slate-600 border-slate-200 leading-tight text-[13px] ";

        const sizeClass = small ? 'w-[100px]' : 'min-w-[140px]';

        return (
            <span className={`inline-flex items-center justify-center ${sizeClass} h-[34px] px-2 rounded-lg text-xs font-bold border whitespace-nowrap ${styles}`}>
                {text}
            </span>
        );
    };

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

    // Pre-calculation for Template Variables
    const currentItems = displayData;
    const mentorApprovedTime = selectedRequest ? formatTimestamp(selectedRequest.approvedAtMentor) : null;
    const adminApprovedTime = selectedRequest ? formatTimestamp(selectedRequest.approvedAtAdmin) : null;

    return (
        <div className="bg-slate-50 min-h-screen p-8 font-sans text-slate-800 -mt-8 -ml-5 -mr-5">

            {/* Header & Action Bar */}
            <div className="mb-8">
                <h1 className={`text-3xl font-bold ${textDarkBlue} mb-2`}>Leave Request Approval</h1>
                <p className="text-slate-500 text-sm">Check your intern leave requests</p>
            </div>

            <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-6">
                <div className="flex items-center gap-3 w-full md:w-auto">
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

                <div className="w-full md:ml-auto md:w-auto">
                    <button
                        onClick={() => { setConfirmAction('approve_selected'); setIsConfirmOpen(true); }}
                        disabled={selectedIds.length === 0}
                        className={`w-full md:w-auto bg-[#22C55E] hover:bg-[#16A34A] text-white py-3.5 px-6 rounded-xl font-bold text-sm shadow-md shadow-green-200 flex items-center justify-center gap-3 transition-all active:scale-95 ${selectedIds.length === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                        <Check size={18} />
                        <span className="inline">Approve Selected</span>
                        <span className="ml-2 text-xs">{selectedIds.length > 0 ? `(${selectedIds.length})` : '(0)'}</span>
                    </button>
                </div>
            </div>

            {/* Table Section */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="border-b border-slate-100 text-sm font-bold text-slate-900 bg-slate-50/50">
                                <th className="p-3 w-10 text-center"><input type="checkbox" className="w-4 h-4" checked={displayData.filter(isEligibleForBulkApprove).length > 0 && selectedIds.length === displayData.filter(isEligibleForBulkApprove).length} onChange={toggleSelectAll} /></th>
                                <th className="p-3 w-12 text-center">No</th>
                                <th className="p-3">Name</th>
                                <th className="p-3">Date</th>
                                <th className="p-3 text-center">Type</th>
                                <th className="p-3">Job Position</th>
                                <th className="p-3">Division</th>
                                <th className="p-3">Institution</th>
                                <th className="p-3 text-center">Status</th>
                                <th className="p-3 text-center">Action</th>
                            </tr>
                        </thead>
                        <tbody className="text-sm text-slate-600">
                            {loading ? (
                                <tr><td colSpan="11" className="p-12 text-center"><div className="flex flex-col items-center justify-center"><Loader2 className="animate-spin text-[#354C8F] mb-2" size={24} /><span className="text-slate-400">Loading data...</span></div></td></tr>
                            ) : displayData.length > 0 ? (
                                currentItems.map((item, index) => (
                                    <tr key={item.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                                        <td className="p-3 text-center">
                                            <input
                                                type="checkbox"
                                                className={`w-4 h-4 ${!isEligibleForBulkApprove(item) ? 'opacity-50 cursor-not-allowed' : ''}`}
                                                checked={selectedIds.includes(item.id)}
                                                disabled={!isEligibleForBulkApprove(item)}
                                                onChange={(e) => { e.stopPropagation(); toggleSelect(item.id); }}
                                            />
                                        </td>
                                        <td className="p-3 text-center font-medium">{(showingFrom ? showingFrom + index : ((currentPage - 1) * itemsPerPage + index + 1))}</td>
                                        <td className="p-3">
                                            <div className="font-medium text-slate-700">{item.name}</div>
                                        </td>
                                        <td className="p-3 whitespace-nowrap">{item.date}</td>
                                        <td className="p-3 text-center"><Badge text={item.type} small /></td>

                                        <td className="p-3 text-sm text-slate-600">{item.jobPosition}</td>
                                        <td className="p-3 text-sm text-slate-600">{item.division}</td>
                                        <td className="p-3 text-sm text-slate-600">{item.institution}</td>
                                        <td className="p-3 text-center">
                                            <Badge text={getTableStatus(item)} />
                                        </td>
                                        <td className="p-3 text-center">
                                            {getTableStatus(item) === 'Need Approval' ? (
                                                <button
                                                    onClick={() => handleOpenDetail(item)}
                                                    className="inline-flex items-center justify-center h-[34px] w-[34px] bg-[#22C55E] text-white rounded-lg hover:bg-[#16A34A] transition-colors shadow-sm shadow-green-100 active:scale-95"
                                                    title="Review"
                                                >
                                                    <Edit size={14} />
                                                </button>
                                            ) : (
                                                <button
                                                    onClick={() => handleOpenDetail(item)}
                                                    className="inline-flex items-center justify-center h-[34px] w-[34px] bg-[#354C8F] text-white rounded-lg hover:bg-[#2a3c70] transition-colors shadow-sm shadow-indigo-100 active:scale-95"
                                                    title="View Detail"
                                                >
                                                    <Eye size={14} />
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr><td colSpan="11" className="p-8 text-center text-slate-400">No data available.</td></tr>
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
                                const pageCurrent = (typeof pagination !== 'undefined' && pagination.current_page) ? pagination.current_page : currentPage;
                                const pageTotal = parseInt((typeof pagination !== 'undefined' && pagination.last_page) ? pagination.last_page : totalPages) || 1;
                                
                                // Helper to generate page numbers with ellipsis
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
                                        <button 
                                            onClick={() => handlePageChange(pageCurrent - 1)} 
                                            disabled={pageCurrent === 1} 
                                            className="p-2 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50 border border-slate-200 disabled:cursor-not-allowed"
                                        >
                                            <ChevronLeft size={18} />
                                        </button>
                                        
                                        {getPageItems(pageCurrent, pageTotal, 1).map((p, idx) => {
                                            if (p === 'left-ellipsis' || p === 'right-ellipsis') {
                                                return <div key={`${p}-${idx}`} className="w-8 h-8 flex items-center justify-center rounded-lg text-xs font-bold text-slate-400">...</div>;
                                            }
                                            return (
                                                <button 
                                                    key={p} 
                                                    onClick={() => handlePageChange(p)} 
                                                    className={`w-8 h-8 flex items-center justify-center rounded-lg text-xs font-bold transition-colors ${pageCurrent === p ? "bg-slate-100 text-[#27345A] border border-slate-200" : "text-slate-500 hover:bg-slate-50 border border-transparent"}`}
                                                >
                                                    {p}
                                                </button>
                                            );
                                        })}
                                        
                                        <button 
                                            onClick={() => handlePageChange(pageCurrent + 1)} 
                                            disabled={pageCurrent === pageTotal} 
                                            className="p-2 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50 border border-slate-200 disabled:cursor-not-allowed"
                                        >
                                            <ChevronRight size={18} />
                                        </button>
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
                                <div><label className="block text-sm font-bold text-slate-800 mb-2">Type</label><div className="flex flex-wrap gap-2">{['Sick', 'On Leave'].map(type => (<button key={type} onClick={() => toggleFilter(filterType, setFilterType, type)} className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all border ${filterType.includes(type) ? 'bg-[#354C8F] text-white border-[#354C8F] shadow-md' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}>{type}</button>))}</div></div>
                                <div><label className="block text-sm font-bold text-slate-800 mb-2">Status</label><div className="flex flex-wrap gap-2">{['Approved', 'Need Approval', 'Waiting Mentor', 'Rejected'].map(status => (<button key={status} onClick={() => toggleFilter(filterStatus, setFilterStatus, status)} className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all border ${filterStatus.includes(status) ? 'bg-[#354C8F] text-white border-[#354C8F] shadow-md' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}>{status}</button>))}</div></div>

                                <div>
                                    <label className="block text-sm font-bold text-slate-800 mb-2">Month</label>
                                    <div className="flex items-center gap-1">
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
                            <hr className="my-4 border-slate-100" />
                            <div className="flex gap-3 justify-end"><button onClick={handleResetFilter} className={btnSecondaryClass}>Reset</button><button onClick={() => {
                                setAppliedFilterType(filterType);
                                setAppliedFilterStatus(filterStatus);
                                setAppliedFilterMonth(filterMonth);
                                setAppliedFilterYear(filterYear);
                                setIsFilterOpen(false);
                            }} className={btnPrimaryClass}>Apply</button></div>
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

            {/* --- MODAL ACTION / VIEW DETAIL (TEMPLATE INTEGRATED) --- */}
            <AnimatePresence>
                {isActionModalOpen && selectedRequest && (
                    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
                        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} className="bg-white w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-white">
                                <h3 className="text-[18px] font-bold text-[#27345A]">Leave Request Detail</h3>
                                <button onClick={() => setIsActionModalOpen(false)}><X size={24} className="text-slate-400 hover:text-slate-600" /></button>
                            </div>

                            <div className="p-8 overflow-y-auto custom-scrollbar">
                                <div className="space-y-6 -mt-4">
                                    <div className="grid grid-cols-3 gap-3 mb-3">
                                        <div className="text-sm text-slate-600"><div className="block text-sm font-bold text-slate-800">Name</div><div className="mt-1">{selectedRequest.name || '-'}</div></div>
                                        <div className="text-sm text-slate-600"><div className="block text-sm font-bold text-slate-800">Division</div><div className="mt-1">{selectedRequest.division || '-'}</div></div>
                                        <div className="text-sm text-slate-600"><div className="block text-sm font-bold text-slate-800">Institution</div><div className="mt-1">{selectedRequest.institution || '-'}</div></div>
                                    </div>
                                    {/* Type */}
                                    <div>
                                        <label className="block text-sm font-bold text-slate-800 mb-2 -mt-1">Type</label>
                                        <div className="inline-block"><Badge text={selectedRequest.type} small /></div>
                                    </div>

                                    {/* Detail Status (User Template Integrated) */}
                                    <div>
                                        <label className="block text-sm font-bold text-slate-800 mb-2">Detail Status</label>



                                        <div className="grid grid-cols-2 gap-4">
                                            {/* Mentor Card */}
                                            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50">
                                                <div className="flex items-center justify-between mb-2">
                                                    <div className="text-sm font-bold text-slate-700">Mentor</div>
                                                    <Badge text={selectedRequest.statusMentor} />
                                                </div>
                                                {selectedRequest.statusMentor && (selectedRequest.statusMentor.includes('Approved') || selectedRequest.statusMentor.includes('Rejected')) ? (
                                                    mentorApprovedTime ? (
                                                        <div className="text-[12px] text-slate-500">{selectedRequest.statusMentor} at {mentorApprovedTime}</div>
                                                    ) : (
                                                        <div className="text-[12px] text-slate-400">{selectedRequest.statusMentor || '-'}</div>
                                                    )
                                                ) : (
                                                    <div className="text-[12px] text-slate-400">{selectedRequest.statusMentor || '-'}</div>
                                                )}
                                            </div>

                                            {/* Admin Card */}
                                            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50">
                                                <div className="flex items-center justify-between mb-2">
                                                    <div className="text-sm font-bold text-slate-700">Admin</div>
                                                    <Badge text={selectedRequest.statusAdmin} />
                                                </div>
                                                {selectedRequest.statusAdmin && (selectedRequest.statusAdmin.includes('Approved') || selectedRequest.statusAdmin.includes('Rejected')) ? (
                                                    adminApprovedTime ? (
                                                        <div className="text-[12px] text-slate-500">{selectedRequest.statusAdmin} at {adminApprovedTime}</div>
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
                                            <div className="flex items-center px-4 py-3 rounded-xl border border-[#E2E8F0] bg-[#F8F9FD] text-slate-600 text-sm font-medium whitespace-pre-wrap">{selectedRequest.dateDisplay}</div>
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-2 gap-4">
                                            <div><label className="block text-sm font-bold text-slate-800 mb-2">Start Date</label><div className="flex items-center px-4 py-3 rounded-xl border border-[#E2E8F0] bg-[#F8F9FD] text-slate-600 text-sm font-medium"><Calendar size={16} className="mr-3 text-slate-400" />{selectedRequest.startDate}</div></div>
                                            <div><label className="block text-sm font-bold text-slate-800 mb-2">End Date</label><div className="flex items-center px-4 py-3 rounded-xl border border-[#E2E8F0] bg-[#F8F9FD] text-slate-600 text-sm font-medium"><Calendar size={16} className="mr-3 text-slate-400" />{selectedRequest.endDate}</div></div>
                                        </div>
                                    )}

                                    {/* Reason */}
                                    <div><label className="block text-sm font-bold text-slate-800 mb-2">Reason</label><textarea readOnly value={selectedRequest.reason} className="w-full px-4 py-3 rounded-xl border border-[#E2E8F0] bg-[#F8F9FD] text-slate-600 text-sm font-medium leading-relaxed resize-none focus:outline-none" rows="3" /></div>

                                    {/* Attachments */}
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
                                            <div className="text-center p-6 bg-[#F8F9FD] rounded-xl border border-dashed border-[#E2E8F0] text-slate-400 text-sm font-medium">No attachments provided.</div>
                                        )}
                                    </div>

                                </div>
                            </div>

                            {/* ACTION BUTTONS (Logic: Mentor Approved & Admin Pending) */}
                            <div className="p-4 border-t border-slate-100 bg-white flex justify-end gap-3 sticky bottom-0 z-10">
                                {selectedRequest.statusMentor === 'Approved' && selectedRequest.statusAdmin === 'Pending' ? (
                                    <div className="flex gap-3 justify-end">
                                        <button
                                            onClick={() => initiateApproval('reject')}
                                            className="w-36 border border-[#EF4444] text-[#EF4444] hover:bg-red-50 py-3 rounded-xl font-bold text-sm transition-all active:scale-95"
                                        >
                                            Reject
                                        </button>
                                        <button
                                            onClick={() => initiateApproval('approve')}
                                            className="w-36 bg-[#22C55E] hover:bg-[#16A34A] text-white py-3 rounded-xl font-bold text-sm shadow-md shadow-green-100 transition-all active:scale-95"
                                        >
                                            Approve
                                        </button>
                                    </div>
                                ) : (
                                    <button onClick={() => setIsActionModalOpen(false)} className={btnSecondaryClass}>Close</button>
                                )}
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
                            <h3 className="text-[20px] font-bold text-[#27345A] mb-2">{confirmAction === 'approve' || confirmAction === 'approve_selected' ? 'Approve Permission?' : 'Reject Permission?'}</h3>
                            <p className="text-slate-500 text-sm mb-8">{confirmAction === 'approve_selected' ? `Approve ${selectedIds.length} selected permissions? This action cannot be undone.` : (confirmAction === 'reject' ? 'Please make sure this is correct before proceeding. Reject actions cannot be undone.' : 'Your action cannot be changed, do you wish to continue?')}</p>
                            <div className="flex gap-3">
                                <button onClick={() => setIsConfirmOpen(false)} className={btnSecondaryClass + " w-full"}>Cancel</button>
                                <button onClick={confirmApproval} className={`w-full py-3.5 px-6 rounded-xl font-bold text-sm shadow-md text-white transition-all active:scale-95 ${confirmAction === 'approve' || confirmAction === 'approve_selected' ? 'bg-[#22C55E] hover:bg-[#16A34A] shadow-green-200' : 'bg-[#EF4444] hover:bg-[#DC2626] shadow-red-200'}`}>{confirmAction === 'approve' || confirmAction === 'approve_selected' ? 'Approve' : 'Reject'}</button>
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
                                {confirmAction === 'approve' || confirmAction === 'approve_selected' ? 'Approved'
                                    : confirmAction === 'reject' ? 'Rejected'
                                        : confirmAction === 'download' ? 'Download Success' : 'Success'}
                            </h3>
                            <p className="text-slate-500 text-sm mb-8">
                                {confirmAction === 'approve' || confirmAction === 'approve_selected' || confirmAction === 'reject'
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