import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Eye, EyeOff, Lock, Check, X, Loader2 } from 'lucide-react';
import bgGedung from '../../assets/backgroundLogin.jpeg';
import logoSier from '../../assets/Logo1.png';
import apiClient from '../../api/axiosConfig';

export default function ResetPassword() {
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const location = useLocation();
    const email = location.state?.email || "your email";

    // State untuk kontrol Modal Success
    const [isSuccessOpen, setIsSuccessOpen] = useState(false);

    const navigate = useNavigate();

    // Validasi Regex
    const validations = [
        { label: "Minimal 8 Characters", valid: password.length >= 8 },
        { label: "Minimal 1 Capital Letter [A-Z]", valid: /[A-Z]/.test(password) },
        { label: "Minimal 1 Number [0-9]", valid: /[0-9]/.test(password) },
    ];

    const isAllValid = validations.every((v) => v.valid) && password === confirmPassword && password !== '';

    const handleReset = async (e) => {
        e.preventDefault();
        setIsLoading(true);

        const payload = {
            email: email,
            password: password,
            confirm_password: confirmPassword,
        }

        try {
            const response = await apiClient.post('/reset-password', payload);
            if (response.data.success) {
                setIsSuccessOpen(true);
            } else {
                alert("Failed to reset password. Please try again.");
            }
        } catch (error) {
            alert(error?.response?.data?.message || "Failed to reset password. Please try again.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex h-screen w-full bg-slate-50 overflow-hidden font-sans relative">
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
            <div className="w-full lg:w-[45%] flex items-center justify-center p-6 bg-white overflow-y-auto">
                <div className="w-full max-w-md py-8">
                    <div className="text-center mb-8">
                        <img src={logoSier} alt="Logo" className="h-20 mx-auto mb-6 object-contain" />
                        <h1 className="text-2xl font-extrabold text-[#27345A]  mb-2">Create New Password</h1>
                        <p className="text-slate-500 text-sm">Create a new, secure password for your account.</p>
                    </div>

                    <form onSubmit={handleReset} className="space-y-5">
                        {/* New Password */}
                        <div>
                            <label className="block text-sm font-bold text-[#27345A] mb-2">New Password</label>
                            <div className="relative group">
                                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-900" size={20} />
                                <input
                                    type={showPassword ? "text" : "password"}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full pl-12 pr-12 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-indigo-100 focus:border-indigo-900 outline-none transition-all font-medium text-slate-700"
                                    placeholder="Enter new password"
                                />
                                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-indigo-600">
                                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                                </button>
                            </div>

                            {/* Validation Checklist */}
                            <div className="mt-3 bg-indigo-50 p-3 rounded-lg border border-indigo-100 space-y-2">
                                {validations.map((item, idx) => (
                                    <div key={idx} className={`flex items-center gap-2 text-xs font-medium ${item.valid ? 'text-green-600' : 'text-slate-400'}`}>
                                        {item.valid ? <Check size={14} /> : <div className="w-3.5 h-3.5 rounded-full border border-slate-300" />}
                                        {item.label}
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Confirm Password */}
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-2">Confirm Password</label>
                            <div className="relative group">
                                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-900" size={20} />
                                <input
                                    type="password"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    className={`w-full pl-12 pr-4 py-3.5 bg-slate-50 border rounded-xl focus:ring-4 outline-none transition-all font-medium text-slate-700 ${confirmPassword && password !== confirmPassword ? 'border-red-300 focus:ring-red-100' : 'border-slate-200 focus:ring-indigo-100 focus:border-indigo-900'}`}
                                    placeholder="Confirm new password"
                                />
                            </div>
                            {confirmPassword && password !== confirmPassword && (
                                <p className="text-red-500 text-xs mt-1 font-medium flex items-center gap-1"><X size={12} /> Passwords do not match</p>
                            )}
                        </div>

                        {/* Submit Button */}
                        <button
                            type="submit"
                            disabled={!isAllValid || isLoading}
                            className="bg-[#354C8F] w-full hover:bg-[#1F2B4D] text-white py-3.5 rounded-xl font-bold text-lg shadow-lg shadow-indigo-200 flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
                        >
                            {isLoading ? <Loader2 className="animate-spin" /> : "Reset Password"}
                        </button>
                    </form>
                </div>
            </div>
            {/* --- SUCCESS MODAL --- */}

            {isSuccessOpen && (
                <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-8 text-center animate-bounce-in relative">

                        {/* Icon Check */}
                        <div className="w-24 h-24 bg-[#E8F8EA] rounded-full flex items-center justify-center mx-auto mb-6">
                            <Check className="text-[#4CD964]" size={48} strokeWidth={3.5} />
                        </div>

                        <h3 className="text-2xl font-bold text-[#27345A] mb-2">Password Reset!</h3>
                        <p className="text-slate-500 text-sm mb-8">
                            Your password has been successfully updated. Please login with your new password.
                        </p>
                        <button
                            onClick={() => navigate('/login')}
                            className="w-full bg-[#4CD964] hover:bg-[#42BD56] text-white py-3.5 rounded-xl font-bold text-sm shadow-lg shadow-green-100 transition-all active:scale-95 flex items-center justify-center"
                        >
                            OK
                        </button>
                    </div>
                </div>
            )}

        </div>
    );
}