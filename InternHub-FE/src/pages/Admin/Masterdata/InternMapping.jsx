import React, { useState, useRef, useEffect } from 'react';
import {
  Search,
  Filter,
  Eye,
  Trash2,
  Plus,
  FileText, // For Export PDF
  X,
  Check,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ArrowLeft,
  Users,
  Clock
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import apiClient from '../../../api/axiosConfig';

// --- STYLE CONSTANTS ---
const colors = {
  primary: "#354C8F",
  textDark: "#203266",
  bgLight: "#F8F9FD"
};

// ... (keep button styles) ...
const btnBase = "py-3 px-4 md:px-6 rounded-xl font-bold text-[14px] flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed ";
const btnPrimary = `${btnBase} bg-[#354C8F] hover:bg-[#2a3c70] text-white shadow-md shadow-indigo-200`;
const btnSecondary = `${btnBase} bg-white border border-slate-300 text-slate-700 hover:bg-slate-50`;
const actionText = 'hidden sm:inline-block';
const btnSuccess = `${btnBase} bg-[#22C55E] hover:bg-[#16A34A] text-white shadow-md shadow-green-200`;
const btnDanger = `${btnBase} bg-[#EF4444] hover:bg-[#DC2626] text-white shadow-md shadow-red-200`;

const InternMapping = () => {
  // Modals (Move to top to avoid initialization issues)
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false); // The large modal
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [confirmActionType, setConfirmActionType] = useState(null); // 'assign' | 'unassign'
  const [statusMessage, setStatusMessage] = useState({ title: "", desc: "" });
  const [statusType, setStatusType] = useState('success');
  const [syncLoading, setSyncLoading] = useState(false);

  // --- STATE ---
  const [mentors, setMentors] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Data for "Add Intern" Modal (Candidates)
  const [availableInterns, setAvailableInterns] = useState([]);
  const [loadingUnassigned, setLoadingUnassigned] = useState(false);
  
  // Pagination for Assign Modal
  const [unassignedPage, setUnassignedPage] = useState(1);
  const [unassignedPerPage, setUnassignedPerPage] = useState(10);
  const [unassignedPaginationMeta, setUnassignedPaginationMeta] = useState({ current_page: 1, last_page: 1, from: 0, to: 0, total: 0 });

  // Divisions for Assign Modal filter
  const [availableDivisions, setAvailableDivisions] = useState([]);
  const [showDivisionModal, setShowDivisionModal] = useState(false);
  const [assignModalDivisionFilter, setAssignModalDivisionFilter] = useState("");
  const [assignDivisionDropdownOpen, setAssignDivisionDropdownOpen] = useState(false);

  const fetchUnassignedInterns = async (page = 1) => {
    setLoadingUnassigned(true);
    try {
      const params = {
        start_date: assignDate,
        end_date: endDate,
        q: assignModalSearch,
        division: assignModalDivisionFilter,
        page: page,
        per_page: unassignedPerPage
      };

      const res = await apiClient.get('/admin/intern-mentor/unassigned', { params });
      if (res.data && res.data.success) {
        const payload = res.data.data;
        const internsArray = payload.data || [];

        const normalizedInterns = internsArray.map(i => ({
          ...i,
          id: i.mahasiswa?.id_mahasiswa || i.id_mahasiswa || i.user_id,
          name: i.nama_lengkap || i.name || i.nama,
          nim: i.identifier,
          university: i.universitas,
          division: i.division,
          job_position: i.job_position,
          periode: i.periode
        }));

        setAvailableInterns(normalizedInterns);
        
        setUnassignedPaginationMeta({
          current_page: payload.current_page || page,
          last_page: payload.last_page || 1,
          from: payload.from || 0,
          to: payload.to || 0,
          total: payload.total || 0
        });
        setUnassignedPage(payload.current_page || page);
      }
    } catch (err) {
      console.error("Failed to fetch unassigned interns", err);
    } finally {
      setLoadingUnassigned(false);
    }
  };

  const openAssignModal = () => {
    setShowAssignModal(true);
    setUnassignedPage(1);
    fetchUnassignedInterns(1);
    // preload divisions for inline dropdown
    fetchAvailableDivisions();
  };

  const fetchAvailableDivisions = async () => {
    try {
      // Use provided local dev proxy endpoint for available divisions
      const res = await apiClient.get('/available-divisions');
      const payload = res.data || {};
      // Expect payload to be an array or wrapped in { data: [...] }
      const raw = Array.isArray(payload) ? payload : (payload.data || payload.items || []);
      const items = (raw || []).map(d => d.name || d.nama || d.division || d.label || d);
      setAvailableDivisions(items.filter(Boolean));
    } catch (err) {
      console.error('Failed to fetch divisions, falling back to static list', err);
      // Fallback static list
      setAvailableDivisions(['IT', 'Finance', 'HR']);
    }
  };

  const [viewMode, setViewMode] = useState("list"); // 'list' | 'detail'
  const [selectedMentor, setSelectedMentor] = useState(null);

  // Selection State for Assigning
  const [selectedInternsToAssign, setSelectedInternsToAssign] = useState([]);

  // Use Local Date for Default (UTC from toISOString can be yesterday if early morning)
  const getTodayDate = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const [assignDate, setAssignDate] = useState(getTodayDate()); // Default today (Local)
  const [endDate, setEndDate] = useState("");

  const [filter, setFilter] = useState({ site: "", division: "" });

  // Sites fetched from API (use OfficeLocation source)
  const [sites, setSites] = useState([]);
  const [sitesLoading, setSitesLoading] = useState(false);

  // Custom dropdown open states and refs for filter modal
  const [siteDropdownOpen, setSiteDropdownOpen] = useState(false);
  const [divisionDropdownOpen, setDivisionDropdownOpen] = useState(false);
  const siteDropdownRef = useRef(null);
  const divisionDropdownRef = useRef(null);

  // Applied filters (only used when user clicks Apply)
  const [appliedFilterSite, setAppliedFilterSite] = useState("");
  const [appliedFilterDivision, setAppliedFilterDivision] = useState("");

  const isFilterActive = appliedFilterSite !== "" || appliedFilterDivision !== "";
  const [assignModalSearch, setAssignModalSearch] = useState("");

  const [searchQuery, setSearchQuery] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");

  React.useEffect(() => {
    const timer = setTimeout(() => {
      setAppliedSearch(searchQuery);
    }, 700);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Reset selected interns when modal closes
  React.useEffect(() => {
    if (!showAssignModal) {
      setSelectedInternsToAssign([]);
      setAssignModalSearch("");
      setAssignModalDivisionFilter("");
      setUnassignedPage(1);
    }
  }, [showAssignModal]);

  // Fetch when filters or page change
  React.useEffect(() => {
    if (showAssignModal) {
      const timer = setTimeout(() => {
        fetchUnassignedInterns(unassignedPage);
      }, 700); // 700ms debounce
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assignModalSearch, assignModalDivisionFilter, assignDate, endDate, showAssignModal, unassignedPerPage, unassignedPage]);

  // Reset page to 1 when filters change natively
  React.useEffect(() => {
    setUnassignedPage(1);
  }, [assignModalSearch, assignModalDivisionFilter, assignDate, endDate, unassignedPerPage]);


  // Memoized filtered unassigned interns for the assign modal (Purely server-driven now)
  const filteredAvailableInterns = React.useMemo(() => {
    return availableInterns;
  }, [availableInterns]);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [paginationMeta, setPaginationMeta] = useState({ current_page: 1, last_page: 1, from: 0, to: 0, total: 0 });

  // --- API FETCHING ---
  const fetchMentors = async (page = 1) => {
    setLoading(true);
    try {
      // Build query params
      const params = { page, per_page: itemsPerPage };
      if (appliedFilterSite) params.site = appliedFilterSite; // Verify if backend supports filtering
      if (appliedFilterDivision) params.division = appliedFilterDivision;
      if (appliedSearch) params.q = appliedSearch;

      const res = await apiClient.get('/admin/intern-mentor/mentors', { params });

      if (res.data && res.data.success && res.data.data) {
        // Handle nested 'mentors' key if present (API structure variation)
        const payload = res.data.data.mentors || res.data.data;
        const mappedRaw = payload.data || [];

        const mappedMentors = mappedRaw.map(m => ({
          id: m.karyawan.id_karyawan || m.user_id,
          name: m.nama_lengkap || m.nama,
          nip: m.identifier,
          email: m.email,
          assignedCount: m.interns_count || 0,
          division: m.division,
          site: m.karyawan?.site?.nama_site || (m.id_site === 1 ? 'SIER' : (m.id_site === 2 ? 'PIER' : '-')),
          // Initialize empty; detailed interns likely need another fetch or included in detail endpoint
          interns: []
        }));

        setMentors(mappedMentors);
        setPaginationMeta({
          current_page: payload.current_page || page,
          last_page: payload.last_page || 1,
          from: payload.from || 0,
          to: payload.to || 0,
          total: payload.total || 0
        });
        setCurrentPage(payload.current_page || page);
      }
    } catch (err) {
      console.error('Failed to fetch mentors', err);
      setStatusMessage({ title: 'Error', desc: 'Failed to data mentors.' });
      setStatusType('error');
      setShowStatusModal(true);
    } finally {
      setLoading(false);
    }
  };

  // Fetch sites for filter (reuse OfficeLocation API)
  const fetchSites = async () => {
    setSitesLoading(true);
    try {
      const res = await apiClient.get('/admin/sites', { params: { per_page: 100 } });
      const payload = res.data || {};
      const items = (payload.data || []).map(s => ({ name: s.nama_site || s.name || '', id: s.id_site || s.id }));
      setSites(items);
    } catch (err) {
      console.error('Failed to fetch sites for filter', err);
    } finally {
      setSitesLoading(false);
    }
  };

  // Fetch sites once on mount
  React.useEffect(() => {
    fetchSites();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch mentors or mentor-interns depending on current view
  React.useEffect(() => {
    if (viewMode === 'list') {
      fetchMentors(currentPage);
    } else if (viewMode === 'detail' && selectedMentor) {
      fetchMentorInterns(selectedMentor.id, currentPage);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, appliedFilterSite, appliedFilterDivision, appliedSearch, itemsPerPage, viewMode, selectedMentor && selectedMentor.id]);

  // Reset page to 1 when filters or search change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [appliedSearch, appliedFilterSite, appliedFilterDivision, itemsPerPage]);


  // --- LOGIC ---
  // Determine data source based on view
  const dataList = viewMode === 'list' ? mentors : (selectedMentor ? selectedMentor.interns : []);
  // Note: For 'list' view, pagination is handled server-side. For 'detail' view (interns), it's currently client-side mock or needs fetching
  const currentItems = viewMode === 'list' ? mentors : dataList;

  const handlePageChange = (page) => {
    if (page >= 1 && page <= paginationMeta.last_page) {
      setCurrentPage(page);
      // Load correct page depending on current view
      if (viewMode === 'list') {
        fetchMentors(page);
      } else if (viewMode === 'detail' && selectedMentor) {
        fetchMentorInterns(selectedMentor.id, page);
      }
    }
  };

  // --- HANDLERS ---

  // Fetch interns for a specific mentor
  const fetchMentorInterns = async (mentorId, page = 1) => {
    setLoading(true);
    try {
      const params = { mentor_id: mentorId, page, per_page: itemsPerPage };
      if (appliedSearch) params.q = appliedSearch;

      const res = await apiClient.get(`/admin/intern-mentor`, { params });

      if (res.data && res.data.success) {
        // The data is inside res.data.data because it's a paginated response
        const payload = res.data.data || {};
        const mappings = payload.data || [];

        // Map the response to the intern structure used in the UI
        const mappedInterns = mappings.map(item => {
          const internData = item.intern || {};
          return {
            id: internData.user_id,
            name: internData.nama_lengkap || internData.nama|| '-',
            nim: internData.identifier || '-',
            university: internData.universitas || '-',
            division: internData.division || '-',
            job_position: internData.job_position || '-',
            periode: internData.periode || '-',
            mappingId: item.id,
            // Preserve status and mapping-effective flag from API so UI can reflect inactive state
            status: internData.status || 'active',
            mappingEffectiveActive: typeof item.mapping_effective_active !== 'undefined' ? item.mapping_effective_active : true,
            mappingActiveLabel: item.mapping_active_label || 'Active'
          };
        });

        setSelectedMentor(prev => ({
          ...prev,
          interns: mappedInterns
        }));

        // Update pagination meta for detail view (use server pagination when available)
        setPaginationMeta({
          current_page: payload.current_page || page,
          last_page: payload.last_page || Math.max(1, Math.ceil((payload.total || mappedInterns.length) / itemsPerPage)),
          from: payload.from ?? (mappedInterns.length ? (page - 1) * itemsPerPage + 1 : 0),
          to: payload.to ?? ((page - 1) * itemsPerPage + mappedInterns.length),
          total: payload.total ?? mappedInterns.length
        });

        setCurrentPage(payload.current_page || page);
      }
    } catch (err) {
      console.error('Failed to fetch mentor interns', err);
      setStatusMessage({ title: 'Error', desc: 'Failed to load assigned interns.' });
      setStatusType('error');
      setShowStatusModal(true);
    } finally {
      setLoading(false);
    }
  };

  const handleExportPdf = async () => {
    try {
      const response = await apiClient.get('/admin/intern-mentor/export/pdf', {
        responseType: 'blob',
      });

      // Check if status is 200 (OK) or 204 (No Content / Handled by IDM)
      if (response.status === 200) {
        // Create virtual link to trigger browser download
        const url = window.URL.createObjectURL(new Blob([response.data]));
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', 'Laporan_Intern_Mentor.pdf');
        document.body.appendChild(link);
        link.click();
        link.remove();

        // Clean up
        window.URL.revokeObjectURL(url);
      } else if (response.status === 204) {
        // Success but no content manually handled (likely IDM or empty report)
        console.log("Export succeeded (Status 204 or IDM handled).");
        setStatusMessage({ title: "Download Started", desc: "Export berhasil. Download akan diproses oleh browser atau IDM." });
        setStatusType('success');
        setShowStatusModal(true);
      }
    } catch (error) {
      // Check if logic fell here due to an "error" that is actually a success condition (204 or IDM)
      if (error.response && error.response.status === 204) {
        console.log("Export succeeded (Status 204 caught in error block).");
        setStatusMessage({ title: "Download Started", desc: "Export berhasil. Download akan diproses oleh browser atau IDM." });
        setStatusType('success');
        setShowStatusModal(true);
        return;
      }

      // IDM Interception often manifests as a Network Error without response
      if (!error.response && error.message === "Network Error") {
        console.log("Export might be intercepted by IDM.");
        setStatusMessage({ title: "Download Started", desc: "Export berhasil. Download akan diproses oleh browser atau IDM." });
        setStatusType('success');
        setShowStatusModal(true);
        return;
      }

      console.error("Gagal download PDF", error);
      setStatusMessage({ title: "Export Failed", desc: "Failed to download PDF report." });
      setStatusType('error');
      setShowStatusModal(true);
    }
  };

  const handleSyncEmployees = async () => {
    if (syncLoading) return;

    setSyncLoading(true);
    try {
      const endpoint = import.meta.env.VITE_EMPLOYEE_SYNC_ENDPOINT || '/admin/intern-mentor/sync-employees';
      const res = await apiClient.post(endpoint);

      setStatusMessage({
        title: 'Sync Success',
        desc: res?.data?.message || 'Employee data sync has been triggered successfully.'
      });
      setStatusType('success');

      if (viewMode === 'list') {
        await fetchMentors(currentPage);
      } else if (selectedMentor?.id) {
        await fetchMentorInterns(selectedMentor.id, currentPage);
      }
    } catch (error) {
      const apiMessage = error?.response?.data?.message || error?.response?.data?.error;
      setStatusMessage({
        title: 'Sync Failed',
        desc: apiMessage || 'Failed to sync employees. Please try again.'
      });
      setStatusType('error');
    } finally {
      setSyncLoading(false);
      setShowStatusModal(true);
    }
  };

  const handleViewDetail = (mentor) => {
    setSearchQuery("");
    setAppliedSearch("");
    setSelectedMentor({ ...mentor, interns: [] }); // Reset interns initially
    setViewMode("detail");
    setCurrentPage(1); // Reset pagination for detail view
  };

  const handleBackToList = () => {
    setSearchQuery("");
    setAppliedSearch("");
    setViewMode("list");
    setSelectedMentor(null);
    setCurrentPage(1);
  };

  const toggleInternSelection = (id) => {
    setSelectedInternsToAssign(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleToggleSelectAll = () => {
    const allFilteredIds = filteredAvailableInterns.map(i => i.id);
    const allSelected = allFilteredIds.length > 0 && allFilteredIds.every(id => selectedInternsToAssign.includes(id));

    if (allSelected) {
      // Deselect all from current filter
      setSelectedInternsToAssign(prev => prev.filter(id => !allFilteredIds.includes(id)));
    } else {
      // Select all from current filter (combine with existing selections from other filters if any)
      setSelectedInternsToAssign(prev => Array.from(new Set([...prev, ...allFilteredIds])));
    }
  };

  const handleAssignInit = () => {
    if (selectedInternsToAssign.length === 0) return;
    setConfirmActionType('assign');
    setShowConfirmModal(true);
  };



  const handleUnassignInit = (mappingId) => {
    // Store mappingId for deletion
    setSelectedInternsToAssign([mappingId]);
    setConfirmActionType('unassign');
    setShowConfirmModal(true);
  };

  const executeAction = async () => {
    // Jangan izinkan submit jika sedang loading
    if (isSubmitting) return;

    setIsSubmitting(true);
    // Modal confirm ditutup NANTI saat proses berhasil/gagal, jadi user bisa lihat loadingnya

    if (confirmActionType === 'assign') {
      try {
        // Loop through selected interns and assign them one by one
        const promises = selectedInternsToAssign.map(internId => {
          return apiClient.post('/admin/intern-mentor', {
            intern_id: internId,
            mentor_id: selectedMentor.id,
            assigned_date: assignDate,
            end_date: endDate || null
          });
        });

        await Promise.all(promises);

        setStatusMessage({ title: "Interns Assigned", desc: "Selected interns have been successfully assigned." });
        setStatusType('success');

        // Refresh data
        fetchMentorInterns(selectedMentor.id);
        // Optionally update mentor list count in background or next page load

      } catch (error) {
        console.error(error);
        setStatusMessage({ title: "Assignment Failed", desc: "Some assignments might have failed." });
        setStatusType('error');
      } finally {
        setIsSubmitting(false);
        setShowConfirmModal(false);
        setShowAssignModal(false);
        setSelectedInternsToAssign([]);
        setShowStatusModal(true);
      }
    }
    else if (confirmActionType === 'unassign') {
      const mappingIdToRemove = selectedInternsToAssign[0];

      try {
        const res = await apiClient.delete(`/admin/intern-mentor/${mappingIdToRemove}`);
        if (res.data && res.data.success) {
          const updatedMentor = {
            ...selectedMentor,
            interns: selectedMentor.interns.filter(i => i.mappingId !== mappingIdToRemove),
            assignedCount: selectedMentor.assignedCount - 1
          };

          setMentors(mentors.map(m => m.id === selectedMentor.id ? updatedMentor : m));
          setSelectedMentor(updatedMentor);

          setStatusMessage({ title: "Unassigned", desc: "Intern has been removed from this mentor." });
          setStatusType('success');
        } else {
          throw new Error(res.data.message || "Failed to delete");
        }
      } catch (err) {
        console.error(err);
        setStatusMessage({ title: "Error", desc: "Failed to unassign intern." });
        setStatusType('error');
      } finally {
        setIsSubmitting(false);
        setShowConfirmModal(false);
        setSelectedInternsToAssign([]);
        setShowStatusModal(true);
      }
    }
  };

  // --- RENDER HELPERS ---

  const formatPeriode = (periode) => {
    if (!periode) return '-';
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const parts = periode.split(' - ');
    if (parts.length !== 2) return periode;

    const formatDate = (dateStr) => {
      const date = new Date(dateStr);
      const day = String(date.getDate()).padStart(2, '0');
      const month = monthNames[date.getMonth()];
      const year = date.getFullYear();
      return `${day} ${month} ${year}`;
    };

    return `${formatDate(parts[0])} - ${formatDate(parts[1])}`;
  };

  const Badge = ({ text, isPeriode = false }) => {
    if (isPeriode) {
      return (
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 bg-slate-50 px-2 py-1 rounded-lg w-fit border border-slate-100">
          <Clock size={12} />
          {text}
        </div>
      );
    }
    return (
      <span className="px-3 py-1.5 rounded-lg text-xs font-bold border bg-slate-50 border-slate-200 text-slate-600 inline-block min-w-[70px] text-center">
        {text}
      </span>
    );
  };

  return (
    <div className="bg-slate-50 min-h-screen pt-8 pb-8 pl-2 pr-2 md:pl-2 md:pr-2 w-full font-sans text-slate-800 -mt-8">

      {/* HEADER & NAV */}
      <div className="mb-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-4">
            {viewMode === 'detail' && (
              <button onClick={handleBackToList} className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-600 hover:text-[#354C8F] hover:border-[#354C8F] transition-all shadow-sm active:scale-95">
                <ArrowLeft size={20} />
              </button>
            )}
            <div>
              <h1 className={`text-xl md:text-2xl font-bold text-[${colors.textDark}]`}>
                {viewMode === 'list' ? 'Intern Mapping' : selectedMentor?.name}
              </h1>
              <p className="text-slate-500 text-xs mt-1">
                {viewMode === 'list'
                  ? 'Assign and manage the connection between mentors and interns'
                  : `${selectedMentor?.division} | ${selectedMentor?.site}`
                }
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* --- TABLE CONTENT AREA --- */}

      {/* ACTION BAR */}
      <div className="flex flex-col md:flex-row justify-between items-stretch md:items-center gap-3 md:gap-4 mb-6">
        <div className="flex gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-80">
            <input 
              type="text" 
              placeholder="Search by Name" 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 md:pl-10 pr-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#354C8F]/20 text-sm shadow-sm transition-all" 
            />
            <Search className="absolute left-3 top-3.5 text-slate-400" size={18} />
          </div>
          <button onClick={async () => { await fetchAvailableDivisions(); setShowFilterModal(true); }} className={`${btnPrimary} md:!px-6 w-auto`} aria-label="Open filter">
            <Filter size={16} />
            <span className="hidden md:inline">Filter</span>
            {isFilterActive && <div className="w-2 h-2 bg-red-400 rounded-full animate-pulse ml-2"></div>}
          </button>
        </div>


        <div className="flex flex-col md:flex-row gap-3 w-full lg:w-auto">
          <button onClick={handleSyncEmployees} disabled={syncLoading} className={`${btnPrimary} w-full md:w-auto disabled:opacity-60 disabled:cursor-not-allowed`}>
            {syncLoading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                Syncing...
              </>
            ) : (
              <>
                <Users size={16} /> Sync
              </>
            )}
          </button>

          {viewMode === 'detail' && (
            <>
              <button onClick={handleExportPdf} className={`${btnPrimary} w-full md:w-auto`}>
                <FileText size={16} /> Export as PDF
              </button>
              <button onClick={openAssignModal} className={`${btnPrimary} w-full md:w-auto`}>
                <Plus size={16} /> Add Intern
              </button>
            </>
          )}
        </div>

      </div>


      {/* 1. FILTER & SEARCH BAR (Shared) */}


      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden min-h-[400px] flex flex-col">
        <div className="overflow-x-auto flex-1">
          <table className="w-full text-left min-w-[800px] md:min-w-full">
            <thead>
              <tr className="border-b border-slate-100 text-xs font-bold text-slate-900 bg-slate-50/50">
                <th className="px-4 py-3 w-16 text-center">No</th>
                <th className="px-4 py-3">Name</th>
                {viewMode === 'list' ? (
                  <>
                    <th className="px-4 py-3 text-center">Assigned Interns</th>
                    <th className="px-4 py-3 text-center">Division</th>
                    <th className="px-4 py-3 text-center">Site</th>
                  </>
                ) : (
                  <>
                    <th className="px-4 py-3">Institution</th>
                    <th className="px-4 py-3">Division</th>
                    <th className="px-4 py-3">Job Position</th>
                    <th className="px-4 py-3">Internship Period</th>
                  </>
                )}
                <th className="px-4 py-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="text-xs text-slate-600">
              {loading ? (
                <tr>
                  <td colSpan={6} className="p-12 text-center">
                    <div className="flex flex-col items-center justify-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#354C8F] mb-2"></div>
                      <span className="text-slate-400">Loading mapping...</span>
                    </div>
                  </td>
                </tr>
              ) : currentItems.length > 0 ? (
                currentItems.map((item, index) => (
                  <tr key={item.id} className={`border-b border-slate-50 transition-colors ${viewMode === 'detail' && (!item.mappingEffectiveActive || (item.status && item.status.toLowerCase() !== 'active')) ? 'bg-slate-200 text-slate-500' : 'hover:bg-slate-50'}`} title={`${viewMode === 'detail' && (!item.mappingEffectiveActive || (item.status && item.status.toLowerCase() !== 'active')) ? (item.mappingActiveLabel || item.status || 'Inactive') : ''}`}>
                    <td className="px-4 py-3 text-center font-medium">{paginationMeta.from + index}</td>
                    <td className="px-4 py-3 font-medium text-slate-700">{item.name}</td>

                    {viewMode === 'list' ? (
                      <>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${item.assignedCount > 0 ? 'bg-indigo-50 text-[#354C8F]' : 'bg-slate-100 text-slate-400'}`}>
                            {item.assignedCount}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center text-slate-700 font-medium">{item.division}</td>
                        <td className="px-4 py-3 text-center"><Badge text={item.site} /></td>
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={() => handleViewDetail(item)}
                            className="p-2 bg-[#354C8F] text-white rounded-lg hover:bg-[#2a3c70] transition-colors shadow-sm shadow-indigo-200 active:scale-95"
                          >
                            <Eye size={14} />
                          </button>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="px-4 py-3">{item.university}</td>
                        <td className="px-4 py-3">{item.division}</td>
                        <td className="px-4 py-3 text-xs">{item.job_position || '-'}</td>
                        <td className="px-4 py-3"><Badge text={formatPeriode(item.periode)} isPeriode={true} /></td>
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={() => handleUnassignInit(item.mappingId)}
                            className="p-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors shadow-sm shadow-red-200"
                            title="Unassign"
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </>
                    )}
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="7" className="p-8 text-center text-slate-400 italic">No data available</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* PAGINATION */}
        {paginationMeta.total > 0 && (
          <div className="flex flex-col md:flex-row justify-between items-center p-5 border-t border-slate-100 text-sm text-slate-500 gap-4 mt-auto">
            <p className="order-2 md:order-1">Showing {paginationMeta.from} to {paginationMeta.to} of {paginationMeta.total} entries</p>
            <div className="flex items-center gap-4 order-1 md:order-2">
              <div className="flex items-center gap-2">
                <label className="text-sm md:text-sm font-medium text-slate-600">Per page:</label>
                <select
                  value={itemsPerPage}
                  onChange={(e) => setItemsPerPage(Number(e.target.value))}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 focus:outline-none focus:border-[#354C8F] bg-white hover:border-slate-300 transition-colors"
                >
                  <option value="5">5</option>
                  <option value="10">10</option>
                  <option value="15">15</option>
                  <option value="20">20</option>
                  <option value="25">25</option>
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

      {/* --- MODALS --- */}
      <AnimatePresence>

        {/* 1. FILTER MODAL */}
        {showFilterModal && (
          <ModalOverlay zIndex="z-50" onClose={() => setShowFilterModal(false)} compact>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-[18px] font-bold text-[#27345A]"> Data Mapping Filter</h3>
              <button onClick={() => setShowFilterModal(false)}><X className="text-slate-400 hover:text-slate-600" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-800 mb-1">Site</label>
                <div className="relative" ref={siteDropdownRef}>
                  <button type="button" onClick={() => { setSiteDropdownOpen(v => !v); setDivisionDropdownOpen(false); }} className={`w-full text-left px-4 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:border-[#354C8F] bg-white flex items-center justify-between`}>
                    <span className={`${filter.site ? 'text-slate-700' : 'text-slate-400'}`}>{filter.site || 'Select Site'}</span>
                    <ChevronDown className="text-slate-400" size={18} />
                  </button>
                  {siteDropdownOpen && (
                    <div className="absolute left-0 right-0 mt-2 bg-white border border-slate-100 rounded-xl shadow-lg z-50 max-h-48 overflow-auto">
                      <button key={'none'} onClick={() => { setFilter({ ...filter, site: '' }); setSiteDropdownOpen(false); }} className={`w-full text-left px-4 py-2.5 hover:bg-slate-50 flex items-center justify-between text-sm ${filter.site === '' ? 'font-bold text-slate-700' : 'text-slate-600'}`}>
                        <span>Select Site</span>
                        {filter.site === '' && <Check size={16} className="text-[#354C8F]" />}
                      </button>
                      {sitesLoading ? (
                        <div className="p-2.5 text-sm text-slate-500">Loading sites...</div>
                      ) : (
                        sites.map((s) => (
                          <button key={s.id || s.name} onClick={() => { setFilter({ ...filter, site: s.name }); setSiteDropdownOpen(false); }} className={`w-full text-left px-4 py-2.5 hover:bg-slate-50 flex items-center justify-between text-sm ${filter.site === s.name ? 'font-bold text-slate-700' : 'text-slate-600'}`}>
                            <span>{s.name}</span>
                            {filter.site === s.name && <Check size={16} className="text-[#354C8F]" />}
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-800 mb-1">Division</label>
                <div className="relative" ref={divisionDropdownRef}>
                  <button type="button" onClick={() => { setDivisionDropdownOpen(v => !v); setSiteDropdownOpen(false); }} className={`w-full text-left px-4 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:border-[#354C8F] bg-white flex items-center justify-between`}>
                    <span className={`${filter.division ? 'text-slate-700' : 'text-slate-400'}`}>{filter.division || 'Select Division'}</span>
                    <ChevronDown className="text-slate-400" size={18} />
                  </button>
                  {divisionDropdownOpen && (
                    <div className="absolute left-0 right-0 mt-2 bg-white border border-slate-100 rounded-xl shadow-lg z-50 max-h-48 overflow-auto">
                      {(
                        availableDivisions.length > 0 ?
                          [{ label: 'Select Division', value: '' }, ...availableDivisions.map(d => ({ label: d, value: d }))]
                          : [{ label: 'Select Division', value: '' }, { label: 'IT', value: 'IT' }, { label: 'Finance', value: 'Finance' }, { label: 'HR', value: 'HR' }]
                      ).map((opt) => (
                        <button key={opt.value || 'none'} onClick={() => { setFilter({ ...filter, division: opt.value }); setDivisionDropdownOpen(false); }} className={`w-full text-left px-4 py-2.5 hover:bg-slate-50 flex items-center justify-between text-sm ${filter.division === opt.value ? 'font-bold text-slate-700' : 'text-slate-600'}`}>
                          <span>{opt.label}</span>
                          {filter.division === opt.value && <Check size={16} className="text-[#354C8F]" />}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="flex gap-3 justify-end mt-6 pt-4 border-t border-slate-100">
              <button onClick={() => {
                setFilter({ site: "", division: "" });
                setAppliedFilterSite("");
                setAppliedFilterDivision("");
              }} className={btnSecondary}>Reset</button>
              <button onClick={() => {
                setAppliedFilterSite(filter.site);
                setAppliedFilterDivision(filter.division);
                setShowFilterModal(false);
              }} className={btnPrimary}>Apply</button>
            </div>
          </ModalOverlay>
        )}

        {/* 2. ASSIGN INTERNS MODAL (Large) */}
        {showAssignModal && selectedMentor && (
          <ModalOverlay zIndex="z-50" onClose={() => setShowAssignModal(false)} width="max-w-4xl">
            <div className="flex flex-col h-[85vh] md:h-auto md:max-h-[85vh]">
              <div className="flex justify-between items-center mb-4 flex-shrink-0">
                <h3 className="text-[18px] font-bold text-[#27345A]">Assign Interns to {selectedMentor.name}</h3>
                <button onClick={() => setShowAssignModal(false)}><X className="text-slate-400 hover:text-slate-600" size={24} /></button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4 flex-shrink-0">
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                <p className="text-sm text-slate-500 mb-1">Mentor Division / Site</p>
                <p className="text-base font-bold text-[#27345A]">{selectedMentor.division} / {selectedMentor.site}</p>
              </div>

              {/* Date Inputs */}
              <div className="flex flex-col gap-3">
                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="block text-xs font-bold text-slate-700 mb-1">Start Date</label>
                    <input
                      type="date"
                      value={assignDate}
                      onChange={(e) => setAssignDate(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:border-[#354C8F]"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="block text-xs font-bold text-slate-700 mb-1">End Date (Opt)</label>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:border-[#354C8F]"
                    />
                  </div>
                </div>

                {/* Inline Division dropdown under Start/End date (placed in right column) */}
                <div className="mt-0">
                  <label className="block text-xs font-bold text-slate-700 mb-1">Division</label>
                  <div className="relative">
                    <button type="button" onClick={() => { if (!availableDivisions.length) fetchAvailableDivisions(); setAssignDivisionDropdownOpen((s) => !s); }} className="w-full text-left px-3 py-2 rounded-lg border border-slate-300 bg-white flex items-center justify-between">
                      <span className="text-sm text-slate-700">{assignModalDivisionFilter || 'All Divisions'}</span>
                      <ChevronDown className="text-slate-400" size={18} />
                    </button>

                    {assignDivisionDropdownOpen && (
                      <div className="absolute left-0 right-0 mt-2 bg-white border border-slate-100 rounded-xl shadow-lg z-50 max-h-48 overflow-auto">
                        <button onClick={() => { setAssignModalDivisionFilter(''); setAssignDivisionDropdownOpen(false); }} className={`w-full text-left px-4 py-2.5 hover:bg-slate-50 flex items-center justify-between text-sm ${assignModalDivisionFilter === '' ? 'font-bold text-slate-700' : 'text-slate-600'}`}>
                          <span>All Divisions</span>
                          {assignModalDivisionFilter === '' && <Check size={16} className="text-[#354C8F]" />}
                        </button>
                        {availableDivisions.length === 0 ? (
                          <div className="p-2.5 text-sm text-slate-500">Loading divisions...</div>
                        ) : (
                          availableDivisions.map((d) => (
                            <button key={d} onClick={() => { setAssignModalDivisionFilter(d); setAssignDivisionDropdownOpen(false); }} className={`w-full text-left px-4 py-2.5 hover:bg-slate-50 flex items-center justify-between text-sm ${assignModalDivisionFilter === d ? 'font-bold text-slate-700' : 'text-slate-600'}`}>
                              <span>{d}</span>
                              {assignModalDivisionFilter === d && <Check size={16} className="text-[#354C8F]" />}
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Search inside Modal (inline Division dropdown placed below date inputs) */}
            <div className="flex gap-3 mb-4 flex-shrink-0">
              <div className="relative flex-1">
                <input
                  type="text"
                  placeholder="Search unassigned intern..."
                  value={assignModalSearch}
                  onChange={(e) => setAssignModalSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#354C8F]/20"
                />
                <Search className="absolute left-3 top-3 text-slate-400" size={16} />
              </div>
            </div>

            <div className="border border-slate-200 rounded-xl overflow-x-auto overflow-y-auto custom-scrollbar flex-1 min-h-[150px] relative">
              {loadingUnassigned ? (
                <div className="absolute inset-0 bg-white/50 backdrop-blur-[1px] flex items-center justify-center z-20">
                  <div className="flex flex-col items-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#354C8F] mb-2"></div>
                    <span className="text-xs text-slate-500 font-medium">Updating availability...</span>
                  </div>
                </div>
              ) : null}

              {filteredAvailableInterns.length > 0 ? (
                <table className="w-full text-left">
                  <thead className="bg-slate-50 text-xs font-bold text-slate-700 sticky top-0 z-10">
                    <tr>
                      <th className="p-4 w-12 text-center">
                        <button
                          type="button"
                          onClick={handleToggleSelectAll}
                          className={`w-5 h-5 rounded-[5px] border flex items-center justify-center transition-all ${
                            filteredAvailableInterns.length > 0 && filteredAvailableInterns.every(i => selectedInternsToAssign.includes(i.id))
                              ? 'bg-[#354C8F] border-[#354C8F]'
                              : 'border-slate-300 bg-white'
                          }`}
                        >
                          {filteredAvailableInterns.length > 0 && filteredAvailableInterns.every(i => selectedInternsToAssign.includes(i.id)) ? (
                            <Check size={14} className="text-white" strokeWidth={3} />
                          ) : filteredAvailableInterns.some(i => selectedInternsToAssign.includes(i.id)) ? (
                            <div className="w-2 h-[2px] bg-slate-400"></div>
                          ) : null}
                        </button>
                      </th>
                      <th className="p-4">No</th>
                      <th className="p-4">Name</th>
                      <th className="p-4">Institution</th>
                      <th className="p-4">Division</th>
                      <th className="p-4">Job Position</th>
                      <th className="p-4">Internship Periode</th>
                    </tr>
                  </thead>
                  <tbody className="text-sm text-slate-600 divide-y divide-slate-100">
                    {filteredAvailableInterns.map((intern, idx) => (
                      <tr key={intern.id} className="hover:bg-slate-50 transition-colors cursor-pointer" onClick={() => toggleInternSelection(intern.id)}>
                        <td className="p-4 text-center">
                          <div className={`w-5 h-5 rounded-[5px] border flex items-center justify-center transition-all ${selectedInternsToAssign.includes(intern.id) ? 'bg-[#354C8F] border-[#354C8F]' : 'border-slate-300 bg-white'}`}>
                            {selectedInternsToAssign.includes(intern.id) && <Check size={14} className="text-white" strokeWidth={3} />}
                          </div>
                        </td>
                        <td className="p-4">{(unassignedPaginationMeta.from || 1) + idx}</td>
                        <td className="p-4 font-bold text-slate-700">{intern.nama_lengkap || intern.name || intern.nama}</td>
                        <td className="p-4">{intern.universitas || intern.university}</td>
                        <td className="p-4">{intern.division}</td>
                        <td className="p-4 text-xs">{intern.job_position || '-'}</td>
                        <td className="p-4"><Badge text={formatPeriode(intern.periode)} isPeriode={true} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="p-8 text-center text-slate-500 flex flex-col items-center justify-center min-h-[200px]">
                  <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                    <Check className="text-slate-400" size={32} />
                  </div>
                  <p className="font-bold text-lg text-slate-700">No unassigned interns available</p>
                  <p className="text-sm">Try changing dates, search or division filter.</p>
                </div>
              )}
            </div>

            {/* PAGINATION FOR ASSIGN MODAL */}
            {unassignedPaginationMeta.total > 0 && (
              <div className="flex flex-col md:flex-row justify-between items-center px-4 py-2 mt-3 border border-slate-200 rounded-xl bg-slate-50 text-[11px] text-slate-500 gap-3 flex-shrink-0">
                <p className="order-2 md:order-1">Showing {unassignedPaginationMeta.from} to {unassignedPaginationMeta.to} of {unassignedPaginationMeta.total}</p>
                <div className="flex items-center gap-3 order-1 md:order-2">
                  <div className="flex items-center gap-1.5 hidden md:flex">
                    <label className="font-medium text-slate-600">Per page:</label>
                    <select
                      value={unassignedPerPage}
                      onChange={(e) => setUnassignedPerPage(Number(e.target.value))}
                      className="px-1.5 py-1 rounded border border-slate-200 focus:outline-none focus:border-[#354C8F] bg-white hover:border-slate-300 transition-colors cursor-pointer text-[11px]"
                    >
                      <option value="5">5</option>
                      <option value="10">10</option>
                      <option value="20">20</option>
                      <option value="50">50</option>
                    </select>
                  </div>
                  <div className="flex items-center gap-0.5">
                    <button disabled={unassignedPage === 1} onClick={() => setUnassignedPage(unassignedPage - 1)} className="p-1 hover:bg-slate-200 rounded transition-colors disabled:opacity-50 border border-transparent disabled:cursor-not-allowed"><ChevronLeft size={14} /></button>
                    {(() => {
                      const pageCurrent = unassignedPaginationMeta.current_page;
                      const pageTotal = unassignedPaginationMeta.last_page || 1;
                      const getPageItems = (current, total, sibling = 1) => {
                        const totalNumbers = sibling * 2 + 5;
                        if (total <= totalNumbers) {
                          return Array.from({length: total}, (_, i) => i + 1);
                        }
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
                        if (p === 'left-ellipsis' || p === 'right-ellipsis') return <span key={`ellipsis-${idx}`} className="text-slate-400 px-1">...</span>;
                        return <button key={p} onClick={() => setUnassignedPage(p)} className={`w-5 h-5 flex items-center justify-center rounded font-bold transition-colors ${pageCurrent === p ? "bg-white text-[#27345A] border border-slate-300 shadow-sm" : "text-slate-500 hover:bg-slate-200 border border-transparent"}`}>{p}</button>;
                      });
                    })()}
                    <button disabled={unassignedPage === unassignedPaginationMeta.last_page} onClick={() => setUnassignedPage(unassignedPage + 1)} className="p-1 hover:bg-slate-200 rounded transition-colors disabled:opacity-50 border border-transparent disabled:cursor-not-allowed"><ChevronRight size={14} /></button>
                  </div>
                </div>
              </div>
            )}

            {/* Division selection modal moved to top-level so it stacks above other modals */}
            <div className="flex justify-between items-center mt-4 pt-4 border-t border-slate-100 flex-shrink-0">
              <p className="text-sm text-slate-500">{selectedInternsToAssign.length} interns selected</p>
              <div className="flex gap-3">
                <button onClick={() => setShowAssignModal(false)} className={btnSecondary}>Cancel</button>
                <button onClick={handleAssignInit} disabled={selectedInternsToAssign.length === 0} className={btnSuccess}>Assign</button>
              </div>
            </div>
            </div>
          </ModalOverlay>
        )}

        {/* Division selection modal for Assign Modal (top-level) */}
        {showDivisionModal && (
          <ModalOverlay zIndex={9999} onClose={() => setShowDivisionModal(false)} width="max-w-sm" compact>
            <div className="mb-3 flex justify-between items-center">
              <h3 className="text-[16px] font-bold text-[#27345A]">Filter by Division</h3>
              <button onClick={() => setShowDivisionModal(false)}><X className="text-slate-400 hover:text-slate-600" /></button>
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-800 mb-2">Division</label>
              <div className="relative" >
                <button type="button" onClick={() => setAssignDivisionDropdownOpen(v => !v)} className={`w-full text-left px-4 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:border-[#354C8F] bg-white flex items-center justify-between`}>
                  <span className={`${assignModalDivisionFilter ? 'text-slate-700' : 'text-slate-400'}`}>{assignModalDivisionFilter || 'All Divisions'}</span>
                  <ChevronDown className="text-slate-400" size={18} />
                </button>
                {assignDivisionDropdownOpen && (
                  <div className="absolute left-0 right-0 mt-2 bg-white border border-slate-100 rounded-xl shadow-lg z-50 max-h-48 overflow-auto">
                    <button onClick={() => { setAssignModalDivisionFilter(''); setAssignDivisionDropdownOpen(false); }} className={`w-full text-left px-4 py-2.5 hover:bg-slate-50 flex items-center justify-between text-sm ${assignModalDivisionFilter === '' ? 'font-bold text-slate-700' : 'text-slate-600'}`}>
                      <span>All Divisions</span>
                      {assignModalDivisionFilter === '' && <Check size={16} className="text-[#354C8F]" />}
                    </button>
                    {availableDivisions.length === 0 ? (
                      <div className="p-2.5 text-sm text-slate-500">Loading divisions...</div>
                    ) : (
                      availableDivisions.map((d) => (
                        <button key={d} onClick={() => { setAssignModalDivisionFilter(d); setAssignDivisionDropdownOpen(false); }} className={`w-full text-left px-4 py-2.5 hover:bg-slate-50 flex items-center justify-between text-sm ${assignModalDivisionFilter === d ? 'font-bold text-slate-700' : 'text-slate-600'}`}>
                          <span>{d}</span>
                          {assignModalDivisionFilter === d && <Check size={16} className="text-[#354C8F]" />}
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>
            <div className="flex gap-3 justify-end mt-6 pt-4 border-t border-slate-100">
              <button onClick={() => { setAssignModalDivisionFilter(''); setShowDivisionModal(false); }} className={btnSecondary}>Reset</button>
              <button onClick={() => setShowDivisionModal(false)} className={btnPrimary}>Apply</button>
            </div>
          </ModalOverlay>
        )}

        {/* 3. CONFIRM MODAL */}
        {showConfirmModal && (
          <ModalOverlay zIndex="z-[60]" onClose={() => setShowConfirmModal(false)} width="max-w-sm" compact>
            <div className="text-center p-4">
              <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${confirmActionType === 'unassign' ? 'bg-red-50' : 'bg-yellow-50'}`}>
                <AlertCircle className={confirmActionType === 'unassign' ? 'text-red-500' : 'text-yellow-500'} size={32} strokeWidth={2} />
              </div>
              <h3 className="text-xl font-bold text-[#27345A] mb-2">{confirmActionType === 'unassign' ? 'Remove Intern?' : 'Assign Interns?'}</h3>
              <p className="text-slate-500 text-sm mb-6">Are you sure you want to proceed with this action?</p>
              <div className="flex gap-3">
                <button onClick={() => setShowConfirmModal(false)} disabled={isSubmitting} className={`${btnSecondary} w-full justify-center disabled:opacity-50 disabled:cursor-not-allowed`}>Cancel</button>
                <button onClick={executeAction} disabled={isSubmitting}
                  className={`w-full py-3 px-6 rounded-xl font-bold text-sm text-white shadow-md transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed ${confirmActionType === 'unassign' ? 'bg-[#EF4444] shadow-red-200 hover:bg-red-600' : 'bg-[#22C55E] shadow-green-200 hover:bg-green-600'}`}>
                  {isSubmitting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                      <span>Processing...</span>
                    </>
                  ) : (
                    confirmActionType === 'unassign' ? 'Remove' : 'Assign'
                  )}
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
              <button onClick={() => setShowStatusModal(false)} className={`w-full py-3 px-6 rounded-xl font-bold text-sm text-white shadow-md transition-all active:scale-95 ${statusType === 'success' ? 'bg-[#22C55E] shadow-green-200 hover:bg-green-600' : 'bg-[#EF4444] shadow-red-200 hover:bg-red-600'}`}>OK</button>
            </div>
          </ModalOverlay>
        )}

      </AnimatePresence>
    </div>
  );
};

// --- MODAL COMPONENT ---
const ModalOverlay = ({ children, onClose, width = "max-w-md", zIndex = "z-50", compact = false }) => {
  const zClass = typeof zIndex === 'string' ? zIndex : '';
  const zStyle = typeof zIndex === 'number' ? { zIndex } : undefined;
  return (
    <div className={`fixed inset-0 ${zClass} flex items-center justify-center bg-black/40 backdrop-blur-sm p-4`} style={zStyle}>
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
};

export default InternMapping;