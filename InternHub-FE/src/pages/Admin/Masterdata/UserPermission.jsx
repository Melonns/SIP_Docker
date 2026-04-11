import React, { useState, useEffect } from 'react';
import {
  X,
  Check,
  AlertCircle,
  Settings,
  Info
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
const btnPrimary = `bg-[#354C8F] hover:bg-[#2a3c70] text-white py-3 px-4 md:px-6 rounded-xl font-bold text-[14px] shadow-md shadow-indigo-200 flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed`;
const btnSecondary = `bg-white border border-slate-300 text-slate-700 py-3 px-4 md:px-6 rounded-xl font-bold text-[14px] hover:bg-slate-50 transition-all active:scale-95`;

// Group titles
const groupTitles = {
  dashboard: 'Dashboard',
  monitoring: 'Intern Monitoring',
  attendance: 'Attendance',
  logbook: 'Logbook Monitoring',
  evaluation: 'Evaluation',
  reports: 'Reports',
  master_data: 'Master Data',
  profile: 'Profile',
  activities: 'Daily Activities',
  result: 'Result Evaluation',
  other: 'Other Permissions'
};

const titleCase = (s) => String(s).split(/[\s-_]+/).map(w => w.length ? w.charAt(0).toUpperCase() + w.slice(1) : w).join(' ');

const UserPermissionManagement = () => {
  const [roles, setRoles] = useState([]);
  const [loadingRoles, setLoadingRoles] = useState(false);

  // States
  const [showPermissionModal, setShowPermissionModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [statusType, setStatusType] = useState('success');
  const [statusMessage, setStatusMessage] = useState({ title: "", desc: "" });

  const [selectedRole, setSelectedRole] = useState(null);
  const [userPermissions, setUserPermissions] = useState([]); // Checked permission IDs
  const [currentPermissionList, setCurrentPermissionList] = useState({});
  const [loadingPermissions, setLoadingPermissions] = useState(false);
  const [savingPermissions, setSavingPermissions] = useState(false);

  // centralized confirm dialog state
  const [confirmDialog, setConfirmDialog] = useState({ open: false, title: '', desc: '', onConfirm: null, confirmLabel: 'Confirm', cancelLabel: 'Cancel' });

  const fetchRoles = async () => {
    setLoadingRoles(true);
    try {
      const res = await apiClient.get('/admin/roles');
      const payload = res.data || {};
      const items = Array.isArray(payload.data) ? payload.data : [];
      setRoles(items);
    } catch (err) {
      console.error('Error fetching roles:', err);
    } finally {
      setLoadingRoles(false);
    }
  };

  useEffect(() => { fetchRoles(); }, []);

  const openPermissionModal = (role) => {
    setSelectedRole(role);
    setShowPermissionModal(true);
    fetchPermissionData(role);
  };

  const fetchPermissionData = async (role) => {
    const roleId = role?.role_id;
    if (!roleId) return;
    setLoadingPermissions(true);
    try {
      const res = await apiClient.get(`/admin/roles/${roleId}/permissions`);
      const payload = res.data?.data || {};

      const formattedList = {};
      const granted = [];

      Object.entries(payload).forEach(([groupName, items]) => {
        formattedList[groupName] = {
          title: groupTitles[groupName] || titleCase(groupName),
          items: items.map(p => {
            if (p.is_assigned) granted.push(String(p.permission_id));
            return {
              id: String(p.permission_id),
              permission_id: p.permission_id,
              label: p.label || p.name,
              name: p.name,
              is_applicable: p.is_applicable !== false, // default true if not present
              applicable_roles: p.applicable_roles || null
            };
          })
        };
      });

      setCurrentPermissionList(formattedList);
      setUserPermissions(granted);
    } catch (err) {
      console.error('Error fetching permissions:', err);
      setStatusMessage({ title: 'Error', desc: 'Failed to load permissions.' });
      setStatusType('error');
      setShowStatusModal(true);
    } finally {
      setLoadingPermissions(false);
    }
  };

  const togglePermission = (id, isApplicable) => {
    if (!isApplicable) return; // Cannot toggle non-applicable permissions
    const pid = String(id);
    setUserPermissions(prev => prev.includes(pid) ? prev.filter(p => p !== pid) : [...prev, pid]);
  };

  const handleGroupToggle = (group) => {
    // Only toggle applicable items
    const applicableItems = (group.items || []).filter(it => it.is_applicable !== false);
    const pids = applicableItems.map(it => String(it.id));
    if (pids.length === 0) return;
    const allChecked = pids.every(pid => userPermissions.includes(pid));
    
    if (allChecked) {
      setUserPermissions(prev => prev.filter(pid => !pids.includes(pid)));
    } else {
      setUserPermissions(prev => Array.from(new Set([...prev, ...pids])));
    }
  };

  const handleSaveInit = () => {
    setConfirmDialog({
      open: true,
      title: 'Save Changes',
      desc: 'Are you sure you want to save the permission changes for this role?',
      confirmLabel: 'Save',
      cancelLabel: 'Cancel',
      onConfirm: async () => {
        setConfirmDialog(prev => ({ ...prev, open: false }));
        await executeSave();
      }
    });
  };

  const executeSave = async () => {
    if (!selectedRole) return;
    try {
      setSavingPermissions(true);
      // Only send applicable permissions that are assigned
      const allItems = Object.values(currentPermissionList).flatMap(g => g.items || []);
      const applicableAssigned = userPermissions.filter(pid => {
        const item = allItems.find(it => String(it.id) === pid);
        return item && item.is_applicable !== false;
      });
      const payload = { permissions: applicableAssigned.map(id => parseInt(id, 10)) };
      await apiClient.put(`/admin/roles/${selectedRole.role_id}/permissions`, payload);
      
      setStatusMessage({ title: "Success", desc: "Role permissions have been updated." });
      setStatusType('success');
      setShowStatusModal(true);
      setShowPermissionModal(false);

      // Notify layout to re-fetch permissions immediately
      window.dispatchEvent(new Event('permissions-updated'));
    } catch (err) {
      console.error('Error saving permissions:', err);
      setStatusMessage({ title: 'Error', desc: 'Failed to save permissions.' });
      setStatusType('error');
      setShowStatusModal(true);
    } finally {
      setSavingPermissions(false);
    }
  };

  return (
    <div className="bg-slate-50 min-h-screen pt-8 pb-8 pl-2 pr-2 md:pr-1 w-full font-sans text-slate-800 -mt-8">
      {/* HEADER */}
      <div className="mb-6 md:mb-8 mt-4 md:mt-0">
        <h1 className={`text-xl md:text-2xl font-bold text-[${colors.textDark}] mb-1 md:mb-2`}>Role Permissions</h1>
        <p className="text-slate-500 text-xs">Manage system access privileges for each user role</p>
      </div>

      {/* TABLE */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden mt-6">
        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[800px] md:min-w-full">
            <thead>
              <tr className="border-b border-slate-100 text-xs md:text-sm font-bold text-slate-900 bg-slate-50/50">
                <th className="px-4 py-3 w-12 md:w-16 text-center">No</th>
                <th className="px-4 py-3">Role Name</th>
                <th className="px-4 py-3">Role Label</th>
                <th className="px-4 py-3 text-center w-32">Action</th>
              </tr>
            </thead>
            <tbody className="text-xs md:text-sm text-slate-600">
              {loadingRoles ? (
                <tr>
                  <td colSpan={4} className="p-12 text-center">
                    <div className="flex flex-col items-center justify-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#354C8F] mb-2"></div>
                      <span className="text-slate-400">Loading roles...</span>
                    </div>
                  </td>
                </tr>
              ) : (!roles || roles.length === 0) ? (
                <tr>
                  <td colSpan="4" className="p-8 text-center text-slate-400 italic">No roles available</td>
                </tr>
              ) : (
                roles.map((item, index) => (
                  <tr key={item.role_id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 text-center font-medium">{index + 1}</td>
                    <td className="px-4 py-3 font-medium text-slate-700 whitespace-nowrap">{titleCase(item.name)}</td>
                    <td className="px-4 py-3 text-slate-600">{item.label}</td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex justify-center">
                        <button
                          onClick={() => openPermissionModal(item)}
                          title='Edit Permissions'
                          className={`p-2 rounded-lg transition-colors shadow-sm bg-[#F59E0B] text-white hover:bg-[#D97706] shadow-orange-200 active:scale-95`}
                        >
                          <Settings size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* --- MODALS --- */}
      <AnimatePresence>
        {/* PERMISSION MODAL */}
        {showPermissionModal && selectedRole && (
          <ModalOverlay key="permission-modal" zIndex="z-50" onClose={() => setShowPermissionModal(false)} width="max-w-xl" compact>
            <div className="flex justify-between items-center mb-4 pb-2 border-b border-slate-100">
              <div className="flex flex-col">
                <h3 className="text-[18px] font-bold text-[#27345A]">Role Permissions</h3>
                <span className="text-sm text-slate-500 font-medium mt-1">
                  Editing: <span className="font-bold text-[#354C8F]">{selectedRole.label}</span>
                </span>
              </div>
              <button onClick={() => setShowPermissionModal(false)}><X className="text-slate-400 hover:text-slate-600" size={24} /></button>
            </div>

            <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-3 custom-scrollbar">
              {loadingPermissions ? (
                <div className="p-6 text-center text-sm text-slate-500 flex flex-col items-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#354C8F] mb-2"></div>
                  Loading permissions...
                </div>
              ) : (
                Object.entries(currentPermissionList).map(([key, group], gIdx) => {
                  const allGroupChecked = group.items && group.items.length > 0 && group.items.every(it => userPermissions.includes(String(it.id)));
                  return (
                    <div key={`${key}-${gIdx}`} className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                      <div className="flex items-center justify-between mb-3 border-b border-slate-200 pb-2">
                        <h4 className="text-[15px] font-bold text-[#27345A]">{group.title}</h4>
                        <button onClick={() => handleGroupToggle(group)} className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 hover:text-[#354C8F] transition-colors">
                          {allGroupChecked ? 'Unselect All' : 'Select All'}
                        </button>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                        {group.items.map((item) => {
                          const pid = String(item.id);
                          const checked = userPermissions.includes(pid);
                          const isApplicable = item.is_applicable !== false;
                          return (
                            <label
                              key={pid}
                              role="checkbox"
                              aria-checked={checked}
                              aria-disabled={!isApplicable}
                              tabIndex={isApplicable ? 0 : -1}
                              onKeyDown={(e) => { if (isApplicable && (e.key === ' ' || e.key === 'Enter')) { e.preventDefault(); togglePermission(pid, isApplicable); } }}
                              className={`flex items-center gap-3 ${isApplicable ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'} group select-none hover:bg-white p-2 rounded-lg transition-colors border ${checked && isApplicable ? 'border-[#354C8F]/20 bg-[#354C8F]/5' : 'border-transparent'}`}
                            >
                              <div className={`w-5 h-5 rounded border flex items-center justify-center transition-all duration-200 ${!isApplicable ? 'border-slate-200 bg-slate-100' : checked ? 'bg-[#354C8F] border-[#354C8F]' : 'border-slate-300 bg-white group-hover:border-[#354C8F]/50'}`}>
                                {checked && <Check size={14} className={isApplicable ? 'text-white' : 'text-slate-400'} strokeWidth={3} />}
                              </div>
                              <input type="checkbox" className="hidden" checked={checked} disabled={!isApplicable} onChange={() => togglePermission(pid, isApplicable)} />
                              <span className={`text-sm font-medium transition-colors ${!isApplicable ? 'text-slate-400' : checked ? 'text-[#354C8F]' : 'text-slate-600 group-hover:text-slate-800'}`}>{item.label}</span>
                              {!isApplicable && item.applicable_roles && (
                                <span className="inline-flex items-center gap-1 text-[11px] text-slate-400 italic ml-auto" title={`Only for: ${item.applicable_roles.join(', ')}`}>
                                  <Info size={12} />
                                  {item.applicable_roles.join(', ')} only
                                </span>
                              )}
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="p-4 mt-4 -m-4 bg-slate-50 rounded-b-2xl border-t border-slate-100 flex gap-3 justify-end">
              <button onClick={() => setShowPermissionModal(false)} className={`${btnSecondary} !py-2.5 w-32`}>Cancel</button>
              <button
                onClick={handleSaveInit}
                disabled={savingPermissions}
                className={`${btnPrimary} !py-2.5 w-32 ${savingPermissions ? 'opacity-60 cursor-not-allowed' : ''}`}
              >
                {savingPermissions ? 'Saving...' : 'Save'}
              </button>
            </div>
          </ModalOverlay>
        )}

        {/* CONFIRMATION MODAL */}
        {confirmDialog.open && (
          <ModalOverlay key="confirm-modal" zIndex="z-[60]" onClose={() => setConfirmDialog(prev => ({ ...prev, open: false }))} width="max-w-sm" compact>
            <div className="text-center p-4">
              <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 bg-yellow-50">
                <AlertCircle className="text-yellow-500" size={32} strokeWidth={2} />
              </div>
              <h3 className="text-xl font-bold text-[#27345A] mb-2">{confirmDialog.title}</h3>
              <p className="text-slate-500 text-sm mb-6">{confirmDialog.desc}</p>
              <div className="flex gap-3">
                <button onClick={() => setConfirmDialog(prev => ({ ...prev, open: false }))} className={`${btnSecondary} w-full justify-center !py-2.5`}>{confirmDialog.cancelLabel || 'Cancel'}</button>
                <button onClick={() => { confirmDialog.onConfirm && confirmDialog.onConfirm(); }} className={`w-full py-2.5 px-6 rounded-xl font-bold text-sm text-white shadow-md transition-all active:scale-95 flex items-center justify-center bg-[#22C55E] shadow-green-200 hover:bg-green-600`}>{confirmDialog.confirmLabel || 'Confirm'}</button>
              </div>
            </div>
          </ModalOverlay>
        )}

        {/* STATUS MODAL */}
        {showStatusModal && (
          <ModalOverlay key="status-modal" zIndex="z-[60]" onClose={() => setShowStatusModal(false)} width="max-w-sm" compact>
            <div className="text-center p-6">
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

const ModalOverlay = ({ children, onClose, width = "max-w-md", zIndex = "z-50", compact = false }) => (
  <div className={`fixed inset-0 ${zIndex} flex items-center justify-center bg-black/40 backdrop-blur-sm p-4`}>
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className={`bg-white w-full ${width} rounded-2xl shadow-xl ${compact ? 'p-0' : 'p-6'} relative overflow-hidden`}
    >
      <div className={compact ? 'p-6' : ''}>
        {children}
      </div>
    </motion.div>
  </div>
);

export default UserPermissionManagement;