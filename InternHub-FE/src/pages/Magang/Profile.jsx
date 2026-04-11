import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Eye, EyeOff, X, Check, AlertTriangle, ChevronDown, Camera, Upload } from 'lucide-react';
import apiClient from '../../api/axiosConfig';
import { getSafeErrorMessage } from '../../utils/errorHandler';
import { fetchSecureBlob } from '../../utils/secureFetch';

// Translate gender codes to readable labels (shared helper)
const translateGender = (g) => {
    if (!g && g !== '') return '';
    const val = String(g || '').trim();
    if (!val) return '';
    const u = val.toUpperCase();
    if (u === 'L' || u === 'LAKI-LAKI' || u === 'LAKI') return 'Laki-laki';
    if (u === 'P' || u === 'PEREMPUAN') return 'Perempuan';
    return val;
};

export default function Profile() {
    const [profile, setProfile] = useState(null);
    const [isFormOpen, setIsFormOpen] = useState(false); // Modal Form
    const [isEditOpen, setIsEditOpen] = useState(false); // Modal Edit Profile
    const [isSavingProfile, setIsSavingProfile] = useState(false);
    const [isSuccessOpen, setIsSuccessOpen] = useState(false); // Modal Sukses
    const [isErrorOpen, setIsErrorOpen] = useState(false); // Modal Gagal
    const [errorMessage, setErrorMessage] = useState('');

    // Secure photo states
    const [securePhotoUrl, setSecurePhotoUrl] = useState(null);
    const [secureKtmUrl, setSecureKtmUrl] = useState(null);
    const [secureBankProofUrl, setSecureBankProofUrl] = useState(null);
    const [photoLoading, setPhotoLoading] = useState(false);
    const [ktmLoading, setKtmLoading] = useState(false);
    const [bankProofLoading, setBankProofLoading] = useState(false);
    const [showImagePreview, setShowImagePreview] = useState(false);
    const [previewImageUrl, setPreviewImageUrl] = useState(null);

    const navigate = useNavigate();

    useEffect(() => {
        const storedUserJSON = localStorage.getItem('user_profile');
        const storedRole = localStorage.getItem('role');

        const hydrateFromStorage = () => {
            if (!storedUserJSON) {
                navigate('/login');
                return;
            }

            try {
                const userData = JSON.parse(storedUserJSON);
                // Ensure gender is translated when loading from storage
                const normalizedFromStorage = { ...userData, gender: translateGender(userData.gender) };
                setProfile({
                    user: normalizedFromStorage,
                    roles: [storedRole]
                });
                // keep local storage normalized
                localStorage.setItem('user_profile', JSON.stringify(normalizedFromStorage));
            } catch (error) {
                console.error("Data profile corrupt:", error);
                localStorage.clear();
                navigate('/login');
            }
        };

        // Fetch profile from API; fall back to local storage when fetch fails
        const fetchProfile = async () => {
            try {
                const response = await apiClient.get('/profile');
                const data = response.data?.data || response.data || {};
                const normalized = {
                    ...data,
                    intern_profile_id: data.intern_profile_id || data.id_mahasiswa || data.mahasiswa_id || data.intern_profile?.id || data.profile_id || null,
                    nama_lengkap: data.nama_lengkap || data.name || data.nama || data.full_name || data.username || '',
                    identifier: data.identifier || data.nim || data.nip || data.nik || '',
                    email: data.email || '',
                    no_telp: data.no_telp || data.phone || data.whatsapp || '',
                    gender: translateGender(data.gender === 'L' ? 'L' : data.gender === 'P' ? 'P' : data.gender || ''),
                    universitas: data.universitas || data.university || '',
                    jurusan: data.jurusan || data.program_studi || data.programStudi || '',
                    jenjang_pendidikan: data.jenjang_pendidikan || data.jenjang || data.educationLevel || '',
                    alamat: data.alamat || data.address || '',
                    nama_kontak_darurat: data.nama_kontak_darurat || data.emergency_contact_name || data.emergencyName || '',
                    nomor_darurat: data.nomor_darurat || data.emergency_contact_number || data.emergencyContact || '',
                    // Bank details (support multiple backend field names)
                    bank_name: data.bank_name || data.nama_bank || data.bank || '',
                    account_holder: data.account_holder || data.bank_account_name || data.nama_pemegang_rekening || data.account_name || '',
                    account_number: data.account_number || data.bank_account_number || data.no_rekening || data.rekening || '',
                    bank_proof: data.bank_proof || data.bank_proof_photo || data.foto_rekening || data.foto_buku_rekening || data.bukti_rekening || data.mbanking_photo || data.m_banking_photo || '',
                    foto: data.foto || data.foto_url || data.profile_photo || data.avatar || '',
                    foto_ktm: data.foto_ktm || data.foto_ktm_url || data.id_card || data.ktm || '',
                    job_position: data.job_position || data.position || data.job || '',
                    division: data.division || '',
                    mentors: data.mentors || data.mentor || data.pembimbing || [],
                    site: data.site || data.placement || data.division_site || data.site_info || {},
                    work_schedule: data.work_schedule || {},
                    mulai_magang: data.mulai_magang || data.start_date || data.internship_start || '',
                    akhir_magang: data.akhir_magang || data.end_date || data.internship_end || ''
                };

                setProfile({ user: normalized, roles: [storedRole] });
                localStorage.setItem('user_profile', JSON.stringify(normalized));
            } catch (error) {
                console.warn('Failed to fetch profile, using local storage.', error);
                hydrateFromStorage();
            }
        };

        fetchProfile();
    }, [navigate]);

    // Fetch secure photo
    useEffect(() => {
        const fetchSecurePhoto = async () => {
            try {
                setPhotoLoading(true);
                const blobUrl = await fetchSecureBlob('/profile/photo');
                if (blobUrl) setSecurePhotoUrl(blobUrl);
            } catch {
                // silently handle — photo may not exist
            } finally {
                setPhotoLoading(false);
            }
        };
        fetchSecurePhoto();
        return () => {
            if (securePhotoUrl) URL.revokeObjectURL(securePhotoUrl);
        };
    }, []);

    // Fetch secure KTM
    useEffect(() => {
        const fetchSecureKtm = async () => {
            setKtmLoading(true);
            const url = await fetchSecureBlob('/profile/ktm');
            if (url) setSecureKtmUrl(url);
            setKtmLoading(false);
        };
        fetchSecureKtm();
        return () => {
            if (secureKtmUrl) URL.revokeObjectURL(secureKtmUrl);
        };
    }, []);

    // Fetch secure Bank Proof (same pattern as photo/KTM)
    useEffect(() => {
        const fetchSecureBankProof = async () => {
            setBankProofLoading(true);
            const candidates = ['/profile/bank-proof', '/profile/bank_proof'];
            for (const endpoint of candidates) {
                const url = await fetchSecureBlob(endpoint);
                if (url) {
                    setSecureBankProofUrl((prev) => {
                        if (prev) URL.revokeObjectURL(prev);
                        return url;
                    });
                    setBankProofLoading(false);
                    return;
                }
            }
            setSecureBankProofUrl(null);
            setBankProofLoading(false);
        };

        fetchSecureBankProof();
        return () => {
            if (secureBankProofUrl) URL.revokeObjectURL(secureBankProofUrl);
        };
    }, []);

    const handleImageClick = (url) => {
        if (url) {
            setPreviewImageUrl(url);
            setShowImagePreview(true);
        }
    };

    

    // --- HELPER FUNCTIONS ---
    const formatDate = (dateString) => {
        if (!dateString) return "-";
        const date = new Date(dateString);
        return new Intl.DateTimeFormat('id-ID', {
            day: '2-digit', month: 'long', year: 'numeric'
        }).format(date);
    };

    const calculateDuration = (startStr, endStr) => {
        if (!startStr || !endStr) return "-";
        const start = new Date(startStr);
        const end = new Date(endStr);
        let months = (end.getFullYear() - start.getFullYear()) * 12;
        months -= start.getMonth();
        months += end.getMonth();
        return months <= 0 ? "Kurang dari 1 bulan" : `${months} Bulan`;
    };

    const resolveImageUrl = (value) => {
        if (!value) return '';
        const val = String(value || '');
        if (val.startsWith('data:') || val.startsWith('blob:')) return val;

        const apiBase = String(import.meta.env.VITE_API_BASE_URL || '').replace(/\/+$/, '');
        let apiOrigin = '';
        try {
            if (apiBase.startsWith('http')) apiOrigin = new URL(apiBase).origin;
        } catch (e) { }

        if (val.startsWith('http')) {
            try {
                const parsed = new URL(val);
                if (
                    apiOrigin &&
                    parsed.origin === window.location.origin &&
                    (parsed.pathname.startsWith('/api/') || parsed.pathname.startsWith('/storage/'))
                ) {
                    return `${apiOrigin}${parsed.pathname}${parsed.search || ''}`;
                }
            } catch (e) { }
            return val;
        }

        if (val.startsWith('/')) {
            if (apiOrigin && (val.startsWith('/api/') || val.startsWith('/storage/'))) return `${apiOrigin}${val}`;
            return val;
        }

        if (!apiBase) return val;
        return `${apiBase}/${val.replace(/^\/+/, '')}`;
    };

    const normalizeMentorNames = (mentorVal) => {
        if (!mentorVal) return '-';
        if (Array.isArray(mentorVal)) {
            const names = mentorVal
                .map((m) => m?.nama_lengkap || m?.name || m?.nama || '')
                .filter(Boolean);
            return names.length ? names.join(', ') : '-';
        }
        if (typeof mentorVal === 'object') {
            return mentorVal.nama_lengkap || mentorVal.name || mentorVal.nama || '-';
        }
        return String(mentorVal) || '-';
    };

    const formatWorkSchedule = (ws) => {
        // If there's no work schedule object, return empty so UI doesn't show a hard-coded default
        if (!ws) return [];

        const dayOrder = ['mon','tue','wed','thu','fri','sat','sun'];
        const formatRange = (s, e) => `${String(s || '').substring(0,5) || '08:00'} - ${String(e || '').substring(0,5) || '17:00'}`;

        let wsDays = ws.days;
        if (wsDays && typeof wsDays === 'string') {
            try { const p = JSON.parse(wsDays); if (Array.isArray(p)) wsDays = p; } catch(e) { }
        }

        const compressDays = (arr) => {
            if (!arr || !arr.length) return 'Mon - Fri';
            const idxs = arr.map(d => dayOrder.indexOf(String(d).toLowerCase())).filter(i => i>=0).sort((a,b)=>a-b);
            if (!idxs.length) return arr.map(d => String(d).slice(0,3)).join(', ');
            let ranges = []; let start = idxs[0]; let prev = idxs[0];
            for (let i=1;i<idxs.length;i++){ const cur = idxs[i]; if (cur===prev+1){ prev=cur; continue;} ranges.push([start,prev]); start=cur; prev=cur; }
            ranges.push([start,prev]);
            const parts = ranges.map(([s,e]) => s===e ? dayOrder[s].charAt(0).toUpperCase()+dayOrder[s].slice(1,3) : `${dayOrder[s].charAt(0).toUpperCase()+dayOrder[s].slice(1,3)} - ${dayOrder[e].charAt(0).toUpperCase()+dayOrder[e].slice(1,3)}`);
            return parts.join(', ');
        };

        if (!ws.day_times) {
            const daysLabel = compressDays(wsDays || ['mon','tue','wed','thu','fri']);
            return [{ days: daysLabel, time: formatRange(ws.start_time, ws.end_time) }];
        }

        const groups = {};
        Object.entries(ws.day_times).forEach(([day, times]) => {
            const range = formatRange(times.start, times.end);
            if (!groups[range]) groups[range] = [];
            groups[range].push(day);
        });

        const mapped = Object.entries(groups).map(([time, days]) => ({ days: compressDays(days), time }));
        return mapped.length ? mapped : [defaultGroup];
    };

    const containerVariants = {
        hidden: { opacity: 0 },
        visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
    };

    const itemVariants = {
        hidden: { y: 20, opacity: 0 },
        visible: { y: 0, opacity: 1, transition: { type: "spring", stiffness: 100 } }
    };

    // --- BUTTON COMPONENT (Untuk Reuse) ---
    const ChangePasswordButton = ({ className }) => (
        <motion.button
            onClick={() => setIsFormOpen(true)}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className={`w-full py-3.5 rounded-2xl border-2 border-[#3B5998] text-[#3B5998] font-bold text-sm hover:bg-[#3B5998] hover:text-white transition-all ${className}`}
        >
            Change Password
        </motion.button>
    );

    const EditProfileButton = ({ className }) => (
        <motion.button
            onClick={() => setIsEditOpen(true)}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className={`w-full py-3.5 rounded-2xl border-2 border-[#354C8F] text-[#354C8F] font-bold text-sm hover:bg-[#354C8F] hover:text-white transition-all ${className}`}
        >
            Edit Profile
        </motion.button>
    );

    if (!profile) return null;

    const { user, roles } = profile;
    const site = user.site || {};
    const mentorNames = normalizeMentorNames(user.mentors || site?.pembimbing);
    const bankProofImageUrl = secureBankProofUrl || resolveImageUrl(user.bank_proof);

    return (
        <>
            <motion.div
                className="max-w-7xl mx-auto font-sans p-4"
                variants={containerVariants}
                initial="hidden"
                animate="visible"
            >
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                    {/* --- CARD 1: FOTO PROFIL --- */}
                    <motion.div className="lg:col-span-1 lg:sticky lg:top-5 lg:self-start z-10" variants={itemVariants}>
                        <div className="bg-white rounded-[24px] p-8 shadow-sm border border-slate-100 flex flex-col items-center hover:shadow-md transition-shadow duration-300">
                            <div className="relative mb-6">
                                <motion.div 
                                    whileHover={{ scale: 1.05 }} 
                                    className="w-32 h-32 rounded-full overflow-hidden border-4 border-slate-50 shadow-inner cursor-pointer"
                                    onClick={() => handleImageClick(securePhotoUrl)}
                                >
                                    {photoLoading ? (
                                        <div className="w-full h-full bg-slate-100 flex items-center justify-center">
                                            <div className="w-6 h-6 border-2 border-slate-300 border-t-[#354C8F] rounded-full animate-spin" />
                                        </div>
                                    ) : (
                                        <img
                                            src={securePhotoUrl || `https://ui-avatars.com/api/?name=${user.nama_lengkap}&background=0D8ABC&color=fff`}
                                            alt="Profile"
                                            className="w-full h-full object-cover"
                                        />
                                    )}
                                </motion.div>
                                <div className="absolute top-0 right-0 bg-blue-100 text-blue-600 text-xs font-bold px-3 py-1 rounded-full border border-white shadow-sm uppercase">
                                    {roles[0]}
                                </div>
                            </div>

                            <h2 className="text-lg font-bold text-slate-800 text-center mb-8">{user.nama_lengkap}</h2>

                            <div className="w-full space-y-5">
                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-slate-800">NIK</label>
                                    <div className="w-full bg-[#F5F5F5] border border-slate-200 rounded-2xl px-4 py-3 text-sm text-slate-700 font-medium">
                                        {user.nik || "-"}
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-slate-800">Email</label>
                                    <div className="w-full bg-[#F5F5F5] border border-slate-200 rounded-2xl px-4 py-3 text-sm text-slate-700 font-medium overflow-hidden text-ellipsis">
                                        {user.email}
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-slate-800">Phone</label>
                                    <div className="w-full bg-[#F5F5F5] border border-slate-200 rounded-2xl px-4 py-3 text-sm text-slate-700 font-medium">
                                        {user.no_telp || "-"}
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-slate-800">Gender</label>
                                    <div className="w-full bg-[#F5F5F5] border border-slate-200 rounded-2xl px-4 py-3 text-sm text-slate-700 font-medium">
                                        {translateGender(user.gender) || "-"}
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-slate-800">Place of Birth</label>
                                    <div className="w-full bg-[#F5F5F5] border border-slate-200 rounded-2xl px-4 py-3 text-sm text-slate-700 font-medium">
                                        {user.tempat_lahir || "-"}
                                    </div>
                                </div>
                            </div>

                            {/* TOMBOL DESKTOP (Hidden di Mobile) */}
                            <div className="w-full mt-8 hidden lg:block">
                                <EditProfileButton className="mb-3" />
                                <ChangePasswordButton />
                            </div>
                        </div>
                    </motion.div>

                    {/* --- CARD 2: DATA AKADEMIK & MAGANG --- */}
                    <motion.div className="lg:col-span-2" variants={itemVariants}>
                        <div className="bg-white rounded-[24px] p-8 -mr-2 shadow-sm border border-slate-100 hover:shadow-md transition-shadow duration-300 flex flex-col">

                            {/* Konten Atas */}
                            <div className="flex-1">
                                <h3 className="text-base font-bold text-slate-900 mb-6">A. Academic Information</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                                    <div className="space-y-2">
                                        <label className="text-sm font-semibold text-slate-800">Institution</label>
                                        <div className="w-full bg-[#F5F5F5] border border-slate-200 rounded-2xl px-4 py-3 text-sm text-slate-700 font-medium">{user.universitas}</div>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-semibold text-slate-800">Study Program</label>
                                        <div className="w-full bg-[#F5F5F5] border border-slate-200 rounded-2xl px-4 py-3 text-sm text-slate-700 font-medium">{user.jurusan}</div>
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                                    <div className="space-y-2">
                                        <label className="text-sm font-semibold text-slate-800">Education Level</label>
                                        <div className="w-full bg-[#F5F5F5] border border-slate-200 rounded-2xl px-4 py-3 text-sm text-slate-700 font-medium">{user.jenjang_pendidikan || '-'}</div>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-semibold text-slate-800">Student ID</label>
                                        <div className="w-full bg-[#F5F5F5] border border-slate-200 rounded-2xl px-4 py-3 text-sm text-slate-700 font-medium">{user.identifier}</div>
                                    </div>
                                </div>

                                <div className="space-y-2 mb-6">
                                    <label className="text-sm font-semibold text-slate-800">Semester</label>
                                    <div className="w-full bg-[#F5F5F5] border border-slate-200 rounded-2xl px-4 py-3 text-sm text-slate-700 font-medium">{user.semester || '-'}</div>
                                </div>

                                <div className="space-y-2 mb-10">
                                    <label className="text-sm font-semibold text-slate-800">Address</label>
                                    <div className="w-full bg-[#F5F5F5] border border-slate-200 rounded-2xl px-4 py-3 text-sm text-slate-700 font-medium">{user.alamat || '-'}</div>
                                </div>

                                <h3 className="text-base font-bold text-slate-900 mb-6">B. Internship Details</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                                    <div className="space-y-2">
                                        <label className="text-sm font-semibold text-slate-800">Position</label>
                                        <div className="w-full bg-[#F5F5F5] border border-slate-200 rounded-2xl px-4 py-3 text-sm text-slate-700 font-medium">{user.job_position || '-'}</div>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-semibold text-slate-800">Division</label>
                                        <div className="w-full bg-[#F5F5F5] border border-slate-200 rounded-2xl px-4 py-3 text-sm text-slate-700 font-medium">{user.division || '-'}</div>
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                                    <div className="space-y-2">
                                        <label className="text-sm font-semibold text-slate-800">Mentor</label>
                                        <div className="w-full bg-[#F5F5F5] border border-slate-200 rounded-2xl px-4 py-3 text-sm text-slate-700 font-medium">{mentorNames}</div>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-semibold text-slate-800">Placement Location</label>
                                        <div className="w-full bg-[#F5F5F5] border border-slate-200 rounded-2xl px-4 py-3 text-sm text-slate-700 font-medium">{site.nama_site || '-'}</div>
                                    </div>
                                </div>
                                <div className="space-y-2 mb-6">
                                    <label className="text-sm font-semibold text-slate-800">Internship Duration</label>
                                    <div className="w-full bg-[#F5F5F5] border border-slate-200 rounded-2xl px-4 py-3 text-sm text-slate-700 font-medium">{calculateDuration(user.mulai_magang, user.akhir_magang)}</div>
                                </div>
                                <div className="space-y-2 mb-6">
                                    <label className="text-sm font-semibold text-slate-800">Internship Period</label>
                                    <div className="w-full bg-[#F5F5F5] border border-slate-200 rounded-2xl px-4 py-3 text-sm text-slate-700 font-medium">{formatDate(user.mulai_magang)} - {formatDate(user.akhir_magang)}</div>
                                </div>

                                {/* Work Schedule */}
                                <div className="space-y-2 mb-6">
                                    <label className="text-sm font-semibold text-slate-800">Work Schedule</label>
                                    <div className="w-full bg-[#F5F5F5] border border-slate-200 rounded-2xl px-4 py-3 flex flex-col gap-3">
                                        <div className="text-sm text-slate-900 font-bold border-b border-slate-200 pb-1 mb-1">
                                                            {user.work_schedule?.name || (user.work_schedule ? '' : 'Not Assigned')}
                                                        </div>
                                        <div className="space-y-2">
                                            {formatWorkSchedule(user.work_schedule).map((group, idx) => (
                                                <div key={idx} className="flex flex-col">
                                                    <span className="text-xs font-bold text-[#354C8F] uppercase tracking-wider">{group.days}</span>
                                                    <span className="text-sm text-slate-700 font-medium">{group.time}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                <h3 className="text-base font-bold text-slate-900 mt-10 mb-6">C. Emergency Contact</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <label className="text-sm font-semibold text-slate-800">Contact Name</label>
                                        <div className="w-full bg-[#F5F5F5] border border-slate-200 rounded-2xl px-4 py-3 text-sm text-slate-700 font-medium">{user.nama_kontak_darurat || '-'}</div>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-semibold text-slate-800">Contact Number</label>
                                        <div className="w-full bg-[#F5F5F5] border border-slate-200 rounded-2xl px-4 py-3 text-sm text-slate-700 font-medium">{user.nomor_darurat || '-'}</div>
                                    </div>
                                </div>

                                <h3 className="text-base font-bold text-slate-900 mt-10 mb-6">D. Bank Details</h3>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                                    <div className="space-y-2">
                                        <label className="text-sm font-semibold text-slate-800">Bank Name</label>
                                        <div className="w-full bg-[#F5F5F5] border border-slate-200 rounded-2xl px-4 py-3 text-sm text-slate-700 font-medium">{user.bank_name || '-'}</div>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-semibold text-slate-800">Account Holder</label>
                                        <div className="w-full bg-[#F5F5F5] border border-slate-200 rounded-2xl px-4 py-3 text-sm text-slate-700 font-medium">{user.account_holder || '-'}</div>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-semibold text-slate-800">Account Number</label>
                                        <div className="w-full bg-[#F5F5F5] border border-slate-200 rounded-2xl px-4 py-3 text-sm text-slate-700 font-medium font-mono">{user.account_number || user.no_rekening || '-'}</div>
                                    </div>
                                </div>
                                <div className="space-y-2 mb-6">
                                    <label className="text-sm font-semibold text-slate-800">Bank Book / M-Banking Photo</label>
                                    <p className="text-xs text-slate-500">Make sure the photo displays the owner's name and account number clearly.</p>
                                    <div
                                        className="w-full bg-[#F5F5F5] border border-slate-200 rounded-2xl px-4 py-3 flex items-center gap-3 cursor-pointer hover:border-[#354C8F] transition-colors"
                                        onClick={() => handleImageClick(bankProofImageUrl)}
                                    >
                                        {bankProofLoading ? (
                                            <div className="w-12 h-12 rounded-lg bg-slate-100 flex items-center justify-center">
                                                <div className="w-5 h-5 border-2 border-slate-300 border-t-[#354C8F] rounded-full animate-spin" />
                                            </div>
                                        ) : bankProofImageUrl ? (
                                            <img src={bankProofImageUrl} alt="Bank proof" className="w-12 h-12 rounded-lg object-cover border border-slate-200" />
                                        ) : (
                                            <div className="w-12 h-12 rounded-lg bg-slate-200 flex items-center justify-center text-slate-400 text-xs">N/A</div>
                                        )}
                                        <span className="text-sm text-slate-700 font-medium">
                                            {bankProofImageUrl ? 'Click to view' : 'No file'}
                                        </span>
                                    </div>
                                </div>

                                <h3 className="text-base font-bold text-slate-900 mt-10 mb-6">D. Documents</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {/* Photo Preview */}
                                    <div className="space-y-2">
                                        <label className="text-sm font-semibold text-slate-800">Photo</label>
                                        <div 
                                            className="w-full bg-[#F5F5F5] border border-slate-200 rounded-2xl px-4 py-3 flex items-center gap-3 cursor-pointer hover:border-[#354C8F] transition-colors"
                                            onClick={() => handleImageClick(securePhotoUrl)}
                                        >
                                            {photoLoading ? (
                                                <div className="w-12 h-12 rounded-lg bg-slate-100 flex items-center justify-center">
                                                    <div className="w-5 h-5 border-2 border-slate-300 border-t-[#354C8F] rounded-full animate-spin" />
                                                </div>
                                            ) : securePhotoUrl ? (
                                                <img src={securePhotoUrl} alt="Photo" className="w-12 h-12 rounded-lg object-cover border border-slate-200" />
                                            ) : (
                                                <div className="w-12 h-12 rounded-lg bg-slate-200 flex items-center justify-center text-slate-400 text-xs">N/A</div>
                                            )}
                                            <span className="text-sm text-slate-700 font-medium">
                                                {securePhotoUrl ? 'Click to view' : 'No file'}
                                            </span>
                                        </div>
                                    </div>
                                    {/* KTM Preview */}
                                    <div className="space-y-2">
                                        <label className="text-sm font-semibold text-slate-800">KTM</label>
                                        <div 
                                            className="w-full bg-[#F5F5F5] border border-slate-200 rounded-2xl px-4 py-3 flex items-center gap-3 cursor-pointer hover:border-[#354C8F] transition-colors"
                                            onClick={() => handleImageClick(secureKtmUrl)}
                                        >
                                            {ktmLoading ? (
                                                <div className="w-12 h-12 rounded-lg bg-slate-100 flex items-center justify-center">
                                                    <div className="w-5 h-5 border-2 border-slate-300 border-t-[#354C8F] rounded-full animate-spin" />
                                                </div>
                                            ) : secureKtmUrl ? (
                                                <img src={secureKtmUrl} alt="KTM" className="w-12 h-12 rounded-lg object-cover border border-slate-200" />
                                            ) : (
                                                <div className="w-12 h-12 rounded-lg bg-slate-200 flex items-center justify-center text-slate-400 text-xs">N/A</div>
                                            )}
                                            <span className="text-sm text-slate-700 font-medium">
                                                {secureKtmUrl ? 'Click to view' : 'No file'}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* TOMBOL MOBILE (Visible di Mobile, Hidden di Desktop) */}
                            <div className="w-full mt-8 block lg:hidden">
                                <EditProfileButton className="mb-3" />
                                <ChangePasswordButton />
                            </div>

                        </div>
                    </motion.div>
                </div>
            </motion.div>

            {/* --- MODAL CHANGE PASSWORD --- */}
            <ChangePasswordModal
                isOpen={isFormOpen}
                onClose={() => setIsFormOpen(false)}
                onSuccess={() => setIsSuccessOpen(true)}
                onError={(msg) => {
                    setErrorMessage(msg);
                    setIsErrorOpen(true);
                }}
            />

            {/* --- MODAL EDIT PROFILE --- */}
            <EditProfileModal
                isOpen={isEditOpen}
                isSaving={isSavingProfile}
                user={user}
                onClose={() => setIsEditOpen(false)}
                onSave={async (updatedUser, payload, hasFiles) => {
                    try {
                        setIsSavingProfile(true);
                        
                        // Always use FormData as per backend requirement (POST /api/profile with multipart/form-data)
                        const fd = new FormData();
                        
                        // Append all text fields
                        Object.entries(payload).forEach(([key, val]) => {
                            if (val !== undefined && val !== null) fd.append(key, val);
                        });

                        // Ensure common bank aliases are present in FormData (some backends expect different names)
                        if (payload.bank_name !== undefined && payload.bank_name !== null) fd.set('bank_name', payload.bank_name);
                        if ((payload.nama_bank !== undefined && payload.nama_bank !== null) || payload.bank_name) fd.set('nama_bank', payload.nama_bank || payload.bank_name || '');

                        if (payload.account_holder !== undefined && payload.account_holder !== null) fd.set('account_holder', payload.account_holder);
                        if (payload.bank_account_name !== undefined && payload.bank_account_name !== null) fd.set('bank_account_name', payload.bank_account_name);
                        if (payload.nama_pemegang_rekening !== undefined && payload.nama_pemegang_rekening !== null) fd.set('nama_pemegang_rekening', payload.nama_pemegang_rekening);

                        if (payload.account_number !== undefined && payload.account_number !== null) fd.set('account_number', payload.account_number);
                        if (payload.bank_account_number !== undefined && payload.bank_account_number !== null) fd.set('bank_account_number', payload.bank_account_number);
                        if (payload.no_rekening !== undefined && payload.no_rekening !== null) fd.set('no_rekening', payload.no_rekening);

                        // Append files if they exist
                        if (updatedUser?.fotoFile instanceof File) fd.append('foto', updatedUser.fotoFile);
                        if (updatedUser?.fotoKtmFile instanceof File) fd.append('foto_ktm', updatedUser.fotoKtmFile);
                        if (updatedUser?.bankProofFile instanceof File) fd.append('bank_proof', updatedUser.bankProofFile);

                        // Send POST request (Axios automatically sets Content-Type to multipart/form-data with boundary)
                        try {
                            await apiClient.post('/profile', fd);
                        } catch (combinedErr) {
                            // Fallback for backends that fail when text fields and files are posted together.
                            if (!hasFiles) throw combinedErr;

                            const textPayload = { ...payload };
                            delete textPayload.foto;
                            delete textPayload.foto_ktm;
                            delete textPayload.fotoFile;
                            delete textPayload.fotoKtmFile;
                            delete textPayload.bankProofFile;

                            // 1) Save text data first
                            await apiClient.post('/profile', textPayload);

                            // 2) Upload file(s) only
                            const fileOnlyFd = new FormData();
                            if (updatedUser?.fotoFile instanceof File) fileOnlyFd.append('foto', updatedUser.fotoFile);
                            if (updatedUser?.fotoKtmFile instanceof File) fileOnlyFd.append('foto_ktm', updatedUser.fotoKtmFile);
                            if (updatedUser?.bankProofFile instanceof File) fileOnlyFd.append('bank_proof', updatedUser.bankProofFile);

                            if ([...fileOnlyFd.keys()].length > 0) {
                                await apiClient.post('/profile', fileOnlyFd);
                            }
                        }

                        // Fetch fresh profile data to ensure all fields are formatted correctly
                        const profileResponse = await apiClient.get('/profile');
                        const data = profileResponse?.data?.data || profileResponse?.data || {};
                        const normalizedProfile = {
                            ...data,
                            intern_profile_id: data.intern_profile_id || data.id_mahasiswa || data.mahasiswa_id || data.intern_profile?.id || data.profile_id || null,
                            nama_lengkap: data.nama_lengkap || data.name || data.nama || data.full_name || data.username || '',
                            identifier: data.identifier || data.nim || data.nip || data.nik || '',
                            email: data.email || '',
                            no_telp: data.no_telp || data.phone || data.whatsapp || '',
                            gender: translateGender(data.gender === 'L' ? 'L' : data.gender === 'P' ? 'P' : data.gender || ''),
                            universitas: data.universitas || data.university || '',
                            jurusan: data.jurusan || data.program_studi || data.programStudi || '',
                            jenjang_pendidikan: data.jenjang_pendidikan || data.jenjang || data.educationLevel || '',
                            alamat: data.alamat || data.address || '',
                            nama_kontak_darurat: data.nama_kontak_darurat || data.emergency_contact_name || data.emergencyName || '',
                            nomor_darurat: data.nomor_darurat || data.emergency_contact_number || data.emergencyContact || '',
                            bank_name: data.bank_name || data.nama_bank || data.bank || '',
                            account_holder: data.account_holder || data.bank_account_name || data.nama_pemegang_rekening || data.account_name || '',
                            account_number: data.account_number || data.bank_account_number || data.no_rekening || data.rekening || '',
                            bank_proof: data.bank_proof || data.bank_proof_photo || data.foto_rekening || data.foto_buku_rekening || data.bukti_rekening || data.mbanking_photo || data.m_banking_photo || '',
                            foto: data.foto || data.foto_url || data.profile_photo || data.avatar || '',
                            foto_ktm: data.foto_ktm || data.foto_ktm_url || data.id_card || data.ktm || '',
                            job_position: data.job_position || data.position || data.job || '',
                            division: data.division || '',
                            mentors: data.mentors || data.mentor || data.pembimbing || [],
                            site: data.site || data.placement || data.division_site || data.site_info || {},
                            work_schedule: data.work_schedule || {},
                            mulai_magang: data.mulai_magang || data.start_date || data.internship_start || '',
                            akhir_magang: data.akhir_magang || data.end_date || data.internship_end || ''
                        };

                        setProfile((prev) => ({ ...prev, user: normalizedProfile }));
                        localStorage.setItem('user_profile', JSON.stringify(normalizedProfile));
                        setIsEditOpen(false);
                        
                        // Emit event for header tracking
                        window.dispatchEvent(new Event('profile-photo-updated'));

                        // Refetch local secure photos
                        setPhotoLoading(true);
                        const newPhotoUrl = await fetchSecureBlob('/profile/photo');
                        if (newPhotoUrl) {
                            setSecurePhotoUrl(prev => {
                                if (prev) URL.revokeObjectURL(prev);
                                return newPhotoUrl;
                            });
                        }
                        setPhotoLoading(false);

                        // Refetch local secure KTM
                        setKtmLoading(true);
                        const newKtmUrl = await fetchSecureBlob('/profile/ktm');
                        if (newKtmUrl) {
                            setSecureKtmUrl(prev => {
                                if (prev) URL.revokeObjectURL(prev);
                                return newKtmUrl;
                            });
                        }
                        setKtmLoading(false);

                        // Refetch local secure Bank Proof
                        setBankProofLoading(true);
                        let newBankUrl = await fetchSecureBlob('/profile/bank-proof');
                        if (!newBankUrl) newBankUrl = await fetchSecureBlob('/profile/bank_proof');
                        if (newBankUrl) {
                            setSecureBankProofUrl((prev) => {
                                if (prev) URL.revokeObjectURL(prev);
                                return newBankUrl;
                            });
                        } else {
                            setSecureBankProofUrl(null);
                        }
                        setBankProofLoading(false);

                    } catch (error) {
                        console.error(error);
                        const detailErrors = error?.response?.data?.errors;
                        const firstDetail = detailErrors && typeof detailErrors === 'object'
                            ? Object.values(detailErrors).flat().find(Boolean)
                            : null;
                        const safeMsg = firstDetail || getSafeErrorMessage(error, 'Failed to update profile.');
                        setErrorMessage(safeMsg);
                        setIsErrorOpen(true);
                    } finally {
                        setIsSavingProfile(false);
                        // Refresh secure previews if needed (usually auto-handled by re-render/re-mount or we can trigger a refetch if keys change)
                    }
                }}
            />

            {/* --- MODAL SUCCESS (Custom - Updated) --- */}
            <AnimatePresence>
                {isSuccessOpen && (
                    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
                        <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-8 text-center animate-bounce-in relative">

                            {/* Icon Check */}
                            <div className="w-24 h-24 bg-[#E8F8EA] rounded-full flex items-center justify-center mx-auto mb-6">
                                <Check className="text-[#4CD964]" size={48} strokeWidth={3.5} />
                            </div>

                            <h3 className="text-2xl font-bold text-[#27345A] mb-2">Password Changed!</h3>
                            <p className="text-slate-500 text-sm mb-8">
                                Your password has been successfully updated.
                            </p>
                           <button
                                onClick={() => { setIsSuccessOpen(false); window.location.href = '/login'; }}
                                className="w-full bg-[#4CD964] hover:bg-[#42BD56] text-white py-3.5 rounded-xl font-bold text-sm shadow-lg shadow-green-100 transition-all active:scale-95 flex items-center justify-center"
                            >
                                OK
                            </button>
                        </div>
                    </div>
                )}
            </AnimatePresence>


    {/* Error Modal (AnimatePresence) */}
            <AnimatePresence>
                {isErrorOpen && (
                    <div
                        className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
                        onClick={() => setIsErrorOpen(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            onClick={(e) => e.stopPropagation()}
                            className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-8 text-center relative"
                        >
                            <button
                                aria-label="Close"
                                onClick={() => setIsErrorOpen(false)}
                                className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"
                            >
                                <X size={20} />
                            </button>

                            <div className="w-24 h-24 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6">
                                <AlertTriangle className="text-red-500" size={48} strokeWidth={2.5} />
                            </div>
                            <h3 className="text-2xl font-bold text-[#27345A] mb-2">Failed!</h3>
                            <p className="text-slate-500 text-sm mb-8">{errorMessage}</p>
                            <button
                                onClick={() => setIsErrorOpen(false)}
                                className="w-full bg-[#354C8F] hover:bg-[#232E4D] text-white py-3.5 rounded-xl font-bold text-lg shadow-lg transition-all active:scale-95"
                            >
                                OK
                            </button>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* --- IMAGE PREVIEW MODAL --- */}
            <AnimatePresence>
                {showImagePreview && previewImageUrl && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
                        onClick={() => setShowImagePreview(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.9 }}
                            animate={{ scale: 1 }}
                            exit={{ scale: 0.9 }}
                            className="relative max-w-4xl max-h-[90vh]"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <button
                                onClick={() => setShowImagePreview(false)}
                                className="absolute -top-12 right-0 text-white hover:text-slate-300 transition-colors"
                            >
                                <X size={32} />
                            </button>
                            <img
                                src={previewImageUrl}
                                alt="Preview"
                                className="max-w-full max-h-[85vh] object-contain rounded-xl shadow-2xl"
                            />
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
            
        </>
    );
}

// --- SUB-COMPONENT: MODAL FORM (Updated) ---
function ChangePasswordModal({ isOpen, onClose, onSuccess, onError }) {
    const [formData, setFormData] = useState({
        current_password: '',
        new_password: '',
        new_password_confirmation: ''
    });
    const [loading, setLoading] = useState(false);

    // 1. Logic Validasi Password
    const validations = [
        { label: "Minimal 8 Characters", valid: formData.new_password.length >= 8 },
        { label: "Minimal 1 Capital Letter [A-Z]", valid: /[A-Z]/.test(formData.new_password) },
        { label: "Minimal 1 Number [0-9]", valid: /[0-9]/.test(formData.new_password) },
    ];
    const isAllValid = validations.every((v) => v.valid);

    // 2. Logic Cek Kesamaan Password (Real-time)
    const isMismatch = formData.new_password_confirmation.length > 0 &&
        formData.new_password !== formData.new_password_confirmation;

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

        if (!isAllValid) return;
        if (isMismatch) return; // Block submit jika tidak match

        setLoading(true);

        try {
            // Simulasi API Call
            const payload = {
                current_password: formData.current_password,
                new_password: formData.new_password,
                new_password_confirmation: formData.new_password_confirmation
            }

            const response = await apiClient.post('/change-password', payload);

            if (response.data.success) {
                onClose();
                onSuccess();
                return;
            } else if(response.data.message === "Current password salah."){
                onError("Current password is incorrect.");
                return;
            }else{
                const safeMsg = getSafeErrorMessage({ response: { data: response.data } }, 'Failed to update password.');
                onError(safeMsg);
                return;
            }
        } catch (error) {
            console.error(error);
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
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
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
                        transition={{ type: "spring", duration: 0.3 }}
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
                                            {item.valid ? (
                                                <Check size={18} strokeWidth={2.5} className="text-[#16A34A]" />
                                            ) : (
                                                <div className="w-[18px] h-[18px] rounded-full border-2 border-slate-300 shrink-0" />
                                            )}
                                            {item.label}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Input Confirmation dengan Error Handling */}
                            <PasswordInput
                                label="Confirmation Password"
                                name="new_password_confirmation"
                                value={formData.new_password_confirmation}
                                onChange={handleChange}
                                placeholder="****************"
                                error={isMismatch ? "Passwords do not match" : null}
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
                                    onClick={handleSubmit}
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

// --- SUB-COMPONENT: INPUT PASSWORD (Fixed Double Icon) ---
function PasswordInput({ label, name, value, onChange, placeholder, error }) {
    const [show, setShow] = useState(false);

    return (
        <div className="space-y-1.5">
            {/* CSS Hack untuk menyembunyikan ikon mata bawaan Edge/IE */}
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

            {/* Pesan Error di Bawah Input */}
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

// --- SUB-COMPONENT: EDIT PROFILE MODAL ---
function EditProfileModal({ isOpen, onClose, onSave, user, isSaving }) {
    const [formData, setFormData] = useState({});
    const [photoPreview, setPhotoPreview] = useState('');
    const [ktmPreview, setKtmPreview] = useState('');
    const [bankProofPreview, setBankProofPreview] = useState('');
    const [photoLoading, setPhotoLoading] = useState(false);
    const [ktmLoading, setKtmLoading] = useState(false);
    const [bankProofLoading, setBankProofLoading] = useState(false);
    const [uploadErrors, setUploadErrors] = useState({ foto: '', foto_ktm: '', bank_proof: '' });
    const [validationErrors, setValidationErrors] = useState({});
    const [fieldWarnings, setFieldWarnings] = useState({});
    const MAX_UPLOAD_SIZE = 5 * 1024 * 1024; // 5MB
    const ALLOWED_FILE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];
    const ALLOWED_FILE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp', 'svg'];

    const resolveLocalImageUrl = (value) => {
        if (!value) return '';
        const val = String(value || '');
        if (val.startsWith('data:') || val.startsWith('blob:')) return val;

        const apiBase = String(import.meta.env.VITE_API_BASE_URL || '').replace(/\/+$/, '');
        let apiOrigin = '';
        try {
            if (apiBase.startsWith('http')) apiOrigin = new URL(apiBase).origin;
        } catch (e) { }

        if (val.startsWith('http')) {
            try {
                const parsed = new URL(val);
                if (
                    apiOrigin &&
                    parsed.origin === window.location.origin &&
                    (parsed.pathname.startsWith('/api/') || parsed.pathname.startsWith('/storage/'))
                ) {
                    return `${apiOrigin}${parsed.pathname}${parsed.search || ''}`;
                }
            } catch (e) { }
            return val;
        }

        if (val.startsWith('/')) {
            if (apiOrigin && (val.startsWith('/api/') || val.startsWith('/storage/'))) return `${apiOrigin}${val}`;
            return val;
        }

        if (!apiBase) return val;
        return `${apiBase}/${val.replace(/^\/+/, '')}`;
    };

    // Fetch secure photos when modal opens
    useEffect(() => {
        if (!isOpen) return;

        let photoBlobUrl = null;
        let ktmBlobUrl = null;
        let bankProofBlobUrl = null;
        
        const initial = {
            nama_lengkap: user?.nama_lengkap || '',
            nik: user?.nik || '', // Added NIK
            identifier: user?.identifier || '',
            email: user?.email || '',
            no_telp: user?.no_telp || '',
            gender: translateGender(user?.gender) || '',
            universitas: user?.universitas || '',
            jurusan: user?.jurusan || '',
            jenjang_pendidikan: user?.jenjang_pendidikan || '',
            tempat_lahir: user?.tempat_lahir || '',
            tanggal_lahir: user?.tanggal_lahir || '',
            alamat: user?.alamat || '',
            nama_kontak_darurat: user?.nama_kontak_darurat || '',
            nomor_darurat: user?.nomor_darurat || '',
            semester: user?.semester || '',
            // Bank fields
            bank_name: user?.bank_name || '',
            account_holder: user?.account_holder || '',
            account_number: user?.account_number || user?.no_rekening || ''
        };
        setFormData(initial);
        setValidationErrors({});
        setFieldWarnings({});
        setUploadErrors({ foto: '', foto_ktm: '', bank_proof: '' });
        const fallbackBankProofUrl = resolveLocalImageUrl(
            user?.bank_proof ||
            user?.bank_proof_photo ||
            user?.foto_rekening ||
            user?.foto_buku_rekening ||
            user?.bukti_rekening ||
            user?.mbanking_photo ||
            user?.m_banking_photo ||
            ''
        );
        setBankProofPreview(fallbackBankProofUrl);

        // Fetch secure photo
        const fetchSecurePhoto = async () => {
            setPhotoLoading(true);
            const url = await fetchSecureBlob('/profile/photo');
            if (url) {
                photoBlobUrl = url;
                setPhotoPreview(url);
            } else {
                setPhotoPreview('');
            }
            setPhotoLoading(false);
        };

        // Fetch secure KTM
        const fetchSecureKtm = async () => {
            setKtmLoading(true);
            const url = await fetchSecureBlob('/profile/ktm');
            if (url) {
                ktmBlobUrl = url;
                setKtmPreview(url);
            } else {
                setKtmPreview('');
            }
            setKtmLoading(false);
        };

        // Fetch secure Bank Proof
        const fetchSecureBankProof = async () => {
            setBankProofLoading(true);
            let url = await fetchSecureBlob('/profile/bank-proof');
            if (!url) url = await fetchSecureBlob('/profile/bank_proof');
            if (url) {
                bankProofBlobUrl = url;
                setBankProofPreview(url);
            } else {
                setBankProofPreview(fallbackBankProofUrl || '');
            }
            setBankProofLoading(false);
        };

        fetchSecurePhoto();
        fetchSecureKtm();
        fetchSecureBankProof();

        return () => {
            // Cleanup blob URLs on unmount
            if (photoBlobUrl) URL.revokeObjectURL(photoBlobUrl);
            if (ktmBlobUrl) URL.revokeObjectURL(ktmBlobUrl);
            if (bankProofBlobUrl) URL.revokeObjectURL(bankProofBlobUrl);
        };
    }, [isOpen, user]);

    const sanitizeAlphaNumSpace = (value) => String(value || '').replace(/[^A-Za-z0-9\s]/g, '');
    const sanitizeDigits = (value) => String(value || '').replace(/\D/g, '');

    const handleChange = (e) => {
        const { name, value } = e.target;
        const alphaNumericWithSpaceFields = new Set([
            'nama_lengkap',
            'universitas',
            'jurusan',
            'tempat_lahir',
            'nama_kontak_darurat',
            'bank_name',
            'account_holder'
        ]);
        const numericOnlyFields = new Set([
            'nik',
            'identifier',
            'no_telp',
            'nomor_darurat',
            'semester',
            'account_number'
        ]);

        let sanitizedValue = value;

        if (alphaNumericWithSpaceFields.has(name)) {
            sanitizedValue = sanitizeAlphaNumSpace(value);
            if (sanitizedValue !== value) {
                setFieldWarnings((prev) => ({
                    ...prev,
                    [name]: 'Special characters are removed automatically.'
                }));
            } else {
                setFieldWarnings((prev) => ({ ...prev, [name]: '' }));
            }
        }

        if (numericOnlyFields.has(name)) {
            sanitizedValue = sanitizeDigits(value);
            if (sanitizedValue !== value) {
                setFieldWarnings((prev) => ({
                    ...prev,
                    [name]: 'Only numbers are allowed. Non-digit characters were removed.'
                }));
            } else {
                setFieldWarnings((prev) => ({ ...prev, [name]: '' }));
            }
        }

        setValidationErrors((prev) => ({ ...prev, [name]: '' }));
        setFormData((prev) => ({ ...prev, [name]: sanitizedValue }));
    };

    const handleFileChange = (e, field) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const ext = (file.name?.split('.').pop() || '').toLowerCase();
        const isAllowedType = ALLOWED_FILE_TYPES.includes(file.type) || ALLOWED_FILE_EXTENSIONS.includes(ext);
        if (!isAllowedType) {
            const fieldLabel = field === 'foto' ? 'Photo' : field === 'foto_ktm' ? 'Student ID (KTM)' : 'Bank Book / M-Banking Photo';
            setUploadErrors((prev) => ({
                ...prev,
                [field]: `${fieldLabel} must be PNG, JPG, JPEG, WEBP, or SVG (PDF/Word are not allowed).`
            }));
            e.target.value = '';
            return;
        }

        if (file.size > MAX_UPLOAD_SIZE) {
            const fieldLabel = field === 'foto' ? 'Photo' : field === 'foto_ktm' ? 'Student ID (KTM)' : 'Bank Book / M-Banking Photo';
            setUploadErrors((prev) => ({
                ...prev,
                [field]: `${fieldLabel} must be under 5MB.`
            }));
            e.target.value = '';
            return;
        }

        setUploadErrors((prev) => ({ ...prev, [field]: '' }));

        const reader = new FileReader();
        reader.onloadend = () => {
            if (field === 'foto') {
                setPhotoPreview(reader.result);
                setFormData((prev) => ({ ...prev, fotoFile: file }));
            } else if (field === 'foto_ktm') {
                setKtmPreview(reader.result);
                setFormData((prev) => ({ ...prev, fotoKtmFile: file }));
            } else {
                setBankProofPreview(reader.result);
                setFormData((prev) => ({ ...prev, bankProofFile: file }));
            }
        };
        reader.readAsDataURL(file);
    };

    const handleSubmit = (e) => {
        e.preventDefault();

        const hasValidationError = Object.values(validationErrors).some(Boolean);
        const hasUploadError = Object.values(uploadErrors).some(Boolean);
        if (hasValidationError || hasUploadError) return;
        
        // Use all formData fields as payload, but remove file objects if present
        const payload = { ...formData };
        
        // Normalize gender back to L/P for backend
        if (payload.gender === 'Laki-laki') payload.gender = 'L';
        else if (payload.gender === 'Perempuan') payload.gender = 'P';

        // Add alias for jenjang if backend expects 'jenjang'
        if (payload.jenjang_pendidikan) {
            payload.jenjang = payload.jenjang_pendidikan;
        }

        // Bank aliases: normalize multiple possible backend fields so we always submit common names
        const bankNameVal = payload.bank_name || payload.nama_bank || payload.bank || '';
        const accountHolderVal = payload.account_holder || payload.bank_account_name || payload.nama_pemegang_rekening || payload.account_holder || '';
        const accountNumberVal = payload.account_number || payload.bank_account_number || payload.no_rekening || payload.account_number || '';

        payload.bank_name = bankNameVal;
        payload.nama_bank = payload.nama_bank || bankNameVal;

        payload.account_holder = accountHolderVal;
        payload.bank_account_name = payload.bank_account_name || accountHolderVal;
        payload.nama_pemegang_rekening = payload.nama_pemegang_rekening || accountHolderVal;

        payload.account_number = accountNumberVal;
        payload.bank_account_number = payload.bank_account_number || accountNumberVal;
        payload.no_rekening = payload.no_rekening || accountNumberVal;

        // Final sanitize guard before submit
        payload.nama_lengkap = sanitizeAlphaNumSpace(payload.nama_lengkap);
        payload.universitas = sanitizeAlphaNumSpace(payload.universitas);
        payload.jurusan = sanitizeAlphaNumSpace(payload.jurusan);
        payload.tempat_lahir = sanitizeAlphaNumSpace(payload.tempat_lahir);
        payload.nama_kontak_darurat = sanitizeAlphaNumSpace(payload.nama_kontak_darurat);
        payload.bank_name = sanitizeAlphaNumSpace(payload.bank_name);
        payload.account_holder = sanitizeAlphaNumSpace(payload.account_holder);

        payload.nik = sanitizeDigits(payload.nik);
        payload.identifier = sanitizeDigits(payload.identifier);
        payload.no_telp = sanitizeDigits(payload.no_telp);
        payload.nomor_darurat = sanitizeDigits(payload.nomor_darurat);
        payload.semester = sanitizeDigits(payload.semester);
        payload.account_number = sanitizeDigits(payload.account_number);
        payload.bank_account_number = sanitizeDigits(payload.bank_account_number);
        payload.no_rekening = sanitizeDigits(payload.no_rekening);

        delete payload.fotoFile;
        delete payload.fotoKtmFile;
        delete payload.bankProofFile;

        const hasFiles = Boolean(formData.fotoFile || formData.fotoKtmFile || formData.bankProofFile);
        onSave(formData, payload, hasFiles);
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
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
                        transition={{ type: "spring", duration: 0.3 }}
                        className="relative bg-white rounded-[24px] w-full max-w-2xl shadow-2xl z-10 max-h-[90vh] flex flex-col overflow-hidden"
                    >
                        {/* Sticky Header */}
                        <div className="flex justify-between items-center p-6 border-b border-slate-100 bg-white sticky top-0 z-20">
                            <h2 className="text-xl font-bold text-[#232E4D]">Edit Profile</h2>
                            <button onClick={onClose} className="text-slate-400 hover:text-slate-800 transition-colors">
                                <X size={28} strokeWidth={2.5} />
                            </button>
                        </div>

                        {/* Scrollable Content */}
                        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                            <form id="edit-profile-form" onSubmit={handleSubmit} className="space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <InputField label="Full Name" name="nama_lengkap" value={formData.nama_lengkap || ''} onChange={handleChange} required />
                                    <InputField label="NIK" name="nik" value={formData.nik || ''} onChange={handleChange} error={validationErrors.nik} warning={fieldWarnings.nik} />
                                    <InputField label="Student ID" name="identifier" value={formData.identifier || ''} onChange={handleChange} required error={validationErrors.identifier} warning={fieldWarnings.identifier} />
                                    <InputField label="Email" name="email" value={formData.email || ''} onChange={handleChange} type="email" />
                                    <InputField label="Phone" name="no_telp" value={formData.no_telp || ''} onChange={handleChange} error={validationErrors.no_telp} warning={fieldWarnings.no_telp} />
                                    
                                    {/* Gender Dropdown */}
                                    <div>
                                        <label className="block text-sm font-bold text-slate-800 mb-2">Gender</label>
                                        <div className="relative">
                                            <select
                                                name="gender"
                                                value={formData.gender || ''}
                                                onChange={handleChange}
                                                className="w-full px-4 py-3.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:border-[#354C8F] transition-colors appearance-none bg-white cursor-pointer"
                                            >
                                                <option value="" disabled>Select Gender</option>
                                                <option value="Laki-laki">Laki-laki</option>
                                                <option value="Perempuan">Perempuan</option>
                                            </select>
                                            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">
                                                <ChevronDown size={16} />
                                            </div>
                                        </div>
                                    </div>

                                    <InputField label="Institution" name="universitas" value={formData.universitas || ''} onChange={handleChange} error={validationErrors.universitas} warning={fieldWarnings.universitas} />
                                    <InputField label="Study Program" name="jurusan" value={formData.jurusan || ''} onChange={handleChange} error={validationErrors.jurusan} warning={fieldWarnings.jurusan} />
                                    <InputField label="Semester" name="semester" value={formData.semester || ''} onChange={handleChange} error={validationErrors.semester} warning={fieldWarnings.semester} />
                                    
                                    {/* Education Level Dropdown */}
                                    <div>
                                        <label className="block text-sm font-bold text-slate-800 mb-2">Education Level</label>
                                        <div className="relative">
                                            <select
                                                name="jenjang_pendidikan"
                                                value={formData.jenjang_pendidikan || ''}
                                                onChange={handleChange}
                                                className="w-full px-4 py-3.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:border-[#354C8F] transition-colors appearance-none bg-white cursor-pointer"
                                            >
                                                <option value="" disabled>Select Level</option>
                                                <option value="SMA/SMK">SMA/SMK</option>
                                                <option value="D1">D1</option>
                                                <option value="D2">D2</option>
                                                <option value="D3">D3</option>
                                                <option value="D4">D4</option>
                                                <option value="S1">S1</option>
                                                <option value="S2">S2</option>
                                                <option value="S3">S3</option>
                                            </select>
                                            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">
                                                <ChevronDown size={16} />
                                            </div>
                                        </div>
                                    </div>

                                    <InputField label="Place of Birth" name="tempat_lahir" value={formData.tempat_lahir || ''} onChange={handleChange} error={validationErrors.tempat_lahir} warning={fieldWarnings.tempat_lahir} />
                                    <InputField label="Date of Birth" name="tanggal_lahir" value={formData.tanggal_lahir || ''} onChange={handleChange} type="date" />
                                </div>

                                <div>
                                    <label className="block text-sm font-bold text-slate-800 mb-2">Address</label>
                                    <textarea
                                        name="alamat"
                                        value={formData.alamat || ''}
                                        onChange={handleChange}
                                        rows={3}
                                        className="w-full px-4 py-3 rounded-xl border border-slate-300 text-sm focus:outline-none focus:border-[#354C8F] transition-colors"
                                    />
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <InputField label="Emergency Contact Name" name="nama_kontak_darurat" value={formData.nama_kontak_darurat || ''} onChange={handleChange} error={validationErrors.nama_kontak_darurat} warning={fieldWarnings.nama_kontak_darurat} />
                                    <InputField label="Emergency Contact Number" name="nomor_darurat" value={formData.nomor_darurat || ''} onChange={handleChange} error={validationErrors.nomor_darurat} warning={fieldWarnings.nomor_darurat} />
                                </div>

                                {/* Bank Details Inputs */}
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                                    <InputField label="Bank Name" name="bank_name" value={formData.bank_name || ''} onChange={handleChange} error={validationErrors.bank_name} warning={fieldWarnings.bank_name} />
                                    <InputField label="Account Holder" name="account_holder" value={formData.account_holder || ''} onChange={handleChange} error={validationErrors.account_holder} warning={fieldWarnings.account_holder} />
                                    <InputField label="Account Number" name="account_number" value={formData.account_number || ''} onChange={handleChange} error={validationErrors.account_number} warning={fieldWarnings.account_number} />
                                </div>

                                <div>
                                    <label className="block text-sm font-bold text-slate-800 mb-2">Bank Book / M-Banking Photo</label>
                                    <p className="text-[11px] text-slate-500 mb-2">Upload foto yang menampilkan nama pemilik dan nomor rekening. Max file size: 5MB</p>
                                    <div className="w-full border border-dashed border-slate-300 rounded-xl p-4 text-center group cursor-pointer hover:bg-slate-50 transition-colors relative">
                                        <label className="cursor-pointer block">
                                            {bankProofLoading ? (
                                                <div className="w-24 h-24 rounded-lg bg-slate-100 mx-auto mb-3 flex items-center justify-center">
                                                    <div className="w-6 h-6 border-2 border-slate-300 border-t-[#354C8F] rounded-full animate-spin" />
                                                </div>
                                            ) : bankProofPreview ? (
                                                <div className="relative w-24 h-24 mx-auto mb-3">
                                                    <img src={bankProofPreview} alt="Bank proof preview" className="w-24 h-24 rounded-lg object-cover" />
                                                    <div className="absolute -bottom-2 -right-2 bg-[#354C8F] text-white p-1.5 rounded-full shadow-md hover:bg-[#2a3c70] transition-colors">
                                                        <Upload size={14} />
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="w-24 h-24 rounded-lg bg-slate-100 mx-auto mb-3 flex items-center justify-center text-slate-400">
                                                    <Upload size={24} />
                                                </div>
                                            )}
                                            <input type="file" accept=".png,.jpg,.jpeg,.webp,.svg,image/png,image/jpeg,image/webp,image/svg+xml" className="hidden" onChange={(e) => handleFileChange(e, 'bank_proof')} />
                                            {!bankProofPreview && <span className="text-xs font-bold text-[#354C8F]">Select File</span>}
                                        </label>
                                    </div>
                                    {uploadErrors.bank_proof && (
                                        <div className="mt-2 flex items-center gap-1.5 text-xs text-red-600 font-semibold">
                                            <AlertTriangle size={14} />
                                            <span>{uploadErrors.bank_proof}</span>
                                        </div>
                                    )}
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-bold text-slate-800 mb-2">Photo</label>
                                        <p className="text-[11px] text-slate-500 mb-2">Max file size: 5MB</p>
                                        <div className="border border-dashed border-slate-300 rounded-xl p-4 text-center group cursor-pointer hover:bg-slate-50 transition-colors relative">
                                            <label className="cursor-pointer block">
                                                {photoLoading ? (
                                                    <div className="w-24 h-24 rounded-full bg-slate-100 mx-auto mb-3 flex items-center justify-center">
                                                        <div className="w-6 h-6 border-2 border-slate-300 border-t-[#354C8F] rounded-full animate-spin" />
                                                    </div>
                                                ) : photoPreview ? (
                                                    <div className="relative w-24 h-24 mx-auto mb-3">
                                                        <img src={photoPreview} alt="Photo preview" className="w-24 h-24 rounded-full object-cover" />
                                                        <div className="absolute bottom-0 right-0 bg-[#354C8F] text-white p-1.5 rounded-full shadow-md hover:bg-[#2a3c70] transition-colors">
                                                            <Camera size={14} />
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="w-24 h-24 rounded-full bg-slate-100 mx-auto mb-3 flex items-center justify-center text-slate-400">
                                                        <Camera size={24} />
                                                    </div>
                                                )}
                                                <input type="file" accept=".png,.jpg,.jpeg,.webp,.svg,image/png,image/jpeg,image/webp,image/svg+xml" className="hidden" onChange={(e) => handleFileChange(e, 'foto')} />
                                                {!photoPreview && <span className="text-xs font-bold text-[#354C8F]">Select Photo</span>}
                                            </label>
                                        </div>
                                        {uploadErrors.foto && (
                                            <div className="mt-2 flex items-center gap-1.5 text-xs text-red-600 font-semibold">
                                                <AlertTriangle size={14} />
                                                <span>{uploadErrors.foto}</span>
                                            </div>
                                        )}
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-slate-800 mb-2">Student ID (KTM)</label>
                                        <p className="text-[11px] text-slate-500 mb-2">Max file size: 5MB</p>
                                        <div className="border border-dashed border-slate-300 rounded-xl p-4 text-center group cursor-pointer hover:bg-slate-50 transition-colors relative">
                                            <label className="cursor-pointer block">
                                                {ktmLoading ? (
                                                    <div className="w-24 h-24 rounded-lg bg-slate-100 mx-auto mb-3 flex items-center justify-center">
                                                        <div className="w-6 h-6 border-2 border-slate-300 border-t-[#354C8F] rounded-full animate-spin" />
                                                    </div>
                                                ) : ktmPreview ? (
                                                     <div className="relative w-24 h-24 mx-auto mb-3">
                                                        <img src={ktmPreview} alt="Student ID preview" className="w-24 h-24 rounded-lg object-cover" />
                                                        <div className="absolute -bottom-2 -right-2 bg-[#354C8F] text-white p-1.5 rounded-full shadow-md hover:bg-[#2a3c70] transition-colors">
                                                            <Upload size={14} />
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="w-24 h-24 rounded-lg bg-slate-100 mx-auto mb-3 flex items-center justify-center text-slate-400">
                                                        <Upload size={24} />
                                                    </div>
                                                )}
                                                <input type="file" accept=".png,.jpg,.jpeg,.webp,.svg,image/png,image/jpeg,image/webp,image/svg+xml" className="hidden" onChange={(e) => handleFileChange(e, 'foto_ktm')} />
                                                {!ktmPreview && <span className="text-xs font-bold text-[#354C8F]">Select File</span>}
                                            </label>
                                        </div>
                                        {uploadErrors.foto_ktm && (
                                            <div className="mt-2 flex items-center gap-1.5 text-xs text-red-600 font-semibold">
                                                <AlertTriangle size={14} />
                                                <span>{uploadErrors.foto_ktm}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </form>
                        </div>

                        {/* Sticky Footer */}
                        <div className="p-6 border-t border-slate-100 bg-white sticky bottom-0 z-20 flex justify-end gap-3">
                            <button
                                type="button"
                                onClick={onClose}
                                className="px-6 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-bold hover:bg-slate-50 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                form="edit-profile-form"
                                disabled={isSaving || Object.values(uploadErrors).some(Boolean) || Object.values(validationErrors).some(Boolean)}
                                className="px-6 py-2.5 rounded-xl bg-[#354C8F] text-white font-bold hover:bg-[#232E4D] transition-colors shadow-lg shadow-indigo-200 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isSaving ? 'Saving...' : 'Save'}
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}

function InputField({ label, name, value, onChange, type = 'text', required = false, error = '', warning = '' }) {
    return (
        <div>
            <label className="block text-sm font-bold text-slate-800 mb-2">{label}</label>
            <input
                type={type}
                name={name}
                value={value}
                onChange={onChange}
                required={required}
                className="w-full px-4 py-3.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:border-[#354C8F] transition-colors"
            />
            {error && (
                <div className="mt-1.5 flex items-center gap-1.5 text-xs text-red-600 font-semibold">
                    <AlertTriangle size={14} />
                    <span>{error}</span>
                </div>
            )}
            {warning && !error && (
                <div className="mt-1.5 flex items-center gap-1.5 text-xs text-amber-600 font-semibold">
                    <AlertTriangle size={14} />
                    <span>{warning}</span>
                </div>
            )}
        </div>
    );
}