import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  Filter,
  Plus,
  Edit2,
  Trash2,
  X,
  Check,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Clock,
  Calendar,
  Upload,   // Icon Import
  Download, // Icon Download Template
  FileSpreadsheet
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import apiClient from '../../../api/axiosConfig';
import { getSafeErrorMessage, logError } from '../../../utils/errorHandler';

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
const btnDanger = `${btnBase} bg-[#EF4444] hover:bg-[#DC2626] text-white shadow-md shadow-red-200`;
const actionText = 'hidden sm:inline-block';

const WorkingSchedule = () => {
  // schedules initially empty — populated by API
  const [schedules, setSchedules] = useState([]);

  // --- STATES ---
  // Modals
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [showFormModal, setShowFormModal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);

  // Data
  const [formMode, setFormMode] = useState("add");
  const [selectedSchedule, setSelectedSchedule] = useState(null);
  const [formData, setFormData] = useState({ name: "", clockIn: "", clockOut: "", tolerance: 0, days: [] });

  // Status & Confirm
  const [confirmType, setConfirmType] = useState(null);
  const [statusType, setStatusType] = useState('success');
  const [statusMessage, setStatusMessage] = useState({ title: "", desc: "" });
  const [activeSummary, setActiveSummary] = useState({ activeIds: [], activeCount: 0 });
  const [statusGuardLoading, setStatusGuardLoading] = useState(false);

  // Filter
  const [filter, setFilter] = useState({ days: [] });

  // Applied filters (only used when user clicks Apply)
  const [appliedFilterDays, setAppliedFilterDays] = useState([]);

  const isFilterActive = appliedFilterDays.length > 0;

  // Pagination, search & server data
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [loading, setLoading] = useState(false);
  const [meta, setMeta] = useState({ current_page: 1, last_page: 1, from: 0, to: 0, total: 0, per_page: 25 });

  // Search
  const [query, setQuery] = useState('');
  const searchTimeout = useRef(null);

  // helper: map API day keys to UI labels
  const dayMap = { mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri', sat: 'Sat', sun: 'Sun' };
  const allDays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  // Helper to extract a user-friendly error message without leaking API details
  const getErrorMessage = (err, fallback = 'Something went wrong') => {
    return getSafeErrorMessage(err, fallback);
  };

  // --- ACTION HELPERS ---
  const [isProcessing, setIsProcessing] = useState(false);

  const formatTimeToHHMMSS = (t) => {
    if (!t) return '';
    // if already HH:MM:SS
    if (/^\d{2}:\d{2}:\d{2}$/.test(t)) return t;
    // if HH:MM
    if (/^\d{2}:\d{2}$/.test(t)) return `${t}:00`;
    // try to parse loosely and format
    const m = t.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/);
    if (m) {
      const hh = m[1].padStart(2, '0');
      const mm = m[2];
      const ss = m[3] ? m[3].padStart(2, '0') : '00';
      return `${hh}:${mm}:${ss}`;
    }
    return t;
  };

  const toPayload = (fd) => {
    const payload = {
      name: fd.name,
      start_time: formatTimeToHHMMSS(fd.clockIn),
      end_time: formatTimeToHHMMSS(fd.clockOut),
      tolerance: Number(fd.tolerance) || 0,
      toleransi: Number(fd.tolerance) || 0,
      days: (fd.days || []).map(d => d.toLowerCase()),
      is_active: !!fd.is_active,
      apply_to_all_interns: !!fd.is_active,
    };

    if (fd.dayTimes && Object.keys(fd.dayTimes).length) {
      const dt = {};
      Object.keys(fd.dayTimes).forEach(k => {
        const key = String(k).toLowerCase();
        const s = formatTimeToHHMMSS(fd.dayTimes[k]?.start);
        const e = formatTimeToHHMMSS(fd.dayTimes[k]?.end);
        if (s || e) dt[key] = { start: s || null, end: e || null };
      });
      if (Object.keys(dt).length) payload.day_times = dt;
    }

    return payload;
  };

  // Client-side validation to give quicker feedback and avoid roundtrips
  const validateForm = () => {
    const toSeconds = (t) => {
      const [hh, mm, ss] = String(t).split(':').map(Number);
      return hh * 3600 + mm * 60 + ss;
    };
    const normalizeDayLabel = (day) => {
      const raw = String(day || '').trim();
      const key = raw.toLowerCase().slice(0, 3);
      return dayMap[key] || raw;
    };

    if (!formData.name || !String(formData.name).trim()) return 'Schedule name is required.';
    const dayTimes = formData.dayTimes || {};
    const selectedDays = formData.days || [];
    const hasPerDayTimes = selectedDays.length > 0 && selectedDays.every((d) => {
      const dt = dayTimes[d];
      return dt && String(dt.start || '').trim() && String(dt.end || '').trim();
    });

    if (!hasPerDayTimes) {
      if (!formData.clockIn || !formData.clockOut) return 'Clock-In and Clock-Out are required.';
      const start = formatTimeToHHMMSS(formData.clockIn);
      const end = formatTimeToHHMMSS(formData.clockOut);
      if (!/^\d{2}:\d{2}:\d{2}$/.test(start) || !/^\d{2}:\d{2}:\d{2}$/.test(end)) return 'Times must be in HH:MM or HH:MM:SS format.';
      if (toSeconds(end) <= toSeconds(start)) return 'Clock-Out must be later than Clock-In.';
    }

    // Validate tolerance
    if (formData.tolerance !== '' && formData.tolerance !== null) {
      if (!Number.isInteger(Number(formData.tolerance)) || Number(formData.tolerance) < 0) return 'Tolerance must be a non-negative integer.';
    }

    // Validate days
    const allowed = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
    const lowerDays = (formData.days || []).map(d => String(d).toLowerCase());
    if (lowerDays.some(d => !allowed.includes(d))) return 'Work days contain invalid value.';

    // If per-day times are present, ensure each selected day has valid start & end
    const dt = formData.dayTimes || {};
    for (const d of formData.days || []) {
      const dayLabel = normalizeDayLabel(d);
      const lookupCandidates = [
        d,
        dayLabel,
        String(d || '').trim(),
        String(d || '').toLowerCase(),
        String(d || '').toUpperCase(),
        String(d || '').slice(0, 3),
        String(d || '').slice(0, 3).toLowerCase(),
      ];
      const dayTime = lookupCandidates.map((k) => dt[k]).find(Boolean);
      if (!dayTime || !String(dayTime.start).trim() || !String(dayTime.end).trim()) return `Please set start and end time for ${dayLabel}.`;
      const ds = formatTimeToHHMMSS(dayTime.start);
      const de = formatTimeToHHMMSS(dayTime.end);
      if (!/^\d{2}:\d{2}:\d{2}$/.test(ds) || !/^\d{2}:\d{2}:\d{2}$/.test(de)) return `Invalid time format for ${dayLabel}.`;
      if (toSeconds(de) <= toSeconds(ds)) return `Clock-Out must be later than Clock-In for ${dayLabel}.`;
    }

    return null;
  };

  // Safe parser for 'days' field — server may return an array, JSON string, or delimiter string
  const parseDays = (val) => {
    if (!val && val !== 0) return [];
    try {
      if (Array.isArray(val)) return val;
      if (typeof val === 'string') {
        // Try JSON first
        try {
          const parsed = JSON.parse(val);
          if (Array.isArray(parsed)) return parsed;
        } catch (e) {
          // not JSON, continue
        }
        // Split by common delimiters ; , | or whitespace
        return val.split(/[;,|]+/).map(s => s.trim()).filter(Boolean);
      }
      // If it's an object with numeric keys (rare), convert to array
      if (typeof val === 'object') {
        return Object.values(val).map(String).map(s => s.trim()).filter(Boolean);
      }
    } catch (e) {
      console.warn('parseDays error', e, val);
    }
    return [];
  };

  const mapApiScheduleToFormData = (item) => {
    const rawDays = parseDays(item?.days || []);
    const mappedDays = rawDays.map(d => {
      try { return dayMap[String(d).toLowerCase()] || String(d); } catch (e) { return String(d); }
    });

    const rawDayTimes = item?.day_times || {};
    const dayTimes = {};
    Object.keys(rawDayTimes).forEach(k => {
      try {
        const label = dayMap[String(k).toLowerCase()] || String(k);
        const start = rawDayTimes[k]?.start ? String(rawDayTimes[k].start).slice(0, 5) : '';
        const end = rawDayTimes[k]?.end ? String(rawDayTimes[k].end).slice(0, 5) : '';
        dayTimes[label] = { start, end };
      } catch (e) {
        // ignore malformed entries
      }
    });

    return {
      name: item?.name || '',
      clockIn: item?.start_time ? String(item.start_time).slice(0, 5) : '',
      clockOut: item?.end_time ? String(item.end_time).slice(0, 5) : '',
      tolerance: item?.tolerance ?? 0,
      days: mappedDays,
      dayTimes,
      is_active: false,
    };
  };

  const getActiveSchedulesSummary = async () => {
    let page = 1;
    let lastPage = 1;
    const activeIds = [];

    do {
      const res = await apiClient.get('/admin/work-schedules', {
        params: { page, per_page: 100 }
      });
      const payload = res.data || {};
      const items = payload.data || [];
      items.forEach((schedule) => {
        if (schedule?.is_active) activeIds.push(schedule.id);
      });
      lastPage = payload.last_page || 1;
      page += 1;
    } while (page <= lastPage);

    return { activeIds, activeCount: activeIds.length };
  };

  const deactivateOtherActiveSchedules = async (activeScheduleId) => {
    if (!activeScheduleId) return { updated: 0, failed: 0 };

    let page = 1;
    let lastPage = 1;
    const activeSchedules = [];

    do {
      const res = await apiClient.get('/admin/work-schedules', {
        params: { page, per_page: 100 }
      });
      const payload = res.data || {};
      const items = payload.data || [];
      items.forEach((schedule) => {
        if (schedule?.is_active && String(schedule?.id) !== String(activeScheduleId)) {
          activeSchedules.push(schedule);
        }
      });
      lastPage = payload.last_page || 1;
      page += 1;
    } while (page <= lastPage);

    if (!activeSchedules.length) return { updated: 0, failed: 0 };

    const results = await Promise.allSettled(
      activeSchedules.map((schedule) => {
        const payload = toPayload(mapApiScheduleToFormData(schedule));
        return apiClient.put(`/admin/work-schedules/${schedule.id}`, payload);
      })
    );

    const failed = results.filter(r => r.status === 'rejected').length;
    return { updated: activeSchedules.length - failed, failed };
  };

  // Fetch schedules from API
  const fetchSchedules = async (page = 1) => {
    setLoading(true);
    try {
      const params = { page, per_page: itemsPerPage };
      if (appliedFilterDays && appliedFilterDays.length) params.days = appliedFilterDays.map(d => d.toLowerCase());
      if (query && String(query).trim()) params.q = String(query).trim();
      const res = await apiClient.get('/admin/work-schedules', { params });
      const payload = res.data || {};
      const items = (payload.data || []).map(i => {
        const rawDays = parseDays(i.days || []);
        const mappedDays = rawDays.map(d => {
          try { return dayMap[String(d).toLowerCase()] || String(d); } catch (e) { return String(d); }
        });

        // Normalize per-day times if backend provides them
        const rawDayTimes = i.day_times || {};
        const dayTimes = {};
        let perDayDifferent = false;
        Object.keys(rawDayTimes).forEach(k => {
          try {
            const label = dayMap[String(k).toLowerCase()] || String(k);
            const start = rawDayTimes[k]?.start ? String(rawDayTimes[k].start).slice(0, 5) : null;
            const end = rawDayTimes[k]?.end ? String(rawDayTimes[k].end).slice(0, 5) : null;
            if (start || end) {
              dayTimes[label] = { start, end, short: (start && end) ? `${start} - ${end}` : (start ? `Start ${start}` : (end ? `End ${end}` : '')) };
            }
            // Check if any per-day time differs from schedule default
            const defaultStart = i.start_time ? String(i.start_time).slice(0, 5) : '';
            const defaultEnd = i.end_time ? String(i.end_time).slice(0, 5) : '';
            if ((start && start !== defaultStart) || (end && end !== defaultEnd)) perDayDifferent = true;
          } catch (e) {
            // ignore malformed entries
          }
        });

        // Build grouped ranges of consecutive days that share the same time
        const dayGroups = [];
        let currentGroup = null;
        allDays.forEach(day => {
          const active = mappedDays.includes(day);
          if (!active) {
            if (currentGroup) { dayGroups.push(currentGroup); currentGroup = null; }
            return;
          }
          const dt = dayTimes[day];
          const start = (dt && dt.start) || (i.start_time ? String(i.start_time).slice(0, 5) : '');
          const end = (dt && dt.end) || (i.end_time ? String(i.end_time).slice(0, 5) : '');
          const key = `${start}|${end}`;
          const label = (start && end) ? `${start} - ${end}` : (start ? `Start ${start}` : (end ? `End ${end}` : ''));

          if (currentGroup && currentGroup.timeKey === key) {
            currentGroup.days.push(day);
          } else {
            if (currentGroup) dayGroups.push(currentGroup);
            currentGroup = { days: [day], timeKey: key, timeLabel: label };
          }
        });
        if (currentGroup) dayGroups.push(currentGroup);

        return {
          id: i.id,
          name: i.name,
          // Keep defaults for backward compatibility (used in forms and exports)
          clockIn: i.start_time ? i.start_time.slice(0, 5) : '',
          clockOut: i.end_time ? i.end_time.slice(0, 5) : '',
          tolerance: i.tolerance ?? 0,
          days: mappedDays,
          dayTimes,
          dayGroups,
          hasPerDayDifferent: perDayDifferent,
          is_active: i.is_active,
          raw: i
        };
      });

      setSchedules(items);
      setMeta({
        current_page: payload.current_page || page,
        last_page: payload.last_page || 1,
        from: payload.from || (items.length ? 1 : 0),
        to: payload.to || items.length,
        total: payload.total || items.length,
        per_page: payload.per_page || items.length
      });
    } catch (err) {
      console.error('Failed to fetch schedules', err);
      setStatusType('error');
      setStatusMessage({ title: 'Load Failed', desc: getErrorMessage(err, 'Unable to load work schedules.') });
      setShowStatusModal(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // reset to first page when filters change
    setCurrentPage(1);
    fetchSchedules(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appliedFilterDays, itemsPerPage]);

  // remove immediate fetch on raw query change — debounce will handle it

  useEffect(() => {
    fetchSchedules(currentPage);
    // cleanup search timeout on unmount
    return () => { if (searchTimeout.current) clearTimeout(searchTimeout.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage]);

  const handlePageChange = (page) => {
    if (page >= 1 && page <= (meta.last_page || 1)) setCurrentPage(page);
  };

  // --- HANDLERS ---

  const openForm = async (mode, item = null) => {
    setStatusGuardLoading(true);
    let latestSummary = { activeIds: [], activeCount: 0 };
    try {
      latestSummary = await getActiveSchedulesSummary();
      setActiveSummary(latestSummary);
    } catch (e) {
      // fallback to current summary state if fetch fails
      latestSummary = activeSummary;
    } finally {
      setStatusGuardLoading(false);
    }

    setFormMode(mode);
    if (mode === 'edit' && item) {
      setFormData({ ...item, is_active: item?.is_active ?? true });
      setSelectedSchedule(item);
    } else {
      const defaultDays = ["Mon", "Tue", "Wed", "Thu", "Fri"];
      const defaultClockIn = "08:00";
      const defaultClockOut = "17:00";
      const dayTimes = {};
      defaultDays.forEach(d => { dayTimes[d] = { start: defaultClockIn, end: defaultClockOut }; });
      setFormData({
        name: "",
        clockIn: defaultClockIn,
        clockOut: defaultClockOut,
        tolerance: 0,
        days: defaultDays,
        dayTimes,
        is_active: latestSummary.activeCount === 0
      });
      setSelectedSchedule(null);
    }
    setShowFormModal(true);
  };

  const handleDayToggle = (day) => {
    setFormData(prev => {
      const has = prev.days.includes(day);
      const newDays = has ? prev.days.filter(d => d !== day) : [...prev.days, day];
      newDays.sort((a, b) => allDays.indexOf(a) - allDays.indexOf(b));
      const dayTimes = { ...(prev.dayTimes || {}) };
      if (!has) {
        // initialize per-day times to current global values
        dayTimes[day] = { start: prev.clockIn || '', end: prev.clockOut || '' };
      } else {
        delete dayTimes[day];
      }
      return { ...prev, days: newDays, dayTimes };
    });
  };

  const handleDeleteInit = (item) => {
    setSelectedSchedule(item);
    setConfirmType('delete');
    setShowConfirmModal(true);
  };

  const handleFormSubmit = () => {
    setConfirmType(formMode === 'add' ? 'add' : 'save');
    setShowConfirmModal(true);
  };

  const createSchedule = async () => {
    const v = validateForm();
    if (v) { setStatusType('error'); setStatusMessage({ title: 'Validation', desc: v }); setShowStatusModal(true); return; }
    setIsProcessing(true);
    try {
      if (formData.is_active) {
        await deactivateOtherActiveSchedules(-1); // Deactivate all other active schedules first
      }

      const payload = toPayload(formData);
      await apiClient.post('/admin/work-schedules', payload);
      setStatusType('success');
      setStatusMessage({
        title: 'Schedule Added',
        desc: 'New working schedule created.'
      });
      setShowFormModal(false);
      await fetchSchedules(1);
    } catch (err) {
      console.error('Create failed', err);
      setStatusType('error');
      setStatusMessage({ title: 'Create Failed', desc: getErrorMessage(err, 'Unable to create schedule.') });
    } finally {
      setIsProcessing(false);
      setShowStatusModal(true);
    }
  };

  const updateSchedule = async () => {
    const v = validateForm();
    if (v) { setStatusType('error'); setStatusMessage({ title: 'Validation', desc: v }); setShowStatusModal(true); return; }
    setIsProcessing(true);
    try {
      const id = selectedSchedule?.raw?.id || selectedSchedule?.id;
      if (!id) throw new Error('Missing schedule id');

      if (formData.is_active) {
        await deactivateOtherActiveSchedules(id);
      }

      const payload = toPayload(formData);
      await apiClient.put(`/admin/work-schedules/${id}`, payload);
      setStatusType('success');
      setStatusMessage({
        title: 'Saved',
        desc: 'Schedule details updated.'
      });
      setShowFormModal(false);
      await fetchSchedules(currentPage);
    } catch (err) {
      console.error('Update failed', err);
      setStatusType('error');
      setStatusMessage({ title: 'Update Failed', desc: getErrorMessage(err, 'Unable to update schedule.') });
    } finally {
      setIsProcessing(false);
      setShowStatusModal(true);
    }
  };

  const deleteSchedule = async () => {
    setIsProcessing(true);
    try {
      const id = selectedSchedule?.raw?.id || selectedSchedule?.id;
      if (!id) throw new Error('Missing schedule id');
      await apiClient.delete(`/admin/work-schedules/${id}`);
      setStatusType('success');
      setStatusMessage({ title: 'Deleted', desc: 'Schedule removed successfully.' });
      fetchSchedules(1);
    } catch (err) {
      console.error('Delete failed', err);
      setStatusType('error');
      setStatusMessage({ title: 'Delete Failed', desc: getErrorMessage(err, 'Unable to delete schedule.') });
    } finally {
      setIsProcessing(false);
      setShowStatusModal(true);
    }
  };

  const executeAction = async () => {
    setShowConfirmModal(false);
    if (confirmType === 'delete') {
      await deleteSchedule();
    } else if (confirmType === 'add') {
      await createSchedule();
    } else if (confirmType === 'save') {
      await updateSchedule();
    } else if (confirmType === 'import') {
      // import already handled elsewhere
      setStatusType('success');
      setStatusMessage({ title: 'Import', desc: 'Import handled.' });
      setShowStatusModal(true);
    }
  };

  const selectedScheduleId = selectedSchedule?.raw?.id || selectedSchedule?.id;
  const isSelectedScheduleCurrentlyActive = formMode === 'edit'
    ? activeSummary.activeIds.some((id) => String(id) === String(selectedScheduleId))
    : false;
  const blockSetActive = false; // Allow users to select Active, will automatically deactivate others.
  const blockSetInactive = false;

  return (
    <div className="bg-slate-50 min-h-screen pt-8 pb-8 pl-2 pr-2 md:pl-2 md:pr-2 w-full font-sans text-slate-800 -mt-8">

      {/* HEADER */}
      <div className="mb-6 md:mb-8 mt-4 md:mt-0">
        <h1 className={`text-xl md:text-2xl font-bold text-[${colors.textDark}] mb-1 md:mb-2`}>Working Schedule</h1>
        <p className="text-slate-500 text-xs">Define and manage standard working hours and workdays</p>
      </div>

      {/* ACTION BAR */}
      <div className="flex flex-col md:flex-row justify-between items-stretch md:items-center gap-3 md:gap-4 mb-6">
        <div className="flex gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-80">
            <input
              type="text"
              value={query}
              onChange={(e) => {
                const v = e.target.value;
                setQuery(v);
                if (searchTimeout.current) clearTimeout(searchTimeout.current);
                // debounce: if already on page 1, call fetch after delay; otherwise reset to page 1 which will trigger fetch
                searchTimeout.current = setTimeout(() => {
                  if (currentPage === 1) {
                    fetchSchedules(1);
                  } else {
                    setCurrentPage(1);
                  }
                }, 500);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  if (searchTimeout.current) clearTimeout(searchTimeout.current);
                  // immediate search on Enter
                  fetchSchedules(1);
                  setCurrentPage(1);
                }
              }}
              placeholder="Search schedule..."
              className="w-full pl-9 md:pl-10 pr-9 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#354C8F]/20 text-sm shadow-sm transition-all"
            />
            <Search className="absolute left-3 top-3.5 text-slate-400" size={18} />
            {query && <button onClick={() => { setQuery(''); setCurrentPage(1); }} className="absolute right-3 top-3.5 text-slate-400"><X size={14} /></button>}
          </div>
          <button onClick={() => setShowFilterModal(true)} className={`${btnPrimary} !bg-[#354C8F] md:!px-6 w-auto`} aria-label="Open filter">
            <Filter size={16} />

            <span className="hidden md:inline">Filter</span>
            {isFilterActive && <div className="w-2 h-2 bg-red-400 rounded-full animate-pulse ml-2"></div>}
          </button>
        </div>

        <div className="flex gap-3 w-full md:w-auto">
          <button onClick={() => openForm('add')} className={`${btnPrimary} w-full md:w-auto`}>
            <Plus size={18} /> Add Schedule
          </button>
        </div>
      </div>

      {/* TABLE */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[1000px] md:min-w-full">
            <thead>
              <tr className="border-b border-slate-100 text-xs font-bold text-slate-900 bg-slate-50/50">
                <th className="px-4 py-3 w-16 text-center">No</th>
                <th className="px-4 py-3">Schedule Name</th>
                <th className="px-4 py-3 text-center">Tolerance (min)</th>
                <th className="px-4 py-3">Work Days</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="text-xs text-slate-600">
              {loading ? (
                <tr>
                  <td colSpan={6} className="p-12 text-center">
                    <div className="flex flex-col items-center justify-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#354C8F] mb-2"></div>
                      <span className="text-slate-400">Loading schedules...</span>
                    </div>
                  </td>
                </tr>
              ) : schedules.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-slate-500">No schedules found</td>
                </tr>
              ) : (
                schedules.map((item, index) => (
                  <tr key={item.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 text-center font-medium">{meta.from + index}</td>
                    <td className="px-4 py-3 font-medium text-slate-700 whitespace-nowrap">{item.name}</td>
                    <td className="px-4 py-3 text-center font-mono">{item.tolerance ?? 0}</td>

                    {/* WORK DAYS GROUPS */}
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2 items-start justify-start">
                        {(item.dayGroups && item.dayGroups.length) ? item.dayGroups.map((g, idx) => {
                          const label = g.days.length > 1 ? `${g.days[0]} - ${g.days[g.days.length - 1]}` : g.days[0];
                          return (
                            <div key={`${label}-${idx}`} className="px-3 py-2 rounded-lg border bg-indigo-50 border-indigo-100 text-xs text-[#354C8F] flex items-center gap-2 whitespace-nowrap">
                              <div className="font-bold text-xs">{label}</div>
                              <div className="text-xs text-slate-500 font-mono">{g.timeLabel}</div>
                            </div>
                          );
                        }) : <div className="text-xs text-slate-400">No days</div>}
                      </div>
                    </td>

                    <td className="px-4 py-3 text-center">
                      <span className={`px-3 py-1 md:px-4 md:py-1.5 rounded-lg text-[10px] md:text-xs font-bold border inline-block min-w-[70px] md:min-w-[80px] text-center ${item.is_active ? 'bg-green-100 text-green-700 border-green-200' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                        {item.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>

                    <td className="px-4 py-3 text-center">
                      <div className="flex justify-center gap-2">
                        <button onClick={() => openForm('edit', item)} className="p-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors shadow-sm shadow-green-200"><Edit2 size={14} /></button>
                        <button onClick={() => handleDeleteInit(item)} className="p-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors shadow-sm shadow-red-200"><Trash2 size={14} /></button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* PAGINATION */}
        {meta.total > 0 && (
          <div className="flex flex-col md:flex-row justify-between items-center p-5 border-t border-slate-100 text-sm text-slate-500 gap-4">
            <p className="order-2 md:order-1">Showing {meta.from} to {meta.to} of {meta.total} entries</p>
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
                  const pageCurrent = meta.current_page;
                  const pageTotal = meta.last_page || 1;
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
                <button disabled={currentPage === meta.last_page} onClick={() => handlePageChange(currentPage + 1)} className="p-2 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50 border border-slate-200 disabled:cursor-not-allowed"><ChevronRight size={18} /></button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* --- MODALS --- */}
      <AnimatePresence>

        {/* 1. FILTER MODAL */}
        {showFilterModal && (
          <ModalOverlay key="modal-filter" zIndex="z-50" onClose={() => setShowFilterModal(false)}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-[18px] font-bold text-[#27345A]">Schedule Filter</h3>
              <button onClick={() => setShowFilterModal(false)}><X className="text-slate-400 hover:text-slate-600" /></button>
            </div>
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-bold text-slate-800 mb-3">Work Days</label>
                <div className="flex flex-wrap gap-2">
                  {allDays.map(day => (
                    <button key={day} onClick={() => setFilter({ days: filter.days.includes(day) ? filter.days.filter(d => d !== day) : [...filter.days, day] })}
                      className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all border ${filter.days.includes(day) ? 'bg-[#354C8F] text-white border-[#354C8F] shadow-md' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                      {day}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex gap-3 justify-end mt-6 pt-4 border-t border-slate-100">
              <button onClick={() => {
                setFilter({ days: [] });
                setAppliedFilterDays([]);
              }} className={btnSecondary}>Reset</button>
              <button onClick={() => {
                setAppliedFilterDays([...filter.days]);
                setShowFilterModal(false);
              }} className={btnPrimary}>Apply</button>
            </div>
          </ModalOverlay>
        )}

        {/* 2. FORM MODAL (ADD / EDIT) */}
        {showFormModal && (
          <ModalOverlay key="modal-form" zIndex="z-50" onClose={() => setShowFormModal(false)} width="max-w-lg">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-[18px] font-bold text-[#27345A]">{formMode === 'add' ? 'Add Schedule' : 'Edit Schedule'}</h3>
              <button onClick={() => setShowFormModal(false)}><X className="text-slate-400 hover:text-slate-600" /></button>
            </div>

            <div className="space-y-3 max-h-[65vh] overflow-y-auto pr-2 custom-scrollbar">
              <InputGroup label="Schedule Name" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="e.g. Shift Morning" />

              {/* <div className="grid grid-cols-2 gap-4">
                  <div>
                      <label className="block text-sm font-bold text-slate-800 mb-2">Clock-In</label>
                      <input type="time" value={formData.clockIn} onChange={e => setFormData({...formData, clockIn: e.target.value})} className="w-full px-4 py-3 rounded-xl border border-slate-300 text-sm focus:outline-none focus:border-[#354C8F] transition-colors" />
                  </div>
                  <div>
                      <label className="block text-sm font-bold text-slate-800 mb-2">Clock-Out</label>
                      <input type="time" value={formData.clockOut} onChange={e => setFormData({...formData, clockOut: e.target.value})} className="w-full px-4 py-3 rounded-xl border border-slate-300 text-sm focus:outline-none focus:border-[#354C8F] transition-colors" />
                  </div>
              </div> */}

              <div>
                <label className="block text-sm font-bold text-slate-800 mb-2">Tolerance (minutes)</label>
                <input
                  type="number"
                  min="0"
                  value={formData.tolerance}
                  onChange={e => setFormData({ ...formData, tolerance: Number(e.target.value) })}
                  className="w-full px-4 py-3 rounded-xl border border-slate-300 text-sm focus:outline-none focus:border-[#354C8F] transition-colors"
                  placeholder="e.g. 5"
                />
                <p className="text-[11px] text-slate-500 mt-1">The tolerance limit after the scheduled work start time before being recorded as late.</p>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-800 mb-2">Status</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => { if (!blockSetActive) setFormData({ ...formData, is_active: true }); }}
                    disabled={statusGuardLoading || blockSetActive}
                    className={`px-4 py-2 rounded-xl text-sm font-semibold border transition-all ${formData.is_active ? 'bg-[#22C55E] text-white border-[#22C55E]' : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'} ${(statusGuardLoading || blockSetActive) ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    Active
                  </button>
                  <button
                    type="button"
                    onClick={() => { if (!blockSetInactive) setFormData({ ...formData, is_active: false }); }}
                    disabled={statusGuardLoading || blockSetInactive}
                    className={`px-4 py-2 rounded-xl text-sm font-semibold border transition-all ${formData.is_active === false ? 'bg-[#EF4444] text-white border-[#EF4444]' : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'} ${(statusGuardLoading || blockSetInactive) ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    Inactive
                  </button>
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  {statusGuardLoading
                    ? 'Checking active schedule status...'
                    : 'If set to Active, other active schedules will be deactivated and this will be applied to all interns.'}
                </p>
              </div>

              {/* Work Days Checkbox Group */}
              <div>
                <label className="block text-sm font-bold text-slate-800 mb-3">Work Days</label>
                <div className="grid grid-cols-4 gap-3">
                  {allDays.map(day => (
                    <label key={day} className="flex items-center gap-2 cursor-pointer group select-none">
                      <div className={`w-5 h-5 rounded-[5px] border flex items-center justify-center transition-all ${formData.days.includes(day) ? 'bg-[#354C8F] border-[#354C8F]' : 'border-slate-300 bg-white group-hover:border-[#354C8F]'}`}>
                        {formData.days.includes(day) && <Check size={14} className="text-white" strokeWidth={3} />}
                      </div>
                      <input type="checkbox" className="hidden" checked={formData.days.includes(day)} onChange={() => handleDayToggle(day)} />
                      <span className="text-sm text-slate-600 font-medium group-hover:text-slate-800">{day}</span>
                    </label>
                  ))}
                </div>

                {/* Per-Day Times Inputs (show for selected days) */}
                <div className="mt-4">
                  <label className="block text-sm font-bold text-slate-800 mb-2">Per-Day Times</label>
                  <p className="text-xs text-slate-500 mb-3">Set start & end time for each selected day.</p>
                  <div className="flex flex-col gap-3">
                    {(formData.days && formData.days.length) ? formData.days.map(day => (
                      <div key={day} className="flex items-center gap-3">
                        <div className="w-12 text-sm text-slate-700 font-medium">{day}</div>
                        <div className="flex items-center gap-2 flex-1">
                          <input type="time" value={(formData.dayTimes && formData.dayTimes[day] && formData.dayTimes[day].start) || ''} onChange={(e) => setFormData(prev => ({ ...prev, dayTimes: { ...prev.dayTimes, [day]: { ...(prev.dayTimes && prev.dayTimes[day]), start: e.target.value } } }))} className="px-3 py-1.5 rounded-xl border border-slate-300 text-sm" />
                          <span className="text-xs text-slate-400">to</span>
                          <input type="time" value={(formData.dayTimes && formData.dayTimes[day] && formData.dayTimes[day].end) || ''} onChange={(e) => setFormData(prev => ({ ...prev, dayTimes: { ...prev.dayTimes, [day]: { ...(prev.dayTimes && prev.dayTimes[day]), end: e.target.value } } }))} className="px-3 py-1.5 rounded-xl border border-slate-300 text-sm" />
                        </div>
                      </div>
                    )) : <p className="text-xs text-slate-400">No days selected</p>}
                  </div>
                </div>

              </div>
            </div>

            <div className="flex gap-3 mt-6 pt-4 border-t border-slate-100 justify-end">
              <button onClick={() => setShowFormModal(false)} className={`${btnSecondary} !py-3 w-36`}>Cancel</button>
              <button onClick={handleFormSubmit} className={`${btnPrimary} !py-3 w-36`}>{formMode === 'add' ? 'Add' : 'Save'}</button>
            </div>
          </ModalOverlay>
        )}

        {/* 4. CONFIRM MODAL (z-60) */}
        {showConfirmModal && (
          <ModalOverlay key="modal-confirm" zIndex="z-[60]" onClose={() => setShowConfirmModal(false)} width="max-w-sm" compact>
            <div className="text-center p-4">
              <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${confirmType === 'delete' ? 'bg-red-50' : 'bg-yellow-50'}`}>
                {confirmType === 'delete' ? (
                  <Trash2 className="text-red-500" size={32} strokeWidth={2} />
                ) : (
                  <AlertCircle className="text-yellow-500" size={32} strokeWidth={2} />
                )}
              </div>
              <h3 className="text-xl font-bold text-[#27345A] mb-2">
                {confirmType === 'add' ? 'Add Schedule?' : confirmType === 'save' ? 'Save Changes?' : 'Delete Schedule?'}
              </h3>
              <p className="text-slate-500 text-sm mb-6">
                {confirmType === 'delete' ? 'This schedule will be permanently deleted.' : 'Are you sure you want to proceed?'}
              </p>
              <div className="flex gap-3">
                <button onClick={() => setShowConfirmModal(false)} disabled={isProcessing} className={`${btnSecondary} w-full justify-center ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}`}>Cancel</button>
                <button onClick={executeAction} disabled={isProcessing}
                  className={`w-full py-3 px-6 rounded-xl font-bold text-sm text-white shadow-md transition-all active:scale-95 flex items-center justify-center ${confirmType === 'delete' ? 'bg-[#EF4444] shadow-red-200 hover:bg-red-600' : 'bg-[#22C55E] shadow-green-200 hover:bg-green-600'} ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}`}>
                  {isProcessing ? 'Processing...' : (confirmType === 'delete' ? 'Delete' : formMode === 'add' ? 'Add' : 'Save')}
                </button>
              </div>
            </div>
          </ModalOverlay>
        )}

        {/* 5. STATUS MODAL (z-60) */}
        {showStatusModal && (
          <ModalOverlay key="modal-status" zIndex="z-[60]" onClose={() => setShowStatusModal(false)} width="max-w-sm" compact>
            <div className="text-center p-4">
              <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${confirmType === 'delete' ? 'bg-red-50' : 'bg-yellow-50'}`}>
                {confirmType === 'delete' ? (
                  <Trash2 className="text-red-500" size={32} strokeWidth={2} />
                ) : (
                  <AlertCircle className="text-yellow-500" size={32} strokeWidth={2} />
                )}
              </div>
              <h3 className="text-xl font-bold text-[#27345A] mb-2">
                {confirmType === 'add' ? 'Add Schedule?' : confirmType === 'save' ? 'Save Changes?' : 'Delete Schedule?'}
              </h3>
              <p className="text-slate-500 text-sm mb-6">
                {confirmType === 'delete' ? 'This schedule will be permanently deleted.' : 'Are you sure you want to proceed?'}
              </p>
              <div className="flex gap-3">
                <button onClick={() => setShowConfirmModal(false)} disabled={isProcessing} className={`${btnSecondary} w-full justify-center ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}`}>Cancel</button>
                <button onClick={executeAction} disabled={isProcessing}
                  className={`w-full py-3 px-6 rounded-xl font-bold text-sm text-white shadow-md transition-all active:scale-95 flex items-center justify-center ${confirmType === 'delete' ? 'bg-[#EF4444] shadow-red-200 hover:bg-red-600' : 'bg-[#22C55E] shadow-green-200 hover:bg-green-600'} ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}`}>
                  {isProcessing ? 'Processing...' : (confirmType === 'delete' ? 'Delete' : formMode === 'add' ? 'Add' : 'Save')}
                </button>
              </div>
            </div>
          </ModalOverlay>
        )}

        {/* 5. STATUS MODAL (z-60) */}
        {showStatusModal && (
          <ModalOverlay zIndex="z-[60]" onClose={() => setShowStatusModal(false)} width="max-w-sm" compact>
            <div className="text-center p-4">
              <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${statusType === 'success' ? 'bg-green-50' : 'bg-red-50'}`}>
                {statusType === 'success' ? (
                  <Check className="text-green-500" size={32} strokeWidth={3} />
                ) : (
                  <X className="text-red-500" size={32} strokeWidth={3} />
                )}
              </div>
              <h3 className="text-xl font-bold text-[#27345A] mb-2">{statusMessage.title}</h3>
              <p className="text-slate-500 text-sm mb-6">{statusMessage.desc}</p>
              <button onClick={() => setShowStatusModal(false)}
                className={`w-full py-3 px-6 rounded-xl font-bold text-sm text-white shadow-md transition-all active:scale-95 ${statusType === 'success' ? 'bg-[#22C55E] shadow-green-200 hover:bg-green-600' : 'bg-[#EF4444] shadow-red-200 hover:bg-red-600'}`}>
                OK
              </button>
            </div>
          </ModalOverlay>
        )}

      </AnimatePresence>
    </div>
  );
};

// --- SUB-COMPONENTS ---

const InputGroup = ({ label, value, onChange, placeholder }) => (
  <div>
    <label className="block text-sm font-bold text-slate-800 mb-2">{label}</label>
    <input
      type="text"
      value={value}
      onChange={onChange}
      className="w-full px-4 py-3 rounded-xl border border-slate-300 text-sm focus:outline-none focus:border-[#354C8F] transition-colors placeholder:text-slate-400"
      placeholder={placeholder}
    />
  </div>
);

const ModalOverlay = ({ children, onClose, width = "max-w-md", zIndex = "z-50", compact = false }) => (
  <div className={`fixed inset-0 ${zIndex} flex items-center justify-center bg-black/40 backdrop-blur-sm p-4`}>
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className={`bg-white w-[95%] md:w-full ${width} rounded-2xl shadow-2xl ${compact ? 'p-4' : 'p-4'} relative`}
    >
      {children}
    </motion.div>
  </div>
);

export default WorkingSchedule;