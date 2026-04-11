import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import {
  Calendar,
  Eye,
  X,
  Award,
  CheckCircle,
  AlertCircle,
  Activity,
  UserCircle2,
  CalendarClock
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import apiClient from '../../api/axiosConfig';

// --- STYLE CONSTANTS ---
const colors = {
  primary: "#354C8F",
  textDark: "#203266",
  bgLight: "#F8F9FD"
};

// Button Styles
const btnBase = "py-3 px-6 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50";
const btnSecondary = `${btnBase} bg-white border border-slate-300 text-slate-700 hover:bg-slate-50`;

// --- MODAL PORTAL ---
const ModalOverlay = ({ children, onClose, width = "max-w-lg", zIndex = "z-[9999]" }) => {
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
        className={`relative bg-white w-full ${width} rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]`} // w-full di mobile
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </motion.div>
    </div>,
    document.body
  );
};

const EvaluationIntern = () => {
  // --- MOCK DATA ---
  const [mainEval, setMainEval] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [internshipPeriod, setInternshipPeriod] = useState(null);

  useEffect(() => {
    let mounted = true;
    const fetchEval = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await apiClient.get('/intern/my-evaluation');
        if (!mounted) return;
        // capture internship period (may exist even when data array empty)
        if (res.data && res.data.internship_info && res.data.internship_info.internship_periode) {
          setInternshipPeriod(res.data.internship_info.internship_periode);
        }
        if (res.data && res.data.success && Array.isArray(res.data.data) && res.data.data.length > 0) {
          const d = res.data.data[0];
          
          // Build details array dynamically from d.details (new API structure)
          let details = [];
          if (d.details && Array.isArray(d.details)) {
            details = d.details.map(detail => ({
              label: detail.nama_komponen,
              score: parseFloat(detail.score) || 0
            }));
          } else {
            // Jika tidak ada details array, tampilkan error
            setError('Gagal mendapat komponen penilaian.');
            setMainEval(null);
            setLoading(false);
            return;
          }

          setMainEval({
            status: 'Done',
            period: d.periode || '',
            mentor: d.mentor?.nama || d.mentor?.nama_lengkap || '',
            date: d.evaluation_date || '',
            finalScore: Number(d.final_score_numeric) || Number(d.total_average_score) || 0,
            predicate: d.final_score_letter || '',
            notes: d.mentor_notes || '',
            details
          });
        } else {
          setMainEval(null);
        }
      } catch (err) {
        console.error('Failed to fetch evaluation', err);
        setError('Failed to load evaluation.');
      } finally {
        setLoading(false);
      }
    };

    fetchEval();
    return () => { mounted = false; };
  }, []);

  const handleOpenDetail = () => {
    if (mainEval && mainEval.status === 'Done') {
      setShowDetailModal(true);
    }
  };

  // Format ISO/DB date to human-readable (e.g., "4 Januari 2026")
  const formatDate = (iso) => {
    if (!iso) return '-';
    const d = new Date(iso);
    if (isNaN(d)) return iso;
    return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
  };

  const StatusBadge = ({ status }) => {
    return status === 'Done'
      ? <span className="flex items-center gap-1.5 text-green-600 font-bold bg-green-50 px-3 py-1 rounded-lg text-xs border border-green-200"><CheckCircle size={14}/> Done</span>
      : <span className="flex items-center gap-1.5 text-red-500 font-bold bg-red-50 px-3 py-1 rounded-lg text-xs border border-red-200"><AlertCircle size={14}/> Not yet</span>;
  };

  return (
    <div className="bg-slate-50 min-h-screen p-4 md:p-8 font-sans text-slate-800 -mt-6 -ml-4 -mr-4">
      
      {/* HEADER */}
      <div className="mb-6 mt-4 md:mt-0">
        <h1 className={`text-3xl md:text-3xl font-bold text-[${colors.textDark}] mb-1 md:mb-2`}>Internship Evaluation</h1>
        <p className="text-slate-500 text-xs md:text-sm">Check whether you have been assessed by the mentor and see the final result.</p>
      </div>

      {/* --- MAIN CARD --- */}
      {error && (
        <div className="max-w-5xl mx-auto mb-4 px-4 py-3 rounded-lg bg-red-50 text-red-700 border border-red-100 text-sm">{error}</div>
      )}
      <div className="bg-white rounded-[24px] md:rounded-[30px] p-5 md:p-8 shadow-sm border border-slate-100 mb-8 max-w-full mx-0">
        
        {/* 1. Period Section */}
        <div className="mb-6 md:mb-8">
            <label className="block text-sm font-bold text-slate-900 mb-2 md:mb-3">Internship Period</label>
            <div className="w-full md:w-fit px-4 py-3 md:px-6 md:py-4 rounded-2xl border border-slate-200 bg-slate-50 text-sm  md:text-sm font-bold text-slate-700 flex items-center gap-3">
                <Calendar className="text-[#354C8F] shrink-0" size={18} md:size={20} />
                <span className="truncate">{loading ? 'Loading...' : (internshipPeriod || (mainEval ? mainEval.period : 'No evaluation available'))}</span>
            </div>
        </div>

        {/* 2. Grid Info: Status & Summary */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 md:gap-8 mb-6 md:mb-8 items-stretch">
            
            {/* Left: Evaluation Status */}
            <div className="bg-white rounded-3xl border border-slate-100 p-6 md:p-8 shadow-[0_4px_20px_rgba(0,0,0,0.02)] flex flex-col justify-center min-h-[160px] md:min-h-[180px]">
                <h3 className="text-lg font-bold text-[#203266] mb-2 md:mb-2 pb-3 border-b border-slate-50">Evaluation Status</h3>
                
                {/* CSS GRID RESPONSIVE */}
                {/* Mobile: 1 Kolom (Stack), Desktop: 3 Kolom sejajar */}
                <div className="grid grid-cols-1 md:grid-cols-[150px_24px_1fr] gap-y-3 md:gap-y-5 text-sm">
                    
                    {/* Row 1 */}
                    <div className="flex flex-col md:contents"> {/* md:contents agar elemen anak langsung masuk grid parent di desktop */}
                        <div className="flex items-center gap-2 text-slate-500 font-medium mb-1 md:mb-0">
                            <Activity size={16} className="text-[#354C8F]" /> 
                            Status
                        </div>
                        <div className="hidden md:block text-center font-bold text-slate-400">:</div>
                        <div className="md:col-start-3"><StatusBadge status={mainEval?.status} /></div>
                    </div>

                    {/* Row 2 */}
                    <div className="flex flex-col md:contents mt-2 md:mt-0">
                        <div className="flex items-center gap-2 text-slate-500 font-medium mb-1 md:mb-0">
                            <UserCircle2 size={16} className="text-[#354C8F]" />
                            Mentor Name
                        </div>
                        <div className="hidden md:block text-center font-bold text-slate-400">:</div>
                        <div className="font-bold text-slate-800 truncate md:col-start-3" title={mainEval?.mentor}>{loading ? 'Loading...' : (mainEval?.mentor || '-')}</div>
                    </div>

                    {/* Row 3 */}
                    <div className="flex flex-col md:contents mt-2 md:mt-0">
                        <div className="flex items-center gap-2 text-slate-500 font-medium mb-1 md:mb-0">
                            <CalendarClock size={16} className="text-[#354C8F]" />
                            Evaluation Date
                        </div>
                        <div className="hidden md:block text-center font-bold text-slate-400">:</div>
                        <div className="font-bold text-slate-800 md:col-start-3">{loading ? 'Loading...' : (mainEval?.status === 'Done' ? formatDate(mainEval?.date) : '-')}</div>
                    </div>
                </div>
            </div>

            {/* Right: Summary of Performance */}
            <div className="bg-[#354C8F] rounded-3xl p-5 md:p-6 text-white relative overflow-hidden shadow-xl shadow-indigo-200/50 flex flex-col justify-between min-h-[160px] md:min-h-[180px]">
                <div className="absolute top-0 right-0 w-32 h-32 md:w-40 md:h-40 bg-white/10 rounded-full blur-3xl -mr-10 -mt-10"></div>
                <div className="absolute bottom-0 left-0 w-24 h-24 md:w-32 md:h-32 bg-indigo-500/20 rounded-full blur-2xl -ml-5 -mb-5"></div>
                
                <div className="relative z-10">
                    <h3 className="text-sm md:text-base font-bold mb-4 md:mb-6 flex items-center gap-2 opacity-90">
                        <Award size={18} /> Performance Summary
                    </h3>
                    <div className="grid grid-cols-2 gap-3 md:gap-6">
                        <div>
                            <p className="text-[10px] md:text-xs text-indigo-100 mb-1 uppercase tracking-wider font-semibold">Final Score</p>
                            <p className="text-2xl md:text-4xl font-bold tracking-tight">{loading ? '...' : (mainEval?.status === 'Done' ? mainEval.finalScore : '-')}</p>
                        </div>
                        <div>
                            <p className="text-[10px] md:text-xs text-indigo-100 mb-1 uppercase tracking-wider font-semibold">Predicate</p>
                            <p className="text-2xl md:text-4xl font-bold tracking-tight">{loading ? '...' : (mainEval?.status === 'Done' ? mainEval.predicate : '-')}</p>
                        </div>
                    </div>
                </div>

                {mainEval?.status === 'Done' && (
                    <button 
                        onClick={handleOpenDetail} 
                        className="mt-6 relative z-10 w-full py-2.5 md:py-3 rounded-xl bg-white text-[#354C8F] hover:bg-slate-50 text-xs md:text-sm font-bold transition-all flex items-center justify-center gap-2 shadow-sm"
                    >
                        <Eye size={16} /> Score Detail
                    </button>
                )}
            </div>
        </div>

        {/* 3. Mentor Notes */}
        <div className="mb-2">
            <label className="block text-sm font-bold text-slate-900 mb-2 md:mb-3">Mentor Notes</label>
            <div className="w-full px-5 py-4 md:px-6 md:py-5 rounded-2xl border border-slate-200 bg-[#F8F9FD] text-sm text-slate-600 leading-relaxed italic shadow-inner min-h-[100px] flex items-center">
                {mainEval?.status === 'Done' ? (`"${mainEval?.notes}"`) : <span className="text-slate-400 not-italic">No notes available yet.</span>}
            </div>
        </div>

      </div>

      {/* --- MODALS (DETAILS) --- */}
      <AnimatePresence>
        {showDetailModal && (
            <ModalOverlay zIndex="z-50" onClose={() => setShowDetailModal(false)}>
                {/* Header */}
                <div className="px-5 py-4 md:px-6 md:py-5 border-b border-slate-100 flex justify-between items-center bg-white sticky top-0 z-10">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-[#354C8F]/10 flex items-center justify-center text-[#354C8F]">
                            <Award size={18} md:size={20} />
                        </div>
                        <div>
                            <h3 className="text-base md:text-lg font-bold text-[#27345A]">Score Breakdown</h3>
                            <p className="text-[10px] md:text-xs text-slate-500">Detailed scoring by Mentor</p>
                        </div>
                    </div>
                    <button onClick={() => setShowDetailModal(false)}><X className="text-slate-400 hover:text-slate-600" size={20} /></button>
                </div>

                {/* Body */}
                <div className="p-5 md:p-6 overflow-y-auto max-h-[60vh] bg-[#F8F9FD]">
                    <div className="space-y-3">
                        {(mainEval?.details || []).map((item, idx) => (
                            <div key={idx} className="bg-white p-3 md:p-4 rounded-xl border border-slate-100 flex justify-between items-center shadow-sm">
                                <span className="text-xs md:text-sm font-medium text-slate-700">{item.label}</span>
                                <div className="flex items-center gap-2 md:gap-3">
                                    <div className="hidden md:block h-2 w-24 bg-slate-100 rounded-full overflow-hidden">
                                        <div 
                                            className="h-full bg-[#354C8F] rounded-full" 
                                            style={{ width: `${item.score}%` }}
                                        ></div>
                                    </div>
                                    <span className="text-xs md:text-sm font-bold text-[#354C8F] w-6 md:w-8 text-right">{item.score}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                    
                    <div className="mt-5 md:mt-6 bg-[#354C8F] rounded-xl p-4 md:p-5 text-white flex justify-between items-center shadow-lg shadow-indigo-200">
                        <span className="font-medium text-xs md:text-sm opacity-90">Total Average Score</span>
                        <span className="font-bold text-xl md:text-2xl">{mainEval.finalScore}</span>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 md:p-5 border-t border-slate-100 bg-white flex justify-end sticky bottom-0 z-10">
                    <button onClick={() => setShowDetailModal(false)} className={btnSecondary + " w-full md:w-auto px-8"}>
                        Close
                    </button>
                </div>
            </ModalOverlay>
        )}
      </AnimatePresence>

    </div>
  );
};

export default EvaluationIntern;