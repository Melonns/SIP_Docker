import axios from 'axios';
import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Eye, EyeOff, Lock, User, Loader2, CheckCircle2, X } from 'lucide-react'; // Tambah CheckCircle2

// Pastikan path assets benar
import bgGedung from '../../assets/backgroundLogin.jpeg';
import logoSier from "../../assets/Logo1.png";
import { getSafeErrorMessage, logError } from '../../utils/errorHandler';

export default function Login() {
    const [identifier, setIdentifier] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');



    // State untuk Toast
    const [showLogoutSuccess, setShowLogoutSuccess] = useState(false);

    const navigate = useNavigate();
    const location = useLocation();

    // --- 1. CEK STATUS LOGOUT & TOKEN SSO (LOGIC URL) ---
    useEffect(() => {
        if (location.state?.loggedOut) {
            setShowLogoutSuccess(true);
            window.history.replaceState({}, document.title);

            // Timer: Hilang otomatis setelah 3 detik
            const timer = setTimeout(() => setShowLogoutSuccess(false), 3000);
            return () => clearTimeout(timer);
        }

        const queryParams = new URLSearchParams(location.search);

        // Cek jika ada error dari SSO redirect
        const ssoError = queryParams.get('sso_error');
        if (ssoError) {
            setError(ssoError);
            // Bersihkan URL params
            window.history.replaceState({}, document.title, '/login');
            return;
        }

        // Cek jika ada sanctum_token dari backend SSO redirect
        const sanctumToken = queryParams.get('sanctum_token');
        if (sanctumToken) {
            // Bersihkan URL params supaya token tidak terlihat di address bar
            window.history.replaceState({}, document.title, '/login');
            processSsoToken(sanctumToken);
        }
    }, [location]);

    // --- 2. FUNGSI HANDLE SUCCESS LOGIN ---
    const handleLoginSuccess = (token, data) => {
        // 1. Simpan Token
        localStorage.setItem("token", token);

        // 2. Simpan Data User
        localStorage.setItem("nama_lengkap", data.user?.nama || "User");
        if (data.user?.foto) localStorage.setItem("foto", data.user.foto);

        localStorage.setItem("user_profile", JSON.stringify(data.user));

        // 2a. Simpan must_change_password flag
        if (data.user?.must_change_password) {
            localStorage.setItem("must_change_password", "true");
        } else {
            localStorage.removeItem("must_change_password");
        }

        // 2b. Simpan permissions jika backend mengirimkannya
        // New BE: permissions[] is a flat array of permission names from /api/user
        const permissionNames = data?.permissions || data?.user?.permissions || [];
        if (Array.isArray(permissionNames)) {
            localStorage.setItem("permissions", JSON.stringify(permissionNames));
        }

        // Legacy: keep granted_permissions for backward compatibility
        const grantedPermissions = data?.granted_permissions || data?.user?.granted_permissions || permissionNames;
        if (Array.isArray(grantedPermissions)) {
            localStorage.setItem("granted_permissions", JSON.stringify(grantedPermissions));
        }

        // 3. Logic Penentuan Role
        let targetRole = "intern";
        let rolesToSave = ["intern"];

        if (data.roles && Array.isArray(data.roles) && data.roles.length > 0) {
            targetRole = String(data.roles[0]).toLowerCase().trim();
            rolesToSave = data.roles;
        }

        // 4. Simpan ke LocalStorage
        localStorage.setItem("role", targetRole);
        localStorage.setItem("active_role", targetRole);
        localStorage.setItem("roles", JSON.stringify(rolesToSave));

        // 5. REDIRECT
        if (targetRole === 'admin') {
            navigate('/admin/dashboard', { replace: true });
        } else if (targetRole === 'mentor') {
            navigate('/mentor/dashboard', { replace: true });
        } else {
            navigate('/magang/dashboard', { replace: true });
        }
    };

    // --- 3. PROSES SANCTUM TOKEN DARI SSO REDIRECT ---
    const processSsoToken = async (sanctumToken) => {
        setIsLoading(true);
        setError('');
        try {
            const apiUrl = import.meta.env.VITE_API_BASE_URL;
            // Token sudah valid (Sanctum), simpan dulu lalu ambil data user
            const response = await axios.get(`${apiUrl}/user`, {
                headers: { Authorization: `Bearer ${sanctumToken}` }
            });
            const data = response.data;

            if (data.success) {
                handleLoginSuccess(sanctumToken, data);
            } else {
                setError(getSafeErrorMessage({ response: { data } }, "Gagal mengambil data user dari SSO."));
            }
        } catch (err) {
            logError('handleSSOTokenCheck', err);
            setError(getSafeErrorMessage(err, "Gagal memproses login SSO."));
        } finally {
            setIsLoading(false);
        }
    };

    // --- 4. HANDLE SUBMIT LOGIN (API CHECK) ---

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        try {
            const apiUrl = import.meta.env.VITE_API_BASE_URL;
            const payload = identifier.trim().includes('@')
                ? { email: identifier.trim(), password: password }
                : { usercode: identifier.trim(), password: password };

            // 1. Try Logic Login Ke SIP DB (Intern/Other/Karyawan)
            const response = await axios.post(`${apiUrl}/login`, payload);
            const data = response.data;

            if (data.success) {
                handleLoginSuccess(data.token, data);
            } else {
                const safeMsg = data.message ? getSafeErrorMessage({ response: { data } }, "Login gagal. Periksa email/Usercode atau password.") : "Login gagal. Periksa email/Usercode atau password.";
                setError(safeMsg);
                setIsLoading(false); // Stop loading di sini
            }

        } catch (err) {
            logError('handleSubmit', err);
            if (err.response) {
                setError(getSafeErrorMessage(err, "Email/Usercode atau password salah."));
            } else if (err.request) {
                setError("Tidak dapat terhubung ke server. Periksa koneksi internet.");
            } else {
                setError("Terjadi kesalahan sistem.");
            }
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex h-screen w-full bg-slate-50 overflow-hidden font-sans">

            {/* Animate-in slide-in-from-top supaya munculnya meluncur dari atas */}
            {showLogoutSuccess && (
                <div className="fixed top-6 right-6 z-[100] animate-in slide-in-from-right duration-300">
                    <div className="bg-white border-l-4 border-green-500 shadow-lg rounded-lg p-4 flex items-start gap-3 min-w-[300px]">

                        {/* Icon */}
                        <div className="text-green-500 mt-0.5">
                            <CheckCircle2 size={24} />
                        </div>

                        {/* Content */}
                        <div className="flex-1">
                            <h3 className="text-sm font-bold text-slate-800">Success</h3>
                            <p className="text-xs text-slate-500 mt-1">
                                You have successfully logged out.
                            </p>
                        </div>

                        {/* Close Button (Optional) */}
                        <button
                            onClick={() => setShowLogoutSuccess(false)}
                            className="text-slate-400 hover:text-slate-600 transition-colors"
                        >
                            < X size={16} />
                        </button>
                    </div>
                </div>
            )}
            {/* --- END TOAST --- */}

            {/* Bagian Kiri (Gambar) */}
            <div className="hidden lg:flex lg:w-[55%] relative bg-[#27345A] overflow-hidden">
                <img src={bgGedung} alt="PT SIER Building" className="absolute inset-0 w-full h-full object-cover opacity-40 scale-105" />
                <div className="absolute inset-0 bg-gradient-to-t from-[#27345A]/100 via-[#27345A]/10 to-[#27345A]/10"></div>
                <div className="relative z-10 p-16 flex flex-col justify-end h-full text-white">
                    <h2 className="text-4xl lg:text-5xl font-extrabold leading-tight mb-4 tracking-tight">
                        PT Surabaya Industrial Estate Rungkut (SIER)
                    </h2>
                    <p className="text-indigo-100 text-lg max-w-xl leading-relaxed opacity-90 font-medium">
                        Integrated Internship Attendance & Reporting System.
                    </p>
                </div>
            </div>

            {/* Bagian Kanan (Form) */}
            <div className="w-full lg:w-[45%] flex items-center justify-center p-6 sm:p-12 bg-white relative">
                <div className="w-full max-w-md z-10">
                    <div className="text-center mb-8">
                        <img src={logoSier} alt="PT SIER Logo" className="h-20 w-20 mx-auto mb-3 object-contain" />
                        <h1 className="text-3xl font-extrabold text-[#27345A] tracking-tight mb-2">
                            SIER Internship Program
                        </h1>
                        <p className="text-slate-500">Sign in to access your dashboard.</p>
                    </div>

                    {error && (
                        <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 text-red-700 text-sm rounded-r-lg flex items-center gap-3 animate-pulse">
                            <Lock size={18} /> {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div>
                            <label className="block text-sm font-bold text-[#27345A] mb-2">Email atau Usercode</label>
                            <div className="relative group">
                                <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-900 transition-colors" size={20} />
                                <input
                                    type="text"
                                    value={identifier}
                                    onChange={(e) => setIdentifier(e.target.value)}
                                    className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-indigo-100 focus:border-indigo-900 outline-none transition-all font-medium text-slate-700 placeholder:text-slate-400"
                                    placeholder="name@company.com atau usercode"
                                    required
                                />
                            </div>
                        </div>

                        <div>
                            <div className="flex justify-between items-center mb-2">
                                <label className="block text-sm font-bold text-[#27345A]">Password</label>
                                <button type="button" onClick={() => navigate('/auth/forgot-password')} className="text-xs font-bold text-indigo-900 hover:text-indigo-800 hover:underline">
                                    Forgot Password?
                                </button>
                            </div>
                            <div className="relative group">
                                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-900 transition-colors" size={20} />
                                <input
                                    type={showPassword ? "text" : "password"}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full pl-12 pr-12 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-indigo-100 focus:border-indigo-900 outline-none transition-all font-medium text-slate-700 placeholder:text-slate-400"
                                    placeholder="Enter your password"
                                    required
                                />
                                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-indigo-900 transition-colors p-1">
                                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                                </button>
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={isLoading}
                            className="bg-[#354C8F] w-full hover:bg-[#1F2B4D] text-white py-3.5 px-4 rounded-xl active:scale-[0.98] transition-all font-bold text-lg shadow-lg shadow-indigo-200 flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                        >
                            {isLoading ? (<><Loader2 className="animate-spin" size={22} /> Signing In...</>) : ("Sign In")}
                        </button>
                    </form>


                    <div className="mt-8 text-center text-xs text-slate-400">
                        &copy; {new Date().getFullYear()} PT SIER. All rights reserved.
                    </div>
                </div>
            </div>
        </div>
    );
}