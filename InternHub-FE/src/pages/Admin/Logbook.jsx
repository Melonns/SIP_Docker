import React, { useState, useEffect } from 'react';
import {
  Search,
  Filter,
  Eye,
  X,
  Check,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Calendar,
  FileText,
  Clock,
  MessageSquare,
  User,
  Paperclip,
  ChevronDown,
  Download
} from 'lucide-react';
import apiClient from '../../api/axiosConfig';
import { motion, AnimatePresence } from 'framer-motion';

// --- STYLE CONSTANTS ---
const colors = {
  primary: "#354C8F",
  textDark: "#203266",
  bgLight: "#F8F9FD"
};

// Button Styles
const btnBase = "py-3 px-4 md:px-6 rounded-xl font-bold text-xs md:text-sm flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed";
const btnPrimary = `${btnBase} bg-[#354C8F] hover:bg-[#2a3c70] text-white shadow-md shadow-indigo-200`;
const btnSecondary = `${btnBase} bg-white border border-slate-300 text-slate-700 hover:bg-slate-50`;

const LogbookMonitoring = () => {
  // --- DATA (server-driven) ---
  const [logs, setLogs] = useState([]);
  const [loadingList, setLoadingList] = useState(false);
  const [serverMeta, setServerMeta] = useState(null); // { current_page, last_page, total, per_page, from, to }

  // --- STATES ---
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false); // For View Detail

  const [selectedLog, setSelectedLog] = useState(null);

  // Filter State
  const initialFilter = {
    university: "",
    division: "",
    office: "",
    startDate: "",
    endDate: "",
    status: []
  };
  const [filter, setFilter] = useState(initialFilter);
  const [appliedFilter, setAppliedFilter] = useState(initialFilter);
  const [openDropdown, setOpenDropdown] = useState(null);

  // Dynamic dropdown options from API
  const [sites, setSites] = useState([]); // office options (nama_site)
  const [universities, setUniversities] = useState([]);
  const [divisions, setDivisions] = useState([]);
  const [loadingSites, setLoadingSites] = useState(false);
  const [loadingUniversities, setLoadingUniversities] = useState(false);
  const [loadingDivisions, setLoadingDivisions] = useState(false);

  const isFilterActive = appliedFilter.university !== "" || appliedFilter.division !== "" || appliedFilter.office !== "" || appliedFilter.startDate !== "" || appliedFilter.endDate !== "" || appliedFilter.status.length > 0;

  // Pagination (server-side)
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;


  // Pagination (server aware)
  // itemsPerPage defined above
  const totalEntries = serverMeta?.total ?? logs.length;
  const totalPages = serverMeta?.last_page ?? Math.max(1, Math.ceil(totalEntries / itemsPerPage));
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = serverMeta ? logs : logs.slice(indexOfFirstItem, indexOfLastItem);

  const paginationMeta = serverMeta ? {
    current_page: serverMeta.current_page ?? currentPage,
    last_page: serverMeta.last_page ?? totalPages,
    from: serverMeta.from ?? (totalEntries === 0 ? 0 : indexOfFirstItem + 1),
    to: serverMeta.to ?? Math.min(indexOfLastItem, totalEntries),
    total: serverMeta.total ?? totalEntries
  } : {
    current_page: currentPage,
    last_page: totalPages,
    from: totalEntries === 0 ? 0 : indexOfFirstItem + 1,
    to: Math.min(indexOfLastItem, totalEntries),
    total: totalEntries
  };

  // --- HANDLERS ---

  const handlePageChange = async (page) => {
    if (page < 1) return;
    const pageTotal = serverMeta?.last_page ?? totalPages;
    if (page > pageTotal) return;
    setCurrentPage(page);
    await fetchLogbooks({ page, ...buildFilterParams(appliedFilter) });
  };

  const buildFilterParams = (source) => {
    const params = {};
    // accept start OR end OR both
    if (source.startDate) params.start_date = source.startDate;
    if (source.endDate) params.end_date = source.endDate;
    // send status as comma-separated string to match common backend expectations
    if (source.status && source.status.length > 0) {
      params.status_verifikasi = source.status.map(s => s.toLowerCase()).join(',');
    }
    if (source.university) params.universitas = source.university;
    if (source.division) params.division = source.division;
    if (source.office) params.office = source.office;
    return params;
  };

  const buildPreviewOutputs = (outputs) => {
    const base = apiClient.defaults.baseURL || '';
    const baseNoApi = base.replace(/\/api\/?$/i, '');
    return (outputs || []).map(f => {
      if (!f) return f;
      if (String(f).startsWith('http') || String(f).startsWith('data:')) return f;
      const cleaned = String(f).replace(/^\/api\//i, '/').replace(/^api\//i, '');
      const root = baseNoApi.replace(/\/$/, '');
      return `${root}/${cleaned.replace(/^\//, '')}`;
    });
  };

  const mapLogbookItem = (item) => {
    const rawStatus = item.status_verifikasi ?? item.status ?? 'draft';
    const status = rawStatus && String(rawStatus).toLowerCase() === 'verified' ? 'Verified' : (rawStatus && String(rawStatus).toLowerCase() === 'pending' ? 'Pending' : (rawStatus && String(rawStatus).toLowerCase() === 'rejected' ? 'Rejected' : 'Draft'));
    const outputs = buildPreviewOutputs(Array.isArray(item.bukti_kegiatan) ? item.bukti_kegiatan : (item.bukti_kegiatan ? [item.bukti_kegiatan] : []));
    const dj = Number(item.durasi_jam ?? 0) || 0;
    const dm = Number(item.durasi_menit ?? 0) || 0;
    const buildDuration = () => {
      if (dj === 0 && dm === 0) return '0 Hours';
      if (dj === 0) return `${dm} Minutes`;
      if (dm === 0) return `${dj} Hours`;
      return `${dj} Hours ${dm} Minutes`;
    };

    return {
      id: item.id_logbook ?? item.id,
      name: item.nama_lengkap || item.intern_name || item.user_name || item.user?.nama_lengkap || item.user?.name || item.verifier?.nama_lengkap || '-',
      date: item.tanggal,
      description: item.deskripsi_kegiatan || item.deskripsi || item.activity_description || item.activity || '',
      duration: buildDuration(),
      durasi_jam: dj,
      durasi_menit: dm,
      division: item.divisi || item.division || item.verifier?.division || '',
      mentor: item.mentor_name || item.nama_mentor || item.mentor || item.verifier?.nama_lengkap || '-',
      status,
      rawStatus: rawStatus,
      feedback: item.feedback || '',
      outputs,
      attachment: outputs?.[0] ?? null,
      approvedAt: item.approved_at || item.verified_at || null,
      rejectedAt: item.rejected_at || null,
      submittedAt: item.submitted_at || item.created_at || null
    };
  };

  const fetchLogbooks = async (params = {}) => {
    setLoadingList(true);
    try {
      const res = await apiClient.get('/admin/logbook', { params: { per_page: itemsPerPage, ...params } });
      const raw = res?.data ?? {};
      const container = raw?.data ?? raw;
      const items = Array.isArray(container)
        ? container
        : (Array.isArray(container?.data) ? container.data : (Array.isArray(raw?.data?.data) ? raw.data.data : []));

      const mapped = (items || []).map(item => mapLogbookItem(item));

      const metaSource = (container && typeof container.per_page !== 'undefined')
        ? container
        : (raw && typeof raw.per_page !== 'undefined' ? raw : null);

      if (metaSource) {
        setServerMeta({
          current_page: Number(metaSource.current_page ?? 1),
          last_page: Number(metaSource.last_page ?? Math.max(1, Math.ceil((metaSource.total ?? mapped.length) / (metaSource.per_page ?? itemsPerPage)))),
          total: Number(metaSource.total ?? mapped.length),
          per_page: Number(metaSource.per_page ?? itemsPerPage),
          from: metaSource.from ?? 0,
          to: metaSource.to ?? mapped.length
        });
        setCurrentPage(Number(metaSource.current_page ?? 1));
      } else {
        setServerMeta(null);
      }

      setLogs(mapped);
    } catch (err) {
      console.error('Error fetching admin logbooks:', err);
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => {
    fetchLogbooks(buildFilterParams(appliedFilter));
  }, []);

  // Fetch dropdown options for Office (sites) and University
  const fetchSites = async () => {
    setLoadingSites(true);
    try {
      // endpoint: /admin/sites
      const res = await apiClient.get('/admin/sites');
      const data = res?.data?.data ?? res?.data ?? [];
      const opts = Array.isArray(data) ? data.map(s => ({ value: s.nama_site ?? s.name ?? s.site_name ?? s.id, label: s.nama_site ?? s.name ?? s.site_name ?? String(s.id) })) : [];
      setSites([{ value: '', label: 'All Offices' }, ...opts]);
    } catch (err) {
      console.warn('Could not fetch sites for Office dropdown:', err);
      setSites([{ value: '', label: 'All Offices' }]);
    } finally {
      setLoadingSites(false);
    }
  };

  const fetchUniversities = async () => {
    setLoadingUniversities(true);
    try {
      // endpoint per request: /mentor/universitas
      const res = await apiClient.get('/mentor/universitas');
      const data = res?.data?.data ?? res?.data ?? [];
      const opts = Array.isArray(data) ? data.map(u => {
        // normalise both 'string' and 'object' responses
        const v = (u && (u.nama_universitas || u.nama || u.universitas || u.name))
          ? (u.nama_universitas || u.nama || u.universitas || u.name)
          : u;
        return { value: v, label: v };
      }) : [];
      setUniversities([{ value: '', label: 'All Institutions' }, ...opts]);
    } catch (err) {
      console.warn('Could not fetch universities for dropdown:', err);
      setUniversities([{ value: '', label: 'All Institutions' }]);
    } finally {
      setLoadingUniversities(false);
    }
  };

  const fetchDivisions = async () => {
    setLoadingDivisions(true);
    try {
      // Correct endpoint: /available-divisions (proxied via baseURL '/api')
      const res = await apiClient.get('/available-divisions');
      const data = res?.data?.data ?? res?.data ?? [];
      const opts = Array.isArray(data) ? data.map(d => ({ value: d, label: d })) : [];
      setDivisions([{ value: '', label: 'All Divisions' }, ...opts]);
    } catch (err) {
      console.warn('Could not fetch divisions for dropdown (available-divisions):', err);
      setDivisions([{ value: '', label: 'All Divisions' }]);
    } finally {
      setLoadingDivisions(false);
    }
  };

  useEffect(() => {
    // load dropdown options once on mount
    fetchSites();
    fetchUniversities();
    fetchDivisions();
  }, []);

  const handleViewDetail = async (log) => {
    setSelectedLog(log);
    setShowDetailModal(true);
  };

  const handleViewFile = (logbookId, fileUrl, cleanName) => {
    const rawName = String(fileUrl).split('/').pop();
    const displayName = cleanName || rawName;
    const secureUrl = `/logbook/${logbookId}/file/${encodeURIComponent(rawName)}`;
    const viewerUrl = `/admin/file-viewer?url=${encodeURIComponent(secureUrl)}&name=${encodeURIComponent(displayName)}`;
    window.open(viewerUrl, '_blank');
  };

  const handleDownloadFile = async (logbookId, fileUrl, cleanName) => {
    try {
      const rawName = String(fileUrl).split('/').pop();
      const downloadName = cleanName || rawName;
      const secureUrl = `/logbook/${logbookId}/file/${encodeURIComponent(rawName)}?download=1`;
      const res = await apiClient.get(secureUrl, { responseType: 'blob' });

      const blobUrl = URL.createObjectURL(res.data);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = downloadName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.error('Error downloading file:', err);
    }
  };

  const handleFilterChange = (key, value) => {
    setFilter(prev => ({ ...prev, [key]: value }));
  };

  const handleStatusToggle = (status) => {
    setFilter(prev => {
      const current = prev.status;
      const updated = current.includes(status) ? current.filter(s => s !== status) : [...current, status];
      return { ...prev, status: updated };
    });
  };

  const resetFilter = async () => {
    setFilter(initialFilter);
    setAppliedFilter(initialFilter);
    setCurrentPage(1);
    await fetchLogbooks(buildFilterParams(initialFilter));
  };

  const applyFilter = async () => {
    setAppliedFilter(filter);
    setShowFilterModal(false);
    setCurrentPage(1);
    await fetchLogbooks(buildFilterParams(filter));
  };

  const handleDropdownSelect = (key, value) => {
    setFilter(prev => ({ ...prev, [key]: prev[key] === value ? "" : value }));
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
          <div className="absolute inset-x-0 mt-2 bg-white rounded-xl border border-slate-100 shadow-xl z-50 overflow-hidden">
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

  // --- RENDER HELPERS ---

  const Badge = ({ text }) => {
    let style = "";
    if (text === 'Verified' || text === 'Approved') style = "bg-green-50 text-green-600 border-green-200";
    else if (text === 'Pending') style = "bg-[#FFF8E1] text-[#F59E0B] border-[#FFE0B2]";
    else if (text === 'Rejected') style = "bg-red-50 text-red-600 border-red-200";
    else style = "bg-slate-100 text-slate-500 border-slate-200";

    return (
      <span className={`inline-flex items-center justify-center min-w-[140px] h-[34px] px-3 rounded-lg text-xs font-bold border whitespace-nowrap ${style}`}>
        {text}
      </span>
    );
  };

  return (
    <div className="bg-slate-50 min-h-screen p-4 md:p-8 font-sans text-slate-800 -mt-8">

      {/* HEADER */}
      <div className="mb-8 mt-4 md:mt-0">
        <h1 className={`text-2xl md:text-3xl font-bold text-[${colors.textDark}] mb-1 md:mb-2`}>Logbook Monitoring</h1>
        <p className="text-slate-500 text-xs md:text-sm">Overview of intern daily activities and mentor validation status.</p>
      </div>

      {/* ACTION BAR */}
      <div className="flex flex-col md:flex-row justify-between items-stretch md:items-center gap-3 md:gap-4 mb-6">
        <div className="flex gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-80">
            <input type="text" placeholder="Search by Intern" className="w-full pl-9 md:pl-10 pr-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#354C8F]/20 text-sm shadow-sm transition-all" />
            <Search className="absolute left-3 top-3.5 text-slate-400" size={18} />
          </div>
          <button
            onClick={() => {
              setFilter(appliedFilter);
              setShowFilterModal(true);
            }}
            className={`${btnPrimary} md:!px-6 w-auto`} aria-label="Open filter">
            <span className="hidden md:inline">Filter</span>
            <Filter size={16} />
            {isFilterActive && (
              <div className="ml-2 w-2 h-2 bg-red-400 rounded-full animate-pulse"></div>
            )}
          </button>
        </div>
      </div>


      {/* TABLE */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[1000px] md:min-w-full">
            <thead>
              <tr className="border-b border-slate-100 text-xs md:text-sm font-bold text-slate-900 bg-slate-50/50">
                <th className="p-4 md:p-6 w-16 text-center">No</th>
                <th className="p-4 md:p-6">Name</th>
                <th className="p-4 md:p-6">Date</th>
                <th className="p-4 md:p-6 text-center">Division</th>
                <th className="p-4 md:p-6 w-1/3">Description</th>
                <th className="p-4 md:p-6 text-center">Duration</th>
                <th className="p-4 md:p-6">Mentor Name</th>
                <th className="p-4 md:p-6 text-center">Status</th>
                <th className="p-4 md:p-6 text-center">View Detail</th>
              </tr>
            </thead>
            <tbody className="text-xs md:text-sm text-slate-600">
              {loadingList ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-slate-400">Loading logbooks...</td>
                </tr>
              ) : currentItems.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-slate-400">No data available.</td>
                </tr>
              ) : (
                currentItems.map((item, index) => (
                  <tr key={item.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                    <td className="p-4 md:p-6 text-center font-medium">{paginationMeta.from + index}</td>
                    <td className="p-4 md:p-6 font-medium text-slate-700">{item.name}</td>
                    <td className="p-4 md:p-6 whitespace-nowrap">{item.date}</td>
                    <td className="p-4 md:p-6 text-center">{item.division}</td>
                    <td className="p-4 md:p-6">
                      <p className="line-clamp-2" title={item.description}>{item.description}</p>
                    </td>
                    <td className="p-4 md:p-6 text-center whitespace-nowrap">{item.duration}</td>
                    <td className="p-4 md:p-6 font-medium">{item.mentor}</td>
                    <td className="p-4 md:p-6 text-center"><Badge text={item.status} /></td>
                    <td className="p-4 md:p-6 text-center">
                      <button
                        onClick={() => handleViewDetail(item)}
                        className="inline-flex items-center justify-center h-[34px] w-[34px] bg-[#354C8F] text-white rounded-lg hover:bg-[#2a3c70] transition-colors shadow-sm shadow-indigo-100 active:scale-95"
                      >
                        <Eye size={14} />
                      </button>
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

            {/* Teks Info: Di Mobile Pindah ke Bawah (order-2) */}
            <p className="order-2 md:order-1 text-center md:text-left w-full md:w-auto">
              Showing {paginationMeta.from} to {paginationMeta.to} of {paginationMeta.total} entries
            </p>

            {/* Tombol Pagination: Di Mobile Pindah ke Atas (order-1) */}
            <div className="flex items-center gap-1 md:gap-2 flex-wrap justify-center order-1 md:order-2 w-full md:w-auto">

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

      {/* --- MODALS --- */}
      <AnimatePresence>

        {/* 1. FILTER MODAL */}
        {showFilterModal && (
          <ModalOverlay zIndex="z-50" onClose={() => setShowFilterModal(false)}>
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-[#27345A]">Filter Logbook</h3>
              <button onClick={() => setShowFilterModal(false)}><X className="text-slate-400 hover:text-slate-600" /></button>
            </div>
            <div className="space-y-6">
              {renderDropdown("Institution", "university", universities, loadingUniversities ? "Loading institutions..." : "All Institutions")}

              <div className="grid grid-cols-2 gap-4">
                {renderDropdown("Division", "division", (divisions && divisions.length) ? divisions : [{ value: "", label: "All Divisions" }], loadingDivisions ? "Loading divisions..." : "All Divisions")}
                {renderDropdown("Office", "office", sites, loadingSites ? "Loading offices..." : "All Offices")}
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-800 mb-2">Period</label>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    {/* <label className="block text-sm font-bold text-slate-800 mb-1.5"></label> */}
                    <div className="relative">
                      <input
                        type="date"
                        value={filter.startDate}
                        onChange={(e) => handleFilterChange('startDate', e.target.value)}
                        onClick={(e) => e.target.showPicker?.()}
                        className="w-full pl-10 pr-3 py-3 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#354C8F]/20 cursor-pointer [&::-webkit-calendar-picker-indicator]:hidden"
                      />
                      <Calendar className="absolute left-3 top-3 text-slate-400 pointer-events-none z-0" size={16} />
                    </div>
                  </div>
                  <div>
                    {/* <label className="block text-sm font-bold text-slate-800 mb-1.5"></label> */}
                    <div className="relative">
                      <input
                        type="date"
                        value={filter.endDate}
                        onChange={(e) => handleFilterChange('endDate', e.target.value)}
                        onClick={(e) => e.target.showPicker?.()}
                        className="w-full pl-10 pr-3 py-3 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#354C8F]/20 cursor-pointer [&::-webkit-calendar-picker-indicator]:hidden"
                      />
                      <Calendar className="absolute left-3 top-3 text-slate-400 pointer-events-none z-0" size={16} />
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-800 mb-3">Status</label>
                <div className="flex gap-2 flex-wrap">
                  {['Verified', 'Pending', 'Rejected'].map(status => (
                    <button key={status} onClick={() => handleStatusToggle(status)}
                      className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all border ${filter.status.includes(status) ? 'bg-[#354C8F] text-white border-[#354C8F] shadow-md' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
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

        {/* 2. DETAIL LOGBOOK MODAL */}
        {showDetailModal && selectedLog && (
          <ModalOverlay zIndex="z-50" onClose={() => setShowDetailModal(false)} width="max-w-xl">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-[#27345A]">View Detail Logbook</h3>
              <button onClick={() => setShowDetailModal(false)}><X className="text-slate-400 hover:text-slate-600" /></button>
            </div>

            <div className="space-y-6 max-h-[70vh] overflow-y-auto pr-2 custom-scrollbar overflow-x-hidden">

              {/* Header Info */}
              <div className="flex items-center gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
                <div className="h-12 w-12 rounded-full bg-[#354C8F]/10 flex items-center justify-center text-[#354C8F]">
                  <User size={24} />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-[#27345A]">{selectedLog.name}</h4>
                  <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
                    <span className="flex items-center gap-1"><Calendar size={12} /> {selectedLog.date}</span>
                  </div>
                </div>
                <div className="ml-auto">
                  <Badge text={selectedLog.status} />
                </div>
              </div>

              {/* Activity Description */}
              <div>
                <label className="block text-sm font-bold text-slate-800 mb-2">Activity Description</label>
                <div className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm bg-slate-50 text-slate-700 leading-relaxed min-h-[80px] break-words whitespace-pre-wrap">
                  {selectedLog.description}
                </div>

                <div className="mt-3">
                  <label className="block text-sm font-bold text-slate-800 mb-2">Duration</label>
                  <div className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-50 border border-slate-200 text-sm font-bold text-slate-700">
                    <Clock size={16} /> {selectedLog.duration}
                  </div>
                </div>
              </div>

              {/* Attachment */}
              <div>
                <label className="block text-sm font-bold text-slate-800 mb-2">Attached Output</label>
                {selectedLog.outputs && selectedLog.outputs.length > 0 ? (
                  <div className="space-y-3">
                    {selectedLog.outputs.map((fileUrl, idx) => {
                      const rawName = String(fileUrl).split('/').pop();
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
                            onClick={() => handleViewFile(selectedLog.id, fileUrl, cleanName)}
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
                            onClick={() => handleDownloadFile(selectedLog.id, fileUrl, cleanName)}
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
                  <div className="text-sm text-slate-400 italic">No attachment provided.</div>
                )}
              </div>

              {/* Mentor Feedback */}
              <div>
                <label className="block text-sm font-bold text-slate-800 mb-2">Mentor Feedback</label>
                <div className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm bg-slate-50 text-slate-700 min-h-[80px]">
                  {selectedLog.feedback ? (
                    <div className="flex gap-3 min-w-0">
                      <MessageSquare size={16} className="text-[#354C8F] mt-0.5 shrink-0" />
                      <p className="break-words whitespace-pre-wrap">{selectedLog.feedback}</p>
                    </div>
                  ) : (
                    <span className="text-slate-400 italic">No feedback yet.</span>
                  )}
                </div>
              </div>

            </div>

            <div className="mt-6 pt-4 border-t border-slate-100 flex justify-end">
              <button onClick={() => setShowDetailModal(false)} className={`${btnSecondary}`}>Close</button>
            </div>
          </ModalOverlay>
        )}

      </AnimatePresence>
    </div>
  );
};

// --- MODAL COMPONENT ---
const ModalOverlay = ({ children, onClose, width = "max-w-md", zIndex = "z-50" }) => (
  <div className={`fixed inset-0 ${zIndex} flex items-center justify-center bg-black/40 backdrop-blur-sm p-4`}>
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className={`bg-white w-[95%] md:w-full ${width} rounded-2xl shadow-2xl p-6 relative`}
    >
      {children}
    </motion.div>
  </div>
);

export default LogbookMonitoring;