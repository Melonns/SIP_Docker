import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import {
    Search,
    Filter,
    Eye,
    Edit,
    X,
    Check,
    ChevronLeft,
    ChevronRight,
    Calendar,
    Save,
    Send,
    ArrowUpRight,
    Clock,
    ChevronDown
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import apiClient from '../../api/axiosConfig';
import { useNavigate, useLocation } from 'react-router-dom';
import { getSafeErrorMessage, logError } from '../../utils/errorHandler';

// --- STYLE CONSTANTS ---
const colors = {
    primary: "#354C8F",
    textDark: "#203266",
    bgLight: "#F8F9FD"
};

// Button Styles
const btnBase = "py-3 px-6 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed";
const btnPrimary = `${btnBase} bg-[#354C8F] hover:bg-[#2a3c70] text-white shadow-md shadow-indigo-200`;
const btnSecondary = `${btnBase} bg-white border border-slate-300 text-slate-700 hover:bg-slate-50`;
const btnSuccess = `${btnBase} bg-[#22C55E] hover:bg-[#16A34A] text-white shadow-md shadow-green-200`;
const btnDraft = `${btnBase} bg-white border-2 border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300`;
const btnError = `${btnBase}  text-white text-[9px] font-bold px-1 rounded-sm bg-red-500   hover:bg-red-400`;

// --- MODAL PORTAL (EDGE-TO-EDGE + BLUR) ---
const ModalOverlay = ({ children, onClose, width = "max-w-2xl", zIndex = "z-[9999]", compact = false }) => {
    const [mounted, setMounted] = useState(false);
    useEffect(() => setMounted(true), []);
    if (!mounted) return null;

    return ReactDOM.createPortal(
        <div className={`fixed inset-0 ${zIndex} flex items-center justify-center p-4`}>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={onClose}
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}

                className={`relative bg-white w-[95%] ${width} rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[95vh] ${compact ? 'p-4' : ''}`}
            >
                {children}
            </motion.div>
        </div>,
        document.body
    );
};

const EvaluationMentor = () => {
    // --- API-driven interns ---
    const [interns, setInterns] = useState([]);
    const [loadingInterns, setLoadingInterns] = useState(true);
    const [errorInterns, setErrorInterns] = useState(null);
    const [searchQuery, setSearchQuery] = useState("");

    const [endingInterns, setEndingInterns] = useState([]);
    const [loadingEnding, setLoadingEnding] = useState(true);
    const [errorEnding, setErrorEnding] = useState(null);

    // Divisions list for filters (fetched from backend)
    const [divisions, setDivisions] = useState([]);
    const [loadingDivisions, setLoadingDivisions] = useState(false);

    // Evaluation components (criteria) fetched from backend
    const [evaluationComponents, setEvaluationComponents] = useState([]);
    const [loadingComponents, setLoadingComponents] = useState(false);

    // Snapshot of components from loaded evaluation (preserves original nama_komponen)
    const [evaluationComponentsSnapshot, setEvaluationComponentsSnapshot] = useState([]);

    const navigate = useNavigate();
    const location = useLocation();

    // --- STATES ---
    const [showFilterModal, setShowFilterModal] = useState(false);
    const [showFormModal, setShowFormModal] = useState(false);
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [showStatusModal, setShowStatusModal] = useState(false);

    const [selectedIntern, setSelectedIntern] = useState(null);
    const [formData, setFormData] = useState({
        scores: {},
        feedback: ""
    });
    const [formLoading, setFormLoading] = useState(false);
    // validation state for submit
    const [validationErrors, setValidationErrors] = useState({ scoresMissing: false, feedbackMissing: false });
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState(false);

    // unsaved changes tracking + discard modal
    const initialFormRef = React.useRef(null);
    const [showDiscardModal, setShowDiscardModal] = useState(false);

    // Cache for evaluation details (to avoid refetching the same evaluation)
    const evaluationCacheRef = React.useRef({});

    const [confirmAction, setConfirmAction] = useState(null); // 'draft' | 'submit'
    const [confirmChecked, setConfirmChecked] = useState(false); // <-- added
    const [statusMessage, setStatusMessage] = useState({ title: "", desc: "" });
    const [statusType, setStatusType] = useState('success'); // 'success' | 'error'
    const initialFilter = { status: [], division: '', startDate: '', endDate: '' };
    const [filter, setFilter] = useState(initialFilter);
    const [appliedFilter, setAppliedFilter] = useState({ ...initialFilter, periodStart: '', periodEnd: '' });
    const isFilterActive = (appliedFilter.status && appliedFilter.status.length > 0) || appliedFilter.periodStart || appliedFilter.periodEnd; // red dot indicator when true
    const [openDropdown, setOpenDropdown] = useState(null);

    // Helpers to parse end date from period string and to format month-year
    const monthMap = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
    const parseEndDate = (periodStr) => {
        if (!periodStr) return null;
        const parts = periodStr.split('-');
        const last = parts[parts.length - 1].trim(); // e.g. '31 Mar 2026' or 'Mar 2026'
        let m = last.match(/(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/);
        if (m) {
            const day = parseInt(m[1], 10);
            const mon = m[2].slice(0, 3).toLowerCase();
            const year = parseInt(m[3], 10);
            const monIdx = monthMap[mon];
            if (monIdx >= 0) return new Date(year, monIdx, day);
        }
        m = last.match(/([A-Za-z]+)\s+(\d{4})/);
        if (m) {
            const mon = m[1].slice(0, 3).toLowerCase();
            const year = parseInt(m[2], 10);
            const monIdx = monthMap[mon];
            if (monIdx >= 0) return new Date(year, monIdx + 1, 0); // last day of month
        }
        return null;
    };

    const formatMonthYear = (ym) => {
        if (!ym) return "--";
        const [y, m] = ym.split('-');
        const monNames = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
        return `${monNames[parseInt(m, 10) - 1] ?? ''} ${y}`;
    };

    const formatShortDate = (iso) => {
        if (!iso) return '';
        const d = new Date(iso);
        if (isNaN(d)) return String(iso);
        return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    };

    // Month pickers removed from header; period filters now live inside the Filter modal as Start/End date fields.



    // Pagination Logic + Filtering
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);

    const filteredInterns = interns.filter(i => {
        // status filter (applied when user hits Apply)
        if (appliedFilter.status && appliedFilter.status.length > 0 && !appliedFilter.status.includes(i.status)) return false;

        // period filter (applied via modal Apply)
        const endDate = parseEndDate(i.period);
        if (appliedFilter.periodStart) {
            const startDate = new Date(appliedFilter.periodStart);
            if (!endDate || endDate < startDate) return false;
        }
        if (appliedFilter.periodEnd) {
            const endOfDay = new Date(appliedFilter.periodEnd);
            endOfDay.setHours(23, 59, 59, 999);
            if (!endDate || endDate > endOfDay) return false;
        }
        return true;
    });

    const totalEntries = filteredInterns.length;
    const totalPages = Math.max(1, Math.ceil(totalEntries / itemsPerPage));
    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentItems = filteredInterns.slice(indexOfFirstItem, indexOfLastItem);
    const paginationMeta = { from: totalEntries === 0 ? 0 : indexOfFirstItem + 1, to: Math.min(indexOfLastItem, totalEntries), total: totalEntries };

    // --- CALCULATIONS ---
    const calculateScore = (scores) => {
        const values = Object.values(scores).map(Number).filter(v => !isNaN(v));
        if (values.length === 0) return 0;
        const sum = values.reduce((a, b) => a + b, 0);
        const avg = sum / values.length;
        const result = avg % 1 === 0 ? avg : avg.toFixed(1);
        return isNaN(result) ? 0 : result;
    };

    const getPredicate = (score) => {
        const safeScore = isNaN(score) ? 0 : Number(score);
        if (safeScore >= 86) return "A";
        if (safeScore >= 71) return "B";
        return "C";
    };

    const currentScore = calculateScore(formData.scores);
    const currentPredicate = getPredicate(currentScore);

    // --- HANDLERS ---
    const handlePageChange = (page) => { if (page >= 1 && page <= totalPages) setCurrentPage(page); };

    const handleOpenForm = async (intern) => {
        setSelectedIntern({ id: intern.id, name: intern.name, division: intern.division, evaluationId: intern.evaluationId, period: intern.period || intern.periode || '', jobPosition: intern.jobPosition || intern.position || intern.jabatan || '', jurusan: intern.jurusan || intern.major || '', universitas: intern.universitas || intern.university || '' });
        setFormLoading(true);
        try {
            // ensure snapshot isn't left over from previous open
            initialFormRef.current = initialFormRef.current || JSON.stringify({ scores: formData.scores, feedback: formData.feedback });
            // fetch evaluation detail if exists
            let evalData = null;
            if (intern.evaluationId) {
                // Check if already cached
                if (evaluationCacheRef.current[intern.evaluationId]) {
                    evalData = evaluationCacheRef.current[intern.evaluationId];
                } else {
                    const res = await apiClient.get(`/mentor/evaluations/${intern.evaluationId}`);
                    if (res.data && res.data.success) {
                        evalData = res.data.data;
                        // Cache the result
                        evaluationCacheRef.current[intern.evaluationId] = evalData;
                    }
                }
            } else {
                // try find by id_mahasiswa (fallbacks preserved)
                const cacheKey = `mahasiswa_${intern.id}`;
                if (evaluationCacheRef.current[cacheKey]) {
                    evalData = evaluationCacheRef.current[cacheKey];
                } else {
                    const res = await apiClient.get('/mentor/evaluations', { params: { id_mahasiswa: intern.id } });
                    if (res.data && res.data.success && Array.isArray(res.data.data) && res.data.data.length > 0) {
                        evalData = res.data.data[0];
                        // Cache the result
                        evaluationCacheRef.current[cacheKey] = evalData;
                    }
                }
            }

            if (evalData) {
                const normalizedStatus = evalData.status === 'final' || evalData.status === 'done'
                    ? 'Done'
                    : evalData.status === 'need_review'
                        ? 'Need Review'
                        : evalData.status === 'draft'
                            ? 'Draft'
                            : 'Not Yet';

                // Parse scores from pivot table structure (components array)
                const scores = {};
                let componentsSnapshot = []; // Store original components with nama_komponen

                if (evalData.components && Array.isArray(evalData.components)) {
                    evalData.components.forEach((comp, idx) => {
                        const key = `q${idx + 1}`;
                        scores[key] = (comp.score != null && String(comp.score).trim() !== '') ? String(Number(comp.score)) : '';
                        // Store snapshot with original nama_komponen (won't change even if master data changes)
                        componentsSnapshot.push({
                            idx: idx + 1,
                            key: key,
                            nama_komponen: comp.nama_komponen,
                            score: scores[key]
                        });
                    });
                    setEvaluationComponentsSnapshot(componentsSnapshot);
                } else if (evalData.integrity_score != null) {
                    // Fallback for old structure (backward compatibility)
                    scores.q1 = (evalData.integrity_score != null && String(evalData.integrity_score).trim() !== '') ? String(Number(evalData.integrity_score)) : '';
                    scores.q2 = (evalData.punctuality_score != null && String(evalData.punctuality_score).trim() !== '') ? String(Number(evalData.punctuality_score)) : '';
                    scores.q3 = (evalData.expertise_score != null && String(evalData.expertise_score).trim() !== '') ? String(Number(evalData.expertise_score)) : '';
                    scores.q4 = (evalData.teamwork_score != null && String(evalData.teamwork_score).trim() !== '') ? String(Number(evalData.teamwork_score)) : '';
                    scores.q5 = (evalData.communication_score != null && String(evalData.communication_score).trim() !== '') ? String(Number(evalData.communication_score)) : '';
                    scores.q6 = (evalData.it_proficiency_score != null && String(evalData.it_proficiency_score).trim() !== '') ? String(Number(evalData.it_proficiency_score)) : '';
                    scores.q7 = (evalData.self_development_score != null && String(evalData.self_development_score).trim() !== '') ? String(Number(evalData.self_development_score)) : '';
                    setEvaluationComponentsSnapshot([]);
                }

                const initialSnapshot = {
                    scores: scores,
                    feedback: evalData.mentor_notes || ''
                };
                setFormData(initialSnapshot);
                initialFormRef.current = JSON.stringify(initialSnapshot);
                setSelectedIntern(prev => ({ ...prev, evaluationId: evalData.id || prev.evaluationId, status: normalizedStatus }));
            } else {
                const emptySnapshot = { scores: {}, feedback: '' };
                setFormData(emptySnapshot);
                initialFormRef.current = JSON.stringify(emptySnapshot);
                setEvaluationComponentsSnapshot([]);
                setSelectedIntern(prev => ({ ...prev, evaluationId: null, status: 'Not Yet' }));
            }

            setShowFormModal(true);
        } catch (err) {
            console.error('Failed to load evaluation detail', err);
            setStatusMessage({ title: 'Error', desc: 'Failed to load evaluation detail.' });
            setShowStatusModal(true);
        } finally {
            setFormLoading(false);
        }
    };

    const handleScoreChange = (key, value) => {
        const raw = String(value || '');
        // keep only digits, remove leading zeros by normalizing to Number
        const digits = raw.replace(/[^0-9]/g, '');
        if (digits === '') {
            setFormData(prev => ({ ...prev, scores: { ...prev.scores, [key]: '' } }));
            setValidationErrors(prev => ({ ...prev, scoresMissing: false }));
            return;
        }
        let num = parseInt(digits, 10);
        if (Number.isNaN(num)) {
            setFormData(prev => ({ ...prev, scores: { ...prev.scores, [key]: '' } }));
            setValidationErrors(prev => ({ ...prev, scoresMissing: false }));
            return;
        }
        if (num > 100) num = 100;
        if (num < 0) num = 0;
        setFormData(prev => ({ ...prev, scores: { ...prev.scores, [key]: String(num) } }));
        // clear score validation flag when user edits
        setValidationErrors(prev => ({ ...prev, scoresMissing: false }));
    };

    const validateFormForSubmit = () => {
        const scores = formData.scores || {};
        const missingScore = Object.values(scores).some(v => v === null || v === undefined || v === '');
        const missingFeedback = !formData.feedback || !String(formData.feedback).trim();
        setValidationErrors({ scoresMissing: missingScore, feedbackMissing: missingFeedback });
        return !missingScore && !missingFeedback;
    };

    const hasUnsavedChanges = () => {
        try {
            const initial = initialFormRef.current || '';
            const current = JSON.stringify({ scores: formData.scores, feedback: formData.feedback });
            return initial !== current;
        } catch (e) { return false; }
    };

    const handleAttemptCloseForm = () => {
        if (hasUnsavedChanges()) {
            setShowDiscardModal(true);
            return;
        }
        setShowFormModal(false);
    };

    const handleActionInit = (action) => {
        if (action === 'submit') {
            const ok = validateFormForSubmit();
            if (!ok) {
                setStatusType('error');
                setStatusMessage({ title: 'Validation', desc: 'Please complete all scores (Section A) and provide feedback (Section C) before submitting.' });
                setShowStatusModal(true);
                return;
            }
        }
        setConfirmAction(action);
        setConfirmChecked(false); // reset checkbox whenever confirm modal opens
        setShowConfirmModal(true);
    };

    const handleReset = () => {
        const empty = { scores: { q1: '', q2: '', q3: '', q4: '', q5: '', q6: '', q7: '' }, feedback: '' };
        setFormData(empty);
        // update initial snapshot as if fresh
        initialFormRef.current = JSON.stringify(empty);
        setStatusMessage({ title: 'Reset', desc: 'Form inputs have been reset.' });
        setShowStatusModal(true);
    };

    // --- UI HELPER COMPONENTS ---
    const StatusBadge = ({ status }) => {
        const base = "inline-flex items-center justify-center min-w-[140px] h-[34px] px-3 rounded-lg text-[13px] font-bold border whitespace-nowrap";
        if (status === 'Done') return <span className={`${base} bg-green-50 text-green-700 border-green-200`}>Done</span>;
        if (status === 'Need Review') return <span className={`${base} bg-orange-50 text-orange-600 border-orange-200`}>Need Review</span>;
        if (status === 'Draft') return <span className={`${base} bg-slate-100 text-slate-600 border-slate-300`}>Draft</span>;
        return <span className={`${base} bg-red-50 text-red-500 border-red-200`}>Not Yet</span>;
    };

    const handleDropdownSelect = (key, value) => {
        setFilter(prev => ({ ...prev, [key]: prev[key] === value ? "" : value }));
        setOpenDropdown(null);
    };

    const handleStatusToggle = (status) => {
        setFilter(prev => {
            const current = prev.status || [];
            const updated = current.includes(status) ? current.filter(s => s !== status) : [...current, status];
            return { ...prev, status: updated };
        });
    };

    const handleFilterToggle = (key, value) => {
        setFilter(prev => ({ ...prev, [key]: value }));
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
                    <div className="absolute inset-x-0 mt-2 bg-white rounded-xl border border-slate-100 shadow-xl z-20 overflow-hidden max-h-56 overflow-y-auto">
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

    const resetFilter = () => {
        setFilter(initialFilter);
        setAppliedFilter({ status: [], division: '', periodStart: '', periodEnd: '' });
        setShowFilterModal(false);
    };

    // Reset to first page when filters change
    useEffect(() => {
        setCurrentPage(1);
    }, [appliedFilter.status, appliedFilter.periodStart, appliedFilter.periodEnd, appliedFilter.division]);

    const applyFilter = () => {
        setAppliedFilter({ status: filter.status || [], division: filter.division || '', periodStart: filter.startDate || '', periodEnd: filter.endDate || '' });
        setShowFilterModal(false);
    };

    // Fetch interns from API when search or applied filters change
    const fetchInterns = async () => {
        try {
            setLoadingInterns(true);
            setErrorInterns(null);
            const params = {};
            if (searchQuery) params.search = searchQuery;
            if (appliedFilter.division) params.division = appliedFilter.division;
            if (appliedFilter.status && appliedFilter.status.length > 0) {
                const mapStatus = (s) => s === 'Done' ? 'done' : s === 'Draft' ? 'draft' : 'not_yet';
                params.status = appliedFilter.status.map(mapStatus).join(',');
            }
            const res = await apiClient.get('/mentor/evaluations/interns', { params });
            if (res.data && res.data.success && Array.isArray(res.data.data)) {
                // Only include active interns
                const checkActive = (val) => {
                    if (val === undefined || val === null) return false;
                    if (typeof val === 'boolean') return val;
                    if (typeof val === 'number') return val === 1;
                    return String(val).toLowerCase() === '1' || String(val).toLowerCase() === 'true';
                };

                const list = res.data.data.filter(i => {
                    const raw = i.is_active ?? i['is active'] ?? i.active ?? i.isActive ?? i.active_flag ?? i.status_active;
                    return checkActive(raw);
                });

                const mapped = list.map(i => ({
                    id: i.id_mahasiswa ?? i.user_id ?? i.id,
                    name: i.nama_lengkap || i.nama,
                    photo: i.foto,
                    jobPosition: i.job_position || i.position || i.jabatan || i.job || i.role || '',
                    division: i.division || i.unit || '',
                    period: i.periode || (i.internship_info && i.internship_info.internship_periode) || ((i.mulai_magang && i.akhir_magang) ? `${formatShortDate(i.mulai_magang)} - ${formatShortDate(i.akhir_magang)}` : ''),
                    jurusan: i.jurusan || i.major || i.field_of_study || '',
                    universitas: i.universitas || i.university || i.perguruan_tinggi || i.univ || '',
                    status: i.evaluation_status === 'done' || i.evaluation_status === 'final' ? 'Done' : i.evaluation_status === 'draft' ? 'Draft' : i.evaluation_status === 'need_review' ? 'Need Review' : 'Not Yet',
                    evaluationId: i.evaluation_id
                }));
                setInterns(mapped);
            } else {
                setInterns([]);
            }
        } catch (err) {
            console.error('Failed to fetch interns', err);
            setErrorInterns('Failed to load interns');
        } finally {
            setLoadingInterns(false);
        }
    };

    const fetchDivisions = async () => {
        setLoadingDivisions(true);
        try {
            // endpoint: /available-divisions (proxied via /mentor)
            const res = await apiClient.get('/available-divisions');
            const data = res?.data?.data ?? res?.data ?? [];
            const opts = Array.isArray(data) ? data.map(d => {
                const val = typeof d === 'object' && d !== null ? (d.name || d.id_division || '') : d;
                return { value: val, label: val };
            }) : [];
            setDivisions([{ value: '', label: 'All Divisions' }, ...opts]);
        } catch (err) {
            console.warn('Could not fetch /available-divisions:', err);
            setDivisions([{ value: '', label: 'All Divisions' }]);
        } finally {
            setLoadingDivisions(false);
        }
    };

    const fetchEvaluationComponents = async () => {
        setLoadingComponents(true);
        try {
            const res = await apiClient.get('/mentor/evaluations/komponen-penilaian');
            if (res.data && res.data.success && Array.isArray(res.data.data)) {
                setEvaluationComponents(res.data.data);
                // Initialize formData scores based on fetched components
                const initialScores = {};
                res.data.data.forEach((comp, idx) => {
                    initialScores[`q${idx + 1}`] = '';
                });
                setFormData(prev => ({ ...prev, scores: initialScores }));
            }
        } catch (err) {
            console.warn('Could not fetch evaluation components:', err);
            // Fallback to empty array
            setEvaluationComponents([]);
        } finally {
            setLoadingComponents(false);
        }
    };

    useEffect(() => {
        let mounted = true;
        fetchInterns();
        fetchDivisions();
        fetchEvaluationComponents();
        // restore scroll position if returning from detail
        try {
            const raw = sessionStorage.getItem('evaluationLastView');
            if (raw) {
                const parsed = JSON.parse(raw);
                if (parsed && parsed.path === location.pathname) {
                    window.requestAnimationFrame(() => {
                        window.scrollTo(0, parsed.scrollY || 0);
                    });
                    sessionStorage.removeItem('evaluationLastView');
                }
            }
        } catch (e) { /* ignore */ }
        return () => { mounted = false; };
    }, [searchQuery, appliedFilter, location.pathname]);

    // Save or submit evaluation to backend
    const handleSaveEvaluation = async (action) => {
        setSaving(true);
        try {
            // Validate component count (at least 7 required)
            if (evaluationComponents.length < 7) {
                setStatusType('error');
                setStatusMessage({ title: 'Validation Error', desc: `Minimum ${evaluationComponents.length} evaluation components required. System requires at least 7.` });
                setShowStatusModal(true);
                setSaving(false);
                return;
            }

            // Validate score ranges
            let hasInvalidScore = false;
            for (const [key, value] of Object.entries(formData.scores || {})) {
                const num = Number(value);
                if (!isNaN(num) && (num < 0 || num > 100)) {
                    hasInvalidScore = true;
                    break;
                }
            }
            if (hasInvalidScore) {
                setStatusType('error');
                setStatusMessage({ title: 'Validation Error', desc: 'All scores must be between 0 and 100.' });
                setShowStatusModal(true);
                setSaving(false);
                return;
            }

            // Build components array from formData.scores and evaluationComponents
            // IMPORTANT: Include nama_komponen snapshot so it's preserved even if master data changes
            const components = evaluationComponents.map((comp, idx) => {
                const key = `q${idx + 1}`;
                return {
                    komponen_id: comp.id,
                    nama_komponen: comp.nama_komponen,  // Snapshot the name at evaluation time
                    score: Number(formData.scores[key]) || 0
                };
            });

            const payload = {
                id_mahasiswa: selectedIntern.id,
                mentor_notes: formData.feedback || '',
                components: components
            };

            if (selectedIntern.evaluationId) {
                // update existing evaluation
                const res = await apiClient.put(`/mentor/evaluations/${selectedIntern.evaluationId}`, payload);
                if (res.data && res.data.success) {
                    // If submit action, call the separate submit endpoint
                    if (action === 'submit') {
                        const submitRes = await apiClient.put(`/mentor/evaluations/${selectedIntern.evaluationId}`, { status: 'final' });
                        if (submitRes.data && submitRes.data.success) {
                            setStatusType('success');
                            setStatusMessage({ title: 'Submitted', desc: 'Evaluation submitted successfully.' });
                        } else {
                            throw new Error('Failed to submit evaluation');
                        }
                    } else {
                        setStatusType('success');
                        setStatusMessage({ title: 'Saved', desc: 'Evaluation saved as draft.' });
                    }
                    // Clear cache for this evaluation so it's refetched if needed
                    delete evaluationCacheRef.current[selectedIntern.evaluationId];
                } else {
                    throw new Error(res.data?.message || 'Failed to update evaluation');
                }
            } else {
                // create new evaluation
                const res = await apiClient.post('/mentor/evaluations', payload);
                if (res.data && res.data.success) {
                    // If submit action, call the separate submit endpoint
                    if (action === 'submit') {
                        const evaluationId = res.data.data?.id;
                        if (!evaluationId) {
                            throw new Error('No evaluation ID returned from create');
                        }
                        const submitRes = await apiClient.put(`/mentor/evaluations/${evaluationId}`, { status: 'final' });
                        if (submitRes.data && submitRes.data.success) {
                            setStatusType('success');
                            setStatusMessage({ title: 'Submitted', desc: 'Evaluation created and submitted successfully.' });
                        } else {
                            throw new Error('Failed to submit evaluation');
                        }
                    } else {
                        setStatusType('success');
                        setStatusMessage({ title: 'Saved', desc: 'Evaluation saved as draft.' });
                    }
                    // Clear cache for this user so it's refetched if needed
                    delete evaluationCacheRef.current[`mahasiswa_${selectedIntern.id}`];
                } else {
                    throw new Error(res.data?.message || 'Failed to save evaluation');
                }
            }

            setShowStatusModal(true);
            setShowFormModal(false);
            // refresh list
            await fetchInterns();
            // refresh ending soon too with proper mapping
            await fetchEndingInterns();
        } catch (err) {
            logError('handleSaveEvaluation', err);
            let errorMsg = 'Failed to save evaluation. Please try again.';
            if (err.response?.status === 422) {
                const validationErrors = err.response.data?.errors;
                if (validationErrors && typeof validationErrors === 'object') {
                    errorMsg = Object.values(validationErrors).join(', ');
                } else {
                    errorMsg = getSafeErrorMessage(err, errorMsg);
                }
            } else if (err.response?.status === 403) {
                errorMsg = 'You do not have permission to perform this action.';
            } else if (err.response?.status === 404) {
                errorMsg = 'Evaluation or intern not found.';
            } else {
                errorMsg = getSafeErrorMessage(err, errorMsg);
            }
            setStatusType('error');
            setStatusMessage({ title: 'Error', desc: errorMsg });
            setShowStatusModal(true);
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteEvaluation = async (evaluationId) => {
        if (!evaluationId) return;
        setDeleting(true);
        try {
            const res = await apiClient.delete(`mentor/evaluations/${evaluationId}`);
            if (res.data && res.data.success) {
                setStatusType('success');
                setStatusMessage({ title: 'Deleted', desc: 'Evaluation has been deleted successfully.' });
                setShowStatusModal(true);
                setShowFormModal(false);
                await fetchInterns();
            } else {
                throw new Error(res.data?.message || 'Failed to delete');
            }
        } catch (err) {
            logError('handleDeleteEvaluation', err);
            let errorMsg = 'Failed to delete evaluation. Please try again.';
            if (err.response?.status === 403) {
                errorMsg = 'You do not have permission to delete this evaluation.';
            } else if (err.response?.status === 404) {
                errorMsg = 'Evaluation not found.';
            } else if (err.response?.status === 422) {
                errorMsg = getSafeErrorMessage(err, 'Cannot delete this evaluation (it may be already reviewed).');
            } else {
                errorMsg = getSafeErrorMessage(err, errorMsg);
            }
            setStatusType('error');
            setStatusMessage({ title: 'Error', desc: errorMsg });
            setShowStatusModal(true);
        } finally {
            setDeleting(false);
        }
    };

    // the executeAction now handles save/submit via API
    const executeAction = async () => {
        // double-check checkbox + validation before final submit
        if (confirmAction === 'submit' && !confirmChecked) {
            setStatusType('error');
            setStatusMessage({ title: 'Validation', desc: 'Please confirm by checking the box before submitting.' });
            setShowStatusModal(true);
            return;
        }
        setShowConfirmModal(false);
        // double-check validation before final submit
        if (confirmAction === 'submit' && !validateFormForSubmit()) {
            setStatusType('error');
            setStatusMessage({ title: 'Validation', desc: 'Please complete all required fields before submitting.' });
            setShowStatusModal(true);
            return;
        }
        setTimeout(async () => {
            await handleSaveEvaluation(confirmAction);
            // update initial snapshot after successful save
            initialFormRef.current = JSON.stringify({ scores: formData.scores, feedback: formData.feedback });
            setConfirmChecked(false); // reset after action
        }, 200);
    };


    // Helper function to fetch and normalize ending soon data
    const fetchEndingInterns = async () => {
        try {
            setLoadingEnding(true);
            setErrorEnding(null);
            const res = await apiClient.get('/mentor/evaluations/ending-soon', { params: { days: 30 } });
            if (res.data && res.data.success && Array.isArray(res.data.data)) {
                const today = new Date();
                const mapped = res.data.data
                    .map(item => {
                        const name = item.nama_lengkap || item.name || item.nama || item.user?.nama_lengkap || item.user?.name || '-';
                        const university = item.university || item.universitas || item.univ || item.instansi || item.user?.university || item.user?.universitas || '';
                        const rawEnd = item.akhir_magang || item.end_date || item.endDate || item.tanggal_berakhir || item.periode || null;
                        if (!rawEnd) return null;
                        const d = new Date(rawEnd);
                        if (Number.isNaN(d.getTime())) return null;
                        // use raw end date difference (do not add an extra day)
                        const daysLeft = Math.ceil((d - today) / (1000 * 60 * 60 * 24));
                        return {
                            id: item.id_mahasiswa ?? item.user_id ?? item.id ?? name,
                            name,
                            university,
                            endDate: d.toISOString(),
                            daysLeft,
                            division: item.division || item.unit || ''
                        };
                    })
                    .filter(Boolean)
                    .sort((a, b) => a.daysLeft - b.daysLeft);

                setEndingInterns(mapped.slice(0, 5)); // keep top 5 like dashboard
            } else {
                setEndingInterns([]);
            }
        } catch (err) {
            console.error('Failed to fetch ending soon', err);
            setErrorEnding('Failed to load ending soon list');
        } finally {
            setLoadingEnding(false);
        }
    };

    // fetch ending soon list on mount + set page title
    useEffect(() => {
        document.title = "Evaluation - InternHub";
        fetchEndingInterns();
    }, []);

    // beforeunload / navigation guard while modal open
    useEffect(() => {
        if (!showFormModal) return;

        // push a dummy history state so the browser back button triggers popstate while modal is open
        try { window.history.pushState(null, document.title); } catch (e) { }

        const onBeforeUnload = (e) => {
            if (hasUnsavedChanges()) {
                e.preventDefault();
                e.returnValue = '';
                return '';
            }
        };
        const onPop = () => {
            if (hasUnsavedChanges()) {
                // Show discard modal instead of navigating away
                setShowDiscardModal(true);
                // push state again to keep user on the same page
                try { window.history.pushState(null, document.title); } catch (e) { }
            }
        };
        const onKeyDown = (e) => {
            if (e.key === 'Escape') {
                handleAttemptCloseForm();
            }
        };

        window.addEventListener('beforeunload', onBeforeUnload);
        window.addEventListener('popstate', onPop);
        window.addEventListener('keydown', onKeyDown);
        return () => {
            window.removeEventListener('beforeunload', onBeforeUnload);
            window.removeEventListener('popstate', onPop);
            window.removeEventListener('keydown', onKeyDown);
        };
    }, [showFormModal, formData]);

    // reset to first page when search changes
    useEffect(() => { setCurrentPage(1); }, [searchQuery]);

    return (
        <div className="bg-slate-50 ml-2 -mr-2 -mt-1 pb-6 min-h-screen  font-sans text-slate-800">

            {/* hide number input spinners + prevent wheel/arrow increments */}
            <style>{`
                input[type=number]::-webkit-outer-spin-button,
                input[type=number]::-webkit-inner-spin-button {
                    -webkit-appearance: none;
                    margin: 0;
                }
                input[type=number] {
                    -moz-appearance: textfield;
                    appearance: textfield;
                }
            `}</style>

            {/* HEADER */}
            <div className="mb-8 mt-4 md:mt-0">
                <h1 className={`text-2xl md:text-3xl font-bold text-[${colors.textDark}] mb-1 md:mb-2`}>Internship Evaluation</h1>
                <p className="text-slate-500 text-xs md:text-sm -mt-1">Assess intern performance before the internship period ends.</p>
            </div>

            {/* --- ENDING SOON (Horizontal Cards) --- */}
            <div className="bg-white p-6 rounded-[24px] shadow-sm border border-slate-100 mb-8">
                <div className="flex items-center justify-between mb-5">
                    <div>
                        <h3 className="text-[14px] font-bold text-[#203266]">Ending Soon</h3>
                        <p className="text-xs text-slate-400">Internships ending this month</p>
                    </div>
                    <button
                        onClick={() => navigate('/mentor/ending-soon')}
                        className="text-xs font-bold text-slate-400 hover:text-[#354C8F] flex items-center gap-1"
                    >
                        View All <ChevronRight size={16} />
                    </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {loadingEnding ? (
                        <div className="col-span-1 md:col-span-2 lg:col-span-3 p-3 text-center text-slate-500 text-sm">Loading ending soon...</div>
                    ) : errorEnding ? (
                        <div className="col-span-1 md:col-span-2 lg:col-span-3 p-3 text-center text-red-500">{errorEnding}</div>
                    ) : (
                        endingInterns.slice(0, 5).map((intern) => (
                            <div key={intern.id} onClick={() => { try { sessionStorage.setItem('evaluationLastView', JSON.stringify({ path: location.pathname, scrollY: window.scrollY || 0, id: intern.id })); } catch (e) { }; navigate(`/mentor/interns/${intern.id}`, { state: { intern } }); }} className="group p-3 rounded-2xl border border-slate-100 bg-[#FCFDFE] hover:bg-white hover:border-slate-200 hover:shadow-sm transform will-change-transform transition-all duration-200 cursor-pointer relative">
                                <div className="flex justify-between items-start mb-2">
                                    <div className="pr-3">
                                        <h4 className="font-bold text-[#203266] text-sm line-clamp-1">{intern.name}</h4>
                                        <p className="text-[10px] text-slate-400 mt-0.5 line-clamp-1">{intern.division || '-'}</p>
                                    </div>
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border shrink-0 ${intern.daysLeft <= 7 ? 'bg-red-50 text-red-500 border-red-100' : 'bg-orange-50 text-orange-500 border-orange-100'}`}>
                                        {intern.daysLeft} Days
                                    </span>
                                </div>
                                <div className="flex items-end justify-between mt-3 pt-2 border-t border-slate-200">
                                    <div className="flex items-center gap-1 text-[11px] text-slate-500 font-medium">
                                        <Calendar size={12} className="text-slate-300" />
                                        <span>{new Date(intern.endDate).toLocaleDateString('en-GB')}</span>
                                    </div>
                                    <div className="w-6 h-6 rounded-full bg-slate-50 flex items-center justify-center text-slate-300 transition-colors group-hover:bg-[#EAF2FF] group-hover:text-[#203266]">
                                        <ArrowUpRight size={12} />
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* --- MAIN TABLE --- */}
            <div className="bg-white p-6 rounded-[24px] -mt-2 shadow-sm border border-slate-100">
                <div className="mb-6">
                    <h3 className="text-[14px] font-bold text-[#203266]">Evaluation List</h3>
                    <p className="text-xs text-slate-400 mt-1">Manage and submit evaluations for your interns.</p>
                </div>

                <div className="flex flex-col xl:flex-row justify-between items-stretch xl:items-center gap-4 mb-6">

                    {/* ACTION BAR */}
                    <div className="flex flex-col md:flex-row justify-between items-stretch md:items-center gap-3 md:gap-4 mb-0">
                        <div className="flex gap-3 w-full md:w-auto">
                            <div className="relative flex-1 md:w-80">
                                <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} type="text" placeholder="Search by Intern" className="w-full pl-9 md:pl-10 pr-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#354C8F]/20 text-sm shadow-sm transition-all" />
                                <Search className="absolute left-3 top-3.5 text-slate-400" size={18} />
                            </div>
                            <button
                                onClick={() => {
                                    setFilter({ status: appliedFilter.status ? [...appliedFilter.status] : [], division: appliedFilter.division || '', startDate: appliedFilter.periodStart || '', endDate: appliedFilter.periodEnd || '' });
                                    setShowFilterModal(true);
                                }}
                                className={`${btnPrimary} md:!px-6 w-auto`} aria-label="Open filter">
                                <Filter size={16} />
                                <span className="hidden md:inline">Filter</span>
                                {isFilterActive && <div className="ml-2 w-2 h-2 bg-red-400 rounded-full animate-pulse"></div>}
                            </button>
                        </div>
                    </div>


                    {/* Date filters moved to modal — no calendar in header */}
                    <div className="w-full xl:w-auto" />
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left min-w-[900px]">
                        <thead>
                            <tr className="text-xs font-bold text-slate-900 bg-white border-b border-slate-100">
                                <th className="px-3 py-2 w-16 text-center">No</th>
                                <th className="px-3 py-2">Name</th>
                                <th className="px-3 py-2">Internship Period</th> {/* KOLOM BARU */}

                                <th className="px-3 py-2">Job Position</th>
                                <th className="px-3 py-2">Division</th>
                                <th className="px-3 py-2">Institution</th>
                                <th className="px-3 py-2 text-center">Status</th>
                                <th className="px-3 py-2 text-center">Action</th>
                            </tr>
                        </thead>
                        <tbody className="text-xs text-slate-600 font-medium">
                            {loadingInterns ? (
                                <tr>
                                    <td colSpan={8} className="py-6 px-3 text-center text-slate-400 text-sm">
                                        Loading interns...
                                    </td>
                                </tr>
                            ) : errorInterns ? (
                                <tr>
                                    <td colSpan={8} className="py-6 px-3 text-center text-red-500">
                                        {errorInterns}
                                    </td>
                                </tr>
                            ) : currentItems.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="py-6 px-3 text-center text-slate-400">
                                        No data available.
                                    </td>
                                </tr>
                            ) : (
                                currentItems.map((item, index) => (
                                    <tr key={item.id} className="hover:bg-slate-50 transition-colors border-b border-slate-50 last:border-none">
                                        <td className="px-3 py-2 text-center font-medium">{paginationMeta.from + index}</td>
                                        <td className="px-3 py-2 font-medium text-slate-800">{item.name}</td>
                                        <td className="px-3 py-2">
                                            <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 bg-slate-50 px-3 py-1 rounded-lg w-fit border border-slate-100">
                                                <Clock size={14} /> {item.period}
                                            </div>
                                        </td>
                                        <td className="px-3 py-2">{item.jobPosition || '-'}</td>
                                        <td className="px-3 py-2">{item.division || '-'}</td>

                                        <td className="px-3 py-2">{item.universitas || '-'}</td>
                                        <td className="px-3 py-2 text-center"><StatusBadge status={item.status} /></td>
                                        <td className="px-3 py-2 text-center">
                                            <button
                                                onClick={() => handleOpenForm(item)}
                                                className={`inline-flex items-center justify-center w-9 h-9 rounded-lg transition-colors active:scale-95 shadow-sm text-white ${item.status === 'Not Yet' || item.status === 'Draft' ? 'bg-green-500 hover:bg-green-600' : 'bg-[#354C8F] hover:bg-[#2a3c70]'}`}
                                                title={item.status === 'Not Yet' || item.status === 'Draft' ? 'Evaluate' : 'View Result'}
                                            >
                                                {item.status === 'Not Yet' || item.status === 'Draft' ? <Edit size={16} /> : <Eye size={16} />}
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {!showFormModal && !showFilterModal && !showConfirmModal && !showStatusModal && paginationMeta.total > 0 && (
                    <div className="flex flex-col md:flex-row justify-between items-center p-5 border-t border-slate-100 text-sm text-slate-500 gap-4 -mb-6">
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
                                {(() => {
                                    const pageCurrent = currentPage;
                                    const pageTotal = totalPages;
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
                                            <button onClick={() => handlePageChange(pageCurrent - 1)} disabled={pageCurrent === 1} className="p-2 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50 border border-slate-200"><ChevronLeft size={18} /></button>
                                            {getPageItems(pageCurrent, pageTotal, 1).map((p, idx) => {
                                                if (p === 'left-ellipsis' || p === 'right-ellipsis') return <div key={`${p}-${idx}`} className="w-8 h-8 flex items-center justify-center rounded-lg text-xs font-bold text-slate-400">...</div>;
                                                return <button key={p} onClick={() => handlePageChange(p)} className={`w-8 h-8 flex items-center justify-center rounded-lg text-xs font-bold transition-colors ${pageCurrent === p ? "bg-slate-100 text-[#27345A] border border-slate-200" : "text-slate-500 hover:bg-slate-50 border border-transparent"}`}>{p}</button>;
                                            })}
                                            <button onClick={() => handlePageChange(pageCurrent + 1)} disabled={pageCurrent === pageTotal} className="p-2 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50 border border-slate-200"><ChevronRight size={18} /></button>
                                        </>
                                    );
                                })()}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* --- MODALS --- */}
            <AnimatePresence>

                {/* 1. FILTER MODAL */}
                {showFilterModal && (
                    <ModalOverlay zIndex="z-50" onClose={() => setShowFilterModal(false)} width="max-w-md">
                        <div className="flex justify-between items-center mb-6 p-6 border-b border-slate-100">
                            <h3 className="text-[18px] font-bold text-[#27345A]"> Evaluation Filter </h3>
                            <button onClick={() => setShowFilterModal(false)}><X className="text-slate-400 hover:text-slate-600" /></button>
                        </div>
                        <div className="space-y-6 p-6">
                            <div>
                                <label className="block text-sm font-bold text-slate-800 mb-2 -mt-8">Status</label>
                                <div className="flex gap-2 flex-wrap">
                                    {['Done', 'Draft', 'Not Yet'].map(status => (
                                        <button key={status} onClick={() => handleStatusToggle(status)}
                                            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all border ${filter.status && filter.status.includes(status) ? 'bg-[#354C8F] text-white border-[#354C8F] shadow-md' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                                            {status}
                                        </button>
                                    ))}
                                </div>

                                {/* Division dropdown */}
                                <div className="mt-4">
                                    {renderDropdown("Division", "division", (divisions && divisions.length) ? divisions : [{ value: "", label: "All Divisions" }], loadingDivisions ? "Loading divisions..." : "All Divisions")}
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1.5">Start Date</label>
                                <div className="relative">
                                    <input type="date" value={filter.startDate} onChange={(e) => handleFilterToggle('startDate', e.target.value)} onClick={(e) => e.target.showPicker && e.target.showPicker()} className="w-full pl-10 pr-3 py-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#354C8F]/20 cursor-pointer [&::-webkit-calendar-picker-indicator]:hidden" />
                                    <Calendar className="absolute left-3 top-3 text-slate-400 pointer-events-none" size={18} />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1.5">End Date</label>
                                <div className="relative">
                                    <input type="date" value={filter.endDate} onChange={(e) => handleFilterToggle('endDate', e.target.value)} onClick={(e) => e.target.showPicker && e.target.showPicker()} className="w-full pl-10 pr-3 py-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#354C8F]/20 cursor-pointer [&::-webkit-calendar-picker-indicator]:hidden" />
                                    <Calendar className="absolute left-3 top-3 text-slate-400 pointer-events-none" size={18} />
                                </div>
                            </div>

                        </div>
                        <div className="flex gap-3 justify-end p-6 border-t border-slate-100 bg-slate-50">
                            <button onClick={resetFilter} className={btnSecondary}>Reset</button>
                            <button onClick={applyFilter} className={btnPrimary}>Apply</button>
                        </div>
                    </ModalOverlay>
                )}

                {/* 2. FORM EVALUATION MODAL */}
                {showFormModal && selectedIntern && (() => {
                    const isReadOnly = selectedIntern.status === 'Done' || selectedIntern.status === 'Need Review';
                    return (
                        <ModalOverlay zIndex="z-50" onClose={handleAttemptCloseForm}>
                            {/* Header (Sticky) */}
                            <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-white sticky top-0 z-10">
                                <h3 className="text-[18px] font-bold text-[#27345A]">Final Performance Evaluation</h3>
                                <button onClick={handleAttemptCloseForm}><X className="text-slate-400 hover:text-slate-600" /></button>
                            </div>

                            {/* Body (Scrollable) */}
                            <div className="p-8 overflow-y-auto custom-scrollbar flex-1 bg-[#F8F9FD] text-[12px]">

                                {/* Intern Data Card */}
                                <div className="bg-white p-4 rounded-2xl border border-slate-200 mb-4 shadow-sm -mt-4">
                                    <h4 className="text-sm font-bold text-slate-800 mb-3 border-b border-slate-100 pb-2">Intern Data</h4>
                                    <div className="grid grid-cols-1 gap-y-2 text-[12px] pl-2">
                                        <div className="grid grid-cols-[120px_10px_1fr]">
                                            <span className="text-slate-500 font-medium">Name</span>
                                            <span className="text-slate-500">:</span>
                                            <span className="font-bold text-[#203266]">{selectedIntern.name}</span>
                                        </div>
                                        <div className="grid grid-cols-[120px_10px_1fr]">
                                            <span className="text-slate-500 font-medium">Position</span>
                                            <span className="text-slate-500">:</span>
                                            <span className="font-bold text-[#203266]">{selectedIntern.jobPosition || selectedIntern.position || '-'}</span>
                                        </div>
                                        <div className="grid grid-cols-[120px_10px_1fr]">
                                            <span className="text-slate-500 font-medium">Division</span>
                                            <span className="text-slate-500">:</span>
                                            <span className="font-bold text-[#203266]">{selectedIntern.division}</span>
                                        </div>
                                        <div className="grid grid-cols-[120px_10px_1fr]">
                                            <span className="text-slate-500 font-medium">Internship Period</span>
                                            <span className="text-slate-500">:</span>
                                            <span className="font-bold text-[#203266] bg-slate-100 px-2 py-0.5 rounded text-xs w-fit">{selectedIntern.period}</span>
                                        </div>
                                        <div className="grid grid-cols-[120px_10px_1fr]">
                                            <span className="text-slate-500 font-medium">Major</span>
                                            <span className="text-slate-500">:</span>
                                            <span className="font-bold text-[#203266]">{selectedIntern.jurusan || '-'}</span>
                                        </div>
                                        <div className="grid grid-cols-[120px_10px_1fr]">
                                            <span className="text-slate-500 font-medium">Institution</span>
                                            <span className="text-slate-500">:</span>
                                            <span className="font-bold text-[#203266]">{selectedIntern.universitas || '-'}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* A. Quantitative Scores */}
                                <div className="bg-white p-4 rounded-2xl border border-slate-200 mb-4 shadow-sm">
                                    <h4 className="text-sm font-bold text-slate-800 mb-3">A. Quantitative (Score 1-100) <span className="ml-1 text-red-500">*</span> <span className="text-xs text-slate-400 font-normal">(required)</span></h4>
                                    <div className="space-y-3">
                                        {evaluationComponentsSnapshot.length > 0 ? (
                                            // Use snapshot if available (preserves original nama_komponen from evaluation)
                                            evaluationComponentsSnapshot.map((comp) => (
                                                <div key={comp.key} className="flex items-center justify-between gap-4">
                                                    <label className="text-[12px] text-slate-600 font-medium">{comp.nama_komponen}</label>
                                                    <input
                                                        type="number"
                                                        min="0" max="100" step="1" inputMode="numeric" pattern="[0-9]*"
                                                        value={formData.scores[comp.key] || ''}
                                                        onChange={(e) => handleScoreChange(comp.key, e.target.value)}
                                                        onWheel={(e) => e.currentTarget.blur()}
                                                        onKeyDown={(e) => { if (e.key === 'ArrowUp' || e.key === 'ArrowDown') e.preventDefault(); }}
                                                        disabled={isReadOnly}
                                                        className="w-20 px-2 py-2 text-center text-[12px] font-bold rounded-lg border border-slate-300 focus:outline-none focus:border-[#354C8F] focus:ring-2 focus:ring-[#354C8F]/20 bg-slate-50"
                                                    />
                                                </div>
                                            ))
                                        ) : evaluationComponents.length > 0 ? (
                                            // Fallback to master data if no snapshot (new evaluation)
                                            evaluationComponents.map((comp, idx) => {
                                                const key = `q${idx + 1}`;
                                                return (
                                                    <div key={key} className="flex items-center justify-between gap-4">
                                                        <label className="text-[12px] text-slate-600 font-medium">{comp.nama_komponen}</label>
                                                        <input
                                                            type="number"
                                                            min="0" max="100" step="1" inputMode="numeric" pattern="[0-9]*"
                                                            value={formData.scores[key] || ''}
                                                            onChange={(e) => handleScoreChange(key, e.target.value)}
                                                            onWheel={(e) => e.currentTarget.blur()}
                                                            onKeyDown={(e) => { if (e.key === 'ArrowUp' || e.key === 'ArrowDown') e.preventDefault(); }}
                                                            disabled={isReadOnly}
                                                            className="w-20 px-2 py-2 text-center text-[12px] font-bold rounded-lg border border-slate-300 focus:outline-none focus:border-[#354C8F] focus:ring-2 focus:ring-[#354C8F]/20 bg-slate-50"
                                                        />
                                                    </div>
                                                );
                                            })
                                        ) : (
                                            <p className="text-sm text-slate-400">Loading evaluation criteria...</p>
                                        )}
                                        {validationErrors.scoresMissing && <p className="text-xs text-red-500 mt-2">Please complete all scores in section A.</p>}
                                    </div>
                                </div>

                                {/* B. Automatic Calculation */}
                                <div className="bg-white p-6 rounded-2xl border border-slate-200 mb-6 shadow-sm">
                                    <h4 className="text-sm font-bold text-slate-800 mb-4">B. Automatic Calculation</h4>
                                    <div className="bg-[#F8F9FD] p-3 rounded-xl border border-slate-100 space-y-2">
                                        <div className="flex justify-between items-center">
                                            <span className="text-[12px] font-bold text-[#354C8F] uppercase tracking-wider">Final Score</span>
                                            <span className="text-lg font-bold text-slate-800">: {currentScore}</span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-[12px] font-bold text-[#354C8F] uppercase tracking-wider">Predicate</span>
                                            <span className="text-lg font-bold text-slate-800">: {currentPredicate}</span>
                                        </div>
                                        <div className="border-t border-slate-200 pt-3 mt-1">
                                            <p className="text-[10px] text-slate-400 font-medium text-center bg-white py-1 rounded border border-slate-100">
                                                A (86-100) | B (71-85) | C (&lt;=70)
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {/* C. Qualitative */}
                                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                                    <h4 className="text-sm font-bold text-slate-800 mb-1">C. Qualitative Feedback <span className="ml-1 text-red-500">*</span> <span className="text-xs text-slate-400 font-normal">(required)</span></h4>
                                    <p className="text-[10px] text-slate-400 mb-2">Provide suggestions and input for the intern.</p>
                                    <textarea
                                        className="w-full px-3 py-2 rounded-xl border border-slate-300 text-[12px] focus:outline-none focus:border-[#354C8F] bg-white h-28 resize-none"
                                        placeholder="Write your feedback here..."
                                        value={formData.feedback}
                                        onChange={(e) => { setFormData({ ...formData, feedback: e.target.value }); setValidationErrors(prev => ({ ...prev, feedbackMissing: false })); }}
                                        disabled={isReadOnly}
                                    ></textarea>
                                    {validationErrors.feedbackMissing && <p className="text-xs text-red-500 mt-2">Feedback is required.</p>}
                                </div>

                            </div>

                            {/* Footer Buttons (Sticky) */}

                            {/* DISCARD CHANGES CONFIRMATION - consistent with other modals */}
                            {showDiscardModal && (
                                <ModalOverlay zIndex="z-[10000]" width="max-w-sm" onClose={() => setShowDiscardModal(false)}>
                                    <div className="bg-white rounded-2xl p-6 text-center shadow-2xl">
                                        <div className="w-20 h-20 bg-orange-50 rounded-full flex items-center justify-center mx-auto mb-4">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M12 3a9 9 0 100 18 9 9 0 000-18z" />
                                            </svg>
                                        </div>
                                        <h3 className="text-xl font-bold text-[#203266] mb-2">Discard Changes?</h3>
                                        <p className="text-slate-500 text-sm mb-6">Changes won't be saved if you discard.</p>
                                        <div className="flex gap-4 justify-center">
                                            <button
                                                className={`${btnSecondary} px-8 py-3 rounded-full`}
                                                onClick={() => {
                                                    // keep editing
                                                    setShowDiscardModal(false);
                                                    try { window.history.pushState(null, document.title); } catch (e) { }
                                                }}
                                            >
                                                Cancel
                                            </button>
                                            <button
                                                className={`${btnError} px-8 py-3 rounded-full`}
                                                onClick={() => {
                                                    // discard and close
                                                    setShowDiscardModal(false);
                                                    setShowFormModal(false);
                                                    setSelectedIntern(null);
                                                    setFormData({ scores: { q1: '', q2: '', q3: '', q4: '', q5: '', q6: '', q7: '' }, feedback: '' });
                                                    try { window.history.back(); } catch (e) { }
                                                }}
                                            >
                                                Discard
                                            </button>
                                        </div>
                                    </div>
                                </ModalOverlay>
                            )}
                            <div className="px-8 py-5 border-t border-slate-100 bg-white sticky bottom-0 z-10 flex justify-between items-center gap-3">
                                {!isReadOnly ? (
                                    <>
                                        <div className="flex-1">
                                            <button onClick={handleReset} className={`${btnSecondary} px-6`}>Reset</button>
                                        </div>
                                        <div className="flex gap-3">
                                            <button onClick={() => handleActionInit('draft')} className={btnDraft}>
                                                Save as Draft
                                            </button>
                                            <button
                                                onClick={() => handleActionInit('submit')}
                                                disabled={saving || isReadOnly || Object.values(formData.scores || {}).some(v => v === null || v === undefined || v === '') || !formData.feedback || !String(formData.feedback).trim()}
                                                className={btnPrimary}
                                            >
                                                Submit Request
                                            </button>
                                        </div>
                                    </>
                                ) : (
                                    <div className="flex w-full justify-end">
                                        <button onClick={() => setShowFormModal(false)} className={btnSecondary}>Close</button>
                                    </div>
                                )}
                            </div>
                        </ModalOverlay>
                    );
                })()}

                {showConfirmModal && (
                    <ModalOverlay zIndex="z-[10000]" width="max-w-sm" onClose={() => setShowConfirmModal(false)} compact>
                        {/* Hapus bg-white, rounded-2xl, dan shadow-2xl di sini 
       karena ModalOverlay sudah menyediakannya.
    */}
                        <div className="p-6 text-center w-full">
                            <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${confirmAction === 'submit' ? 'bg-green-50' : 'bg-slate-100'}`}>
                                {confirmAction === 'submit' ? <Send className="text-green-500" size={32} /> : <Save className="text-slate-500" size={32} />}
                            </div>

                            <h3 className="text-xl font-bold text-[#203266] mb-2">
                                {confirmAction === 'submit' ? 'Submit to Admin?' : 'Save Draft?'}
                            </h3>

                            <p className="text-slate-500 text-sm mb-6">
                                {confirmAction === 'submit'
                                    ? 'The evaluation will be reviewed by the Admin before being finalized.'
                                    : 'You can continue editing later.'}
                            </p>

                            {confirmAction === 'submit' && (
                                <div className="mb-6 text-left">
                                    <label className="inline-flex items-start gap-3 text-sm text-slate-700 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={confirmChecked}
                                            onChange={(e) => setConfirmChecked(e.target.checked)}
                                            className="mt-1 w-4 h-4 rounded border-slate-300 text-blue-600"
                                        />
                                        <span>I confirm that I have evaluated the intern honestly.</span>
                                    </label>
                                </div>
                            )}

                            <div className="flex gap-3 mt-2">
                                <button
                                    onClick={() => { setConfirmChecked(false); setShowConfirmModal(false); }}
                                    className={`${btnSecondary} flex-1 py-2`}
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={executeAction}
                                    disabled={confirmAction === 'submit' && !confirmChecked}
                                    className={`${confirmAction === 'submit' ? btnSuccess : btnPrimary} flex-1 py-2 ${confirmAction === 'submit' && !confirmChecked ? 'opacity-50 cursor-not-allowed' : ''}`}
                                >
                                    {confirmAction === 'submit' ? 'Yes, Submit' : 'Yes, Save'}
                                </button>
                            </div>
                        </div>
                    </ModalOverlay>
                )}

                {/* 4. SUCCESS MODAL */}
                {showStatusModal && (
                    <ModalOverlay zIndex="z-[10000]" width="max-w-sm" onClose={() => setShowStatusModal(false)} compact>
                        <div className="text-center p-4">
                            <div className={`w-16 h-16 ${statusType === 'error' ? 'bg-red-50' : 'bg-green-50'} rounded-full flex items-center justify-center mx-auto mb-4`}>
                                {statusType === 'error' ? <X className="text-red-500" size={32} /> : <Check className="text-green-500" size={32} strokeWidth={3} />}
                            </div>
                            <h3 className="text-xl font-bold text-[#203266] mb-2">{statusMessage.title}</h3>
                            <p className="text-slate-500 text-sm mb-6">{statusMessage.desc}</p>
                            <button onClick={() => setShowStatusModal(false)} className={`${statusType === 'error' ? btnError : btnSuccess} w-full`}>OK</button>
                        </div>
                    </ModalOverlay>
                )}

            </AnimatePresence>
        </div >
    );
}

export default EvaluationMentor;