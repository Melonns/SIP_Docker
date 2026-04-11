import React, { useState, useEffect } from 'react';
import {
  Edit2,
  Camera,
  Save,
  X,
  AlertCircle,
  Check,
  Eye,
  EyeOff,
  AlertTriangle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import apiClient from '../../api/axiosConfig';
import { getSafeErrorMessage } from '../../utils/errorHandler';

// --- STYLE CONSTANTS ---
const colors = {
  primary: "#354C8F",
  textDark: "#203266",
  bgLight: "#F8F9FD"
};

// Button Styles
const btnBase = "py-2.5 px-6 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50";
const btnPrimary = `${btnBase} bg-[#354C8F] hover:bg-[#2a3c70] text-white shadow-md shadow-indigo-200`;
const btnSecondary = `${btnBase} bg-white border border-slate-300 text-slate-700 hover:bg-slate-50`;
const btnSuccess = `${btnBase} bg-[#22C55E] hover:bg-[#16A34A] text-white shadow-md shadow-green-200`;

// --- SUB-COMPONENT: INPUT PASSWORD (Reusable) ---
function PasswordInput({ label, name, value, onChange, placeholder, error }) {
  const [show, setShow] = useState(false);

  return (
    <div className="space-y-1.5">
      <style>
        {`
            input[type="password"]::-ms-reveal,
            input[type="password"]::-ms-clear {
                display: none;
            }
        `}
      </style>

      <label className="text-sm font-bold text-slate-800">{label}</label>
      <div className="relative">
        <input
          type={show ? "text" : "password"}
          name={name}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          required
          className={`
              w-full rounded-xl px-4 py-3.5 text-sm font-medium transition-all tracking-wide outline-none
              ${error
                ? 'bg-red-50 border border-red-400 text-slate-900 focus:ring-2 focus:ring-red-200 placeholder:text-red-300'
                : 'bg-[#F5F5F5] border border-slate-300 text-slate-800 focus:ring-2 focus:ring-[#354C8F] placeholder:text-slate-400'}
          `}
        />
        <button
          type="button"
          onClick={() => setShow(!show)}
          className={`absolute right-4 top-1/2 -translate-y-1/2 transition-colors ${error ? 'text-red-400 hover:text-red-600' : 'text-slate-400 hover:text-[#354C8F]'}`}
        >
          {show ? <Eye size={20} /> : <EyeOff size={20} />}
        </button>
      </div>

      {error && (
        <motion.div
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-1.5 text-red-500 text-xs font-semibold mt-1"
        >
          <X size={14} strokeWidth={3} />
          <span>{error}</span>
        </motion.div>
      )}
    </div>
  );
}

// --- SUB-COMPONENT: CHANGE PASSWORD MODAL ---
function ChangePasswordModal({ isOpen, onClose, onSuccess, onError }) {
  const [formData, setFormData] = useState({
    current_password: '',
    new_password: '',
    new_password_confirmation: ''
  });
  const [loading, setLoading] = useState(false);

  const validations = [
    { label: "Minimal 8 Characters", valid: formData.new_password.length >= 8 },
    { label: "Minimal 1 Capital Letter [A-Z]", valid: /[A-Z]/.test(formData.new_password) },
    { label: "Minimal 1 Number [0-9]", valid: /[0-9]/.test(formData.new_password) }
  ];
  const isAllValid = validations.every((v) => v.valid);
  const isMismatch = formData.new_password_confirmation.length > 0 && formData.new_password !== formData.new_password_confirmation;

  useEffect(() => {
    if (!isOpen) {
      setFormData({ current_password: '', new_password: '', new_password_confirmation: '' });
    }
  }, [isOpen]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isAllValid || isMismatch) return;

    setLoading(true);
    try {
      const payload = {
        current_password: formData.current_password,
        new_password: formData.new_password,
        new_password_confirmation: formData.new_password_confirmation
      };

      const response = await apiClient.post('/change-password', payload);
      if (response.data?.success) {
        onClose();
        onSuccess();
      } else if (response.data?.message === "Current password salah.") {
        onError('Current password is incorrect.');
      } else {
        const safeMsg = getSafeErrorMessage({ response: { data: response.data } }, 'Failed to update password.');
        onError(safeMsg);
      }
    } catch (error) {
      onClose();
      const safeMsg = getSafeErrorMessage(error, 'Failed to update password.');
      onError(safeMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ type: 'spring', duration: 0.3 }}
            className="relative bg-white rounded-[24px] w-full max-w-md p-8 shadow-2xl z-10"
          >
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-[#232E4D]">Change your password</h2>
              <button onClick={onClose} className="text-slate-400 hover:text-slate-800 transition-colors">
                <X size={28} strokeWidth={2.5} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <PasswordInput
                label="Current Password"
                name="current_password"
                value={formData.current_password}
                onChange={handleChange}
                placeholder="****************"
              />

              <div>
                <PasswordInput
                  label="New Password"
                  name="new_password"
                  value={formData.new_password}
                  onChange={handleChange}
                  placeholder="****************"
                />
                <div className="mt-3 bg-[#F8FAFF] p-4 rounded-xl border border-[#EEF2FF] space-y-3">
                  {validations.map((item, idx) => (
                    <div
                      key={idx}
                      className={`flex items-center gap-3 text-sm font-medium transition-colors duration-300 ${item.valid ? 'text-[#16A34A]' : 'text-slate-400'}`}
                    >
                      {item.valid ? <Check size={18} strokeWidth={2.5} className="text-[#16A34A]" /> : <div className="w-[18px] h-[18px] rounded-full border-2 border-slate-300 shrink-0" />}
                      {item.label}
                    </div>
                  ))}
                </div>
              </div>

              <PasswordInput
                label="Confirmation Password"
                name="new_password_confirmation"
                value={formData.new_password_confirmation}
                onChange={handleChange}
                placeholder="****************"
                error={isMismatch ? 'Passwords do not match' : null}
              />

              <div className="flex gap-4 mt-8 pt-4">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-3 rounded-xl border border-slate-300 text-slate-700 font-bold hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading || !isAllValid || isMismatch || !formData.new_password_confirmation}
                  className="flex-1 py-3 rounded-xl bg-[#354C8F] text-white font-bold hover:bg-[#232E4D] transition-colors shadow-lg shadow-indigo-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Saving...' : 'Save'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

const AdminProfile = () => {
  const [profile, setProfile] = useState({});
  const [loadingProfile, setLoadingProfile] = useState(true);

  useEffect(() => {
    const fetchProfile = async () => {
      setLoadingProfile(true);
      try {
        const response = await apiClient.get('/profile');
        const data = response.data.data || response.data;
        
        // Translator for gender response L/P or M/F
        if (data.gender === "P" || data.gender === "F" || data.gender?.toUpperCase() === "P" || data.gender?.toUpperCase() === "F") data.gender = "Perempuan";
        else if (data.gender === "L" || data.gender === "M" || data.gender?.toUpperCase() === "L" || data.gender?.toUpperCase() === "M") data.gender = "Laki-laki";

        const fetchedProfile = {
          name: data.nama_lengkap || data.nama || "-",
          role: localStorage.getItem('active_role') || data.role || "Admin",
          email: data.email || "-",
          phone: data.no_telp || "-",
          gender: data.gender || "-",
          nip: data.nip || data.nik || "-",
          jobTitle: data.job_position || data.position || "-",
          division: data.division || "-",
          avatar: data.foto ? `${import.meta.env.VITE_API_BASE_URL}/storage/${data.foto}` : "https://api.dicebear.com/7.x/avataaars/svg?seed=Felix"
        };
        setProfile(fetchedProfile);
        setTempProfile(fetchedProfile);
      } catch (err) {
        console.error("Failed to fetch profile", err);
      } finally {
        setLoadingProfile(false);
      }
    };
    fetchProfile();
  }, []);

  // --- STATES ---
  const [isEditing, setIsEditing] = useState(false);
  const [tempProfile, setTempProfile] = useState({});
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isChangeSuccessOpen, setIsChangeSuccessOpen] = useState(false);
  const [isChangeErrorOpen, setIsChangeErrorOpen] = useState(false);
  const [changeErrorMessage, setChangeErrorMessage] = useState('');

  // --- HANDLERS ---
  const handleEditToggle = () => {
    if (isEditing) {
        setTempProfile({ ...profile }); // Revert changes
        setIsEditing(false);
    } else {
        setIsEditing(true);
    }
  };

  const handleInputChange = (key, value) => {
    setTempProfile(prev => ({ ...prev, [key]: value }));
  };

  const handleSaveInit = () => setShowConfirmModal(true);

  const executeSave = () => {
    setShowConfirmModal(false);
    setTimeout(() => {
        setProfile({ ...tempProfile });
        setIsEditing(false);
        setShowStatusModal(true);
    }, 500);
  };

  // --- COMPONENT INPUT ---
  // Input style disesuaikan persis gambar (Background abu-abu muda, border rounded)
  const CustomInput = ({ label, value, onChange, disabled, type = "text" }) => (
    <div className="mb-5">
        <label className="block text-sm font-bold text-slate-900 mb-2">{label}</label>
        <input 
            type={type} 
            value={value} 
            onChange={(e) => onChange(e.target.value)} 
            disabled={disabled}
            className={`w-full px-5 py-4 rounded-2xl border text-sm font-medium transition-all
                ${disabled 
                    ? 'bg-[#F5F6FA] border-transparent text-slate-700' 
                    : 'bg-white border-[#354C8F] text-slate-900 ring-4 ring-[#354C8F]/5'
                }`}
        />
    </div>
  );

  return (
    <div className="bg-slate-50 min-h-screen p-4 md:p-8 font-sans text-slate-800 -mt-8">
      
      {/* HEADER PAGE */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 mt-4 md:mt-0">
        <div>
            <h1 className="text-2xl md:text-3xl font-bold text-[#203266]">Profile</h1>
            <p className="text-slate-500 text-xs md:text-sm mt-1">Manage your personal information</p>
        </div>
        
        {/* Edit Profile removed per UI requirement */}
        <div />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* --- KARTU KIRI (PROFILE & CONTACT) --- */}
        <div className="lg:col-span-4">
            <div className="bg-white rounded-3xl p-8 shadow-sm border border-slate-100 h-full flex flex-col">
                
                {/* Avatar Section */}
                <div className="flex flex-col items-center mb-8 relative">
                    <div className="relative group">
                        <div className="w-32 h-32 rounded-full overflow-hidden bg-[#FFEDD5] mb-4 border-4 border-white shadow-lg">
                            <img src={profile.avatar} alt="Profile" className="w-full h-full object-cover" />
                        </div>
                        {/* Admin Badge */}
                        <div className="absolute top-0 right-0 bg-[#203266] text-white text-[10px] font-bold px-3 py-1 rounded-full border-2 border-white shadow-sm">
                            {profile.role}
                        </div>
                        {/* Camera Icon (Only when editing) */}
                        {isEditing && (
                            <button className="absolute bottom-4 right-0 bg-[#354C8F] p-2 rounded-full text-white shadow-md hover:scale-110 transition-transform">
                                <Camera size={16} />
                            </button>
                        )}
                    </div>
                    <h2 className="text-xl font-bold text-[#203266]">{profile.name}</h2>
                </div>

                <hr className="border-slate-100 mb-8" />

                {/* Contact Inputs */}
                <div className="flex-1">
                    <CustomInput 
                        label="Email" 
                        value={tempProfile.email} 
                        onChange={(val) => handleInputChange('email', val)} 
                        disabled={!isEditing} 
                    />
                    <CustomInput 
                        label="No. Handphone" 
                        value={tempProfile.phone} 
                        onChange={(val) => handleInputChange('phone', val)} 
                        disabled={!isEditing} 
                    />
                </div>
            </div>
        </div>

        {/* --- KARTU KANAN (DETAIL INFORMASI) --- */}
        <div className="lg:col-span-8">
            <div className="bg-white rounded-3xl p-8 shadow-sm border border-slate-100 h-full">
                
                {/* A. Informasi Umum */}
                <div className="mb-8">
                    <h3 className="text-base font-bold text-slate-900 mb-6">A. Informasi Umum</h3>
                    
                    <CustomInput 
                        label="Jenis Kelamin" 
                        value={tempProfile.gender} 
                        onChange={(val) => handleInputChange('gender', val)} 
                        disabled={!isEditing} 
                    />
                    
                    <CustomInput 
                        label="NIP/NIK" 
                        value={tempProfile.nip} 
                        onChange={(val) => handleInputChange('nip', val)} 
                        disabled={!isEditing} 
                    />
                </div>

                {/* B. Detail Pekerjaan */}
                <div>
                    <h3 className="text-base font-bold text-slate-900 mb-6">B. Detail Pekerjaan</h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <CustomInput 
                            label="Pekerjaan" 
                            value={tempProfile.jobTitle} 
                            onChange={(val) => handleInputChange('jobTitle', val)} 
                            disabled={!isEditing} 
                        />
                        <CustomInput 
                            label="Divisi" 
                            value={tempProfile.division} 
                            onChange={(val) => handleInputChange('division', val)} 
                            disabled={!isEditing} 
                        />
                    </div>
                </div>

            </div>
        </div>

      </div>

      {/* --- MODALS (Consistent UI) --- */}
      <AnimatePresence>
        {/* Confirm Modal */}
        {showConfirmModal && (
          <ModalOverlay zIndex="z-[60]" onClose={() => setShowConfirmModal(false)}>
            <div className="text-center p-4">
              <div className="w-20 h-20 bg-yellow-50 rounded-full flex items-center justify-center mx-auto mb-6">
                 <AlertCircle className="text-yellow-500" size={40} strokeWidth={2} />
              </div>
              <h3 className="text-xl font-bold text-[#27345A] mb-2">Save Changes?</h3>
              <p className="text-slate-500 text-sm mb-8">Are you sure you want to update your profile?</p>
              <div className="flex gap-3">
                <button onClick={() => setShowConfirmModal(false)} className={btnSecondary + " w-full"}>Cancel</button>
                <button onClick={executeSave} className={btnSuccess + " w-full"}>Save</button>
              </div>
            </div>
          </ModalOverlay>
        )}

        {/* Success Modal */}
        {showStatusModal && (
          <ModalOverlay zIndex="z-[60]" onClose={() => setShowStatusModal(false)}>
            <div className="text-center p-4">
              <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-6">
                <Check className="text-green-500" size={40} strokeWidth={3} />
              </div>
              <h3 className="text-xl font-bold text-[#27345A] mb-2">Profile Updated</h3>
              <p className="text-slate-500 text-sm mb-8">Your profile information has been successfully updated.</p>
              <button onClick={() => setShowStatusModal(false)} className={btnSuccess + " w-full"}>OK</button>
            </div>
          </ModalOverlay>
        )}
      </AnimatePresence>

    </div>
  );
};

// --- HELPER COMPONENTS ---
const ModalOverlay = ({ children, onClose, zIndex = "z-50" }) => (
  <div className={`fixed inset-0 ${zIndex} flex items-center justify-center bg-black/40 backdrop-blur-sm p-4`}>
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }} 
      animate={{ opacity: 1, scale: 1 }} 
      exit={{ opacity: 0, scale: 0.95 }} 
      className="bg-white w-full max-w-sm rounded-2xl shadow-2xl p-6 relative"
    >
      {children}
    </motion.div>
  </div>
);

export default AdminProfile;