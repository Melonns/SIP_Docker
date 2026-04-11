import React, { useState, useEffect } from 'react';
import {
    Calendar,
    ChevronDown,
    FileSpreadsheet,
    FileText,
    ChevronLeft,
    ChevronRight,
    RefreshCw,
    Filter,
    File as FileIcon,
    Eye,
    Check,
    X
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import apiClient from '../../api/axiosConfig';

// Button Styles (same pattern as Admin)
const btnBase = "py-3 px-4 md:px-6 rounded-xl font-bold text-[14px] flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed";
const btnPrimary = `${btnBase} bg-[#354C8F] hover:bg-[#2a3c70] text-white shadow-md shadow-indigo-200`;
const btnSecondary = `${btnBase} bg-white border border-slate-300 text-slate-700 hover:bg-slate-50`;

const reportTypeOptions = [
    { value: "attendance", label: "Attendance Report" },
    { value: "logbook", label: "Daily Activities (Logbook)" },
    { value: "mentor_assignment", label: "Internship List" }
];

const ReportsMentor = () => {
    // --- CALCULATE DEFAULT DATES ---
    const now = new Date();
    // Period logic: Jan-Jun (0-5) or Jul-Dec (6-11)
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    let periodStart, periodEnd;
    
    if (currentMonth < 6) {
        periodStart = new Date(currentYear, 0, 1); // Jan 1st
        periodEnd = new Date(currentYear, 5, 30);  // Jun 30th
    } else {
        periodStart = new Date(currentYear, 6, 1);  // Jul 1st
        periodEnd = new Date(currentYear, 11, 31); // Dec 31st
    }

    const defaultStartDate = periodStart.toISOString().split('T')[0];
    const defaultEndDate = periodEnd.toISOString().split('T')[0];
    
    // For internship list: use same period dates
    const internshipListStartDate = defaultStartDate;
    const internshipListEndDate = defaultEndDate;

    // --- STATES ---
    const [filters, setFilters] = useState({
        university: "",
        intern: "",
        activeRole: "",
        startDate: defaultStartDate,
        endDate: defaultEndDate,
        reportType: "attendance" // default (attendance | logbook)
    });

    const [isPreviewVisible, setIsPreviewVisible] = useState(false);
    const [loadingPreview, setLoadingPreview] = useState(false);
    const [isReportTypeOpen, setIsReportTypeOpen] = useState(false);
    const [openScopeKey, setOpenScopeKey] = useState(null);
    const [previewData, setPreviewData] = useState([]);

    // Status modal
    const [showStatusModal, setShowStatusModal] = useState(false);
    const [statusMessage, setStatusMessage] = useState({ title: "", desc: "" });
    const [statusType, setStatusType] = useState('success');

    // Filter options from API
    const [filterOptions, setFilterOptions] = useState({
        universities: [],
        interns: []
    });
    const [loadingFilters, setLoadingFilters] = useState(false);

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);
    const [paginationMeta, setPaginationMeta] = useState({
        current_page: 1,
        last_page: 1,
        from: 0,
        to: 0,
        total: 0
    });

    // Since data is paginated from API, currentItems is just previewData
    const currentItems = previewData;

    // --- FETCH FILTERS ---
    const fetchFilters = async () => {
        setLoadingFilters(true);
        try {
            const response = await apiClient.get('mentor/reports/filters');
            if (response.data.success) {
                setFilterOptions({
                    universities: response.data.universities,
                    interns: response.data.interns
                });
            }
        } catch (error) {
            console.error('Error fetching filters:', error);
        } finally {
            setLoadingFilters(false);
        }
    };

    useEffect(() => {
        fetchFilters();
    }, []);

    useEffect(() => {
        if (isPreviewVisible) {
            handlePageChange(1);
        }
    }, [itemsPerPage]);

    // --- FETCH REPORT DATA ---
    const fetchReportData = async (preview = true, page = 1) => {
        const params = {
            preview: preview,
            page: page,
            per_page: itemsPerPage
        };
        if (filters.university) params.universitas = filters.university;
        if (filters.intern) params.intern_id = filters.intern;
        if (filters.startDate) params.start_date = filters.startDate;
        if (filters.endDate) params.end_date = filters.endDate;
        if (filters.reportType === 'mentor_assignment') {
            params.active_role = 'mentor'; // role context scoping
            params.status = filters.activeRole; // intern active/inactive filter
        }

        try {
            let endpoint = '';
            if (filters.reportType === 'attendance') endpoint = 'mentor/reports/attendance';
            else if (filters.reportType === 'logbook') endpoint = 'mentor/reports/logbook';
            else if (filters.reportType === 'mentor_assignment') endpoint = 'mentor/reports/assigned-interns';

            if (endpoint) {
                const response = await apiClient.get(endpoint, { params });
                if (response.data.success) {
                    return {
                        data: response.data.data || [],
                        pagination: response.data.pagination || {}
                    };
                }
            }
            return { data: [], pagination: {} };
        } catch (error) {
            console.error('Error fetching report data:', error);
            return { data: [], pagination: {} };
        }
    };

    // --- HANDLERS ---
    const handleFilterChange = (key, value) => {
        setFilters(prev => {
            let newFilters = {
                ...prev,
                [key]: value
            };
            
            // When report type changes, adjust date range accordingly
            if (key === 'reportType') {
                if (value === 'mentor_assignment') {
                    newFilters.startDate = internshipListStartDate;
                    newFilters.endDate = internshipListEndDate;
                    newFilters.intern = ''; // Clear specific intern selection
                    newFilters.activeRole = ''; // Clear active role filter
                } else {
                    newFilters.startDate = defaultStartDate;
                    newFilters.endDate = defaultEndDate;
                    newFilters.activeRole = '';
                }
            }
            
            return newFilters;
        });
        setIsPreviewVisible(false);
    };

    const handleGeneratePreview = async () => {
        setLoadingPreview(true);
        try {
            const result = await fetchReportData(true, currentPage);
            setPreviewData(result.data);
            // Update pagination meta from API
            if (result.pagination) {
                const perPage = result.pagination.per_page || itemsPerPage;
                const currentPageNum = result.pagination.current_page || 1;
                const total = result.pagination.total || 0;
                const from = total > 0 ? (currentPageNum - 1) * perPage + 1 : 0;
                const to = total > 0 ? Math.min(currentPageNum * perPage, total) : 0;
                setPaginationMeta({
                    current_page: currentPageNum,
                    last_page: result.pagination.last_page || 1,
                    from: from,
                    to: to,
                    total: total
                });
            }
            setIsPreviewVisible(true);
        } catch (error) {
            console.error('Error generating preview:', error);
        } finally {
            setLoadingPreview(false);
        }
    };

    const handleExport = async (type) => {
        // Support PDF/Excel/CSV exports for any reportType by selecting endpoint dynamically
        if (!['PDF', 'Excel', 'CSV'].includes(type)) {
            setStatusMessage({ title: 'Export Failed', desc: 'Unsupported export type.' });
            setStatusType('error');
            setShowStatusModal(true);
            return;
        }

        // Map reportType to endpoint
        let endpoint = '';
        if (filters.reportType === 'attendance') endpoint = 'mentor/reports/attendance';
        else if (filters.reportType === 'logbook') endpoint = 'mentor/reports/logbook';
        else if (filters.reportType === 'mentor_assignment') endpoint = 'mentor/reports/assigned-interns';

        if (!endpoint) {
            setStatusMessage({ title: 'Export Failed', desc: 'No export endpoint for selected report type.' });
            setStatusType('error');
            setShowStatusModal(true);
            return;
        }

        // Build params; always use preview=false for exports
        const params = {
            preview: false,
            format: type.toLowerCase(),
            page: 1,
            per_page: itemsPerPage
        };
        if (filters.university) params.universitas = filters.university;
        if (filters.intern) params.intern_id = filters.intern;
        if (filters.startDate) params.start_date = filters.startDate;
        if (filters.endDate) params.end_date = filters.endDate;
        if (filters.reportType === 'mentor_assignment') {
            params.active_role = 'mentor'; // role context scoping
            params.status = filters.activeRole; // intern active/inactive filter
        }

        try {
            // Use blob responseType to simplify file handling
            const response = await apiClient.get(endpoint, { params, responseType: 'blob' });
            const contentType = response.headers && response.headers['content-type'] ? response.headers['content-type'].toLowerCase() : '';
            const contentDisposition = response.headers && (response.headers['content-disposition'] || response.headers['Content-Disposition'] || '');

            console.log('Export response', { status: response.status, headers: response.headers, contentType, blobSize: response.data && response.data.size ? response.data.size : null });

            // If backend returned JSON (error message) as blob
            if (contentType.includes('application/json')) {
                const text = await response.data.text();
                let parsed = {};
                try { parsed = JSON.parse(text); } catch (e) { parsed = { message: text }; }
                setStatusMessage({ title: 'Export Failed', desc: parsed.message || 'There was an error exporting the report.' });
                setStatusType('error');
                setShowStatusModal(true);
                return;
            }

            // Determine extension
            let extension = '';
            if (contentType.includes('pdf')) extension = 'pdf';
            else if (contentType.includes('zip')) extension = 'zip';
            else if (contentType.includes('spreadsheet') || contentType.includes('excel') || contentType.includes('vnd.openxmlformats-officedocument') || contentType.includes('vnd.ms-excel') || contentType.includes('application/vnd.ms-excel')) extension = 'xlsx';
            else if (contentType.includes('text/csv') || contentType.includes('csv') || contentType.includes('text/plain')) extension = 'csv';
            else {
                // Fallback to requested type if content-type is generic or missing
                if (type === 'PDF') extension = 'pdf';
                else if (type === 'Excel') extension = 'xlsx';
                else if (type === 'CSV') extension = 'csv';
                else extension = 'bin';
            }

            // Try to extract filename from content-disposition
            const fileDate = new Date().toISOString().split('T')[0];
            let filename = `${filters.reportType}_report_${fileDate}.${extension}`;
            try {
                const match = /filename\*?=([^;]+)/i.exec(contentDisposition);
                if (match && match[1]) {
                    filename = match[1].trim().replace(/^["']|["']$/g, '');
                    // If filename has encoding like UTF-8''name.ext, strip it
                    if (filename.includes("''")) filename = filename.split("''").pop();
                }
            } catch (e) {
                // ignore
            }

            // Ensure blob has data
            if (!response.data || (response.data.size !== undefined && response.data.size === 0)) {
                setStatusMessage({ title: 'Export Failed', desc: 'Empty file received from server.' });
                setStatusType('error');
                setShowStatusModal(true);
                return;
            }

            // Trigger download
            const url = window.URL.createObjectURL(response.data);
            const link = document.createElement('a'); link.href = url; link.setAttribute('download', filename); document.body.appendChild(link); link.click(); link.remove(); window.URL.revokeObjectURL(url);

            setStatusMessage({ title: 'Export Successful', desc: `Your ${filters.reportType} report has been exported to ${type}.` });
            setStatusType('success');
            setShowStatusModal(true);

        } catch (error) {
            console.error('Error exporting:', error);

            // Handle cases similar to previous heuristics (intercepted, network, 204)
            if (error && error.response) {
                const resp = error.response; const statusText = (resp.statusText || '').toLowerCase(); const dataStr = (resp.data && typeof resp.data === 'string') ? resp.data.toLowerCase() : (resp.data && resp.data.message ? resp.data.message.toLowerCase() : '');
                if (resp.status === 204 || statusText.includes('intercepted') || statusText.includes('idm') || dataStr.includes('intercepted') || dataStr.includes('idm')) {
                    setStatusMessage({ title: 'Export Successful', desc: `Your ${filters.reportType} report has been exported to ${type}.` }); setStatusType('success'); setShowStatusModal(true); return;
                }
            }

            if (error && error.request) {
                const req = error.request; const reqStatus = req.status; const reqStatusText = (req.statusText || '').toLowerCase(); const reqResponseStr = req.response && typeof req.response === 'string' ? req.response.toLowerCase() : '';
                if (reqStatus === 204 || reqStatusText.includes('intercepted') || reqStatusText.includes('idm') || reqResponseStr.includes('intercepted') || reqResponseStr.includes('idm')) {
                    setStatusMessage({ title: 'Export Successful', desc: `Your ${filters.reportType} report has been exported to ${type}.` }); setStatusType('success'); setShowStatusModal(true); return;
                }

                const isNetworkLike = (error.message && error.message.toLowerCase().includes('network')) || reqStatus === 0;
                if (isNetworkLike) {
                    setStatusMessage({ title: 'Export Successful', desc: `Your ${filters.reportType} report export was initiated.` }); setStatusType('success'); setShowStatusModal(true); return;
                }
            }

            setStatusMessage({ title: 'Export Failed', desc: 'There was an error exporting the report.' });
            setStatusType('error');
            setShowStatusModal(true);
        }
    };

    const handlePageChange = async (page) => {
        if (page >= 1 && page <= paginationMeta.last_page) {
            setCurrentPage(page);
            setLoadingPreview(true);
            try {
                const result = await fetchReportData(true, page);
                setPreviewData(result.data);
                if (result.pagination) {
                    const perPage = result.pagination.per_page || itemsPerPage;
                    const currentPageNum = result.pagination.current_page || page;
                    const total = result.pagination.total || 0;
                    const from = total > 0 ? (currentPageNum - 1) * perPage + 1 : 0;
                    const to = total > 0 ? Math.min(currentPageNum * perPage, total) : 0;
                    setPaginationMeta({
                        current_page: currentPageNum,
                        last_page: result.pagination.last_page || 1,
                        from: from,
                        to: to,
                        total: total
                    });
                }
            } catch (error) {
                console.error('Error changing page:', error);
            } finally {
                setLoadingPreview(false);
            }
        }
    };

    // --- HELPERS ---
    const formatBukti = (raw) => {
        if (!raw) return '-';
        try {
            let str = raw;
            if (typeof raw === 'string' && raw.trim().startsWith('[')) {
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed) && parsed.length > 0) str = parsed[0];
            }
            const fileName = str.split('/').pop().split('\\').pop();
            // Remove typical system prefix: 1234567890_abcdef123_
            return fileName.replace(/^\d+_[a-fA-F0-9]+_/i, '');
        } catch (e) {
            return raw;
        }
    };

    const formatDate = (dateString) => {
        if (!dateString) return '-';
        try {
            const date = new Date(dateString);
            if (isNaN(date.getTime())) return dateString;
            const day = String(date.getDate()).padStart(2, '0');
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const year = date.getFullYear();
            return `${day}-${month}-${year}`;
        } catch (e) {
            return dateString;
        }
    };

    const formatTime = (timeString) => {
        if (!timeString) return '-';
        try {
            // Handle both "HH:MM:SS" and "HH:MM" formats
            const timeParts = timeString.split(':');
            if (timeParts.length >= 2) {
                return `${timeParts[0]}:${timeParts[1]}`;
            }
            return timeString;
        } catch (e) {
            return timeString;
        }
    };

    const mapAttendanceStatus = (status) => {
        const statusLower = String(status || '').toLowerCase();
        if (statusLower === 'sakit' || statusLower === 'sick') return 'Sick';
        if (statusLower === 'izin' || statusLower === 'on leave') return 'On Leave';
        if (statusLower === 'absent') return 'Absent';
        if (statusLower === 'early' || statusLower === 'on early' || statusLower === 'earlier') return 'Early';
        if (statusLower === 'on time') return 'On Time';
        if (statusLower === 'late') return 'Late';
        return status;
    };

    // --- RENDER PREVIEW TABLE ---
    const renderPreviewTable = () => {
        if (!currentItems || currentItems.length === 0) {
            return (
                <div className="p-6 text-center text-slate-400">
                    No data for the selected configuration.
                </div>
            );
        }
        if (filters.reportType === 'attendance') {
            return (
                <table className="w-full text-left">
                    <thead className="bg-slate-50 text-xs font-bold text-slate-700 border-b border-slate-200">
                        <tr>
                            <th className="p-3">Date</th>
                            <th className="p-3">Name</th>
                            <th className="p-3">Institution</th>
                            <th className="p-3">Major</th>
                            <th className="p-3 text-center">Status</th>
                            <th className="p-3 text-center">Clock In</th>
                            <th className="p-3 text-center">Clock Out</th>
                            <th className="p-3">Notes</th>
                        </tr>
                    </thead>
                    <tbody className="text-xs text-slate-600 divide-y divide-slate-100">
                        {currentItems.map((row) => {
                            const mappedStatus = mapAttendanceStatus(row.status);
                            const isAbsentStatus = ['Absent', 'Sick', 'On Leave'].includes(mappedStatus);
                            const getBadgeStyles = (status) => {
                                if (status === 'On Time') return 'bg-green-100 text-green-700';
                                if (status === 'Sick') return 'bg-blue-100 text-blue-700';
                                if (status === 'Absent') return 'bg-red-100 text-red-700';
                                if (status === 'Early') return 'bg-orange-100 text-orange-700';
                                if (status === 'Late') return 'bg-yellow-100 text-yellow-700';
                                if (status === 'On Leave') return 'bg-slate-100 text-slate-600';
                                return 'bg-slate-100 text-slate-600';
                            };
                            return (
                                <tr key={row.id || row.date + row.name} className={isAbsentStatus ? 'bg-yellow-100' : ''}>
                                    <td className="p-3">{formatDate(row.date)}</td>
                                    <td className="p-3 font-bold text-[#354C8F]">{row.name}</td>
                                    <td className="p-3 text-xs">{row.univ || '-'}</td>
                                    <td className="p-3 text-xs">{row.jurusan || '-'}</td>
                                    <td className="p-3 text-center"><span className={`px-2 py-1 rounded text-[10px] font-bold ${getBadgeStyles(mappedStatus)}`}>{mappedStatus}</span></td>
                                    <td className="p-3 text-center font-mono text-xs">{formatTime(row.clock_in)}</td>
                                    <td className="p-3 text-center font-mono text-xs">{formatTime(row.clock_out)}</td>
                                    <td className="p-3 italic text-slate-400">{row.notes || '-'}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            );
        }

        if (filters.reportType === 'logbook') {
            return (
                <table className="w-full text-left">
                    <thead className="bg-slate-50 text-xs font-bold text-slate-700 border-b border-slate-200">
                        <tr>
                            <th className="p-3">Date</th>
                            <th className="p-3">Name</th>
                            <th className="p-3">Institution</th>
                            <th className="p-3">Major</th>
                            <th className="p-3">Division</th>
                            <th className="p-3">Job Position</th>
                            <th className="p-3">Activity</th>
                            <th className="p-3">Evidence / Output</th>
                            <th className="p-3 text-center">Status</th>
                        </tr>
                    </thead>
                    <tbody className="text-xs text-slate-600 divide-y divide-slate-100">
                        {currentItems.map((row, idx) => {
                            // Capitalize status
                            const statusText = row.status ? row.status.charAt(0).toUpperCase() + row.status.slice(1) : 'Pending';
                            const s = String(row.status || "").toLowerCase();
                            let badgeStyles = "bg-slate-100 text-slate-600"; // Default
                            if (s === "verified") badgeStyles = "bg-green-100 text-green-700";
                            else if (s === "rejected") badgeStyles = "bg-red-50 text-red-600";
                            else if (s === "pending") badgeStyles = "bg-yellow-100 text-yellow-700";
                            
                            return (
                                <tr key={row.id || idx} className="hover:bg-slate-50">
                                    <td className="p-3">{formatDate(row.date)}</td>
                                    <td className="p-3 font-bold text-[#354C8F]">{row.name}</td>
                                    <td className="p-3 text-xs">{row.univ || row.university || '-'}</td>
                                    <td className="p-3 text-xs">{row.jurusan || row.major || '-'}</td>
                                    <td className="p-3 text-xs">{row.division || '-'}</td>
                                    <td className="p-3 text-xs">{row.job_position || '-'}</td>
                                    <td className="p-3">{row.activity}</td>
                                    <td className="p-3 text-slate-600 truncate max-w-[200px]" title={row.bukti_kegiatan || row.evidence}>
                                        {formatBukti(row.bukti_kegiatan || row.evidence)}
                                    </td>
                                    <td className="p-3 text-center">
                                        <span className={`px-2 py-1 rounded text-[10px] font-bold ${badgeStyles}`}>
                                            {statusText}
                                        </span>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            );
        }

        if (filters.reportType === 'mentor_assignment') {
            return (
                <table className="w-full text-left">
                    <thead className="bg-slate-50 text-xs font-bold text-slate-700 border-b border-slate-200">
                        <tr>
                            <th className="p-3">Name</th>
                            <th className="p-3">Institution</th>
                            <th className="p-3">Major</th>
                            <th className="p-3">Division</th>
                            <th className="p-3">Site</th>
                            <th className="p-3 text-center">Period</th>
                            <th className="p-3 text-center">Status</th>
                        </tr>
                    </thead>
                    <tbody className="text-xs text-slate-600 divide-y divide-slate-100">
                        {currentItems.map((row) => {
                            const isInactiveStatus = row.status === 'inactive';
                            return (
                                <tr key={row.identifier || row.name} className={`transition-colors border-b border-slate-50 last:border-none ${isInactiveStatus ? 'bg-yellow-100' : 'hover:bg-slate-50'}`}>
                                    <td className="p-3 font-bold text-[#354C8F]">{row.name}</td>
                                    <td className="p-3">{row.university}</td>
                                    <td className="p-3">{row.major}</td>
                                    <td className="p-3 text-xs">{row.division || '-'}</td>
                                    <td className="p-3">{row.site?.nama_site || row.site?.name || (typeof row.site === 'string' ? row.site : '-')}</td>
                                    <td className="p-3 text-center font-mono text-xs">{formatDate(row.start_date) || '-'}{row.start_date && row.end_date ? ' — ' + formatDate(row.end_date) : ''}</td>
                                    <td className="p-3 text-center"><span className={`px-2 py-1 rounded text-[10px] font-bold ${row.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'}`}>{row.status}</span></td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            );
        }



        return null;
    };

    // Generate dynamic option sets
    const getOptionSets = () => ({
        university: [
            { value: "", label: "All Institution" },
            ...filterOptions.universities.map(u => ({ value: u, label: u }))
        ],
        intern: [
            { value: "", label: "All Interns" },
            ...filterOptions.interns.map(i => ({ value: (i.id_mahasiswa ?? i.user_id ?? i.id).toString(), label: i.nama_lengkap || i.nama  }))
        ]
    });

    // Render scope selects based on report type
    const renderScopeSelects = () => {
        if (filters.reportType === 'mentor_assignment') {
            const optionSets = getOptionSets();
            const scopeKey = 'university';
            const selectedLabel = optionSets[scopeKey].find(o => o.value === filters[scopeKey])?.label || 'All Institution';
            const isOpen = openScopeKey === scopeKey;

            const activeRoleOptions = [
                { value: '', label: 'All Status' },
                { value: 'active', label: 'Active' },
                { value: 'inactive', label: 'Inactive' }
            ];
            const activeRoleKey = 'activeRole';
            const selectedActiveRoleLabel = activeRoleOptions.find(o => o.value === filters.activeRole)?.label || 'All Status';
            const isActiveRoleOpen = openScopeKey === activeRoleKey;

            return (
                <>
                    <div className="relative">
                        <button
                            type="button"
                            onClick={() => setOpenScopeKey(prev => prev === scopeKey ? null : scopeKey)}
                            disabled={loadingFilters}
                            className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-xs focus:outline-none focus:border-[#354C8F] bg-white flex items-center justify-between text-left hover:border-slate-400 disabled:bg-slate-100 disabled:cursor-not-allowed"
                        >
                            <span className="text-slate-700">{selectedLabel}</span>
                            <ChevronDown className={`text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} size={16} />
                        </button>
                        {isOpen && (
                            <div className="absolute z-20 mt-2 w-full bg-white rounded-xl border border-slate-200 shadow-lg overflow-hidden">
                                {optionSets[scopeKey].map(opt => (
                                    <button
                                        key={opt.value}
                                        type="button"
                                        onClick={() => {
                                            handleFilterChange(scopeKey, opt.value);
                                            setOpenScopeKey(null);
                                        }}
                                        className={`w-full text-left px-3 py-2.5 text-xs ${filters[scopeKey] === opt.value ? 'bg-[#354C8F]/10 text-[#27345A] font-semibold' : 'hover:bg-slate-50 text-slate-700'}`}
                                    >
                                        {opt.label}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                    <div className="relative">
                        <button
                            type="button"
                            onClick={() => setOpenScopeKey(prev => prev === activeRoleKey ? null : activeRoleKey)}
                            className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-xs focus:outline-none focus:border-[#354C8F] bg-white flex items-center justify-between text-left hover:border-slate-400"
                        >
                            <span className="text-slate-700">{selectedActiveRoleLabel}</span>
                            <ChevronDown className={`text-slate-400 transition-transform ${isActiveRoleOpen ? 'rotate-180' : ''}`} size={16} />
                        </button>
                        {isActiveRoleOpen && (
                            <div className="absolute z-20 mt-2 w-full bg-white rounded-xl border border-slate-200 shadow-lg overflow-hidden">
                                {activeRoleOptions.map(opt => (
                                    <button
                                        key={opt.value}
                                        type="button"
                                        onClick={() => {
                                            handleFilterChange(activeRoleKey, opt.value);
                                            setOpenScopeKey(null);
                                        }}
                                        className={`w-full text-left px-3 py-2.5 text-xs ${filters.activeRole === opt.value ? 'bg-[#354C8F]/10 text-[#27345A] font-semibold' : 'hover:bg-slate-50 text-slate-700'}`}
                                    >
                                        {opt.label}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </>
            );
        }
        
        // For attendance and logbook: show University and Intern
        const optionSets = getOptionSets();
        const renders = [];

        const dropdown = (scopeKey, placeholder) => {
            const selectedLabel = optionSets[scopeKey].find(o => o.value === filters[scopeKey])?.label || placeholder;
            const isOpen = openScopeKey === scopeKey;

            return (
                <div key={scopeKey} className="relative">
                    <button
                        type="button"
                        onClick={() => setOpenScopeKey(prev => prev === scopeKey ? null : scopeKey)}
                        disabled={loadingFilters}
                        className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-xs focus:outline-none focus:border-[#354C8F] bg-white flex items-center justify-between text-left hover:border-slate-400 disabled:bg-slate-100 disabled:cursor-not-allowed"
                    >
                        <span className="text-slate-700">{selectedLabel}</span>
                        <ChevronDown className={`text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} size={16} />
                    </button>
                    {isOpen && (
                        <div className="absolute z-20 mt-2 w-full bg-white rounded-xl border border-slate-200 shadow-lg overflow-hidden max-h-56 overflow-y-auto">
                            {optionSets[scopeKey].map(opt => (
                                <button
                                    key={opt.value}
                                    type="button"
                                    onClick={() => {
                                        handleFilterChange(scopeKey, opt.value);
                                        setOpenScopeKey(null);
                                    }}
                                    className={`w-full text-left px-3 py-2.5 text-xs ${filters[scopeKey] === opt.value ? 'bg-[#354C8F]/10 text-[#27345A] font-semibold' : 'hover:bg-slate-50 text-slate-700'}`}
                                >
                                    {opt.label}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            );
        };

        renders.push(dropdown('university', 'All Institution'));
        renders.push(dropdown('intern', 'All Interns'));
        return renders;
    };

    return (
        <div className="bg-slate-50 min-h-screen font-sans text-slate-800 -mt-8">
            <div className="py-4 md:py-6 md:pl-2">
                <div className="mb-6">
                    <h1 className="text-xl md:text-2xl font-bold text-[#203266] mb-1">Reports</h1>
                    <p className="text-slate-500 text-xs">Generate and export intern reports (Mentor)</p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
             {/* --- LEFT: CONFIGURATION CARD --- */}
                    <div className="lg:col-span-4 space-y-6">
                        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 top-24">
                            <h3 className="text-[14px] font-bold text-[#27345A] mb-6 flex items-center gap-2">
                                <Filter size={20} /> Report Configuration
                            </h3>
                        
                        <div className="space-y-4">
                            {/* REPORT TYPE */}
                            <div className="relative">
                                <label className="block text-xs font-bold text-slate-800 mb-2">Report Type</label>
                                <button
                                    type="button"
                                    onClick={() => setIsReportTypeOpen(prev => !prev)}
                                    className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-xs focus:outline-none focus:border-[#354C8F] bg-white flex items-center justify-between text-left hover:border-slate-400"
                                >
                                    <span className="text-slate-700">{reportTypeOptions.find(o => o.value === filters.reportType)?.label || 'Select report type'}</span>
                                    <ChevronDown className={`text-slate-400 transition-transform ${isReportTypeOpen ? 'rotate-180' : ''}`} size={16} />
                                </button>
                                {isReportTypeOpen && (
                                    <div className="absolute z-20 mt-2 w-full bg-white rounded-xl border border-slate-200 shadow-lg overflow-hidden max-h-56 overflow-y-auto">
                                        {reportTypeOptions.map(opt => (
                                            <button
                                                key={opt.value}
                                                type="button"
                                                onClick={() => {
                                                    handleFilterChange('reportType', opt.value);
                                                    setIsReportTypeOpen(false);
                                                }}
                                                className={`w-full text-left px-3 py-2.5 text-xs ${filters.reportType === opt.value ? 'bg-[#354C8F]/10 text-[#27345A] font-semibold' : 'hover:bg-slate-50 text-slate-700'}`}
                                            >
                                                {opt.label}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* SCOPE SELECTION (REVISED) */}
                            <div>
                                <label className="block text-xs font-bold text-slate-800 mb-2">Select Scope</label>
                                <div className="space-y-3">
                                    {renderScopeSelects()}
                                </div>
                            </div>

                            {/* DATE RANGE */}
                            <div>
                                <label className="block text-xs font-bold text-slate-800 mb-2">Date Range</label>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="relative">
                                        <input
                                            type="date"
                                            name="startDate"
                                            value={filters.startDate}
                                            onChange={(e) => handleFilterChange('startDate', e.target.value)}
                                            onClick={(e) => e.target.showPicker && e.target.showPicker()}
                                            className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-[#354C8F]/20 cursor-pointer [&::-webkit-calendar-picker-indicator]:hidden"
                                        />
                                        <Calendar className="absolute left-3 top-2.5 text-slate-400" size={16} />
                                    </div>
                                    <div className="relative">
                                        <input
                                            type="date"
                                            name="endDate"
                                            value={filters.endDate}
                                            onChange={(e) => handleFilterChange('endDate', e.target.value)}
                                            onClick={(e) => e.target.showPicker && e.target.showPicker()}
                                            className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-[#354C8F]/20 [&::-webkit-calendar-picker-indicator]:hidden"
                                        />
                                        <Calendar className="absolute left-3 top-2.5 text-slate-400" size={16} />
                                    </div>
                                </div>
                            </div>

                            <hr className="border-slate-100 my-2" />

                            {/* GENERATE BUTTON */}
                            <button 
                                onClick={handleGeneratePreview}
                                className={`${btnPrimary} w-full`}
                                disabled={loadingPreview}
                            >
                                {loadingPreview ? (
                                    <RefreshCw className="animate-spin" size={18} />
                                ) : (
                                    <Eye size={18} />
                                )}
                                {loadingPreview ? "Generating..." : "Generate Preview"}
                            </button>
                        </div>
                    </div>
                </div>

                <div className="lg:col-span-8">
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 flex flex-col h-full min-h-[400px]">
                        <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                            <div>
                                <h3 className="text-[14px] font-bold text-[#27345A]">Report Preview</h3>
                                <p className="text-[10px] text-slate-400 mt-1">Review data before exporting</p>
                            </div>

                            {isPreviewVisible && (
                                <div className="flex gap-2">
                                    <button onClick={() => handleExport('Excel')} className={`${btnSecondary} !py-2 !px-4 text-xs`}><FileSpreadsheet size={16} className="text-green-600" /> Excel</button>
                                    <button onClick={() => handleExport('PDF')} className={`${btnSecondary} !py-2 !px-4 text-xs`}><FileIcon size={16} className="text-red-500" /> PDF</button>
                                </div>
                            )}
                        </div>

                        <div className="flex-1 overflow-x-auto p-0 flex flex-col">
                            {loadingPreview ? (
                                <div className="flex flex-col items-center justify-center h-64 text-slate-400 flex-1"><RefreshCw className="animate-spin mb-3 text-[#354C8F]" size={32} /><p className="text-sm">Fetching data...</p></div>
                            ) : isPreviewVisible ? (
                                <div className="w-full md:min-w-[600px] flex flex-col h-full">
                                    <div className="flex-1">{renderPreviewTable()}</div>

                                    {paginationMeta.total > 0 && (
                                        <div className="flex flex-col md:flex-row justify-between items-center p-5 border-t border-slate-100 text-sm text-slate-500 gap-4 mt-auto">
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
                                                    return getPageItems(pageCurrent, pageTotal).map((p, idx) => {
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
                            ) : (
                                <div className="flex flex-col items-center justify-center h-full text-slate-300 min-h-[300px] px-6">
                                    <div className="bg-slate-50 p-6 rounded-full mb-4"><FileText size={48} /></div>
                                    <p className="text-sm font-medium text-slate-400 text-center">Select configuration and click "Generate Preview"</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
            </div>

            <AnimatePresence>
                {showStatusModal && (
                    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
                        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="bg-white rounded-2xl shadow-2xl p-8 text-center max-w-sm w-full">
                            <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 ${statusType === 'success' ? 'bg-green-50' : 'bg-red-50'}`}>
                                {statusType === 'success' ? <Check className="text-green-500" size={40} strokeWidth={3} /> : <X className="text-red-500" size={40} strokeWidth={3} />}
                            </div>
                            <h3 className="text-xl font-bold text-[#27345A] mb-2">{statusMessage.title}</h3>
                            <p className="text-slate-500 text-sm mb-8">{statusMessage.desc}</p>
                            <button onClick={() => setShowStatusModal(false)} className={`w-full py-3 px-6 rounded-xl font-bold text-sm text-white shadow-md transition-all active:scale-95 ${statusType === 'success' ? 'bg-[#22C55E] shadow-green-200 hover:bg-green-600' : 'bg-[#EF4444] shadow-red-200 hover:bg-red-600'}`}>OK</button>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default ReportsMentor;