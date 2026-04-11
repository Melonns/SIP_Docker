import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
    Search,
    Filter,
    X,
    Eye,
    Edit,
    ChevronLeft,
    ChevronRight,
    Clock,
    Calendar,
    Check,
    AlertTriangle,
    AlertCircle,
    Loader2,
    Download // Tambah Icon Download
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import apiClient from '../../api/axiosConfig';

// --- STYLES CONSTANTS ---
const btnPrimaryClass = "bg-[#354C8F] hover:bg-[#2a3c70] text-white py-3.5 px-6 rounded-xl font-bold text-sm shadow-md shadow-indigo-200 flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed";
const btnSecondaryClass = "bg-white border border-slate-300 text-slate-700 py-3.5 px-6 rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-slate-50 transition-all active:scale-95";
const textDarkBlue = "text-[#203266]";

const CorrectionApproval = () => {
    // --- STATES ---
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [isFilterOpen, setIsFilterOpen] = useState(false);

    // Modal States
    const [isActionModalOpen, setIsActionModalOpen] = useState(false);
    const [isConfirmOpen, setIsConfirmOpen] = useState(false);
    const [isSuccessOpen, setIsSuccessOpen] = useState(false);

    // ERROR & LOADING STATES
    const [isErrorOpen, setIsErrorOpen] = useState(false);
    const [errorMessage, setErrorMessage] = useState("");
    const [downloadingFileId, setDownloadingFileId] = useState(null); // State untuk loading download

    const [selectedRequest, setSelectedRequest] = useState(null);
    const [confirmAction, setConfirmAction] = useState(null);

    // Selection for bulk actions (approve selected)
    const [selectedIds, setSelectedIds] = useState([]);

    // Data & Pagination
    const [data, setData] = useState([]);
    const [displayData, setDisplayData] = useState([]);
    const [currentPage, setCurrentPage] = useState(1);
    const [paginationMeta, setPaginationMeta] = useState({ from: 0, to: 0, total: 0, last_page: 1 });

    const [filterType, setFilterType] = useState([]);
    const [filterStatus, setFilterStatus] = useState([]);

    // Translator maps (display -> API)
    const typeDisplayToApi = {
        'Clock In': 'lupa_absen_masuk',
        'Clock Out': 'lupa_absen_pulang'
    };
    const statusDisplayToApi = {
        'Approved': 'approved',
        'Pending': 'pending',
        'Need Approval': 'pending',
        'Waiting Mentor': 'pending',
        'Rejected': 'rejected'
    };
    const mapTypesForApi = (types) => types.map(t => typeDisplayToApi[t] || t.toLowerCase());
    const mapStatusForApi = (statuses) => statuses.map(s => statusDisplayToApi[s] || s.toLowerCase());

    // Applied filters (only used when user clicks Apply)
    const [appliedFilterType, setAppliedFilterType] = useState([]);
    const [appliedFilterStatus, setAppliedFilterStatus] = useState([]);

    // --- HELPER: BERSIHKAN NAMA FILE ---
    const getCleanFileName = (path) => {
        if (!path) return "File";
        let baseName = String(path).split('/').pop();
        const match = baseName.match(/^[a-zA-Z0-9]+_\d+_\d+_[a-f0-9]+_(.+)$/i);
        if (match) return match[1];
        const match2 = baseName.match(/^[a-zA-Z0-9]+_\d+_\d+_[a-f0-9]+(?:\.(.+))?$/i);
        if (match2) return `lampiran${match2[1] ? '.' + match2[1] : ''}`;
        return baseName;
    };

    const formatDateDMY = (value) => {
        if (!value) return "-";
        const raw = String(value).trim();
        const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (match) {
            return `${match[3]}/${match[2]}/${match[1]}`;
        }
        const d = new Date(raw);
        if (Number.isNaN(d.getTime())) return raw;
        const dd = String(d.getDate()).padStart(2, '0');
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const yyyy = d.getFullYear();
        return `${dd}/${mm}/${yyyy}`;
    };

    // Format time helper (robust)
    const formatTimeShort = (value) => {
        if (!value) return "-";
        const s = String(value);
        if (s.includes('T')) return s.split('T')[1].split(':').slice(0, 2).join(':');
        if (s.includes(' ')) return s.split(' ').pop().split(':').slice(0, 2).join(':');
        if (s.includes(':')) return s.split(':').slice(0, 2).join(':');
        return s;
    };

    // --- 1. FETCH DATA (FIXED PARSING) ---
    const [itemsPerPage, setItemsPerPage] = useState(10);
    const fetchData = async (page = 1) => {
        setLoading(true);
        try {
            // Determine if user selected derived statuses that the server may not support directly
            const needsDerivedStatus = appliedFilterStatus.some(s => s === 'Need Approval' || s === 'Waiting Mentor');

            // When derived statuses are requested, fetch more records (large per_page) so client-side filtering can work across a larger set
            const perPage = needsDerivedStatus ? 1000 : itemsPerPage;

            const params = { page: page, search: searchTerm, per_page: perPage };
            if (appliedFilterType.length > 0) params.jenis_koreksi = mapTypesForApi(appliedFilterType).join(',');

            // Only send server-supported statuses (Approved / Rejected) **when** no derived status filters are selected.
            // If derived statuses (Need Approval / Waiting Mentor) are selected, fetch a larger set and filter client-side
            const serverStatusFilters = appliedFilterStatus.filter(s => s === 'Approved' || s === 'Rejected');
            if (!needsDerivedStatus && serverStatusFilters.length > 0) params.status = mapStatusForApi(serverStatusFilters).join(',');

            const response = await apiClient.get('/admin/koreksi', { params });
            const apiData = response.data.data;

            const formatStatus = (statusRaw) => {
                if (!statusRaw) return 'Pending';
                return statusRaw.charAt(0).toUpperCase() + statusRaw.slice(1);
            };

            let rawDataArray = apiData.data || [];
            if (rawDataArray.length > 0 && Array.isArray(rawDataArray[0].items)) {
                rawDataArray = rawDataArray.flatMap(group => group.items || []);
            }

            const mappedData = rawDataArray.map(item => {
                let typeLabel = "Unknown";
                let clockInVal = "-";
                let clockOutVal = "-";

                if (item.jenis_koreksi === 'lupa_absen_masuk') {
                    typeLabel = "Clock In";
                    clockInVal = item.jam_koreksi;
                } else if (item.jenis_koreksi === 'lupa_absen_pulang') {
                    typeLabel = "Clock Out";
                    clockOutVal = item.jam_koreksi;
                }

                // --- FIX PARSING LAMPIRAN ---
                let filesArray = [];
                if (item.lampiran) {
                    try {
                        if (typeof item.lampiran === 'string' && (item.lampiran.startsWith('[') || item.lampiran.includes('\\'))) {
                            filesArray = JSON.parse(item.lampiran);
                        } else {
                            filesArray = [item.lampiran];
                        }
                    } catch (e) {
                        filesArray = [item.lampiran];
                    }
                }

                if (!Array.isArray(filesArray)) filesArray = [];

                const mentorRaw = formatStatus(item.status_mentor);
                const adminRaw = formatStatus(item.status_admin);

                const mentorDisplay = (() => {
                    const m = (mentorRaw || '').toLowerCase();
                    const a = (adminRaw || '').toLowerCase();
                    if (!m || m === 'pending') return 'Waiting Mentor';
                    if (m === 'approved') {
                        if (!a || a === 'pending') return 'Need Approval';
                        if (a === 'approved') return 'Approved';
                        if (a === 'rejected') return 'Rejected';
                    }
                    return mentorRaw || 'Waiting Mentor';
                })();

                return {
                    id: item.id_koreksi,
                    name: item.user?.nama_lengkap || item.user?.nama,
                    studentId: item.user?.identifier || "-",
                    date: formatDateDMY(item.tanggal),
                    type: typeLabel,
                    statusRaw: mentorRaw,
                    byAdminRaw: adminRaw,
                    status: mentorDisplay,
                    byAdmin: adminRaw,
                    clockIn: clockInVal,
                    clockOut: clockOutVal,
                    // Add original & corrected time fields (match Mentor view)
                    originalTime: item.waktu_asli || '-',
                    correctedTime: item.jam_koreksi || '-',
                    reason: item.alasan || "-",
                    // Prefer details from user.mahasiswa when available
                    jobPosition: item.user?.mahasiswa?.job_position || item.user?.mahasiswa?.jobPosition || item.user?.jabatan || '-',
                    division: item.user?.mahasiswa?.division || item.user?.mahasiswa?.divisi || item.user?.divisi || '-',
                    institution: item.user?.mahasiswa?.universitas || item.user?.mahasiswa?.institution || item.user?.universitas || '-',
                    files: filesArray, // Array of paths strings
                    raw: item
                };
            });

            // Apply client-side filtering for status (supports Need Approval & Waiting Mentor)
            const filteredByStatus = appliedFilterStatus.length > 0
                ? mappedData.filter(item => appliedFilterStatus.includes(getTableStatus(item)))
                : mappedData;

            // If derived status was requested, perform client-side pagination over the filtered set
            if (needsDerivedStatus) {
                const total = filteredByStatus.length;
                const totalPagesCalc = Math.max(1, Math.ceil(total / itemsPerPage));
                const pageToShow = Math.min(page, totalPagesCalc);
                const start = (pageToShow - 1) * itemsPerPage;
                const end = start + itemsPerPage;
                const pageItems = filteredByStatus.slice(start, end);

                setData(filteredByStatus);
                setDisplayData(pageItems);
                setPaginationMeta({
                    from: total ? start + 1 : 0,
                    to: total ? Math.min(end, total) : 0,
                    total: total,
                    last_page: totalPagesCalc,
                    current_page: pageToShow
                });
                setCurrentPage(pageToShow);
            } else {
                // Use server-side pagination and data
                setData(mappedData);
                setDisplayData(mappedData);
                setPaginationMeta({
                    from: apiData.from,
                    to: apiData.to,
                    total: apiData.total,
                    last_page: apiData.last_page,
                    current_page: apiData.current_page
                });
                setCurrentPage(apiData.current_page);
            }

        } catch (error) {
            console.error("Gagal load data:", error);
            showError("Gagal memuat data dari server.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const timeoutId = setTimeout(() => fetchData(currentPage), 500);
        return () => clearTimeout(timeoutId);
    }, [currentPage, searchTerm, itemsPerPage]); // Re-fetch when page, search, or itemsPerPage changes

    // --- DISPLAY DATA (FLAT, SORTED) ---
    const flatDisplay = useMemo(() => {
        const flat = [...displayData];
        flat.sort((a, b) => {
            const dateA = a.raw?.tanggal ? String(a.raw.tanggal).slice(0, 10) : (a.date || '');
            const dateB = b.raw?.tanggal ? String(b.raw.tanggal).slice(0, 10) : (b.date || '');
            return dateA < dateB ? 1 : (dateA > dateB ? -1 : 0);
        });
        return flat;
    }, [displayData]);

    // --- Selection helpers (bulk actions) ---
    const isEligibleForBulkApprove = (item) => getTableStatus(item) === 'Need Approval';

    const toggleSelect = (id) => {
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

    // Keep selected ids in sync with current page (remove ids not present)
    useEffect(() => {
        setSelectedIds(prev => prev.filter(id => displayData.some(d => d.id === id)));
    }, [displayData]);


    // Trigger fetch when applied filters change (apply-only behavior)
    const _appliedFirstRunCorrections = useRef(true);
    useEffect(() => {
        if (_appliedFirstRunCorrections.current) { _appliedFirstRunCorrections.current = false; return; }
        fetchData(1);
    }, [appliedFilterType, appliedFilterStatus]);

    // Display data is provided by server (server-side filtering). We keep local filter state for UI selection and apply via the Apply button.

    // --- 2. HELPERS ---

    const showError = (message) => {
        setErrorMessage(message);
        setIsErrorOpen(true);
    };

    // Handler Preview (Buka Tab Baru ke Route FileViewer)
    const handleViewLampiran = (index, idRequest) => {
        const id = idRequest || selectedRequest?.id;
        if (!id) return;
        // Arahkan ke route FileViewer.jsx
        const url = `${window.location.origin}/koreksi/view/${id}/${index}`;
        window.open(url, "_blank");
    };

    // Handler Download (Fetch Blob)
    const handleDownloadFile = async (fileUrl, fileIndex, idRequest) => {
        const fileId = `file-${fileIndex}`; // ID unik untuk loading state per tombol
        setDownloadingFileId(fileId);

        try {
            const id = idRequest || selectedRequest?.id;
            const response = await apiClient.get(
                `/koreksi/${id}/download-lampiran/${fileIndex}`,
                { responseType: "blob", validateStatus: status => (status >= 200 && status < 300) || status === 204 }
            );

            // Handle 204 (no content) as success (e.g., intercepted by download manager)
            if (response.status === 204) {
                setIsSuccessOpen(true);
                setConfirmAction('download');
                return;
            }

            // Buat link download virtual
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement("a");
            link.href = url;

            // Ambil nama file asli untuk disimpan
            const fileName = getCleanFileName(fileUrl);
            link.setAttribute("download", fileName);

            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);

            // Show success modal
            setIsSuccessOpen(true);
            setConfirmAction('download');
        } catch (error) {
            // Treat 204 even if it ended up in catch
            if (error?.response?.status === 204) {
                setIsSuccessOpen(true);
                setConfirmAction('download');
                return;
            }
            const msg = String(error?.message || '').toLowerCase();
            if (msg.includes('network error') || msg.includes('canceled') || msg.includes('cancelled') || msg.includes('aborted')) {
                setIsSuccessOpen(true);
                setConfirmAction('download');
                return;
            }

            showError("Gagal mendownload file.");
        } finally {
            setDownloadingFileId(null);
        }
    };

    // Fix Icon Logic (Cek Ekstensi dari Path String)
    const getFileIcon = (filePath) => {
        const path = filePath ? filePath.toString().toLowerCase() : "";
        const isPdf = path.endsWith('.pdf');

        if (isPdf) {
            return (
                <div className="w-10 h-10 bg-red-50 rounded-lg flex items-center justify-center shadow-sm shrink-0 border border-red-100">
                    <div className="bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-md">PDF</div>
                </div>
            );
        } else {
            return (
                <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center shadow-sm shrink-0 border border-blue-100">
                    <div className="bg-blue-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-md">IMG</div>
                </div>
            );
        }
    };

    // --- STATUS TIMESTAMP HELPERS (mentor/admin) ---
    const findTimestampForRole = (raw, role) => {
        if (!raw) return null;
        const exactKey = `approved_at_${role}`;
        if (raw[exactKey]) return raw[exactKey];
        if (raw.approved_at && typeof raw.approved_at !== 'object') return raw.approved_at;

        const lowerMap = Object.keys(raw).reduce((acc, k) => { acc[k.toLowerCase()] = k; return acc; }, {});
        if (lowerMap[exactKey]) return raw[lowerMap[exactKey]];
        if (lowerMap['approved_at']) return raw[lowerMap['approved_at']];

        for (const k of Object.keys(raw)) {
            const lk = k.toLowerCase();
            if ((lk.includes('approved') && lk.includes(role)) || lk.includes(`approved_at_${role}`)) {
                if (raw[k]) return raw[k];
            }
        }

        for (const k of Object.keys(raw)) {
            const lk = k.toLowerCase();
            if ((lk.includes('approved_at') || lk === 'approved' || lk.includes('approved')) && raw[k]) return raw[k];
        }

        // If there are separate date/time fields, try to combine them (best-effort)
        const lowerKeys = Object.keys(raw).reduce((acc, k) => { acc[k.toLowerCase()] = k; return acc; }, {});
        // patterns: approved_date, approved_time, <role>_date, <role>_time
        const dateKeyCandidates = ['approved_date', `${role}_date`, 'date_approved', 'approvedat_date'];
        const timeKeyCandidates = ['approved_time', `${role}_time`, 'time_approved', 'approvedat_time'];
        let datePart = null;
        let timePart = null;
        for (const dk of dateKeyCandidates) if (lowerKeys[dk] && raw[lowerKeys[dk]]) { datePart = raw[lowerKeys[dk]]; break; }
        for (const tk of timeKeyCandidates) if (lowerKeys[tk] && raw[lowerKeys[tk]]) { timePart = raw[lowerKeys[tk]]; break; }
        if (datePart && timePart) {
            const combined = `${datePart} ${timePart}`;
            if (combined) return combined;
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

    // Format a given timestamp value (raw string/number) consistently using local/server time parsing
    const formatApprovalTimeValue = (ts) => {
        if (!ts) return null;
        try {
            const date = new Date(ts);
            if (!isNaN(date.getTime())) return date.toLocaleString();
        } catch (e) {}
        const n = Number(ts);
        if (!isNaN(n)) {
            const d = new Date(n);
            if (!isNaN(d.getTime())) return d.toLocaleString();
        }
        return String(ts);
    };

    // Precise full datetime formatter matching `M/D/YYYY, h:mm:ss AM/PM` (en-US)
    const formatFullDateTime = (ts) => {
        if (!ts) return null;
        const date = new Date(ts);
        if (!isNaN(date.getTime())) {
            return date.toLocaleString('en-US', {
                month: 'numeric', day: 'numeric', year: 'numeric',
                hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true
            });
        }
        const n = Number(ts);
        if (!isNaN(n)) {
            const d = new Date(n);
            if (!isNaN(d.getTime())) return d.toLocaleString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true });
        }
        return String(ts);
    };

    // Normalize status labels to consistent title-case variants used across the UI
    const normalizeStatus = (raw) => {
        if (!raw) return 'Pending';
        const s = String(raw).trim();
        const lower = s.toLowerCase();
        if (lower.includes('approved')) return 'Approved';
        if (lower.includes('rejected')) return 'Rejected';
        if (lower.includes('waiting') || lower.includes('mentor')) return 'Waiting Mentor';
        if (lower.includes('need')) return 'Need Approval';
        if (lower === 'pending') return 'Pending';
        // Fallback: capitalize first char
        return s.charAt(0).toUpperCase() + s.slice(1);
    };

    // Helper to determine role approval/rejection using raw status or presence of timestamp
    const roleStatusFromSelection = (role) => {
        const rawField = role === 'mentor' ? selectedRequest?.statusMentorRaw || selectedRequest?.status || selectedRequest?.statusRaw : selectedRequest?.statusAdminRaw || selectedRequest?.byAdmin || selectedRequest?.byAdminRaw;
        const raw = (rawField || '').toString().toLowerCase();
        const ts = role === 'mentor' ? selectedRequest?.mentorTimestamp : selectedRequest?.adminTimestamp;
        if (raw.includes('rejected')) return 'Rejected';
        if (raw.includes('approved')) return 'Approved';
        if (ts) return 'Approved';
        if (raw && raw !== 'pending') return raw.charAt(0).toUpperCase() + raw.slice(1);
        return role === 'mentor' ? 'Waiting Mentor' : 'Pending';
    };

    const confirmApproval = async () => {
        try {
            if (confirmAction === 'approve_selected') {
                setLoading(true);
                const idsToApprove = selectedIds.slice();
                const promises = idsToApprove.map(id => apiClient.post(`/admin/koreksi/${id}/status`, {
                    _method: 'PUT',
                    status: 'approved'
                }).catch(e => e));
                await Promise.all(promises);
                await fetchData(currentPage);
                setSelectedIds([]);
                setIsConfirmOpen(false);
                setIsSuccessOpen(true);
            } else {
                const statusPayload = confirmAction === 'approve' ? 'approved' : 'rejected';
                const ids = (selectedRequest && selectedRequest.ids) ? selectedRequest.ids : (selectedRequest && selectedRequest.id ? [selectedRequest.id] : []);
                // optimistic update for immediate UX: mark admin decision and recompute friendly status
                const prevData = data;
                const optimisticData = data.map(d => {
                    if (!ids.includes(d.id)) return d;
                    const updated = { ...d };
                    updated.byAdminRaw = statusPayload === 'approved' ? 'Approved' : 'Rejected';
                    try {
                        updated.status = getTableStatus(updated);
                    } catch (e) {
                        updated.status = statusPayload === 'approved' ? 'Approved' : 'Rejected';
                    }
                    return updated;
                });
                setData(optimisticData);

                try {
                    await Promise.all(ids.map(id => apiClient.post(`/admin/koreksi/${id}/status`, { _method: 'PUT', status: statusPayload })));
                    setTimeout(() => fetchData(currentPage), 300);
                    setIsConfirmOpen(false);
                    setIsActionModalOpen(false);
                    setIsSuccessOpen(true);
                } catch (error) {
                    setData(prevData);
                    setIsConfirmOpen(false);
                    setIsErrorOpen(true);
                    setErrorMessage(error?.response?.data?.message || 'Failed to update status');
                }
            }
        } catch (error) {
            console.error("Gagal update:", error);
            setIsConfirmOpen(false);
            setIsFailedOpen(true);
        } finally {
            setLoading(false);
        }
    };


    // Pre-compute approval timestamps for modal display (null if not found)
    const mentorApprovedTime = selectedRequest ? (formatFullDateTime(selectedRequest?.mentorTimestamp) || formatApprovalTime('mentor')) : null;
    const adminApprovedTime = selectedRequest ? (formatFullDateTime(selectedRequest?.adminTimestamp) || formatApprovalTime('admin')) : null;

    // --- ACTIONS ---
    const handlePageChange = (page) => { if (page >= 1 && page <= paginationMeta.last_page) setCurrentPage(page); };
    const handleView = (payload) => {
        if (payload && payload.items) {
            const main = payload.mainItem || payload.items.find(it => String(it.type).toLowerCase().includes('clock in')) || payload.items[0];
            setSelectedRequest({
                key: payload.key,
                ids: payload.ids,
                userName: payload.userName,
                jobPosition: payload.jobPosition || payload.items[0]?.jobPosition || '-',
                division: payload.division || payload.items[0]?.division || '-',
                institution: payload.institution || payload.items[0]?.institution || '-',
                date: payload.dateLabel,
                items: payload.items,
                itemsDetails: payload.itemsDetails,
                mainReason: payload.mainReason || '-',
                mainFiles: payload.mainFiles || [],
                combinedStatus: payload.combinedStatus,
                statusMentorRaw: main?.raw?.status_mentor || main?.raw?.statusMentor || null,
                statusAdminRaw: main?.raw?.status_admin || main?.raw?.statusAdmin || null,
                mentorTimestamp: main?.raw ? findTimestampForRole(main.raw, 'mentor') : null,
                adminTimestamp: main?.raw ? findTimestampForRole(main.raw, 'admin') : null,
            });
        } else {
            const it = payload;
            setSelectedRequest({
                id: it.id,
                userName: it.name,
                jobPosition: it.jobPosition || '-', division: it.division || '-', institution: it.institution || '-',
                date: it.date,
                items: [it],
                itemsDetails: [{ id: it.id, typeLabel: it.type, jamKoreksi: formatTimeShort(it.correctedTime), waktuAsli: formatTimeShort(it.originalTime), statusLabel: getTableStatus(it) }],
                mainReason: it.reason || '-',
                mainFiles: it.files || [],
                combinedStatus: getTableStatus(it),
                    // include raw and timestamps so modal can show approval times
                    raw: it.raw || it,
                    mentorTimestamp: (it.raw || it) ? findTimestampForRole(it.raw || it, 'mentor') : null,
                    adminTimestamp: (it.raw || it) ? findTimestampForRole(it.raw || it, 'admin') : null,
                    statusMentorRaw: it.raw?.status_mentor || it.raw?.statusMentor || it.status || it.statusRaw || null,
                    statusAdminRaw: it.raw?.status_admin || it.raw?.statusAdmin || it.byAdmin || it.byAdminRaw || null,
                });
        }
        setIsActionModalOpen(true);
    };
    const initiateApproval = (action) => { setConfirmAction(action); setIsConfirmOpen(true); };
    const toggleFilter = (state, setState, value) => { if (state.includes(value)) setState(state.filter(item => item !== value)); else setState([...state, value]); };
    const handleResetFilter = () => {
        setFilterType([]);
        setFilterStatus([]);
        setAppliedFilterType([]);
        setAppliedFilterStatus([]);
        setIsFilterOpen(false);
    };

    const Badge = ({ text, small = false }) => {
        let styles = "bg-gray-50 text-gray-600 border-gray-200";
        const statusLower = text ? text.toString().toLowerCase() : "";
        if (statusLower === 'approved') styles = "bg-green-50 text-green-600 border-green-200 text-[13px] ";
        else if (statusLower.includes('need approval')) styles = "bg-[#FFF7ED] text-[#F97316] border-[#FFD8A8] text-[13px] ";
        else if (statusLower.includes('waiting mentor') || statusLower.includes('waiting admin') || statusLower.includes('pending')) styles = "bg-[#FFFBEB] text-[#F59E0B] border-[#FEF3C7] text-[13px] ";
        else if (statusLower === 'rejected') styles = "bg-red-50 text-red-600 border-red-200 text-[13px] ";
        else if (statusLower === 'clock in' || statusLower === 'clock out') styles = "bg-white border-slate-300 text-slate-700 text-[13px] ";
        const sizeClass = small ? 'w-[100px]' : 'min-w-[140px]';
        return <span className={`inline-flex items-center justify-center ${sizeClass} h-[34px] px-2 rounded-lg text-xs font-bold border whitespace-nowrap ${styles}`}>{text}</span>;
    };

    function getTableStatus(item) {
        const mentorRaw = (item.statusRaw || item.status || '').toLowerCase();
        const adminRaw = (item.byAdminRaw || item.byAdmin || '').toLowerCase();

        if (!mentorRaw || mentorRaw === 'pending') return 'Waiting Mentor';

        if (mentorRaw === 'approved') {
            if (!adminRaw || adminRaw === 'pending') return 'Need Approval';
            if (adminRaw === 'approved') return 'Approved';
            if (adminRaw === 'rejected') return 'Rejected';
        }

        if (mentorRaw === 'rejected') return 'Rejected';

        return mentorRaw.charAt(0).toUpperCase() + mentorRaw.slice(1);
    }

    return (
        <div className="bg-slate-50 min-h-screen p-8 font-sans text-slate-800 -mt-8 -ml-5 -mr-5">
            <div className="mb-8">
                <h1 className={`text-3xl font-bold ${textDarkBlue} mb-2`}>Correction Approval</h1>
                <p className="text-slate-500 text-sm">Check your intern correction</p>
            </div>

            {/* ACTION BAR & TABLE SAMA SEPERTI SEBELUMNYA ... */}
            <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-6">
                <div className="flex items-center gap-3 w-full md:w-auto">
                    <div className="relative flex-1 md:w-80">
                        <input type="text" placeholder="Search Intern" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-3.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#354C8F]/20 text-sm shadow-sm transition-all" />
                        <Search className="absolute left-3 top-3.5 text-slate-400" size={18} />
                    </div>
                    <button onClick={() => setIsFilterOpen(true)} className={`${btnPrimaryClass} !px-6`}>
                        <Filter size={18} />
                        <span className="hidden md:inline">Filter</span>
                        {(appliedFilterType.length > 0 || appliedFilterStatus.length > 0) && (
                            <div className="w-2 h-2 bg-red-400 rounded-full animate-pulse ml-2"></div>
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

            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="border-b border-slate-100 text-sm font-bold text-slate-900 bg-slate-50/50">
                                <th className="p-3 w-10 text-center">
                                    <input
                                        type="checkbox"
                                        className="w-4 h-4"
                                        checked={(() => {
                                            const eligibleIds = flatDisplay.filter(isEligibleForBulkApprove).map(i => i.id);
                                            return eligibleIds.length > 0 && eligibleIds.every(id => selectedIds.includes(id));
                                        })()}
                                        onChange={() => {
                                            const eligibleIds = flatDisplay.filter(isEligibleForBulkApprove).map(i => i.id);
                                            if (eligibleIds.length === 0) return;
                                            const allSelected = eligibleIds.every(id => selectedIds.includes(id));
                                            if (allSelected) setSelectedIds(prev => prev.filter(id => !eligibleIds.includes(id))); else setSelectedIds(prev => Array.from(new Set([...prev, ...eligibleIds])));
                                        }}
                                    />
                                </th>
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
                                <tr><td colSpan="10" className="p-12 text-center"><div className="flex flex-col items-center justify-center"><Loader2 className="animate-spin text-[#354C8F] mb-2" size={24} /><span className="text-slate-400">Loading data...</span></div></td></tr>
                            ) : flatDisplay.length > 0 ? (
                                flatDisplay.map((item, index) => (
                                    <tr key={item.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                                        <td className="p-3 text-center">
                                            <div className="flex items-center justify-center gap-2">
                                                {isEligibleForBulkApprove(item) ? (
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedIds.includes(item.id)}
                                                        onChange={() => toggleSelect(item.id)}
                                                        className="form-checkbox h-4 w-4"
                                                    />
                                                ) : <div className="w-4" />}
                                            </div>
                                        </td>
                                        <td className="p-3 text-center font-medium">{(paginationMeta.from || 1) + index}</td>
                                        <td className="p-3"><div className="font-medium text-slate-700">{item.name}</div></td>
                                        <td className="p-3 whitespace-nowrap">{item.raw?.tanggal ? String(item.raw.tanggal).slice(0, 10).split('-').reverse().join('/') : item.date}</td>
                                        <td className="p-3 text-center">
                                            <span className="px-3 py-1 rounded-lg text-sm font-semibold border bg-white border-slate-200 text-slate-700 whitespace-nowrap">{item.type}</span>
                                        </td>
                                        <td className="p-3 text-sm text-slate-600">{item.jobPosition || '-'}</td>

                                        <td className="p-3 text-sm text-slate-600">{item.division || '-'}</td>
                                        <td className="p-3 text-sm text-slate-600">{item.institution || '-'}</td>
                                        <td className="p-3 text-center"><Badge text={getTableStatus(item)} /></td>
                                        <td className="p-3 text-center">
                                            {isEligibleForBulkApprove(item) ? (
                                                <button onClick={() => handleView(item)} className="inline-flex items-center justify-center h-[34px] w-[34px] bg-[#22C55E] text-white rounded-lg hover:bg-[#16A34A] transition-colors shadow-sm shadow-green-100 active:scale-95" title="Review"><Edit size={14} /></button>
                                            ) : (
                                                <button onClick={() => handleView(item)} className="inline-flex items-center justify-center h-[34px] w-[34px] bg-[#354C8F] text-white rounded-lg hover:bg-[#2a3c70] transition-colors shadow-sm shadow-indigo-100 active:scale-95" title="View Detail"><Eye size={14} /></button>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr><td colSpan="10" className="p-8 text-center text-slate-400">No requests found.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
                {/* Pagination Controls */}
                {!loading && displayData.length > 0 && (
                    <div className="flex flex-col md:flex-row justify-between items-center p-5 border-t border-slate-100 text-sm text-slate-500 gap-4">
                        <p className="order-2 md:order-1">Showing {paginationMeta.from} to {paginationMeta.to} of {paginationMeta.total} entries</p>
                        <div className="flex items-center gap-4 order-1 md:order-2">
                            <div className="flex items-center gap-2">
                                <label className="text-sm md:text-sm font-medium text-slate-600">Per page:</label>
                                <select
                                    value={itemsPerPage}
                                    onChange={(e) => {
                                        setItemsPerPage(Number(e.target.value));
                                        setCurrentPage(1);
                                    }}
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
                                    const pageCurrent = (typeof paginationMeta !== 'undefined' && paginationMeta.current_page) ? paginationMeta.current_page : currentPage;
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
                    </div>

            {/* MODAL FILTER ... */}
                <AnimatePresence>
                    {isFilterOpen && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
                            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-white w-full max-w-md rounded-2xl shadow-2xl p-5 relative">
                                <div className="flex justify-between items-center mb-6"><h3 className="text-[18px] font-bold text-[#27345A]">Correction Filter</h3><button onClick={() => setIsFilterOpen(false)}><X size={24} className="text-slate-400 hover:text-slate-600" /></button></div>
                                <div className="space-y-6">
                                    <div><label className="block text-sm font-bold text-slate-800 mb-2">Type</label><div className="flex flex-wrap gap-2">{['Clock In', 'Clock Out'].map(type => (<button key={type} onClick={() => toggleFilter(filterType, setFilterType, type)} className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all border ${filterType.includes(type) ? 'bg-[#354C8F] text-white border-[#354C8F] shadow-md' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}>{type}</button>))}</div></div>
                                    <div><label className="block text-sm font-bold text-slate-800 mb-2">Status</label><div className="flex flex-wrap gap-2">{['Approved', 'Need Approval', 'Waiting Mentor', 'Rejected'].map(status => (<button key={status} onClick={() => toggleFilter(filterStatus, setFilterStatus, status)} className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all border ${filterStatus.includes(status) ? 'bg-[#354C8F] text-white border-[#354C8F] shadow-md' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}>{status}</button>))}</div></div>
                                </div>
                                <hr className="my-4 border-slate-100" />
                                <div className="flex gap-3 justify-end"><button onClick={handleResetFilter} className={btnSecondaryClass}>Reset</button><button onClick={() => {
                                    setAppliedFilterType(filterType);
                                    setAppliedFilterStatus(filterStatus);
                                    setIsFilterOpen(false);
                                }} className={btnPrimaryClass}>Apply</button></div>
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>

                {/* --- MODAL DETAIL & ATTACHMENTS (FIXED) --- */}
                <AnimatePresence>
                    {isActionModalOpen && selectedRequest && (
                        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
                            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} className="bg-white w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                                <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-white">
                                    <h3 className="text-[18px] font-bold text-[#27345A]">Action Attendance Correction Form</h3>
                                    <button onClick={() => setIsActionModalOpen(false)}><X size={24} className="text-slate-400 hover:text-slate-600" /></button>
                                </div>
                                <div className="p-8 overflow-y-auto custom-scrollbar">
                                    <div className="space-y-6 -mt-4">
                                        <div className="grid grid-cols-3 gap-3 mb-3">
                                            <div className="text-sm text-slate-600"><div className="block text-sm font-bold text-slate-800">Name</div><div className="mt-1">{selectedRequest.userName || '-'}</div></div>
                                            <div className="text-sm text-slate-600"><div className="block text-sm font-bold text-slate-800">Division</div><div className="mt-1">{selectedRequest.division || '-'}</div></div>
                                            <div className="text-sm text-slate-600"><div className="block text-sm font-bold text-slate-800">Institution</div><div className="mt-1">{selectedRequest.institution || '-'}</div></div>
                                        </div>
                                        <div><label className="block text-sm font-bold text-slate-800 mb-2 -mt-1">Correction Type</label><div className="flex items-center gap-2">{selectedRequest?.items ? selectedRequest.items.map(i => (<Badge key={i.id} text={i.type} small />)) : <Badge text={selectedRequest?.itemsDetails ? selectedRequest.itemsDetails[0]?.typeLabel : selectedRequest.type || '-'} small />}</div></div>



                                        {/* Detail Status (Mentor & Admin) */}
                                        <div>
                                            <label className="block text-sm font-bold text-slate-800 mb-2">Detail Status</label>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50">
                                                    <div className="flex items-center justify-between mb-2">
                                                        <div className="text-sm font-bold text-slate-700">Mentor</div>
                                                        <Badge text={roleStatusFromSelection('mentor')} />
                                                    </div>
                                                    {(() => {
                                                        const status = roleStatusFromSelection('mentor');
                                                        if (status && (status.includes('Approved') || status.includes('Rejected'))) {
                                                            return mentorApprovedTime ? (
                                                                <div className="text-[12px] text-slate-500">{status.includes('Rejected') ? 'Rejected at ' : 'Approved at '}{mentorApprovedTime}</div>
                                                            ) : (
                                                                <div className="text-[12px] text-slate-400">{status || '-'}</div>
                                                            );
                                                        }
                                                        return <div className="text-[13px] text-slate-400">{status || '-'}</div>;
                                                    })()}
                                                </div>

                                                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50">
                                                    <div className="flex items-center justify-between mb-2">
                                                            <div className="text-sm font-bold text-slate-700">Admin</div>
                                                            <Badge text={roleStatusFromSelection('admin')} />
                                                        </div>
                                                        {(() => {
                                                            const status = roleStatusFromSelection('admin');
                                                            if (status && (status.includes('Approved') || status.includes('Rejected'))) {
                                                                return adminApprovedTime ? (
                                                                    <div className="text-[12px] text-slate-500">{status.includes('Rejected') ? 'Rejected at ' : 'Approved at '}{adminApprovedTime}</div>
                                                                ) : (
                                                                    <div className="text-[12px] text-slate-400">{status || '-'}</div>
                                                                );
                                                            }
                                                            return <div className="text-[13px] text-slate-400">{status || '-'}</div>;
                                                        })()}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-1 gap-4">
                                            <div>
                                                <label className="block text-sm font-bold text-slate-800 mb-2">Date</label>
                                                <div className="flex items-center px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-600 text-sm font-medium">
                                                    <Calendar size={16} className="mr-3 text-slate-400" />
                                                    {selectedRequest.date}
                                                </div>
                                            </div>
                                        </div>
                                        {/* Per-type times card */}
                                        <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-3">
                                            {selectedRequest.itemsDetails && selectedRequest.itemsDetails.map((d) => (
                                                <div key={d.id} className="grid grid-cols-2 gap-4">
                                                    <div>
                                                        <p className="text-xs text-slate-400 font-bold uppercase mb-1">Original Time <span className="text-[11px] text-slate-500 ml-2">({d.typeLabel})</span></p>
                                                        <div className="flex items-center gap-2 text-sm font-medium text-slate-700 bg-white p-2 rounded-lg border border-slate-100"><Clock size={16} className="text-slate-400 mr-2" />{d.waktuAsli}</div>
                                                    </div>
                                                    <div>
                                                        <p className="text-xs text-slate-400 font-bold uppercase mb-1">Correction Time <span className="text-[11px] text-slate-500 ml-2">({d.typeLabel})</span></p>
                                                        <div className="flex items-center gap-2 text-sm font-medium text-slate-700 bg-white p-2 rounded-lg border border-slate-100"><Clock size={16} className="text-blue-500 mr-2" />{d.jamKoreksi}</div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                        <div><label className="block text-sm font-bold text-slate-800 mb-2">Reason</label><textarea readOnly value={selectedRequest.mainReason || selectedRequest.reason} className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-600 text-sm leading-relaxed resize-none focus:outline-none" rows="3" /></div>

                                        {/* LIST ATTACHMENTS (FIXED) */}
                                        <div>
                                            <label className="block text-sm font-bold text-slate-800 mb-2">Attachments</label>
                                            {(selectedRequest.mainFiles && selectedRequest.mainFiles.length > 0) ? (
                                                <div className="space-y-3">
                                                    {selectedRequest.mainFiles.map((filePath, idx) => (
                                                        <div key={idx} className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-xl group hover:border-[#354C8F]/30 transition-all">

                                                            {/* Klik Area: Preview */}
                                                            <div
                                                                className="flex items-center gap-3 overflow-hidden flex-1 cursor-pointer"
                                                                onClick={() => handleViewLampiran(idx, selectedRequest.ids ? selectedRequest.ids[0] : selectedRequest.id)}
                                                            >
                                                                {getFileIcon(filePath)}
                                                                <div className="min-w-0">
                                                                    {/* Tampilkan Nama Bersih */}
                                                                    <p className="text-sm font-bold text-slate-700 truncate group-hover:text-[#354C8F] transition-colors">{getCleanFileName(filePath)}</p>
                                                                    <p className="text-[10px] text-slate-400">Click to preview</p>
                                                                </div>
                                                            </div>

                                                            {/* Tombol Download (Baru) */}
                                                            <button
                                                                onClick={() => handleDownloadFile(filePath, idx, selectedRequest.ids ? selectedRequest.ids[0] : selectedRequest.id)}
                                                                disabled={downloadingFileId === `file-${idx}`}
                                                                className="p-2 text-slate-400 hover:text-[#354C8F] hover:bg-slate-50 rounded-lg transition-all"
                                                                title="Download File"
                                                            >
                                                                {downloadingFileId === `file-${idx}` ? (
                                                                    <Loader2 size={18} className="animate-spin text-[#354C8F]" />
                                                                ) : (
                                                                    <Download size={18} />
                                                                )}
                                                            </button>
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
                                    {(() => {
                                        const mentorLower = (selectedRequest.statusMentorRaw || selectedRequest.statusRaw || selectedRequest.status || '').toString().toLowerCase();
                                        const adminLower = (selectedRequest.statusAdminRaw || selectedRequest.byAdminRaw || selectedRequest.byAdmin || '').toString().toLowerCase();
                                        const mentorApproved = (mentorLower && mentorLower.includes('approved')) || !!selectedRequest?.mentorTimestamp;
                                        const adminPending = (!adminLower || adminLower.includes('pending') || adminLower === '');
                                        const hasNeedApproval = selectedRequest && (selectedRequest.combinedStatus === 'Need Approval' || (selectedRequest.items && selectedRequest.items.some(i => getTableStatus(i) === 'Need Approval')));
                                        const canAct = (mentorApproved && adminPending) || hasNeedApproval;
                                        return canAct;
                                    })() ? (
                                        <div className="flex gap-3 justify-end">
                                            <button onClick={() => initiateApproval('reject')} className="w-36 border border-[#EF4444] text-[#EF4444] hover:bg-red-50 py-3 rounded-xl font-bold text-sm transition-all active:scale-95">Reject</button>
                                            <button onClick={() => initiateApproval('approve')} className="w-36 bg-[#22C55E] hover:bg-[#16A34A] text-white py-3 rounded-xl font-bold text-sm shadow-md shadow-green-100 transition-all active:scale-95">Approve</button>
                                        </div>
                                    ) : (
                                        <button onClick={() => setIsActionModalOpen(false)} className={btnSecondaryClass}>Close</button>
                                    )}
                                </div>
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>

                {/* --- MODAL CONFIRM & SUCCESS ... */}
                <AnimatePresence>
                    {isConfirmOpen && (
                        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="bg-white rounded-2xl shadow-2xl p-8 text-center max-w-sm w-full">
                                <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 ${confirmAction === 'approve' ? 'bg-green-50' : 'bg-red-50'}`}><AlertTriangle className={confirmAction === 'approve' ? 'text-green-500' : 'text-red-500'} size={40} strokeWidth={2.5} /></div>
                                <h3 className="text-[20px] font-bold text-[#27345A] mb-2">{confirmAction === 'approve_selected' ? 'Approve Selected?' : (confirmAction === 'approve' ? 'Approve Correction?' : 'Reject Correction?')}</h3>
                                {confirmAction === 'approve_selected' && <p className="text-slate-500 text-sm mb-4">Approve {selectedIds.length} selected corrections? This action cannot be undone.</p>}
                                {confirmAction === 'reject' && (
                                    <>
                                        <p className="text-slate-400 text-xs">Please make sure this is correct before proceeding. Reject actions cannot be undone.</p>
                                    </>
                                )}
                                <div className="flex gap-3 mt-8">
                                    <button onClick={() => setIsConfirmOpen(false)} className={btnSecondaryClass + " w-full"}>Cancel</button>
                                    <button onClick={confirmApproval} className={`w-full py-3.5 px-6 rounded-xl font-bold text-sm shadow-md text-white transition-all active:scale-95 ${confirmAction === 'approve' || confirmAction === 'approve_selected' ? 'bg-[#22C55E] hover:bg-[#16A34A] shadow-green-200' : 'bg-[#EF4444] hover:bg-[#DC2626] shadow-red-200'}`}>{confirmAction === 'approve' || confirmAction === 'approve_selected' ? 'Approve' : 'Reject'}</button>
                                </div>
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>
                <AnimatePresence>
                    {isSuccessOpen && (
                        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="bg-white rounded-2xl shadow-2xl p-8 text-center max-w-sm w-full">
                                <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 ${confirmAction === 'approve' ? 'bg-green-50' : 'bg-green-50'}`}><Check className="text-green-500" size={40} strokeWidth={3} /></div>
                                <h3 className="text-xl font-bold text-[#27345A] mb-2">{confirmAction === 'approve' || confirmAction === 'approve_selected' ? 'Approved' : confirmAction === 'download' ? 'Download Success' : 'Rejected'}</h3>
                                <p className="text-slate-500 text-sm mb-6">{confirmAction === 'approve' || confirmAction === 'approve_selected' ? 'The correction has been updated successfully.' : confirmAction === 'download' ? 'The file has been downloaded successfully.' : 'The correction has been rejected.'}</p>
                                <button onClick={() => setIsSuccessOpen(false)} className="w-full bg-[#22C55E] hover:bg-[#16A34A] text-white py-3.5 rounded-xl font-bold text-sm shadow-md shadow-green-200 mt-2">OK</button>
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>

                {/* ERROR MODAL */}
                <AnimatePresence>
                    {isErrorOpen && (
                        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="bg-white rounded-2xl shadow-2xl p-8 text-center max-w-sm w-full">
                                <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6"><AlertCircle className="text-red-500" size={40} strokeWidth={2.5} /></div>
                                <h3 className="text-xl font-bold text-slate-800 mb-2">Error</h3>
                                <p className="text-slate-500 text-sm mb-8">{errorMessage}</p>
                                <button onClick={() => setIsErrorOpen(false)} className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 py-3.5 rounded-xl font-bold text-sm">Close</button>
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>
            </div>
            );
};

            export default CorrectionApproval;