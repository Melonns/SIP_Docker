import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Mail, ArrowLeft, Loader2, AlertTriangle, X } from "lucide-react";
import bgGedung from "../../assets/backgroundLogin.jpeg";
import logoSier from "../../assets/Logo1.png";
import apiClient from "../../api/axiosConfig";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const [isErrorOpen, setIsErrorOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setIsErrorOpen(false);
    setErrorMessage("");
    try {
      const response = await apiClient.post("/forgot-password", {
        email: email,
      });
      if (response.data.success) {
        navigate("/auth/otp-verification", { state: { email: email } });
      } else {
        setErrorMessage("Failed to send OTP. Please try again.");
        setIsErrorOpen(true);
      }
    } catch (error) {
      let msg = error?.response?.data?.message || "Terjadi kesalahan server.";
      setErrorMessage(msg);
      setIsErrorOpen(true);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === "Escape" && isErrorOpen) setIsErrorOpen(false);
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [isErrorOpen]);

  return (
    <div className="flex h-screen w-full bg-slate-50 overflow-hidden font-sans">
      {/* Error Modal */}
      {isErrorOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
          onClick={() => setIsErrorOpen(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-8 text-center relative"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              aria-label="Close"
              onClick={() => setIsErrorOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"
            >
              <X size={20} />
            </button>
            <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertTriangle className="text-red-500" size={40} strokeWidth={2.5} />
            </div>
            <h3 className="text-xl font-bold text-[#27345A] mb-2">Failed!</h3>
            <p className="text-slate-500 text-sm mb-8">{errorMessage}</p>
            <button
              onClick={() => setIsErrorOpen(false)}
              className="w-full bg-[#354C8F] hover:bg-[#232E4D] text-white py-3.5 rounded-xl font-bold text-lg shadow-lg transition-all active:scale-95"
            >
              OK
            </button>
          </div>
        </div>
      )}

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
      <div className="w-full lg:w-[45%] flex items-center justify-center p-6 bg-white relative">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <img
              src={logoSier}
              alt="Logo"
              className="h-20 mx-auto mb-6 object-contain"
            />
            <h1 className="text-2xl font-extrabold text-[#27345A] mb-2">
              Forgot Password?
            </h1>
            <p className="text-slate-500 text-sm">
              Enter your registered email to receive an OTP code.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">
                Email Address
              </label>
              <div className="relative group">
                <Mail
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-900"
                  size={20}
                />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-indigo-100 focus:border-indigo-900 outline-none transition-all font-medium text-slate-700"
                  placeholder="name@company.com"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="bg-[#354C8F] w-full hover:bg-[#1F2B4D] text-white py-3.5 rounded-xl font-bold text-lg shadow-lg shadow-indigo-200 flex items-center justify-center gap-2 transition-all"
            >
              {isLoading ? (
                <Loader2 className="animate-spin" />
              ) : (
                "Send OTP Code"
              )}
            </button>
          </form>

          <div className="mt-8 text-center">
            <Link
              to="/login"
              className="text-sm font-bold text-slate-400 hover:text-indigo-900 flex items-center justify-center gap-2 transition-colors"
            >
              <ArrowLeft size={16} /> Back to Login
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
