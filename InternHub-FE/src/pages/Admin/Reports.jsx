import React, { useState, useEffect } from 'react';
import {
    FileText,
    Download,
    ChevronDown,
    Check,
    X,
    FileSpreadsheet, // Icon Excel
    File as FileIcon, // Icon PDF
    Search,
    Eye,
    RefreshCw,
    Filter,
    ChevronLeft,
    ChevronRight,
    Calendar
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import apiClient from '../../api/axiosConfig';
import { getSafeErrorMessage } from '../../utils/errorHandler';

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

// Static options for fields not fetched from API
const staticOptionSets = {
};

const scopeConfig = {
    attendance: ["university", "intern"],
    logbook: ["mentor", "intern"],
    mentor_list: [],
    mentor_assignment: ["mentor"],
    allowance: ["university", "intern"]
};

const reportTypeOptions = [
    { value: "attendance", label: "Attendance Report" },
    { value: "logbook", label: "Daily Activities (Logbook)" },
    { value: "mentor_list", label: "Mentor List" },
    { value: "mentor_assignment", label: "Internship list" },
    { value: "allowance", label: "Allowance" }
];

const Reports = () => {
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
  
  // For allowance: use same period dates
  const allowanceStartDate = defaultStartDate;
  const allowanceEndDate = defaultEndDate;

  // --- STATES ---
  const [filters, setFilters] = useState({
    university: "",
    division: "",
    mentor: "",
    intern: "",
    startDate: defaultStartDate,
    endDate: defaultEndDate,
    reportType: "attendance", // default
    hasInterns: false
  });

  const [isPreviewVisible, setIsPreviewVisible] = useState(false);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [exportLoading, setExportLoading] = useState({ pdf: false, excel: false });
    const [isReportTypeOpen, setIsReportTypeOpen] = useState(false);
    const [openScopeKey, setOpenScopeKey] = useState(null);
  
  // Modals
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [statusMessage, setStatusMessage] = useState({ title: "", desc: "" });
  const [statusType, setStatusType] = useState('success');

  // Filter options from API
  const [filterOptions, setFilterOptions] = useState({
    universities: [],
    interns: [],
    mentors: []
  });
  const [loadingFilters, setLoadingFilters] = useState(false);

  // Divisions list for filters (fetched from backend)
  const [divisions, setDivisions] = useState([]);
  const [loadingDivisions, setLoadingDivisions] = useState(false);

  // --- FETCH FILTERS ---
  const fetchFilters = async () => {
    setLoadingFilters(true);
    try {
      // Fetch universities from admin endpoint
      const uniRes = await apiClient.get('/admin/universitas');
      const uniData = uniRes.data?.data || uniRes.data || [];
      const universities = Array.isArray(uniData) ? uniData.map(u => u.nama_universitas || u.nama || u.universitas || u) : [];

      // Fetch active interns
      const internRes = await apiClient.get('/active-interns');
      const internData = internRes.data?.data || internRes.data || [];
      const interns = Array.isArray(internData) ? internData : [];

      // Fetch mentors
      const mentorRes = await apiClient.get('/admin/mentors');
      const mentorData = mentorRes.data?.data || mentorRes.data || [];
      const mentors = Array.isArray(mentorData) ? mentorData : [];

      setFilterOptions({
        universities,
        interns,
        mentors
      });
    } catch (error) {
      console.error('Error fetching filters:', error);
    } finally {
      setLoadingFilters(false);
    }
  };

  const fetchDivisions = async () => {
    setLoadingDivisions(true);
    try {
      const res = await apiClient.get('/available-divisions');
      const data = res?.data?.data ?? res?.data ?? [];
      const opts = Array.isArray(data) ? data.map(d => ({ value: d, label: d })) : [];
      setDivisions([{ value: '', label: 'All Divisions' }, ...opts]);
    } catch (err) {
      console.warn('Could not fetch /available-divisions:', err);
      setDivisions([{ value: '', label: 'All Divisions' }]);
    } finally {
      setLoadingDivisions(false);
    }
  };

  useEffect(() => {
    fetchFilters();
    fetchDivisions();
  }, []);

  // Generate dynamic option sets
  const getOptionSets = () => ({
    university: [
      { value: "", label: "All Institutions" },
      ...filterOptions.universities.map(u => ({ value: u, label: u }))
    ],
    division: (divisions && divisions.length) ? divisions : [{ value: "", label: "All Divisions" }],
    mentor: [
      { value: "", label: "All Mentors" },
      ...filterOptions.mentors.map(m => ({ value: (m.user_id || m.id).toString(), label: m.nama_lengkap || m.name || m.nama }))
    ],
    intern: [
      { value: "", label: "All Interns" },
      ...filterOptions.interns.map(i => {
        // prefer mahasiswa ID when available, otherwise fall back to user_id
        const val = i.mahasiswa && (i.mahasiswa.id_mahasiswa || i.mahasiswa.user_id) ?
                      (i.mahasiswa.id_mahasiswa || i.mahasiswa.user_id) :
                      i.user_id;
        return { value: String(val), label: i.nama_lengkap || i.nama };
      })
    ]
  });

  const [previewData, setPreviewData] = useState([]);

  // Pagination Logic (Server-side)
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [serverPagination, setServerPagination] = useState({
    total: 0,
    current_page: 1,
    last_page: 1,
    from: 0,
    to: 0
  });

  const paginationMeta = {
    current_page: serverPagination.current_page,
    last_page: serverPagination.last_page,
    from: serverPagination.from,
    to: serverPagination.to,
    total: serverPagination.total
  };

  const totalEntries = serverPagination.total;
  const totalPages = serverPagination.last_page;
  const currentItems = previewData; // Server already returns paginated slice

  // --- HANDLERS ---

  const handlePageChange = (page) => {
    const pageNum = Number(page);
    if (!isNaN(pageNum) && pageNum >= 1 && pageNum <= totalPages && pageNum !== currentPage) {
        handleGeneratePreview(pageNum);
    }
  };

  const handleFilterChange = (key, value) => {
        setFilters(prev => {
          let newFilters = {
            ...prev,
            // Reset scopes when report type switches to avoid stale filters
            ...(key === 'reportType' ? { university: "", division: "", mentor: "", intern: "", hasInterns: false } : {}),
            [key]: value
          };
          
          // When report type changes, adjust date range accordingly
          if (key === 'reportType') {
            if (value === 'allowance') {
              newFilters.startDate = allowanceStartDate;
              newFilters.endDate = allowanceEndDate;
            } else {
              newFilters.startDate = defaultStartDate;
              newFilters.endDate = defaultEndDate;
            }
          }
          
          return newFilters;
        });
    setIsPreviewVisible(false); 
    setCurrentPage(1);
  };

  const handleGeneratePreview = async (page = 1, perPage = itemsPerPage) => {
    const pageNum = Number(page);
    setLoadingPreview(true);
    if (pageNum === 1) setIsPreviewVisible(false);
    
    try {
        let endpoint = '';
        const params = { 
            preview: true,
            page: pageNum,
            per_page: perPage
        };

        switch (filters.reportType) {
            case 'attendance':
                endpoint = '/admin/reports/attendance';
                if (filters.university) params.universitas = filters.university;
                if (filters.intern) params.intern_id = filters.intern;
                break;
            case 'logbook':
                endpoint = '/admin/reports/logbook';
                if (filters.mentor) params.mentor_id = filters.mentor;
                if (filters.intern) params.intern_id = filters.intern;
                break;
            case 'mentor_list':
                endpoint = '/admin/reports/mentors';
                if (filters.division) params.division = filters.division;
                if (filters.hasInterns) params.has_interns = true;
                break;
            case 'mentor_assignment':
                endpoint = '/admin/reports/internships';
                if (filters.mentor) params.mentor_id = filters.mentor;
                break;
            case 'allowance':
                endpoint = '/admin/reports/allowance';
                if (filters.university) params.universitas = filters.university;
                if (filters.intern) params.intern_id = filters.intern;
                break;
            default:
                break;
        }

        if (filters.startDate) params.start_date = filters.startDate;
        if (filters.endDate) params.end_date = filters.endDate;

        if (endpoint) {
            const response = await apiClient.get(endpoint, { params });
            const data = response.data?.data || [];
            const pagination = response.data?.pagination || {
                total: data.length,
                current_page: 1,
                last_page: 1,
                from: data.length > 0 ? 1 : 0,
                to: data.length
            };
            
            setPreviewData(data);
            setServerPagination(pagination);
            setCurrentPage(pageNum);
            setIsPreviewVisible(true);
        }
    } catch (error) {
        console.error('Error generating preview:', error);
        setStatusMessage({ 
            title: "Error", 
            desc: getSafeErrorMessage(error, "Failed to fetch report preview data.")
        });
        setStatusType('error');
        setShowStatusModal(true);
    } finally {
        setLoadingPreview(false);
    }
  };

  const downloadFile = (blob, filename) => {
    const url = window.URL.createObjectURL(new Blob([blob]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    link.parentNode.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

  const formatEvidence = (evidence) => {
    if (!evidence) return '-';
    try {
        const files = JSON.parse(evidence);
        if (Array.isArray(files)) {
            return files.map(file => {
                const parts = file.split('/');
                const filename = parts[parts.length - 1];
                // Remove timestamp prefix (e.g. 1769758796_697c604cc2e1a_Dummy.jpeg -> Dummy.jpeg)
                return filename.replace(/^\d+_[a-f0-9]+_/, '');
            }).join(', ');
        }
        return evidence;
    } catch (e) {
        return evidence;
    }
  };

  const formatInternshipPeriod = (period) => {
    if (!period) return '-';
    // Format: "2026-01-01 to 2026-06-30" -> "Jan 01, 2026 to Jun 30, 2026"
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const parts = period.split(' to ').map(date => date.trim());
    
    return parts.map(date => {
      const [year, month, day] = date.split('-');
      const monthIdx = parseInt(month) - 1;
      const monthName = months[monthIdx] || month;
      return `${monthName} ${parseInt(day)}, ${year}`;
    }).join(' to ');
  };

  const handleExport = async (format) => {
    const formatKey = format.toLowerCase();
    setExportLoading(prev => ({ ...prev, [formatKey]: true }));
    
    try {
        let endpoint = '';
        const params = { 
            preview: false, 
            format: formatKey === 'excel' ? 'xlsx' : 'pdf'
        };

        switch (filters.reportType) {
            case 'attendance':
                endpoint = '/admin/reports/attendance';
                if (filters.university) params.universitas = filters.university;
                if (filters.intern) params.intern_id = filters.intern;
                break;
            case 'logbook':
                endpoint = '/admin/reports/logbook';
                if (filters.mentor) params.mentor_id = filters.mentor;
                if (filters.intern) params.intern_id = filters.intern;
                break;
            case 'mentor_list':
                endpoint = '/admin/reports/mentors';
                if (filters.division) params.division = filters.division;
                if (filters.hasInterns) params.has_interns = true;
                break;
            case 'mentor_assignment':
                endpoint = '/admin/reports/internships';
                if (filters.mentor) params.mentor_id = filters.mentor;
                break;
            case 'allowance':
                endpoint = '/admin/reports/allowance';
                if (filters.university) params.universitas = filters.university;
                if (filters.intern) params.intern_id = filters.intern;
                break;
            default:
                break;
        }

        if (filters.startDate) params.start_date = filters.startDate;
        if (filters.endDate) params.end_date = filters.endDate;

        if (endpoint) {
            const response = await apiClient.get(endpoint, { 
                params, 
                responseType: 'blob' 
            });
            
            const contentType = response.headers['content-type'];
            let extension = params.format;
            if (contentType) {
                if (contentType.includes('zip')) extension = 'zip';
                else if (contentType.includes('pdf')) extension = 'pdf';
                else if (contentType.includes('spreadsheet') || contentType.includes('excel')) extension = 'xlsx';
            }

            const fileBaseName = filters.reportType === 'mentor_assignment' ? 'internship' : filters.reportType;
            const filename = `${fileBaseName}_report_${new Date().getTime()}.${extension}`;
            downloadFile(response.data, filename);

            setStatusMessage({ 
                title: "Export Successful", 
                desc: `Your ${fileBaseName.replace('_', ' ')} report has been exported to ${format}.` 
            });
            setStatusType('success');
            setShowStatusModal(true);
        }
    } catch (error) {
        console.error('Error exporting report:', error);
        setStatusMessage({ 
            title: "Export Failed", 
            desc: "Failed to download the report file. Please try again." 
        });
        setStatusType('error');
        setShowStatusModal(true);
    } finally {
        setExportLoading(prev => ({ ...prev, [formatKey]: false }));
    }
  };

  // --- RENDER HELPERS ---

  const renderPreviewTable = () => {
    if (filters.reportType === 'attendance') {
            // When preview data is empty, show friendly message
            if (!currentItems || currentItems.length === 0) {
                return (
                    <div className="p-6 text-center text-slate-400">
                        No data for the selected configuration.
                    </div>
                );
            }
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
                    {currentItems.map((row, idx) => (
                        <tr key={row.id || idx} className={`hover:bg-slate-50 ${((row.status||'').toLowerCase().includes('sick') || (row.status||'').toLowerCase().includes('sakit') || (row.status||'').toLowerCase().includes('leave') || (row.status||'').toLowerCase().includes('absent')) ? 'bg-yellow-100' : ''}`}>
                            <td className="p-3">{row.tanggal || row.date}</td>
                            <td className="p-3 font-bold text-[#354C8F]">{row.nama_lengkap || row.name || row.name}</td>
                            <td className="p-3">{row.univ || row.universitas || row.institution || '-'}</td>
                            <td className="p-3">{row.jurusan || row.program_studi || row.major || '-'}</td>
                            <td className="p-3 text-center">
                                {(() => {
                                    const raw = (row.status || '').toLowerCase();
                                    // Determine badge classes
                                    let classes = 'px-2 py-1 rounded text-[10px] font-bold ';
                                    if (raw.includes('absent')) classes += 'bg-red-100 text-red-700';
                                    else if (raw.includes('sick') || raw.includes('sakit')) classes += 'bg-blue-100 text-blue-700';
                                    else if (raw.includes('early')) classes += 'bg-orange-100 text-orange-700';
                                    else if (raw.includes('leave') || raw.includes('izin') || raw.includes('on leave')) classes += 'bg-slate-100 text-slate-600';
                                    else if (raw.includes('late')) classes += 'bg-yellow-100 text-yellow-700';
                                    else classes += 'bg-green-100 text-green-700';

                                    // Normalize label
                                    let label = row.status || '-';
                                    if (raw.includes('sick') || raw.includes('sakit')) label = 'Sick';
                                    else if (raw.includes('izin') || raw.includes('leave') || raw.includes('on leave')) label = 'On Leave';
                                    else if (raw.includes('absent')) label = 'Absent';
                                    else if (raw.includes('on time')) label = 'On Time';
                                    else if (raw.includes('late')) label = 'Late';
                                    else if (raw.includes('early')) label = 'Early';

                                    return <span className={classes}>{label}</span>;
                                })()}
                            </td>
                            <td className="p-3 text-center font-mono text-[10px]">{row.clock_in || row.clockIn || row.jam_masuk || '-'}</td>
                            <td className="p-3 text-center font-mono text-[10px]">{row.clock_out || row.clockOut || row.jam_pulang || '-'}</td>
                            <td className="p-3 italic text-slate-400">{row.notes || row.keterangan || '-'}</td>
                        </tr>
                    ))}
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
                    {currentItems.map((row, idx) => (
                        <tr key={idx} className="hover:bg-slate-50">
                            <td className="p-3">{row.date || row.tanggal}</td>
                            <td className="p-3 font-bold text-[#354C8F]">{row.name || row.nama_lengkap || row.nama}</td>
                            <td className="p-3">{row.univ || row.universitas || row.institution || '-'}</td>
                            <td className="p-3">{row.jurusan || row.program_studi || row.major || '-'}</td>
                            <td className="p-3">{row.divisi || row.division || '-'}</td>
                            <td className="p-3">{row.posisi || row.job_position || row.position || '-'}</td>
                            <td className="p-3">{row.activity || row.aktivitas || row.deskripsi_kegiatan || '-'}</td>
                            <td className="p-3">
                                <div className="text-slate-700 font-medium truncate max-w-[200px]" title={formatEvidence(row.bukti_kegiatan || row.evidence || row.output)}>
                                    {formatEvidence(row.bukti_kegiatan || row.evidence || row.output)}
                                </div>
                            </td>
                            <td className="p-3 text-center">
                                <span className={`px-2 py-1 rounded text-[10px] font-bold ${(row.status || '').toLowerCase().includes('verified') ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'}`}>{row.status}</span>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        );
    }

    if (filters.reportType === 'mentor_list') {
        return (
            <table className="w-full text-left">
                <thead className="bg-slate-50 text-xs font-bold text-slate-700 border-b border-slate-200">
                    <tr>
                        <th className="p-3">Mentor Name</th>
                        <th className="p-3 text-center">Assigned Interns</th>
                    </tr>
                </thead>
                <tbody className="text-xs text-slate-600 divide-y divide-slate-100">
                    {currentItems.map((row, idx) => (
                        <tr key={idx} className="hover:bg-slate-50">
                            <td className="p-3 font-bold text-[#354C8F]">{row.name}</td>
                            <td className="p-3 text-center">{row.assigned_interns ?? 0}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        );
    }

    if (filters.reportType === 'mentor_assignment') {
        return (
            <table className="w-full text-left">
                <thead className="bg-slate-50 text-xs font-bold text-slate-700 border-b border-slate-200">
                    <tr>
                        <th width="5%" className="p-3">No</th>
                        <th width="20%" className="p-3">Name</th>
                        <th width="20%" className="p-3">Institution</th>

                        <th width="15%" className="p-3">Division</th>
                        <th width="15%" className="p-3">Job Position</th>
                        <th width="15%" className="p-3 text-center">Internship Period</th>

                        <th width="10%" className="p-3 text-center">Status</th>
                        <th width="15%" className="p-3">Mentor</th>
                    </tr>
                </thead>
                <tbody className="text-xs text-slate-600 divide-y divide-slate-100">
                    {currentItems.map((row, idx) => {
                        const isInactive = String(row.status || '').toLowerCase() === 'inactive';
                        return (
                            <tr 
                                key={`${row.identifier || row.nim || row.user_id || idx}-${idx}`} 
                                className={`transition-colors border-b border-slate-50 last:border-none ${isInactive ? 'bg-yellow-100' : 'hover:bg-slate-50'}`}
                            >
                            <td className="p-3 text-center font-bold">{idx + 1}</td>
                            <td className="p-3 font-bold text-[#354C8F]">{row.nama_lengkap || row.name || row.nama || '-'}</td>
                            <td className="p-3">{row.univ || row.universitas || row.institution || '-'}</td>

                            <td className="p-3">{row.division || row.divisi || '-'}</td>
                            <td className="p-3">{row.job_position || row.posisi || row.position || '-'}</td>
                            <td className="p-3 text-center font-mono text-[10px]">{(row.mulai_magang || row.startDate) || '-'}{ (row.mulai_magang || row.startDate) && (row.akhir_magang || row.endDate) ? ` — ${row.akhir_magang || row.endDate}` : ''}</td>

                            <td className="p-3 text-center">
                                <span className={`px-2 py-1 rounded text-[10px] font-bold ${(row.status || '').toLowerCase() === 'active' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'}`}>{row.status || '-'}</span>
                            </td>
                            <td className="p-3">{(row.mentors && row.mentors.length > 0) ? row.mentors.map(m => m.nama).join(', ') : (row.mentor_name || row.mentor || row.nama_pembimbing || '-')}</td>
                        </tr>
                        );
                    })}
                </tbody>
            </table>
        );
    }

    if (filters.reportType === 'allowance') {
        return (
            <table className="w-full text-left">
                <thead className="bg-slate-50 text-xs font-bold text-slate-700 border-b border-slate-200">
                    <tr>
                        <th className="p-3">No</th>
                        <th className="p-3">Name</th>
                        <th className="p-3">Institution</th>
                        <th className="p-3">Division</th>
                        <th className="p-3">Job Position</th>
                        <th className="p-3">Internship Period</th>
                        <th className="p-3 text-center">Total Days</th>
                        <th className="p-3 text-center">Daily Allowance</th>
                        <th className="p-3 text-center">Total Allowance</th>
                        <th className="p-3 text-center">Bank Info</th>
                    </tr>
                </thead>
                <tbody className="text-xs text-slate-600 divide-y divide-slate-100">
                    {currentItems.map((row, idx) => (
                        <tr key={`${row.no || row.user_id || row.id || idx}`} className="hover:bg-slate-50">
                            <td className="p-3 text-center font-bold">{row.no || idx + 1}</td>
                            <td className="p-3 font-bold text-[#354C8F]">{row.name || row.nama_lengkap || row.nama || '-'}</td>
                            <td className="p-3">{row.institution || row.univ || row.universitas || '-'}</td>
                            <td className="p-3">{row.division || row.divisi || '-'}</td>
                            <td className="p-3">{row.job_position || row.posisi || row.position || '-'}</td>
                            <td className="p-3 text-sm">{formatInternshipPeriod(row.internship_period)}</td>
                            <td className="p-3 text-center">{row.total_days || row.total_presence || 0}</td>
                            <td className="p-3 text-center font-mono text-[10px]">
                                {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(parseFloat((row.daily_allowance || '0').replace(/\D/g, '')) || 0)}
                            </td>
                            <td className="p-3 text-center font-bold text-green-700">
                                {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(parseFloat((row.total_allowance || '0').replace(/\D/g, '')) || 0)}
                            </td>
                            <td className="p-3 text-center font-mono text-[10px]">
                                {(row.bank_name && row.bank_name !== '-') ? `${row.bank_name}` : '-'}
                                {(row.bank_account_no && row.bank_account_no !== '-') ? ` - ${row.bank_account_no}` : ''}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        );
    }
  };

    const renderScopeSelects = () => {
        const scopes = scopeConfig[filters.reportType] || [];
        const optionSets = getOptionSets();

        return scopes.map((scopeKey) => {
            const selectedLabel = optionSets[scopeKey].find(o => o.value === filters[scopeKey])?.label || `All ${scopeKey}`;
            const isOpen = openScopeKey === scopeKey;

            return (
                <div key={scopeKey} className="relative">
                    <button
                        type="button"
                        onClick={() => setOpenScopeKey(prev => prev === scopeKey ? null : scopeKey)}
                        disabled={scopeKey === 'division' ? loadingDivisions : loadingFilters}
                        className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-xs focus:outline-none focus:border-[#354C8F] bg-white flex items-center justify-between text-left hover:border-slate-400 disabled:bg-slate-100 disabled:cursor-not-allowed"
                    >
                        <span className="text-slate-700">{selectedLabel}</span>
                        <ChevronDown className={`text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} size={16} />
                    </button>
                    {isOpen && (
                        <div className="absolute z-20 mt-2 w-full bg-white rounded-xl border border-slate-200 shadow-lg overflow-hidden max-h-56 overflow-y-auto">
                            {optionSets[scopeKey].map((opt) => (
                                <button
                                    key={opt.value}
                                    type="button"
                                    onClick={() => {
                                        handleFilterChange(scopeKey, opt.value);
                                        setOpenScopeKey(null);
                                    }}
                                    className={`w-full text-left px-3 py-2 text-xs ${filters[scopeKey] === opt.value ? 'bg-[#354C8F]/10 text-[#27345A] font-semibold' : 'hover:bg-slate-50 text-slate-700'}`}
                                >
                                    {opt.label}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            );
        });
    };

  return (
    <div className="bg-slate-50 min-h-screen p-4 md:px-2 md:py-6 font-sans text-slate-800 -mt-8">
      
      {/* HEADER */}
      <div className="mb-8 mt-4 md:mt-0">
        <h1 className={`text-2xl md:text-3xl font-bold text-[${colors.textDark}] mb-1 md:mb-2`}>Reports</h1>
        <p className="text-slate-500 text-xs md:text-sm">Generate and export comprehensive internship reports.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* --- LEFT: CONFIGURATION CARD --- */}
        <div className="lg:col-span-4 space-y-6">
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 top-24">
                <h3 className="text-[14px] font-bold text-[#27345A] mb-6 flex items-center gap-2">
                    <Filter size={20} /> Report Configuration
                </h3>
                
                <div className="space-y-5">
                    {/* REPORT TYPE */}
                    <div className="relative">
                        <label className="block text-xs font-bold text-slate-800 mb-2">Report Type</label>
                        <button
                            type="button"
                            onClick={() => setIsReportTypeOpen(prev => !prev)}
                            className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-xs focus:outline-none focus:border-[#354C8F] bg-white flex items-center justify-between text-left shadow-[inset_0_0_0_1px_rgba(0,0,0,0)] hover:border-slate-400"
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
                                        className={`w-full text-left px-3 py-2 text-xs ${filters.reportType === opt.value ? 'bg-[#354C8F]/10 text-[#27345A] font-semibold' : 'hover:bg-slate-50 text-slate-700'}`}
                                    >
                                        {opt.label}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* SCOPE SELECTION (REVISED) */}
                    {(scopeConfig[filters.reportType] || []).length > 0 && (
                        <div>
                            <label className="block text-xs font-bold text-slate-800 mb-2">Select Scope</label>
                            <div className="space-y-3">
                              {renderScopeSelects()}
                            </div>
                        </div>
                    )}

                    {/* HAS INTERNS FILTER (Only for Mentor List) */}
                    {filters.reportType === 'mentor_list' && (
                        <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100 hover:border-slate-200 transition-colors cursor-pointer group" onClick={() => handleFilterChange('hasInterns', !filters.hasInterns)}>
                            <div className={`w-5 h-5 rounded border flex items-center justify-center transition-all ${filters.hasInterns ? 'bg-[#354C8F] border-[#354C8F]' : 'bg-white border-slate-300'}`}>
                                {filters.hasInterns && <Check size={14} className="text-white" />}
                            </div>
                            <span className="text-xs font-semibold text-slate-700 select-none">Only show mentors with interns</span>
                        </div>
                    )}

                    {/* DATE RANGE */}
                    {filters.reportType !== 'mentor_list' && (
                        <div>
                            <label className="block text-xs font-bold text-slate-800 mb-2">Date Range</label>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="relative">
                                    <input
                                        type="date"
                                        name="startDate"
                                        value={filters.startDate}
                                        onChange={(e) => handleFilterChange('startDate', e.target.value)}
                                        onClick={(e) => e.target.showPicker()}
                                        className="w-full pl-9 pr-2 py-2.5 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-[#354C8F]/20 cursor-pointer [&::-webkit-calendar-picker-indicator]:hidden"
                                    />
                                    <Calendar className="absolute left-3 top-2.5 text-slate-400" size={16} />
                                </div>
                                <div className="relative">
                                    <input
                                        type="date"
                                        name="endDate"
                                        value={filters.endDate}
                                        onChange={(e) => handleFilterChange('endDate', e.target.value)}
                                        onClick={(e) => e.target.showPicker()}
                                        className="w-full pl-9 pr-2 py-2.5 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-[#354C8F]/20 [&::-webkit-calendar-picker-indicator]:hidden"
                                    />
                                    <Calendar className="absolute left-3 top-2.5 text-slate-400" size={16} />
                                </div>
                            </div>
                        </div>
                    )}

                    <hr className="border-slate-100 my-2" />

                    {/* GENERATE BUTTON */}
                    <button 
                        onClick={() => handleGeneratePreview(1)}
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

        {/* --- RIGHT: PREVIEW CARD --- */}
        <div className="lg:col-span-8">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 flex flex-col h-full min-h-[600px]">
                
                {/* Preview Header */}
                <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                        <h3 className="text-[14px] font-bold text-[#27345A]">Report Preview</h3>
                        <p className="text-xs text-slate-400 mt-1">Review data before exporting</p>
                    </div>
                    
                    {/* EXPORT BUTTONS (Show only if preview is visible) */}
                    {isPreviewVisible && (
                        <div className="flex gap-2">
                            <button 
                                onClick={() => handleExport('Excel')} 
                                disabled={exportLoading.excel}
                                className={`${btnSecondary} !py-2 !px-4 text-xs`}
                            >
                                {exportLoading.excel ? (
                                    <RefreshCw size={16} className="animate-spin" />
                                ) : (
                                    <FileSpreadsheet size={16} className="text-green-600" />
                                )}
                                Excel
                            </button>
                            <button 
                                onClick={() => handleExport('PDF')} 
                                disabled={exportLoading.pdf}
                                className={`${btnSecondary} !py-2 !px-4 text-xs`}
                            >
                                {exportLoading.pdf ? (
                                    <RefreshCw size={16} className="animate-spin" />
                                ) : (
                                    <FileIcon size={16} className="text-red-500" />
                                )}
                                PDF
                            </button>
                        </div>
                    )}
                </div>

                {/* Preview Content */}
                <div className="flex-1 overflow-x-auto p-0 flex flex-col">
                    {loadingPreview ? (
                        <div className="flex flex-col items-center justify-center h-64 text-slate-400 flex-1">
                            <RefreshCw className="animate-spin mb-3 text-[#354C8F]" size={32} />
                            <p className="text-sm">Fetching data...</p>
                        </div>
                    ) : isPreviewVisible ? (
                        <div className="w-full md:min-w-[600px] flex flex-col h-full">
                            <div className="flex-1">
                                {renderPreviewTable()}
                            </div>
                            
                            {/* --- CONSISTENT PAGINATION UI --- */}
                            {totalEntries > 0 && (
                                <div className="flex flex-col md:flex-row justify-between items-center p-4 border-t border-slate-100 text-xs text-slate-500 gap-4 mt-auto">
                                    <p className="order-2 md:order-1">Showing {paginationMeta.from} to {paginationMeta.to} of {paginationMeta.total} entries</p>
                                    <div className="flex items-center gap-4 order-1 md:order-2">
                                        <div className="flex items-center gap-2">
                                            <label className="text-xs font-medium text-slate-600">Per page:</label>
                                            <select
                                                value={itemsPerPage}
                                                onChange={(e) => {
                                                    const newPerPage = Number(e.target.value);
                                                    setItemsPerPage(newPerPage);
                                                    setCurrentPage(1);
                                                    handleGeneratePreview(1, newPerPage);
                                                }}
                                                className="px-2 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 bg-white hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#354C8F]/20 cursor-pointer transition-all"
                                            >
                                                <option value={5}>5</option>
                                                <option value={10}>10</option>
                                                <option value={25}>25</option>
                                            </select>
                                        </div>
                                    <div className="flex items-center gap-2">
                                        <button disabled={currentPage === 1} onClick={() => handlePageChange(currentPage - 1)} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50 border border-slate-200 disabled:cursor-not-allowed"><ChevronLeft size={16} /></button>
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
                                                const pageNum = Number(p);
                                                return <button key={p} onClick={() => handlePageChange(pageNum)} className={`w-8 h-8 flex items-center justify-center rounded-lg text-xs font-bold transition-colors ${pageCurrent === pageNum ? "bg-slate-100 text-[#27345A] border border-slate-200" : "text-slate-500 hover:bg-slate-50 border border-transparent"}`}>{p}</button>;
                                            });
                                        })()}
                                        <button disabled={currentPage === paginationMeta.last_page} onClick={() => handlePageChange(currentPage + 1)} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50 border border-slate-200 disabled:cursor-not-allowed"><ChevronRight size={16} /></button>
                                    </div>
                                   </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="w-full flex flex-col items-center justify-center h-full text-slate-300 min-h-[300px] px-6">
                            <div className="bg-slate-50 p-6 rounded-full mb-4">
                                <FileText size={48} />
                            </div>
                            <p className="text-sm font-medium text-slate-400 text-center">Select configuration and click "Generate Preview"</p>
                        </div>
                    )}
                </div>
            </div>
        </div>

      </div>

      {/* --- SUCCESS MODAL --- */}
      <AnimatePresence>
                {showStatusModal && (
                    <ModalOverlay zIndex="z-[60]" onClose={() => setShowStatusModal(false)} width="max-w-sm" compact>
                        <div className="text-center p-4">
                            <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${statusType === 'success' ? 'bg-green-50' : 'bg-red-50'}`}>
                                {statusType === 'success' ? <Check className="text-green-500" size={32} strokeWidth={3} /> : <X className="text-red-500" size={32} strokeWidth={3} />}
                            </div>
                            <h3 className="text-xl font-bold text-[#27345A] mb-2">{statusMessage.title}</h3>
                            <p className="text-slate-500 text-sm mb-6">{statusMessage.desc}</p>
                            <button onClick={() => setShowStatusModal(false)} className={`w-full py-3 px-6 rounded-xl font-bold text-sm text-white shadow-md transition-all active:scale-95 ${statusType === 'success' ? 'bg-[#22C55E] shadow-green-200 hover:bg-green-600' : 'bg-[#EF4444] shadow-red-200 hover:bg-red-600'}`}>OK</button>
                        </div>
                    </ModalOverlay>
                )}
      </AnimatePresence>

    </div>
  );
};

// --- MODAL COMPONENT ---
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

export default Reports;