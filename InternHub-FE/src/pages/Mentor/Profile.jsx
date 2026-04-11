import React, { useState, useEffect } from 'react';
import { 
  Eye, 
  EyeOff, 
  X, 
  Check, 
  AlertTriangle 
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import apiClient from '../../api/axiosConfig';
// ----------------------------------------------------

// --- SUB-COMPONENT: INPUT PASSWORD (Reusable) ---
function PasswordInput({ label, name, value, onChange, placeholder, error }) {
    const [show, setShow] = useState(false);
  const [invalidCharWarning, setInvalidCharWarning] = useState('');

  const handleSafeChange = (e) => {
    const nextValue = e.target.value || '';
    const isAlphaNumericOnly = /^[A-Za-z0-9]*$/.test(nextValue);

    if (!isAlphaNumericOnly) {
      setInvalidCharWarning('Only letters and numbers are allowed. Special characters are blocked for security.');
      return;
    }

    if (invalidCharWarning) setInvalidCharWarning('');
    onChange && onChange(e);
  };

  const handleSafePaste = (e) => {
    const pastedText = e.clipboardData?.getData('text') || '';
    if (!/^[A-Za-z0-9]*$/.test(pastedText)) {
      e.preventDefault();
      setInvalidCharWarning('Pasted text contains invalid characters. Only letters and numbers are allowed.');
    }
  };

    return (
        <div className="space-y-1.5">
            {/* CSS Hack for Edge/IE double eye icon */}
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
                  onChange={handleSafeChange}
                  onPaste={handleSafePaste}
                    placeholder={placeholder}
                    required
                    className={`
                        w-full rounded-xl px-4 py-3.5 text-sm font-medium transition-all tracking-wide outline-none
                        ${error
                            ? 'bg-red-50 border border-red-400 text-slate-900 focus:ring-2 focus:ring-red-200 placeholder:text-red-300'
                            : 'bg-[#F5F5F5] border border-slate-300 text-slate-800 focus:ring-2 focus:ring-[#354C8F] placeholder:text-slate-400'
                        }
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

            {invalidCharWarning && (
              <motion.div
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-1.5 text-amber-600 text-xs font-semibold mt-1"
              >
                <AlertTriangle size={14} strokeWidth={2.5} />
                <span>{invalidCharWarning}</span>
              </motion.div>
            )}
        </div>
    );
}

// Change Password UI removed from Mentor profile

// --- MAIN PROFILE COMPONENT ---
const ProfileMentor = () => {
  // State for modals
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isSuccessOpen, setIsSuccessOpen] = useState(false);
  const [isErrorOpen, setIsErrorOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // --- DATA USER DARI API ---
  const [userData, setUserData] = useState(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  useEffect(() => {
    const fetchProfile = async () => {
      setLoadingProfile(true);
      try {
        const response = await apiClient.get('/profile');
        // Sesuaikan mapping sesuai response backend
        const data = response.data.data || response.data;
        if (data.gender === "P" || data.gender === "F" || data.gender?.toUpperCase() === "P" || data.gender?.toUpperCase() === "F") data.gender = "Perempuan";
        else if (data.gender === "L" || data.gender === "M" || data.gender?.toUpperCase() === "L" || data.gender?.toUpperCase() === "M") data.gender = "Laki-laki";
        setUserData({
          name: data.nama_lengkap|| data.nama || "-",
          role: localStorage.getItem('active_role') || data.role || "-",
          email: data.email || "-",
          phone: data.no_telp || "-",
          gender: data.gender || "-",
          nip: data.nip || data.nik || "-",
          job: data.job_position || data.position || "-",
          division: data.division || "-",
          totalInterns: data.total_interns ? `${data.total_interns} interns` : "-"
        });
      } catch (err) {
        setUserData(null);
      } finally {
        setLoadingProfile(false);
      }
    };
    fetchProfile();
  }, []);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: { y: 0, opacity: 1, transition: { type: "spring", stiffness: 100 } }
  };


  return (
    <div className="bg-slate-50 min-h-screen p-4 font-sans text-slate-800">
      
      <motion.div 
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-1 lg:grid-cols-3 gap-8"
      >
        
        {/* --- LEFT COLUMN: PERSONAL CARD --- */}
        <motion.div className="lg:col-span-1" variants={itemVariants}>
          <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-8 flex flex-col items-center text-center h-full relative overflow-hidden hover:shadow-md transition-shadow duration-300">
            
            {/* Avatar & Role */}
            <div className="relative mb-6">
              <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-slate-50 shadow-inner">
                {/* Placeholder Image (3D Avatar style like design) */}
                <img 
                  src="https://img.freepik.com/free-psd/3d-illustration-person-with-sunglasses_23-2149436188.jpg" 
                  alt="Profile" 
                  className="w-full h-full object-cover"
                />
              </div>
              <span className="absolute top-0 right-0 bg-blue-100 text-[#354C8F] text-[10px] font-bold px-2 py-1 rounded-full border border-blue-200">
                {userData?.role || '-'}
              </span>
            </div>

            <h2 className="text-lg font-bold text-[#27345A] mb-8">{userData?.name || '-'}</h2>

            <hr className="w-full border-slate-100 mb-8" />

            {/* Contact Info Form */}
            <div className="w-full space-y-5 text-left">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-800">Email</label>
                <div className="w-full bg-[#F5F5F5] border border-slate-200 rounded-2xl px-4 py-3 text-sm text-slate-700 font-medium overflow-hidden text-ellipsis">
                    {userData?.email || '-'}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-800">No. Handphone</label>
                <div className="w-full bg-[#F5F5F5] border border-slate-200 rounded-2xl px-4 py-3 text-sm text-slate-700 font-medium">
                    {userData?.phone || '-'}
                </div>
              </div>
            </div>

        

          </div>
        </motion.div>

        {/* --- RIGHT COLUMN: DETAILS CARD --- */}
        <motion.div className="lg:col-span-2" variants={itemVariants}>
          <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-8 h-full hover:shadow-md transition-shadow duration-300">
            
            {/* Section A: General Info */}
            <div className="mb-8">
              <h3 className="text-base font-bold text-slate-900 mb-6">A. General Information</h3>
              <div className="space-y-5">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-800">Gender</label>
                  <div className="w-full px-5 py-3.5 rounded-2xl border border-slate-200 bg-[#F5F5F5] text-slate-600 text-sm font-medium">
                    {userData?.gender || '-'}
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-800">NIP / NIK</label>
                  <div className="w-full px-5 py-3.5 rounded-2xl border border-slate-200 bg-[#F5F5F5] text-slate-600 text-sm font-medium">
                    {userData?.nip || '-'}
                  </div>
                </div>
              </div>
            </div>

            {/* Section B: Internship Detail */}
            <div>
              <h3 className="text-base font-bold text-slate-900 mb-6">B. Work Detail</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-800">Job Position</label>
                  <div className="w-full px-5 py-3.5 rounded-2xl border border-slate-200 bg-[#F5F5F5] text-slate-600 text-sm font-medium">
                    {userData?.job || '-'}
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-800">Division</label>
                  <div className="w-full px-5 py-3.5 rounded-2xl border border-slate-200 bg-[#F5F5F5] text-slate-600 text-sm font-medium">
                    {userData?.division || '-'}
                  </div>
                </div>
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-800">Total Interns</label>
                <div className="w-full px-5 py-3.5 rounded-2xl border border-slate-200 bg-[#F5F5F5] text-slate-600 text-sm font-medium">
                    {userData?.totalInterns || '-'}
                </div>
              </div>
            </div>

            

          </div>
        </motion.div>

      </motion.div>

      {/* --- MODALS --- */}
      {/* ChangePasswordModal removed from Mentor profile */}

      {/* LOADING OVERLAY */}
      <AnimatePresence>
        {loadingProfile && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/30 backdrop-blur-sm"
          >
            <div className="bg-white rounded-xl px-8 py-6 shadow-lg flex flex-col items-center">
              <div className="w-12 h-12 border-4 border-[#354C8F] border-t-transparent rounded-full animate-spin mb-4"></div>
              <span className="text-[#354C8F] font-bold text-lg">Loading profile...</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* SUCCESS MODAL */}
      <AnimatePresence>
        {isSuccessOpen && (
            <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
                <motion.div 
                    initial={{ scale: 0.9, opacity: 0 }} 
                    animate={{ scale: 1, opacity: 1 }} 
                    exit={{ scale: 0.9, opacity: 0 }} 
                    className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-8 text-center relative"
                >
                    <div className="w-24 h-24 bg-[#E8F8EA] rounded-full flex items-center justify-center mx-auto mb-6">
                        <Check className="text-[#4CD964]" size={48} strokeWidth={3.5} />
                    </div>
                    <h3 className="text-2xl font-bold text-[#27345A] mb-2">Success!</h3>
                    <p className="text-slate-500 text-sm mb-8">Password updated successfully.</p>
                    <button 
                        onClick={() => setIsSuccessOpen(false)} 
                        className="w-full bg-[#4CD964] hover:bg-[#42BD56] text-white py-3.5 rounded-xl font-bold text-sm shadow-lg shadow-green-100 transition-all active:scale-95"
                    >
                        OK
                    </button>
                </motion.div>
            </div>
        )}
      </AnimatePresence>

      {/* ERROR MODAL */}
      <AnimatePresence>
        {isErrorOpen && (
            <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
                <motion.div 
                    initial={{ scale: 0.9, opacity: 0 }} 
                    animate={{ scale: 1, opacity: 1 }} 
                    exit={{ scale: 0.9, opacity: 0 }} 
                    className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-8 text-center relative"
                >
                    <div className="w-24 h-24 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6">
                        <AlertTriangle className="text-red-500" size={48} strokeWidth={2.5} />
                    </div>
                    <h3 className="text-2xl font-bold text-[#27345A] mb-2">Failed!</h3>
                    <p className="text-slate-500 text-sm mb-8">{errorMessage}</p>
                    <button 
                        onClick={() => setIsErrorOpen(false)} 
                        className="w-full bg-[#354C8F] hover:bg-[#232E4D] text-white py-3.5 rounded-xl font-bold text-sm shadow-lg transition-all active:scale-95"
                    >
                        OK
                    </button>
                </motion.div>
            </div>
        )}
      </AnimatePresence>

    </div>
  );
};

export default ProfileMentor;