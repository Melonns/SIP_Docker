import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  Plus,
  Edit2,
  Trash2,
  X,
  Check,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  BookOpen
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import apiClient from '../../../api/axiosConfig';

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
const actionText = 'hidden sm:inline-block';
const btnSuccess = `${btnBase} bg-[#22C55E] hover:bg-[#16A34A] text-white shadow-md shadow-green-200`;
const btnDanger = `${btnBase} bg-[#EF4444] hover:bg-[#DC2626] text-white shadow-md shadow-red-200`;

const Evaluation = () => {
  // --- STATES ---
  const [showFormModal, setShowFormModal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);

  const [formMode, setFormMode] = useState("add");
  const [selectedComponent, setSelectedComponent] = useState(null);
  const [formData, setFormData] = useState({ nama_komponen: "" });
  const [isProcessing, setIsProcessing] = useState(false);

  const [confirmType, setConfirmType] = useState(null);
  const [statusType, setStatusType] = useState('success');
  const [statusMessage, setStatusMessage] = useState({ title: "", desc: "" });

  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [query, setQuery] = useState('');
  const searchTimeout = useRef(null);

  const [components, setComponents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [paginationMeta, setPaginationMeta] = useState({
    current_page: 1,
    last_page: 1,
    from: 1,
    to: 0,
    total: 0
  });

  // Use API pagination data directly
  const currentItems = components;

  // --- HELPERS ---
  const getErrorMessage = (err, fallback = 'Something went wrong') => {
    try {
      return err?.response?.data?.message || err?.message || fallback;
    } catch (e) {
      return fallback;
    }
  };

  const validateForm = () => {
    if (!formData.nama_komponen || !formData.nama_komponen.trim()) {
      return 'Nama komponen is required';
    }
    return null;
  };

  // --- DATA ---
  const fetchComponents = async (qParam, pageNum = 1) => {
    setLoading(true);
    try {
      const q = typeof qParam === 'string' ? qParam : query;
      const params = { page: pageNum, ...(q && { q }), per_page: itemsPerPage };
      const res = await apiClient.get('/admin/evaluation-components', { params });
      const payload = res.data?.data || {};
      const items = (payload.data || []).map(c => ({
        id: c.id,
        nama_komponen: c.nama_komponen || '',
        created_at: c.created_at,
        updated_at: c.updated_at
      }));
      setComponents(items);
      setPaginationMeta({
        current_page: payload.current_page || 1,
        last_page: payload.last_page || 1,
        from: payload.from || 1,
        to: payload.to || 0,
        total: payload.total || 0
      });
      setCurrentPage(payload.current_page || 1);
    } catch (err) {
      console.error('Failed to fetch components', err);
      setStatusType('error');
      const msg = (err?.response?.data?.message) || err.message || 'Unable to load evaluation components.';
      setStatusMessage({ title: 'Load Failed', desc: msg });
      setShowStatusModal(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchComponents();
    return () => { if (searchTimeout.current) clearTimeout(searchTimeout.current); };
  }, [itemsPerPage]);

  // --- HANDLERS ---
  const handlePageChange = (page) => {
    if (page >= 1 && page <= paginationMeta.last_page) {
      fetchComponents(query, page);
    }
  };

  const openForm = (mode, component = null) => {
    setFormMode(mode);
    if (mode === 'edit' && component) {
      setFormData({ nama_komponen: component.nama_komponen || '' });
      setSelectedComponent(component);
    } else {
      setFormData({ nama_komponen: "" });
      setSelectedComponent(null);
    }
    setShowFormModal(true);
  };

  const handleDeleteInit = (component) => {
    setSelectedComponent(component);
    setConfirmType('delete');
    setShowConfirmModal(true);
  };

  const handleFormSubmit = () => {
    setConfirmType(formMode === 'add' ? 'add' : 'save');
    setShowConfirmModal(true);
  };

  const createComponent = async () => {
    const v = validateForm();
    if (v) { setStatusType('error'); setStatusMessage({ title: 'Validation', desc: v }); setShowStatusModal(true); return; }
    setIsProcessing(true);
    try {
      const payload = {
        nama_komponen: formData.nama_komponen
      };
      await apiClient.post('/admin/evaluation-components', payload);
      setStatusType('success');
      setStatusMessage({ title: 'Added', desc: 'Evaluation component berhasil ditambahkan.' });
      setShowFormModal(false);
      fetchComponents();
    } catch (err) {
      console.error('Create failed', err);
      setStatusType('error');
      setStatusMessage({ title: 'Create Failed', desc: getErrorMessage(err, 'Unable to create component.') });
    } finally {
      setIsProcessing(false);
      setShowStatusModal(true);
    }
  };

  const updateComponent = async () => {
    const v = validateForm();
    if (v) { setStatusType('error'); setStatusMessage({ title: 'Validation', desc: v }); setShowStatusModal(true); return; }
    setIsProcessing(true);
    try {
      const id = selectedComponent?.id;
      if (!id) throw new Error('Missing component id');
      const payload = {
        nama_komponen: formData.nama_komponen
      };
      await apiClient.put(`/admin/evaluation-components/${id}`, payload);
      setStatusType('success');
      setStatusMessage({ title: 'Updated', desc: 'Evaluation component berhasil diperbarui.' });
      setShowFormModal(false);
      fetchComponents();
    } catch (err) {
      console.error('Update failed', err);
      setStatusType('error');
      setStatusMessage({ title: 'Update Failed', desc: getErrorMessage(err, 'Unable to update component.') });
    } finally {
      setIsProcessing(false);
      setShowStatusModal(true);
    }
  };

  const deleteComponent = async () => {
    setIsProcessing(true);
    try {
      const id = selectedComponent?.id;
      if (!id) throw new Error('Missing component id');
      await apiClient.delete(`/admin/evaluation-components/${id}`);
      setStatusType('success');
      setStatusMessage({ title: 'Deleted', desc: 'Evaluation component berhasil dihapus.' });
      fetchComponents();
    } catch (err) {
      console.error('Delete failed', err);
      setStatusType('error');
      setStatusMessage({ title: 'Delete Failed', desc: getErrorMessage(err, 'Unable to delete component.') });
    } finally {
      setIsProcessing(false);
      setShowStatusModal(true);
    }
  };

  const executeAction = async () => {
    setShowConfirmModal(false);
    if (confirmType === 'delete') {
      await deleteComponent();
    } else if (confirmType === 'add') {
      await createComponent();
    } else if (confirmType === 'save') {
      await updateComponent();
    }
  };

  return (
    <div className="bg-slate-50 min-h-screen pt-8 pb-8 pl-2 pr-2 md:pl-2 md:pr-2 w-full font-sans text-slate-800 -mt-8">

      {/* HEADER */}
      <div className="mb-6 md:mb-8 mt-4 md:mt-0">
        <h1 className={`text-xl md:text-2xl font-bold text-[${colors.textDark}] mb-1 md:mb-2`}>Evaluation Component</h1>
        <p className="text-slate-500 text-xs">Manage evaluation criteria and components for intern final scores</p>
        <div className="mt-3">
          <div className="text-sm text-slate-600 bg-blue-50 border border-blue-100 px-4 py-2 rounded-lg inline-block">
            <strong className="text-slate-800">Info:</strong>The ideal number of each evaluation component is ≤ 8 — try to ensure each component has a value of no more than 8 so that the certificate template meets the standards.
          </div>
        </div>
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
                searchTimeout.current = setTimeout(() => {
                  setCurrentPage(1);
                  fetchComponents(v);
                }, 500);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  if (searchTimeout.current) clearTimeout(searchTimeout.current);
                  setCurrentPage(1);
                  fetchComponents(e.target.value);
                }
              }}
              placeholder="Search component..."
              className="w-full pl-9 md:pl-10 pr-9 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#354C8F]/20 text-sm shadow-sm transition-all"
            />
            <Search className="absolute left-3 top-3.5 text-slate-400" size={18} />
            {query && <button onClick={() => { setQuery(''); setCurrentPage(1); fetchComponents(''); }} className="absolute right-3 top-3.5 text-slate-400"><X size={14} /></button>}
          </div>
        </div>
        <button onClick={() => openForm('add')} className={`${btnPrimary} w-full md:w-auto`}>
          <Plus size={18} /> Add Component
        </button>
      </div>

      {/* TABLE */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[800px] md:min-w-full">
            <thead>
              <tr className="border-b border-slate-100 text-xs font-bold text-slate-900 bg-slate-50/50">
                <th className="px-4 py-3 w-16 text-center">No</th>
                <th className="px-4 py-3 whitespace-nowrap">Component Name</th>
                <th className="px-4 py-3">Created</th>
                <th className="px-4 py-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="text-xs text-slate-600">
              {loading ? (
                <tr>
                  <td colSpan={5} className="p-12 text-center">
                    <div className="flex flex-col items-center justify-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#354C8F] mb-2"></div>
                      <span className="text-slate-400">Loading components...</span>
                    </div>
                  </td>
                </tr>
              ) : currentItems.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-6 text-center text-slate-500">No components found</td>
                </tr>
              ) : (
                currentItems.map((item, index) => (
                  <tr key={item.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 text-center font-medium">{paginationMeta.from + index}</td>
                    <td className="px-4 py-3 font-medium text-slate-700 whitespace-nowrap">{item.nama_komponen}</td>
                    <td className="px-4 py-3 text-xs text-slate-500">{new Date(item.created_at).toLocaleDateString()}</td>
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
        {paginationMeta.total > 0 && (
          <div className="flex flex-col md:flex-row justify-between items-center p-5 border-t border-slate-100 text-sm text-slate-500 gap-4">
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
        {/* FORM MODAL */}
        {showFormModal && (
          <ModalOverlay zIndex="z-50" onClose={() => setShowFormModal(false)} width="max-w-lg">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="text-[18px] font-bold text-[#27345A]">{formMode === 'add' ? 'Add Evaluation Component' : 'Edit Evaluation Component'}</h3>
                <p className="text-xs text-slate-500 mt-1">{formMode === 'add' ? 'Create a new evaluation component' : 'Update component details'}</p>
              </div>
              <button onClick={() => setShowFormModal(false)}><X className="text-slate-400 hover:text-slate-600" /></button>
            </div>

            <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2 custom-scrollbar">
              <InputGroup label="Nama Komponen" value={formData.nama_komponen} onChange={e => setFormData({ ...formData, nama_komponen: e.target.value })} placeholder="e.g. Integritas (etika, moral dan kesungguhan)" required />
            </div>

            <div className="flex gap-3 mt-8 pt-6 border-t border-slate-100 justify-end">
              <button onClick={() => setShowFormModal(false)} className={`${btnSecondary} !py-3 w-36`}>Cancel</button>
              <button onClick={handleFormSubmit} className={`${btnPrimary} !py-3 w-36`}>{formMode === 'add' ? 'Create' : 'Update'}</button>
            </div>
          </ModalOverlay>
        )}

        {/* CONFIRMATION MODAL */}
        {showConfirmModal && (
          <ModalOverlay zIndex="z-[60]" onClose={() => setShowConfirmModal(false)} width="max-w-sm" compact>
            <div className="text-center p-4">
              <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${confirmType === 'delete' ? 'bg-red-50' : 'bg-yellow-50'}`}>
                {confirmType === 'delete' ? (
                  <Trash2 className="text-red-500" size={32} strokeWidth={2} />
                ) : (
                  <AlertCircle className="text-yellow-500" size={32} strokeWidth={2} />
                )}
              </div>
              <h3 className="text-xl font-bold text-[#27345A] mb-2">
                {confirmType === 'add' ? 'Add Evaluation?' : confirmType === 'save' ? 'Save Changes?' : 'Delete Evaluation?'}
              </h3>
              <p className="text-slate-500 text-sm mb-6">
                {confirmType === 'delete' ? 'This evaluation will be permanently deleted.' : 'Are you sure you want to proceed?'}
              </p>
              <div className="flex gap-3">
                <button onClick={() => setShowConfirmModal(false)} className={`${btnSecondary} w-full justify-center`}>Cancel</button>
                <button onClick={executeAction}
                  className={`w-full py-3 px-6 rounded-xl font-bold text-sm text-white shadow-md transition-all active:scale-95 flex items-center justify-center ${confirmType === 'delete' ? 'bg-[#EF4444] shadow-red-200 hover:bg-red-600' : 'bg-[#22C55E] shadow-green-200 hover:bg-green-600'}`}>
                  {confirmType === 'delete' ? 'Delete' : formMode === 'add' ? 'Add' : 'Save'}
                </button>
              </div>
            </div>
          </ModalOverlay>
        )}

        {/* STATUS MODAL */}
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
const InputGroup = ({ label, type = "text", value, onChange, placeholder, required = false }) => (
  <div>
    <label className="block text-sm font-bold text-slate-800 mb-2">
      {label} {required && <span className="text-red-500 ml-1">*</span>}
    </label>
    <input
      type={type}
      value={value}
      onChange={onChange}
      aria-required={required}
      className="w-full px-4 py-3.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:border-[#354C8F] transition-colors placeholder:text-slate-400"
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
      className={`bg-white w-[95%] md:w-full ${width} rounded-2xl shadow-2xl ${compact ? 'p-4' : 'p-6'} relative`}
    >
      {children}
    </motion.div>
  </div>
);

export default Evaluation;
