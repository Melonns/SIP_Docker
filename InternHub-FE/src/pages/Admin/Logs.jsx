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

const StatusBadge = ({ status, tooltip }) => {
  const s = String(status || '').toLowerCase();
  let styles = "bg-gray-100 text-gray-500 border-gray-200";
  let label = status;

  if (s.includes('early out')) styles = "bg-yellow-50 text-yellow-700 border-yellow-200";
  else if (s.includes('on time') || s.includes('ontime')) styles = "bg-green-50 text-green-600 border-green-200";
  else if (s.includes('late')) styles = "bg-[#FFF4E5] text-orange-500 border-orange-200";
  else if (s.includes('sick')) styles = "bg-blue-50 text-blue-600 border-blue-200";
  else if (s.includes('absent')) styles = "bg-red-50 text-red-500 border-red-200";
  else if (s.includes('leave') || s.includes('on leave')) styles = "bg-slate-100 text-slate-600 border-slate-200 leading-tight";
  else if (s.includes('correction') || s.includes('koreksi')) styles = "bg-yellow-50 text-yellow-700 border-yellow-200";

  return (
    <span
      title={tooltip || label || ''}
      aria-label={tooltip || label || ''}
      className={`inline-flex items-center justify-center px-4 py-2 rounded-lg text-xs font-bold border whitespace-nowrap min-w-[100px] ${styles}`}
    >
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
  // Full pagination meta from API for UI
  const [paginationMeta, setPaginationMeta] = useState({ current_page: 1, last_page: 1, from: 0, to: 0, total: 0 });
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [filterOptions, setFilterOptions] = useState({ universities: [], divisions: [], sites: [], mentors: [] });
  const [filterOptionsLoading, setFilterOptionsLoading] = useState(false);

  // Modal States
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [selectedLog, setSelectedLog] = useState(null);
  const [loadingDetailId, setLoadingDetailId] = useState(null);
  const [loading, setLoading] = useState(true);

  // Filter States (applied vs modal-local)
  const [appliedFilterInstitution, setAppliedFilterInstitution] = useState("");
  const [appliedFilterDivision, setAppliedFilterDivision] = useState("");
  const [appliedFilterLocation, setAppliedFilterLocation] = useState("");
  const [appliedFilterMentor, setAppliedFilterMentor] = useState([]);
  const [appliedFilterStatus, setAppliedFilterStatus] = useState([]);

  // Modal-local filter state (changed selections won't trigger fetch until Apply)
  const [modalInstitution, setModalInstitution] = useState("");
  const [modalDivision, setModalDivision] = useState("");
  const [modalLocation, setModalLocation] = useState("");
  const [modalMentor, setModalMentor] = useState([]);
  const [modalStatus, setModalStatus] = useState([]);

  // Month filter
  const [selectedMonth, setSelectedMonth] = useState(new Date());

  // Fetch dari BE dan mapping ke format tabel
  const buildStatusTooltip = (item, statusLabel) => {
    const mentorObj = item.mentor ?? item.pembimbing ?? item.mentor_name ?? null;
    let mentorName = 'mentor';
    if (mentorObj) {
      if (typeof mentorObj === 'string') mentorName = mentorObj;
      else mentorName = mentorObj.nama_lengkap || mentorObj.nama || mentorObj.name || String(mentorObj.user_id ?? mentorObj.id ?? '') || 'mentor';
    }
    const dateText = item.tanggal || 'this date';
    const map = {
      'Correction': `Correction approved by ${mentorName} on ${dateText}`,
      'Sick': `Sick leave recorded on ${dateText}`,
      'On Leave': `Leave recorded on ${dateText}`,
      'Late': `Late arrival on ${dateText}`,
      'On Time': `On time on ${dateText}`,
      'Absent': `Absent on ${dateText}`,
    };
    return map[statusLabel] || statusLabel;
  };

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
      const cutoff = getCutoffMinutes(item.tanggal);
      const clockInMinutes = parseTimeToMinutes(item.jam_masuk);
      if (clockInMinutes !== null) {
        const lateBy = clockInMinutes - cutoff;
        if (lateBy > 0) return { key: 'late', label: `Late (${lateBy} m)` };
        return { key: 'ontime', label: 'On Time' };
      }
      // If no clock-in time, treat as on time to avoid showing Correction badge
      return { key: 'ontime', label: 'On Time' };
    }

    // Check if early out (from response data or status string)
    if (raw.includes('early') || item.early_pulang || item.early) return { key: 'early_out', label: 'Early Out' };

    // Prefer backend-provided status if it's meaningful
    if (raw.includes('absent') || raw === 'absent') return { key: 'absent', label: 'Absent' };
    if (raw.includes('late') || raw === 'late') {
      const mins = item.lama_telat ?? null;
      return { key: 'late', label: mins ? `Late (${mins} m)` : 'Late' };
    }
    if (raw.includes('ontime') || raw.includes('on time') || raw === 'ontime') return { key: 'ontime', label: 'On Time' };
    if (raw.includes('izin') && raw.includes('sakit')) return { key: 'sick', label: 'Sick' };
    if (raw.includes('sakit') || raw === 'sick') return { key: 'sick', label: 'Sick' };
    if (raw.includes('izin') || raw.includes('leave') || raw.includes('on leave')) return { key: 'on_leave', label: 'On Leave' };
    // Fallback: infer from other fields
    if (item.lama_telat && item.lama_telat > 0) return { key: 'late', label: `Late (${item.lama_telat} m)` };
    if (item.jam_masuk) return { key: 'ontime', label: 'On Time' };
    return { key: 'absent', label: 'Absent' };
  };

  // Map client-facing status labels to API values that backend expects.
  // Some backends use different keywords for 'On Leave', so map to multiple synonyms to be robust.
  const mapStatusForApi = (statuses = []) => {
    const map = {
      'On Time': ['ontime'],
      'Late': ['late'],
      'Absent': ['absent'],
      'Sick': ['sakit', 'sick'],
      'On Leave': ['izin', 'cuti', 'leave', 'on_leave'],
      'Early Out': ['early'],
    };
    const mapped = statuses.flatMap(s => (map[s] ? map[s] : [String(s).toLowerCase()]));
    // unique
    return Array.from(new Set(mapped));
  };

  const fetchData = async (page = 1) => {
    try {
      const params = {
        page,
        per_page: itemsPerPage,
      };
      if (searchTerm) params.q = searchTerm;
      if (appliedFilterInstitution) params.universitas = appliedFilterInstitution;
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
      if (appliedFilterMentor && appliedFilterMentor.length > 0) {
        const allNumeric = appliedFilterMentor.every(m => /^\d+$/.test(String(m)));
        if (allNumeric) params.mentor_id = appliedFilterMentor.join(',');
        else params.mentor = appliedFilterMentor.join(',');
      }
      // Month filter (send numeric month and year)
      if (selectedMonth) {
        params.month = selectedMonth.getMonth() + 1; // 1-12
        params.year = selectedMonth.getFullYear();
      }

      const res = await axios.get('/admin/absensi/rekap', { params });
      const apiData = res.data?.data || [];
      const meta = res.data?.meta || {};

      const mapped = apiData.map(item => {
        const status = deriveStatus(item);
        const dateDisplay = formatDateRangeDisplay(
          item.tanggal,
          item.tanggal_mulai || item.start_date,
          item.tanggal_selesai || item.end_date
        );

        const mentorDisplay = (() => {
          const m = item.mentor ?? item.pembimbing ?? null;
          if (!m) return item.mentor_name || item.pembimbing || '-';
          if (typeof m === 'string') return m;
          return m.nama_lengkap || m.nama || m.name || (m.user_id ? String(m.user_id) : '-') || '-';
        })();

        return ({
          id: item.user_id + '-' + item.tanggal,
          name: item.nama_lengkap || item.nama,
          nim: item.identifier,
          institution: item.universitas,
          date: item.tanggal,
          dateDisplay,
          inTime: item.jam_masuk || '-',
          outTime: item.jam_pulang || '-',
          status: status.label,
          statusKey: status.key,
          mentor: mentorDisplay,
          division: item.division,
          reason: item.reason || '-', // bisa diisi jika ada field alasan
          hasFile: !!item.file || !!item.foto_masuk || !!item.foto_pulang,
          fileName: item.file || null,
          location: item.lokasi || '-', // bisa diisi jika ada lokasi
          photoUrl: item.foto_masuk || null,
          statusTooltip: buildStatusTooltip(item, status.label),
          raw: item
        });
      });

      setLogs(mapped);

      // Update mentors dropdown based on returned data (unique id+name pairs)
      try {
        const mentorsMap = new Map();
        apiData.forEach(item => {
          const mentorObj = item.mentor ?? item.pembimbing ?? null;
          let mentorId = null;
          let mentorName = null;
          if (mentorObj && typeof mentorObj === 'object') {
            mentorId = mentorObj.user_id ?? mentorObj.id ?? null;
            mentorName = mentorObj.nama_lengkap ?? mentorObj.name ?? mentorObj.nama ?? null;
          } else if (typeof mentorObj === 'string') {
            mentorName = mentorObj;
          }
          // also consider shorthand fields
          if (!mentorName) mentorName = item.mentor_name ?? item.pembimbing ?? null;
          if (mentorName) {
            const key = mentorId ? `id-${mentorId}` : `name-${mentorName}`;
            if (!mentorsMap.has(key)) mentorsMap.set(key, { value: mentorId ?? mentorName, label: mentorName });
          }
        });
        const mentorList = Array.from(mentorsMap.values());
        if (mentorList.length > 0) setFilterOptions(prev => ({ ...prev, mentors: mentorList }));
      } catch (e) {
        // ignore
      }

      setCurrentPage(meta.current_page || page);
      setTotalPages(meta.last_page || Math.max(1, Math.ceil((meta.total || mapped.length) / itemsPerPage)));
      setTotalEntries(meta.total || mapped.length);
      setShowingFrom(meta.from || (mapped.length ? (page - 1) * itemsPerPage + 1 : 0));
      setShowingTo(meta.to || (meta.to ? meta.to : ((page - 1) * itemsPerPage + mapped.length)));

      setPaginationMeta({
        current_page: meta.current_page || page,
        last_page: meta.last_page || Math.max(1, Math.ceil((meta.total || mapped.length) / itemsPerPage)),
        from: meta.from || (mapped.length ? (page - 1) * itemsPerPage + 1 : 0),
        to: meta.to || (meta.to ? meta.to : ((page - 1) * itemsPerPage + mapped.length)),
        total: meta.total || mapped.length
      });
    } catch (err) {
      setLogs([]);
      setTotalEntries(0);
      setTotalPages(1);
      setShowingFrom(0);
      setShowingTo(0);
    } finally {
      setLoading(false);
    }
  };

  const fetchFilterOptions = async () => {
    try {
      setFilterOptionsLoading(true);

      // Primary: fetch filter options
      const res = await axios.get('/admin/filters');
      const data = res.data?.data || {};

      // Secondary: prefer explicit mentors endpoint if available
      let mentorsFromApi = (data.mentors || data?.pembimbing || []);
      try {
        const mentorsRes = await axios.get('/admin/mentors');
        const mentorsPayload = mentorsRes.data?.data ?? mentorsRes.data ?? [];
        if (Array.isArray(mentorsPayload) && mentorsPayload.length > 0) {
          mentorsFromApi = mentorsPayload;
        }
      } catch (e) {
        // ignore: fall back to mentors from /admin/filters
      }

      const options = {
        institutions: data.universities || data?.universitas || [],
        divisions: data.divisions || [],
        sites: data.sites || [],
        mentors: (mentorsFromApi || []).map(m => ({ value: m.id ?? m.user_id ?? m.value ?? m.name ?? m.nama_lengkap ?? m.nama ?? m, label: m.name ?? m.nama_lengkap ?? m.nama ?? String(m) })),
      };

      // Keep any mentors we derived from attendance data if the filters endpoint/mentors endpoint does not return them
      setFilterOptions((prev) => ({
        institutions: options.institutions?.length ? options.institutions : prev.institutions,
        divisions: options.divisions?.length ? options.divisions : prev.divisions,
        sites: options.sites?.length ? options.sites : prev.sites,
        mentors: options.mentors?.length ? options.mentors : prev.mentors,
      }));
      return options;
    } catch (err) {
      // Preserve any previously fetched options to avoid wiping mentor names
      setFilterOptions((prev) => ({
        institutions: prev.institutions || [],
        divisions: prev.divisions || [],
        sites: prev.sites || [],
        mentors: prev.mentors || [],
      }));
      return { institutions: [], divisions: [], sites: [], mentors: [] };
    } finally {
      setFilterOptionsLoading(false);
    }
  }

  // --- FILTER / MODAL HELPERS ---
  const handleOpenFilter = () => {
    // initialize modal selections from applied filters
    setModalInstitution(appliedFilterInstitution);
    setModalDivision(appliedFilterDivision);
    setModalLocation(appliedFilterLocation);
    setModalMentor(appliedFilterMentor);
    setModalStatus(appliedFilterStatus);
    setIsFilterOpen(true);
  };

  const toggleModalStatus = (status) => {
    if (modalStatus.includes(status)) setModalStatus(modalStatus.filter(s => s !== status));
    else setModalStatus([...modalStatus, status]);
  };

  const resetModalFilters = () => {
    setModalInstitution("");
    setModalDivision("");
    setModalLocation("");
    setModalMentor([]);
    setModalStatus([]);
    
    // Just clear applied states and close. 
    // The debounced useEffect will trigger the search automatically.
    setAppliedFilterInstitution("");
    setAppliedFilterDivision("");
    setAppliedFilterLocation("");
    setAppliedFilterMentor([]);
    setAppliedFilterStatus([]);
    setIsFilterOpen(false);
  };

  const applyModalFilters = () => {
    setAppliedFilterInstitution(modalInstitution);
    setAppliedFilterDivision(modalDivision);
    setAppliedFilterLocation(modalLocation);
    setAppliedFilterMentor(modalMentor);
    setAppliedFilterStatus(modalStatus);
    setIsFilterOpen(false);
    // Removed manual setLoading/fetchData to prevent double fetch.
    // useEffect handles it when applied filters change.
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
            <span className={`text-sm font-medium truncate ${selected ? 'text-slate-700' : 'text-black/40'}`}>{selected ? selected.label : placeholder}</span>
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

  // --- Mentor searchable multi-select ---
  const MentorSelect = ({ value = [], onChange, options = [], placeholder = 'Select Mentors' }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [query, setQuery] = useState('');
    const containerRef = useRef(null);

    useEffect(() => {
      const handleClickOutside = (e) => { if (containerRef.current && !containerRef.current.contains(e.target)) setIsOpen(false); };
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const toggleSelect = (optValue) => {
      if (value.includes(optValue)) onChange(value.filter(v => v !== optValue));
      else onChange([...value, optValue]);
    };

    const selectAll = (e) => {
      if (e) e.stopPropagation();
      if (value.length === options.length) onChange([]);
      else onChange(options.map(o => o.value));
    };

    const filtered = options.filter(o => o.label.toLowerCase().includes(query.toLowerCase()));

    return (
      <div className="relative w-full" ref={containerRef}>
        <div onClick={() => setIsOpen(!isOpen)} className={`w-full min-h-[44px] pl-3 pr-3 py-2 rounded-xl border cursor-pointer select-none flex items-center gap-2 transition-all ${isOpen ? 'border-[#354C8F] ring-2 ring-[#354C8F]/10 bg-white' : 'border-slate-200 bg-white hover:border-slate-300'}`}>
          <div className="flex flex-wrap gap-2 flex-1">
            {value.length === 0 ? (
              <span className="text-sm text-slate-400">{placeholder}</span>
            ) : (
              value.map(v => {
                const opt = options.find(o => String(o.value) === String(v));
                return (
                  <span key={v} className="bg-slate-100 text-slate-700 text-xs font-bold px-2 py-1 rounded-md flex items-center gap-2">
                    {opt ? opt.label : v}
                    <button onClick={(e) => { e.stopPropagation(); toggleSelect(v); }} className="text-slate-400 hover:text-slate-600 p-0.5 rounded-full">×</button>
                  </span>
                );
              })
            )}
          </div>
          <ChevronDown size={16} className={`text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
        </div>

        <AnimatePresence>
          {isOpen && (
            <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 6 }} className="absolute top-full mt-2 left-0 w-full bg-white rounded-xl shadow-xl border border-slate-100 z-50 overflow-auto max-h-64">
              <div className="p-3 border-b">
                <div className="flex items-center gap-2">
                  <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Type to search..." className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-none" />
                  <button onClick={selectAll} className="text-sm px-3 py-2 rounded-lg bg-slate-50 hover:bg-slate-100">{value.length === options.length ? 'Unselect' : 'All'}</button>
                </div>
              </div>
              <div className="max-h-64 overflow-y-auto">
                <button 
                  onClick={(e) => { e.stopPropagation(); onChange([]); }}
                  className={`w-full text-left px-4 py-3 text-sm flex items-center gap-3 ${value.length === 0 ? 'bg-slate-50 font-bold text-[#203266]' : 'text-slate-600 hover:bg-slate-50'}`}
                >
                  <input type="checkbox" readOnly checked={value.length === 0} className="w-4 h-4" />
                  <span>All Mentors</span>
                </button>
                {filtered.length === 0 ? (
                  query && <div className="p-3 text-sm text-slate-400">No mentors found</div>
                ) : (
                  filtered.map(opt => (
                    <button key={opt.value} onClick={(e) => { e.stopPropagation(); toggleSelect(opt.value); }} className={`w-full text-left px-4 py-3 text-sm flex items-center gap-3 ${value.includes(opt.value) ? 'bg-slate-50 font-bold text-[#203266]' : 'text-slate-600 hover:bg-slate-50'}`}>
                      <input type="checkbox" readOnly checked={value.includes(opt.value)} className="w-4 h-4" />
                      <span>{opt.label}</span>
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
    setLoading(true);
    const t = setTimeout(() => fetchData(1), 400);
    return () => clearTimeout(t);
  }, [searchTerm, appliedFilterInstitution, appliedFilterDivision, appliedFilterLocation, appliedFilterStatus, appliedFilterMentor, selectedMonth, itemsPerPage]);

  // Initial load
  useEffect(() => { setLoading(true); fetchFilterOptions(); }, []);

  // Fetch filter options when modal opened (ensure fresh data)
  useEffect(() => {
    if (isFilterOpen) fetchFilterOptions();
  }, [isFilterOpen]);

  // Helper: Check if any applied filter is active
  const isFilterActive = Boolean(
    appliedFilterInstitution ||
    appliedFilterDivision ||
    appliedFilterLocation ||
    (appliedFilterMentor && appliedFilterMentor.length > 0) ||
    (appliedFilterStatus && appliedFilterStatus.length > 0)
  );

  // --- HANDLERS ---
  // Fetch detail absensi dari BE saat klik View
  const handleOpenDetail = async (log) => {
    setLoadingDetailId(log.id);
    // prefer id_mahasiswa from the raw payload; fallback to user_id or parsed id from row
    const resolvedId = log.raw?.id_mahasiswa ?? log.raw?.user_id ?? String(log.id).split(/-(.+)/)[0];
    try {
      const res = await axios.get(`/mentor/detail/${resolvedId}/${log.date}`);
      const detail = res.data?.data || {};
      const userId = resolvedId;
      const fotoMasukUrl = detail.foto_masuk ? `absensi/foto-masuk/${detail.foto_masuk.split('/').pop()}` : null;
      const fotoPulangUrl = detail.foto_pulang ? `absensi/foto-pulang/${detail.foto_pulang.split('/').pop()}` : null;
      setSelectedLog({
        ...log,
        // Overwrite/extend with detail fields jika ada
        reason: detail.alasan || log.reason,
        hasFile: !!detail.file,
        fileName: detail.file || null,
        location: detail.lokasi || log.location,
        photoUrl: detail.foto || log.photoUrl,
        foto_masuk: fotoMasukUrl,
        foto_pulang: fotoPulangUrl,
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
      setLoadingDetailId(null);
      setIsDetailOpen(true);
    }
  };


  const handleCloseDetail = () => {
    setIsDetailOpen(false);
    setSelectedLog(null);
  };

  // Centralized page change handler used by pagination controls
  const handlePageChange = (page) => {
    if (page === undefined || page === null) return;
    const last = paginationMeta?.last_page || totalPages || 1;
    const p = Math.max(1, Math.min(page, last));
    setCurrentPage(p);
    setLoading(true);
    fetchData(p);
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
    <div className="bg-slate-50 min-h-screen p-8 font-sans text-slate-800 -mt-8 -ml-5 -mr-5">

      {/* 1. Page Header */}
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-[#203266] mb-2">Time & Attendance Records</h2>
        <p className="text-slate-500 text-sm">Comprehensive view of student punctuality and real-time attendance tracking.</p>
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
            <span className="hidden md:inline">Filter</span>
            <Filter size={18} />

            {/* Red Dot Indicator */}
            {isFilterActive && (
              <div className="absolute top-3 right-3 md:top-2 md:right-2 w-2.5 h-2.5 bg-red-400 rounded-full border-2 border-[#354C8F]"></div>
            )}
          </button>
        </div>
      </div>

      {/* 3. Table Card */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
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
          <table className="w-full text-left table-auto">
            <thead>
              <tr className="text-sm font-bold text-slate-900 border-b border-slate-100 bg-slate-50/30">
                <th className="p-3 w-12 text-center">No</th>
                <th className="p-3 w-48">Name</th>
                <th className="p-3 w-32">Date</th>
                <th className="p-3 w-24 text-center">Clock In</th>
                <th className="p-3 w-24 text-center">Clock Out</th>
                <th className="p-3 w-36">Division</th>
                <th className="p-3 w-40">Mentor</th>

                <th className="p-3 w-36">Institution</th>

                <th className="p-3 w-36 text-center">Status</th>
                <th className="p-3 w-20 text-center">Action</th>
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
                    <td className="p-3 font-medium text-slate-800 text-center">{(showingFrom ? showingFrom + index : ((currentPage - 1) * itemsPerPage + index + 1))}</td>
                    <td className="p-3 font-medium text-slate-800 max-w-[260px] overflow-hidden">
                      <div className="truncate">{item.name}</div>
                    </td>
                    <td className="p-3 whitespace-nowrap">{item.dateDisplay || item.date}</td>
                    <td className="p-3 text-center whitespace-nowrap">{item.inTime || '-'}</td>
                    <td className="p-3 text-center whitespace-nowrap">{item.outTime || '-'}</td>
                    <td className="p-3 max-w-[180px] overflow-hidden"><div className="truncate">{item.division || '-'}</div></td>
                    <td className="p-3 max-w-[220px] overflow-hidden"><div className="truncate">{item.mentor || '-'}</div></td>

                    <td className="p-3 max-w-[200px] overflow-hidden"><div className="truncate">{item.institution || '-'}</div></td>



                    {/* Status Column (1 Baris) */}
                    <td className="p-3 text-center"><StatusBadge status={item.status} tooltip={item.statusTooltip} /></td>

                    {/* Action Column (View Button) */}
                    <td className="p-3 text-center">
                      <button onClick={() => handleOpenDetail(item)} disabled={loadingDetailId === item.id} className={`inline-flex items-center justify-center h-[34px] w-[34px] bg-[#354C8F] text-white rounded-lg hover:bg-[#2a3c70] transition-colors shadow-sm shadow-indigo-100 active:scale-95 ${loadingDetailId === item.id ? 'opacity-60 cursor-not-allowed' : ''}`} title="View Details">
                        {loadingDetailId === item.id ? <Loader2 size={16} className="animate-spin" /> : <Eye size={14} />}
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
            <p className="order-2 md:order-1 text-center md:text-left w-full md:w-auto">
              Showing {paginationMeta.from} to {paginationMeta.to} of {paginationMeta.total} entries
            </p>

            <div className="flex items-center gap-4 flex-wrap justify-center order-1 md:order-2 w-full md:w-auto">
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

            {/* Tombol Pagination: Di Mobile Pindah ke Atas (order-1) */}
            <div className="flex items-center gap-1 md:gap-2 flex-wrap justify-center">

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
        </div>
        )}
      </div>

      {/* --- MODAL: FILTER --- */}
      {isFilterOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">

            {/* Header */}
            <div className="flex justify-between items-center px-5 py-4 border-b border-slate-100">
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

              {/* Institution */}
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-0 -mt-2">Institution</label>
                <CustomSelect
                  value={modalInstitution}
                  onChange={setModalInstitution}
                  options={[
                    { value: "", label: "All Institution" },
                    ...(filterOptions?.institutions || []).map(u => ({ value: u, label: u }))
                  ]}
                  placeholder="All Institution"
                />
              </div>

              {/* Division */}
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-0 -mt-2">Division</label>
                <CustomSelect
                  value={modalDivision}
                  onChange={setModalDivision}
                  options={[
                    { value: "", label: "All Division" },
                    ...(filterOptions?.divisions || []).map(d => ({ value: d, label: d }))
                  ]}
                  placeholder="All Division"
                />
              </div>

              {/* Mentor */}
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-0 -mt-2">Mentor</label>
                <MentorSelect
                  value={modalMentor}
                  onChange={setModalMentor}
                  options={filterOptions?.mentors || []}
                  placeholder="All Mentors"
                />
              </div>

              {/* Office Location */}
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-0 -mt-2">Site</label>
                <CustomSelect
                  value={modalLocation}
                  onChange={setModalLocation}
                  options={[
                    { value: "", label: "All Site" },
                    ...(filterOptions?.sites || []).map(s => ({ value: s.id_site ?? s.nama_site ?? s.name, label: s.nama_site ?? s.nama ?? s.name }))
                  ]}
                  placeholder="All Site"
                />
              </div>

              {/* Attendance Status */}
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-0 -mt-2">Attendance Status</label>
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
            <div className="p-4 border-t border-slate-100 flex justify-end gap-3 bg-slate-50">
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

            <div className="p-8 overflow-y-auto -mt-5">

              <div className="mb-6">
                <p className="text-sm font-bold text-slate-900 mb-2 ">Attendance Status</p>
                <div className="inline-block">
                  <StatusBadge status={selectedLog.status} tooltip={selectedLog.statusTooltip} />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                {/* Live Photo */}
                <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
                  <p className="text-sm font-bold text-slate-900 mb-3">Live Photo</p>
                  <div className="space-y-4">
                    {/* Clock In Photo */}
                    <div>
                      <p className="text-xs font-semibold text-slate-700 mb-1 text-center">Clock In</p>
                      <div className="aspect-video w-full bg-slate-100 rounded-lg overflow-hidden flex items-center justify-center border border-slate-100 relative group">
                        {selectedLog.foto_masuk ? (
                          <>
                            <SecureImage src={selectedLog.foto_masuk} alt="Clock In Photo" className="w-full h-full object-cover" />
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors pointer-events-none"></div>
                          </>
                        ) : (
                          <div className="text-center text-slate-400 text-sm">
                            <p className="font-semibold">No data</p>
                          </div>
                        )}
                      </div>
                      {selectedLog.foto_masuk && selectedLog.jam_masuk && (
                        <p className="text-xs text-slate-500 mt-2 text-center">Captured at: {selectedLog.jam_masuk}</p>
                      )}
                    </div>
                    {/* Clock Out Photo */}
                    <div>
                      <p className="text-xs font-semibold text-slate-700 mb-1 text-center">Clock Out</p>
                      <div className="aspect-video w-full bg-slate-100 rounded-lg overflow-hidden flex items-center justify-center border border-slate-100 relative group">
                        {selectedLog.foto_pulang ? (
                          <>
                            <SecureImage src={selectedLog.foto_pulang} alt="Clock Out Photo" className="w-full h-full object-cover" />
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors pointer-events-none"></div>
                          </>
                        ) : (
                          <div className="text-center text-slate-400 text-sm">
                            <p className="font-semibold">No data</p>
                          </div>
                        )}
                      </div>
                      {selectedLog.foto_pulang && selectedLog.jam_pulang && (
                        <p className="text-xs text-slate-500 mt-2 text-center">Captured at: {selectedLog.jam_pulang}</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Location */}
                <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
                  <p className="text-sm font-bold text-slate-900 mb-3">Location</p>
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
                <p className="text-sm font-bold text-slate-900 mb-2">Attached Output</p>
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
                <p className="text-sm font-bold text-slate-900 mb-2">Reason</p>
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