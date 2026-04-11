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
  MapPin,
  Locate
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import apiClient from '../../../api/axiosConfig';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

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

const OfficeLocation = () => {
  // --- STATES (declare first before using in functions) ---
  // Modal Visibility
  const [showFormModal, setShowFormModal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);

  // Form & Selection
  const [formMode, setFormMode] = useState("add"); // 'add' | 'edit'
  const [selectedOffice, setSelectedOffice] = useState(null);
  const [formData, setFormData] = useState({ name: "", address: "", lat: "", long: "", radius: "", schedule: "", is_active: true });
  const [isProcessing, setIsProcessing] = useState(false);

  // Confirmation & Status
  const [confirmType, setConfirmType] = useState(null); // 'add' | 'save' | 'delete'
  const [statusType, setStatusType] = useState('success');
  const [statusMessage, setStatusMessage] = useState({ title: "", desc: "" });

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // Search
  const [query, setQuery] = useState('');
  const searchTimeout = useRef(null);

  // Data
  const [offices, setOffices] = useState([]);
  const [loading, setLoading] = useState(false);

  // Pagination calculations
  const totalEntries = offices.length;
  const totalPages = Math.ceil(totalEntries / itemsPerPage);
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = offices.slice(indexOfFirstItem, indexOfLastItem);

  const paginationMeta = {
    current_page: currentPage,
    last_page: totalPages,
    from: indexOfFirstItem + 1,
    to: Math.min(indexOfLastItem, totalEntries),
    total: totalEntries
  };

  // --- HELPERS ---
  const getErrorMessage = (err, fallback = 'Something went wrong') => {
    try {
      return err?.response?.data?.message || err?.message || fallback;
    } catch (e) {
      return fallback;
    }
  };

  // --- DATA ---

  // Fetch sites from API
  const fetchSites = async (qParam) => {
    setLoading(true);
    try {
      const q = typeof qParam === 'string' ? qParam : query;
      const params = { ...(q && { q }), per_page: itemsPerPage };
      const res = await apiClient.get('/admin/sites', { params });
      const payload = res.data || {};
      const items = (payload.data || []).map(s => ({
        id: s.id_site,
        name: s.nama_site,
        pimpinan: s.pimpinan || '',
        no_telp: s.no_telp || '',
        website: s.website || '',
        address: s.alamat,
        lat: s.latitude != null ? String(s.latitude) : '',
        long: s.longitude != null ? String(s.longitude) : '',
        radius: s.radius_meter != null ? String(s.radius_meter) : '',
        schedule: s.pimpinan || '-', // using site leader as auxiliary info
        is_active: s.is_active !== false && s.is_active !== 0 && s.is_active !== '0',
      }));
      setOffices(items);
      setCurrentPage(1);
    } catch (err) {
      console.error('Failed to fetch sites', err);
      setStatusType('error');
      const msg = (err?.response?.data?.message) || err.message || 'Unable to load site locations.';
      setStatusMessage({ title: 'Load Failed', desc: msg });
      setShowStatusModal(true);
    } finally {
      setLoading(false);
    }
  }; 

  useEffect(() => {
    fetchSites();
    return () => { if (searchTimeout.current) clearTimeout(searchTimeout.current); };
  }, [itemsPerPage]);

  // --- HANDLERS ---

  const handlePageChange = (page) => {
    if (page >= 1 && page <= totalPages) setCurrentPage(page);
  };

  // Validation for site form
  const validateSiteForm = () => {
    if (!formData.name || !formData.name.trim()) {
      return 'Office Name is required';
    }
    if (!formData.address || !formData.address.trim()) {
      return 'Address is required';
    }
    if (!formData.lat || isNaN(parseFloat(formData.lat))) {
      return 'Valid Latitude is required';
    }
    if (!formData.long || isNaN(parseFloat(formData.long))) {
      return 'Valid Longitude is required';
    }
    if (!formData.radius || isNaN(parseFloat(formData.radius))) {
      return 'Valid Radius is required';
    }
    return null;
  };

  // Working schedule fetching removed from frontend; schedules no longer part of the office form

  const openForm = (mode, office = null) => {
    setFormMode(mode);
    if (mode === 'edit' && office) {
      setFormData({ name: office.name || '', address: office.address || '', lat: office.lat || '', long: office.long || '', radius: office.radius || '', is_active: office.is_active !== false });
      setSelectedOffice(office);
    } else {
      setFormData({ name: "", address: "", lat: "", long: "", radius: "", is_active: true });
      setSelectedOffice(null);
    }
    setShowFormModal(true);
  }; 

  const handleDeleteInit = (office) => {
    setSelectedOffice(office);
    setConfirmType('delete');
    setShowConfirmModal(true);
  };

  const handleFormSubmit = () => {
    setConfirmType(formMode === 'add' ? 'add' : 'save');
    setShowConfirmModal(true);
  };

  const createSite = async () => {
    const v = validateSiteForm();
    if (v) { setStatusType('error'); setStatusMessage({ title: 'Validation', desc: v }); setShowStatusModal(true); return; }
    setIsProcessing(true);
    try {
      const payload = {
        nama_site: formData.name,
        alamat: formData.address,
        latitude: Number(formData.lat),
        longitude: Number(formData.long),
        radius_meter: Number(formData.radius)
      };
      await apiClient.post('/admin/sites', payload);
      setStatusType('success');
      setStatusMessage({ title: 'Site Added', desc: 'Site berhasil ditambahkan.' });
      setShowFormModal(false);
      fetchSites();
    } catch (err) {
      console.error('Create site failed', err);
      setStatusType('error');
      setStatusMessage({ title: 'Create Failed', desc: getErrorMessage(err, 'Unable to create site.') });
    } finally {
      setIsProcessing(false);
      setShowStatusModal(true);
    }
  };

  const updateSite = async () => {
    const v = validateSiteForm();
    if (v) { setStatusType('error'); setStatusMessage({ title: 'Validation', desc: v }); setShowStatusModal(true); return; }
    setIsProcessing(true);
    try {
      const id = selectedOffice?.id;
      if (!id) throw new Error('Missing site id');
      const payload = {
        nama_site: formData.name,
        alamat: formData.address,
        latitude: Number(formData.lat),
        longitude: Number(formData.long),
        radius_meter: Number(formData.radius),
        is_active: formData.is_active,
      };
      await apiClient.put(`/admin/sites/${id}`, payload);
      setStatusType('success');
      setStatusMessage({ title: 'Updated', desc: 'Site berhasil diperbarui.' });
      setShowFormModal(false);
      fetchSites();
    } catch (err) {
      console.error('Update failed', err);
      setStatusType('error');
      setStatusMessage({ title: 'Update Failed', desc: getErrorMessage(err, 'Unable to update site.') });
    } finally {
      setIsProcessing(false);
      setShowStatusModal(true);
    }
  };

  const deleteSite = async () => {
    setIsProcessing(true);
    try {
      const id = selectedOffice?.id;
      if (!id) throw new Error('Missing site id');
      await apiClient.delete(`/admin/sites/${id}`);
      setStatusType('success');
      setStatusMessage({ title: 'Deleted', desc: 'Site berhasil dihapus.' });
      fetchSites();
    } catch (err) {
      console.error('Delete failed', err);
      setStatusType('error');
      setStatusMessage({ title: 'Delete Failed', desc: getErrorMessage(err, 'Unable to delete site.') });
    } finally {
      setIsProcessing(false);
      setShowStatusModal(true);
    }
  };

  const executeAction = async () => {
    setShowConfirmModal(false);
    if (confirmType === 'delete') {
      await deleteSite();
    } else if (confirmType === 'add') {
      await createSite();
    } else if (confirmType === 'save') {
      await updateSite();
    }
  };

  const toggleSiteStatus = async (office) => {
    try {
      await apiClient.patch(`/admin/sites/${office.id}/toggle-status`);
      fetchSites();
    } catch (err) {
      console.error('Toggle status failed', err);
      setStatusType('error');
      setStatusMessage({ title: 'Toggle Failed', desc: getErrorMessage(err, 'Unable to update status.') });
      setShowStatusModal(true);
    }
  };

  return (
    <div className="bg-slate-50 min-h-screen pt-8 pb-8 pl-2 pr-2 md:pl-2 md:pr-2 w-full font-sans text-slate-800 -mt-8">
      
      {/* HEADER */}
      <div className="mb-6 md:mb-8 mt-4 md:mt-0">
        <h1 className={`text-xl md:text-2xl font-bold text-[${colors.textDark}] mb-1 md:mb-2`}>Office Location</h1>
        <p className="text-slate-500 text-xs">Define and manage office location coordinates and radius</p>
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
                  fetchSites(v);
                }, 500);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  if (searchTimeout.current) clearTimeout(searchTimeout.current);
                  setCurrentPage(1);
                  fetchSites(e.target.value);
                }
              }}
              placeholder="Search office..."
              className="w-full pl-9 md:pl-10 pr-9 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#354C8F]/20 text-sm shadow-sm transition-all"
            />
            <Search className="absolute left-3 top-3.5 text-slate-400" size={18} />
            {query && <button onClick={() => { setQuery(''); setCurrentPage(1); fetchSites(''); }} className="absolute right-3 top-3.5 text-slate-400"><X size={14} /></button>}
          </div>
        </div>
        <button onClick={() => openForm('add')} className={`${btnPrimary} w-full md:w-auto`}>
          <Plus size={18} /> Add Office
        </button>
                  </div>

      {/* TABLE */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[1000px] md:min-w-full">
            <thead>
              <tr className="border-b border-slate-100 text-xs font-bold text-slate-900 bg-slate-50/50">
                <th className="px-4 py-3 w-16 text-center">No</th>
                <th className="px-4 py-3">Office Name</th>
                <th className="px-4 py-3">Address</th>
                <th className="px-4 py-3">Latitude</th>
                <th className="px-4 py-3">Longitude</th>
                <th className="px-4 py-3 text-center">Radius (m)</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="text-xs text-slate-600">
              {loading ? (
                <tr>
                  <td colSpan={8} className="p-12 text-center">
                    <div className="flex flex-col items-center justify-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#354C8F] mb-2"></div>
                      <span className="text-slate-400">Loading sites...</span>
                    </div>
                  </td>
                </tr>
              ) : currentItems.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-6 text-center text-slate-500">No offices found</td>
                </tr>
              ) : (
                currentItems.map((item, index) => (
                  <tr key={item.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 text-center font-medium">{paginationMeta.from + index}</td>
                    <td className="px-4 py-3 font-medium text-slate-700 whitespace-nowrap">{item.name}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-start gap-1.5">
                          <MapPin size={14} className="text-[#354C8F] mt-0.5 shrink-0" />
                          <span className="leading-snug">{item.address}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">{item.lat}</td>
                    <td className="px-4 py-3 font-mono text-xs">{item.long}</td>
                    <td className="px-4 py-3 text-center">
                      <span className="bg-indigo-50 text-[#354C8F] px-2 py-1 rounded-md font-bold text-xs">{item.radius}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => toggleSiteStatus(item)}
                        className={`px-3 py-1 md:px-4 md:py-1.5 rounded-lg text-[10px] md:text-xs font-bold border inline-block min-w-[70px] md:min-w-[80px] text-center transition-colors ${
                          item.is_active
                            ? 'bg-green-100 text-green-700 border-green-200 hover:bg-green-200'
                            : 'bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200'
                        }`}
                      >
                        {item.is_active ? 'Active' : 'Inactive'}
                      </button>
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
        {totalEntries > 0 && (
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
        {/* 2. FORM MODAL (ADD / EDIT) */}
        {showFormModal && (
          <ModalOverlay zIndex="z-50" onClose={() => setShowFormModal(false)} width="max-w-lg">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-[18px] font-bold text-[#27345A]">{formMode === 'add' ? 'Add Office' : 'Edit Office'}</h3>
              <button onClick={() => setShowFormModal(false)}><X className="text-slate-400 hover:text-slate-600" /></button>
            </div>

            <div className="space-y-3 max-h-[65vh] overflow-y-auto pr-2 custom-scrollbar">
              {formMode === 'add' && (
                <p className="text-xs text-slate-500 mb-2"><span className="text-red-500">*</span> Required fields</p>
              )}

              <InputGroup label="Office Name" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="e.g. Head Office" required />

              <LocationPicker 
                lat={formData.lat}
                long={formData.long}
                onChange={(newLat, newLong) => setFormData(prev => ({...prev, lat: newLat, long: newLong}))}
                onAddressSelect={(newAddr) => setFormData(prev => ({...prev, address: newAddr}))}
              />

              <InputGroup label="Address" value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} placeholder="e.g. Jl. Rungkut Industri..." required />
              
              <InputGroup label="Radius (meters)" type="number" value={formData.radius} onChange={e => setFormData({...formData, radius: e.target.value})} placeholder="e.g. 100" required />

              {formMode === 'edit' && (
                <div>
                  <label className="block text-sm font-bold text-slate-800 mb-2">Status</label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, is_active: true })}
                      className={`px-4 py-2 rounded-xl text-sm font-semibold border transition-all ${formData.is_active ? 'bg-[#22C55E] text-white border-[#22C55E]' : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'}`}
                    >
                      Active
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, is_active: false })}
                      className={`px-4 py-2 rounded-xl text-sm font-semibold border transition-all ${formData.is_active === false ? 'bg-[#EF4444] text-white border-[#EF4444]' : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'}`}
                    >
                      Inactive
                    </button>
                  </div>
                </div>
              )}

            </div>

            <div className="flex gap-3 mt-6 pt-4 border-t border-slate-100 justify-end">
              <button onClick={() => setShowFormModal(false)} className={`${btnSecondary} !py-3 w-36`}>Cancel</button>
              <button onClick={handleFormSubmit} className={`${btnPrimary} !py-3 w-36`}>{formMode === 'add' ? 'Add' : 'Save'}</button>
            </div>
          </ModalOverlay>
        )}

        {/* 3. CONFIRMATION MODAL (z-60) */}
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
                {confirmType === 'add' ? 'Add Office?' : confirmType === 'save' ? 'Save Changes?' : 'Delete Office?'}
              </h3>
              <p className="text-slate-500 text-sm mb-6">
                {confirmType === 'delete' ? 'This office location will be permanently deleted.' : 'Are you sure you want to proceed?'}
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

        {/* 4. STATUS MODAL (z-60) */}
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
        className="w-full px-4 py-3 rounded-xl border border-slate-300 text-sm focus:outline-none focus:border-[#354C8F] transition-colors placeholder:text-slate-400"
        placeholder={placeholder}
      />
  </div>
);

const ModalOverlay = ({ children, onClose, width = "max-w-md", zIndex = "z-50" }) => (
  <div className={`fixed inset-0 ${zIndex} flex items-center justify-center bg-black/40 backdrop-blur-sm p-4`}>
    <motion.div 
        initial={{ opacity: 0, scale: 0.95 }} 
        animate={{ opacity: 1, scale: 1 }} 
        exit={{ opacity: 0, scale: 0.95 }} 
        className={`bg-white w-[95%] md:w-full ${width} rounded-2xl shadow-2xl p-4 relative`}
      >
      {children}
    </motion.div>
  </div>
);

// Replaces MapPicker with a more integrated component
const LocationPicker = ({ lat, long, onChange, onAddressSelect }) => {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);

  // Helper: Reverse Geocoding
  const fetchAddress = async (lat, lng) => {
    if (!onAddressSelect) return;
    try {
        const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
        const data = await response.json();
        if (data && data.display_name) {
            onAddressSelect(data.display_name);
        }
    } catch (error) {
        console.error("Failed to fetch address:", error);
    }
  };

  // Initialize map
  useEffect(() => {
    // Delay slightly to allow modal animation to settle
    const timer = setTimeout(() => {
        if (!mapContainerRef.current) return;
        if (mapRef.current) return;

        const defaultLat = lat ? parseFloat(lat) : -7.0;
        const defaultLong = long ? parseFloat(long) : 112.0;

        mapRef.current = L.map(mapContainerRef.current).setView([defaultLat, defaultLong], 13);

        L.tileLayer('https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
            maxZoom: 20,
            subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
            attribution: '© Google Maps',
        }).addTo(mapRef.current);

        mapRef.current.on('click', (e) => {
            const { lat: clickLat, lng: clickLng } = e.latlng;
            onChange(clickLat.toFixed(6), clickLng.toFixed(6));
            fetchAddress(clickLat, clickLng);
        });

        if (lat && long) {
            const markerLat = parseFloat(lat);
            const markerLng = parseFloat(long);
            if (!Number.isNaN(markerLat) && !Number.isNaN(markerLng)) {
                markerRef.current = L.marker([markerLat, markerLng]).addTo(mapRef.current);
                mapRef.current.setView([markerLat, markerLng], 15);
            }
        }
        
        // Ensure map renders correctly after modal transition
        mapRef.current.invalidateSize();
    }, 100);

    return () => {
        clearTimeout(timer);
        if (mapRef.current) {
            mapRef.current.remove();
            mapRef.current = null;
            markerRef.current = null;
        }
    };
  }, []);

  const handleLocateMe = () => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser");
      return;
    }
    
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        onChange(latitude.toFixed(6), longitude.toFixed(6));
        fetchAddress(latitude, longitude);

        if (mapRef.current) {
          mapRef.current.setView([latitude, longitude], 17);
          
          if (markerRef.current) {
            markerRef.current.setLatLng([latitude, longitude]);
          } else {
            markerRef.current = L.marker([latitude, longitude]).addTo(mapRef.current);
          }
        }
      },
      () => {
        alert("Unable to retrieve your location.");
      }
    );
  };

  // Update marker from props
  useEffect(() => {
    if (lat && long && mapRef.current) {
      const newLat = parseFloat(lat);
      const newLng = parseFloat(long);
      if (!Number.isNaN(newLat) && !Number.isNaN(newLng)) {
        if (markerRef.current) {
          markerRef.current.setLatLng([newLat, newLng]);
        } else {
          markerRef.current = L.marker([newLat, newLng]).addTo(mapRef.current);
        }
        mapRef.current.panTo([newLat, newLng]);
      }
    }
  }, [lat, long]);

  return (
    <div className="space-y-4">
      <label className="block text-sm font-bold text-slate-800">
        Location Coordinates <span className="text-red-500">*</span>
      </label>

      {/* Map Area - Keep it consistent with input styling */}
      <div className="border border-slate-300 rounded-xl overflow-hidden h-44 relative z-0 shadow-sm">
        <div
            ref={mapContainerRef}
            className="w-full h-full bg-slate-100"
        />
        
        <button
            type="button"
            onClick={handleLocateMe}
            className="absolute top-3 right-3 z-[400] p-2 bg-white text-slate-700 rounded-lg shadow-md border border-slate-200 hover:bg-slate-50 transition-all active:scale-95 group"
            title="Find my location"
        >
            <Locate size={18} className="text-slate-400 group-hover:text-[#354C8F] transition-colors" />
        </button>

        <div className="absolute bottom-3 left-3 z-[400] bg-white/90 backdrop-blur px-3 py-1.5 rounded-lg shadow-sm border border-slate-200 text-[10px] font-medium text-slate-500 pointer-events-none">
            Click map to pin
        </div>
      </div>

      {/* Inputs Configuration - Matching style of other InputGroups */}
      <div className="grid grid-cols-2 gap-4">
        <div>
           <input 
              type="text" 
              value={lat} 
              onChange={(e) => onChange(e.target.value, long)}
              placeholder="Latitude"
               className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:border-[#354C8F] transition-colors placeholder:text-slate-400 font-mono"
           />
        </div>
        <div>
           <input 
              type="text" 
              value={long} 
              onChange={(e) => onChange(lat, e.target.value)}
              placeholder="Longitude"
               className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:border-[#354C8F] transition-colors placeholder:text-slate-400 font-mono"
           />
        </div>
      </div>
    </div>
  );
};

export default OfficeLocation;