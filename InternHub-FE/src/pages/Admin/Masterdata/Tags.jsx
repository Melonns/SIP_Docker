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
  Tag as TagIcon
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import apiClient from '../../../api/axiosConfig';

// --- STYLE CONSTANTS ---
const colors = {
  primary: "#354C8F",
  textDark: "#203266",
  bgLight: "#F8F9FD"
};

const btnBase = "py-3 px-4 md:px-6 rounded-xl font-bold text-[14px] flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed";
const btnPrimary = `${btnBase} bg-[#354C8F] hover:bg-[#2a3c70] text-white shadow-md shadow-indigo-200`;
const btnSecondary = `${btnBase} bg-white border border-slate-300 text-slate-700 hover:bg-slate-50`;
const btnSuccess = `${btnBase} bg-[#22C55E] hover:bg-[#16A34A] text-white shadow-md shadow-green-200`;
const btnDanger = `${btnBase} bg-[#EF4444] hover:bg-[#DC2626] text-white shadow-md shadow-red-200`;

const Tags = () => {
  const [showFormModal, setShowFormModal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);

  const [formMode, setFormMode] = useState("add");
  const [selectedTag, setSelectedTag] = useState(null);
  const [formData, setFormData] = useState({ nama: "", warna: "#6B7280" });
  const [isProcessing, setIsProcessing] = useState(false);

  const [confirmType, setConfirmType] = useState(null);
  const [statusType, setStatusType] = useState('success');
  const [statusMessage, setStatusMessage] = useState({ title: "", desc: "" });

  const [query, setQuery] = useState('');
  const searchTimeout = useRef(null);

  const [tags, setTags] = useState([]);
  const [loading, setLoading] = useState(false);

  // Pagination states
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [pagination, setPagination] = useState({
    currentPage: 1,
    lastPage: 1,
    total: 0,
    from: 0,
    to: 0
  });

  const predefinedColors = [
    '#3B82F6', '#10B981', '#8B5CF6', '#F59E0B', '#EF4444', 
    '#06B6D4', '#F97316', '#EC4899', '#6366F1', '#6B7280'
  ];

  const getErrorMessage = (err, fallback = 'Something went wrong') => {
    try {
      return err?.response?.data?.message || err?.message || fallback;
    } catch (e) {
      return fallback;
    }
  };

  const validateForm = () => {
    if (!formData.nama || !formData.nama.trim()) return 'Tag Name is required';
    if (!formData.warna || !/^#[0-9A-Fa-f]{6}$/i.test(formData.warna)) return 'Tag Color is invalid (must be a hex color, e.g., #3B82F6)';
    return null;
  };

  const fetchTags = async (qParam, page = 1) => {
    setLoading(true);
    try {
      const q = typeof qParam === 'string' ? qParam : query;
      const params = { page, per_page: itemsPerPage };
      if (q) params.q = q;
      
      const res = await apiClient.get('/admin/tags', { params });
      
      const payload = res.data?.data || {};
      setTags(payload.data || []);
      
      setPagination({
        currentPage: payload.current_page || 1,
        lastPage: payload.last_page || 1,
        total: payload.total || 0,
        from: payload.from || ((payload.data && payload.data.length > 0) ? 1 : 0),
        to: payload.to || (payload.data ? payload.data.length : 0)
      });
    } catch (err) {
      console.error('Failed to fetch tags', err);
      // For testing, just show empty
      setTags([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTags(query, 1);
  }, [itemsPerPage]);

  useEffect(() => {
    fetchTags(query, pagination.currentPage);
    return () => { if (searchTimeout.current) clearTimeout(searchTimeout.current); };
  }, [pagination.currentPage]);

  const handlePageChange = (page) => {
    if (page >= 1 && page <= pagination.lastPage) {
      setPagination(prev => ({ ...prev, currentPage: page }));
    }
  };

  const openForm = (mode, tag = null) => {
    setFormMode(mode);
    if (mode === 'edit' && tag) {
      setFormData({ nama: tag.nama || '', warna: tag.warna || '#6B7280' });
      setSelectedTag(tag);
    } else {
      setFormData({ nama: "", warna: "#3B82F6" });
      setSelectedTag(null);
    }
    setShowFormModal(true);
  };

  const handleDeleteInit = (tag) => {
    setSelectedTag(tag);
    setConfirmType('delete');
    setShowConfirmModal(true);
  };

  const handleFormSubmit = () => {
    setConfirmType(formMode === 'add' ? 'add' : 'save');
    setShowConfirmModal(true);
  };

  const createTag = async () => {
    const v = validateForm();
    if (v) { setStatusType('error'); setStatusMessage({ title: 'Validation', desc: v }); setShowStatusModal(true); return; }
    setIsProcessing(true);
    try {
      await apiClient.post('/admin/tags', formData);
      setStatusType('success');
        setStatusMessage({ title: 'Added', desc: 'Logbook tag successfully added.' });
      setShowFormModal(false);
      fetchTags(query, 1); // Reset to page 1
    } catch (err) {
      console.error('Create failed', err);
      setStatusType('error');
      setStatusMessage({ title: 'Create Failed', desc: getErrorMessage(err, 'Unable to create tag.') });
    } finally {
      setIsProcessing(false);
      setShowStatusModal(true);
    }
  };

  const updateTag = async () => {
    const v = validateForm();
    if (v) { setStatusType('error'); setStatusMessage({ title: 'Validation', desc: v }); setShowStatusModal(true); return; }
    setIsProcessing(true);
    try {
      const id = selectedTag?.id;
      if (!id) throw new Error('Missing tag id');
      await apiClient.put(`/admin/tags/${id}`, formData);
      setStatusType('success');
      setStatusMessage({ title: 'Updated', desc: 'Logbook tag successfully updated.' });
      setShowFormModal(false);
      fetchTags(query, pagination.currentPage);
    } catch (err) {
      console.error('Update failed', err);
      setStatusType('error');
      setStatusMessage({ title: 'Update Failed', desc: getErrorMessage(err, 'Unable to update tag.') });
    } finally {
      setIsProcessing(false);
      setShowStatusModal(true);
    }
  };

  const deleteTag = async () => {
    setIsProcessing(true);
    try {
      const id = selectedTag?.id;
      if (!id) throw new Error('Missing tag id');
      // For actual API
      await apiClient.delete(`/admin/tags/${id}`);
      
      setStatusType('success');
      setStatusMessage({ 
        title: 'Deleted', 
        desc: `Tag successfully deleted.`
      });
      fetchTags(query, pagination.currentPage);
    } catch (err) {
      console.error('Delete failed', err);
      setStatusType('error');
      setStatusMessage({ title: 'Delete Failed', desc: getErrorMessage(err, 'Failed to delete tag. It might be used by a logbook.') });
    } finally {
      setIsProcessing(false);
      setShowStatusModal(true);
    }
  };

  const executeAction = async () => {
    setShowConfirmModal(false);
    if (confirmType === 'delete') await deleteTag();
    else if (confirmType === 'add') await createTag();
    else if (confirmType === 'save') await updateTag();
  };

  return (
    <div className="bg-slate-50 min-h-screen pt-8 pb-8 pl-2 pr-2 md:pl-2 md:pr-2 w-full font-sans text-slate-800 -mt-8">
      {/* HEADER */}
      <div className="mb-6 md:mb-8 mt-4 md:mt-0">
        <h1 className={`text-xl md:text-2xl font-bold text-[${colors.textDark}] mb-1 md:mb-2`}>Logbook Tags</h1>
        <p className="text-slate-500 text-xs">Manage tag categories used for intern logbooks.</p>
        <div className="mt-3">
          <div className="text-sm text-slate-600 bg-blue-50 border border-blue-100 px-4 py-2 rounded-lg inline-block">
            <strong className="text-slate-800">Info:</strong> Tags are global. Deleting a tag will remove it from all associated logbooks.
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
                  fetchTags(v, 1);
                }, 500);
              }}
              placeholder="Search tag..."
              className="w-full pl-9 md:pl-10 pr-9 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#354C8F]/20 text-sm shadow-sm transition-all"
            />
            <Search className="absolute left-3 top-3.5 text-slate-400" size={18} />
            {query && <button onClick={() => { setQuery(''); fetchTags('', 1); }} className="absolute right-3 top-3.5 text-slate-400"><X size={14} /></button>}
          </div>
        </div>
        <button onClick={() => openForm('add')} className={`${btnPrimary} w-full md:w-auto`}>
          <Plus size={18} /> Add Tag
        </button>
      </div>

      {/* TABLE */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[800px] md:min-w-full">
            <thead>
              <tr className="border-b border-slate-100 text-xs font-bold text-slate-900 bg-slate-50/50">
                <th className="px-4 py-3 w-16 text-center">No</th>
                <th className="px-4 py-3 whitespace-nowrap">Tag Name</th>
                <th className="px-4 py-3">Color</th>
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
                      <span className="text-slate-400">Loading tags...</span>
                    </div>
                  </td>
                </tr>
              ) : tags.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-6 text-center text-slate-500">No tags found</td>
                </tr>
              ) : (
                tags.map((item, index) => (
                  <tr key={item.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 text-center font-medium">
                      {pagination.from + index}
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-700">
                      <div className="flex items-center gap-2">
                        <TagIcon size={14} style={{ color: item.warna }} />
                        {item.nama}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div 
                           className="w-5 h-5 rounded shadow-sm border border-slate-200"
                           style={{ backgroundColor: item.warna }}
                        />
                        <span className="text-slate-500 uppercase font-mono">{item.warna}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">
                      {item.created_at ? new Date(item.created_at).toLocaleDateString() : '-'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex justify-center gap-2">
                        <button onClick={() => openForm('edit', item)} className="p-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors shadow-sm shadow-green-200">
                          <Edit2 size={14} />
                        </button>
                        <button onClick={() => handleDeleteInit(item)} className="p-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors shadow-sm shadow-red-200">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* PAGINATION */}
        {pagination.total > 0 && (
          <div className="flex flex-col md:flex-row justify-between items-center p-5 border-t border-slate-100 text-sm text-slate-500 gap-4">
            <p className="order-2 md:order-1">Showing {pagination.from} to {pagination.to} of {pagination.total} entries</p>
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
                <button disabled={pagination.currentPage === 1} onClick={() => handlePageChange(pagination.currentPage - 1)} className="p-2 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50 border border-slate-200 disabled:cursor-not-allowed"><ChevronLeft size={18} /></button>
                {(() => {
                  const pageCurrent = pagination.currentPage;
                  const pageTotal = pagination.lastPage || 1;
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
                <button disabled={pagination.currentPage === pagination.lastPage} onClick={() => handlePageChange(pagination.currentPage + 1)} className="p-2 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50 border border-slate-200 disabled:cursor-not-allowed"><ChevronRight size={18} /></button>
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
                <h3 className="text-[18px] font-bold text-[#27345A]">{formMode === 'add' ? 'Add New Tag' : 'Edit Logbook Tag'}</h3>
                <p className="text-xs text-slate-500 mt-1">{formMode === 'add' ? 'Create a new tag category' : 'Update tag details'}</p>
              </div>
              <button onClick={() => setShowFormModal(false)}><X className="text-slate-400 hover:text-slate-600" /></button>
            </div>

            <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2 custom-scrollbar">
              <InputGroup 
                label="Tag Name" 
                value={formData.nama} 
                onChange={e => setFormData({ ...formData, nama: e.target.value })} 
                placeholder="e.g. Frontend, Backend, UI/UX" 
                required 
              />

              <div>
                 <label className="block text-sm font-bold text-slate-800 mb-2">
                   Tag Color <span className="text-red-500 ml-1">*</span>
                 </label>
                 
                 <div className="flex gap-4 mb-3">
                   <div 
                      className="w-12 h-12 rounded-xl flex-shrink-0 shadow-inner border border-slate-200 flex items-center justify-center transition-colors"
                      style={{ backgroundColor: formData.warna }}
                   >
                     <TagIcon size={20} className="text-white drop-shadow-md" />
                   </div>
                   <input
                     type="text"
                     value={formData.warna.toUpperCase()}
                     onChange={e => {
                       const v = e.target.value;
                       setFormData({ ...formData, warna: v });
                     }}
                     className="w-full px-4 py-3 rounded-xl border border-slate-300 font-mono text-sm uppercase focus:outline-none focus:border-[#354C8F]"
                     placeholder="#FFFFFF"
                   />
                 </div>
                 
                 <div className="flex flex-wrap gap-2 mt-2">
                   {predefinedColors.map(color => (
                     <button
                       key={color}
                       onClick={() => setFormData({ ...formData, warna: color })}
                       className={`w-8 h-8 rounded-full border-2 transition-transform hover:-translate-y-1 ${formData.warna.toUpperCase() === color ? 'border-slate-800 scale-110 shadow-md' : 'border-transparent shadow-sm hover:scale-105'}`}
                       style={{ backgroundColor: color }}
                       title={color}
                       type="button"
                     />
                   ))}
                 </div>
                 <p className="text-xs text-slate-500 mt-2">Pick a standard color or use a hex code.</p>
              </div>
            </div>

            <div className="flex gap-3 mt-8 pt-6 border-t border-slate-100 justify-end">
              <button disabled={isProcessing} onClick={() => setShowFormModal(false)} className={`${btnSecondary} !py-3 w-36`}>Cancel</button>
              <button disabled={isProcessing} onClick={handleFormSubmit} className={`${btnPrimary} !py-3 w-36`}>
                {isProcessing ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div> : (formMode === 'add' ? 'Create' : 'Update')}
              </button>
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
                {confirmType === 'add' ? 'Add Tag?' : confirmType === 'save' ? 'Save Changes?' : 'Delete Tag?'}
              </h3>
              <p className="text-slate-500 text-sm mb-6">
                {confirmType === 'delete' ? 'This tag will be permanently deleted from all associated logbooks.' : 'Are you sure you want to proceed?'}
              </p>
              <div className="flex gap-3">
                <button disabled={isProcessing} onClick={() => setShowConfirmModal(false)} className={`${btnSecondary} w-full justify-center`}>Cancel</button>
                <button disabled={isProcessing} onClick={executeAction}
                  className={`w-full py-3 px-6 rounded-xl font-bold text-sm text-white shadow-md transition-all active:scale-95 flex items-center justify-center ${confirmType === 'delete' ? 'bg-[#EF4444] shadow-red-200 hover:bg-red-600' : 'bg-[#22C55E] shadow-green-200 hover:bg-green-600'}`}>
                  {isProcessing ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div> : (confirmType === 'delete' ? 'Delete' : (formMode === 'add' ? 'Add' : 'Save'))}
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
              <button autoFocus onClick={() => setShowStatusModal(false)}
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
      initial={{ opacity: 0, scale: 0.95, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: 10 }}
      transition={{ duration: 0.2 }}
      className={`bg-white w-[95%] md:w-full ${width} rounded-2xl shadow-2xl ${compact ? 'p-4' : 'p-6'} relative`}
    >
      {children}
    </motion.div>
  </div>
);

export default Tags;
