import { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Loader2, AlertTriangle, X } from "lucide-react";
import bgGedung from "../../assets/backgroundLogin.jpeg";
import logoSier from "../../assets/Logo1.png";
import apiClient from "../../api/axiosConfig";

export default function OtpVerification() {
  const [otp, setOtp] = useState(["", "", "", "", ""]);
  const [isLoading, setIsLoading] = useState(false);
  const [timer, setTimer] = useState(59);
  const [isErrorOpen, setIsErrorOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const navigate = useNavigate();
  const location = useLocation();
  const email = location.state?.email || "your email"; // Ambil email dari page sebelumnya
  const inputRefs = useRef([]);

  // Hitung mundur timer
  useEffect(() => {
    const interval = setInterval(() => {
      setTimer((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setIsErrorOpen(false);
    setErrorMessage("");
    try {
      const response = await apiClient.post("/forgot-password", {
        email: email,
      });
      //   if (response.data.success) {
      //     navigate("/auth/otp-verification", { state: { email: email } });
      //   } else {
      //     setErrorMessage("Failed to send OTP. Please try again.");
      //     setIsErrorOpen(true);
      //   }
    } catch (error) {
      let msg = error?.response?.data?.message || "Terjadi kesalahan server.";
      setErrorMessage(msg);
      setIsErrorOpen(true);
    } finally {
      setIsLoading(false);
    }
  };

  // Logika Input OTP (Pindah otomatis)
  const handleChange = (index, value) => {
    if (isNaN(value)) return;
    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    // Pindah ke kotak selanjutnya jika diisi
    if (value && index < 4) {
      inputRefs.current[index + 1].focus();
    }
  };

  const handleKeyDown = (index, e) => {
    // Pindah ke kotak sebelumnya jika Backspace ditekan
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      inputRefs.current[index - 1].focus();
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData("text");
    // Ambil hanya angka dari paste data
    const digits = pastedData.replace(/\D/g, "").split("").slice(0, 5);
    
    const newOtp = [...otp];
    digits.forEach((digit, idx) => {
      if (idx < 5) {
        newOtp[idx] = digit;
      }
    });
    setOtp(newOtp);
    
    // Focus ke field terakhir yang terisi atau field selanjutnya
    const lastFilledIndex = newOtp.findIndex((val) => !val);
    if (lastFilledIndex !== -1 && lastFilledIndex < 5) {
      inputRefs.current[lastFilledIndex].focus();
    } else if (digits.length === 5) {
      inputRefs.current[4].focus();
    }
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setIsErrorOpen(false);
    setErrorMessage("");
    const payload = {
      email: email,
      token: otp.join(""),
    };
    try {
      const response = await apiClient.post("/verify-reset-token", payload);
      if (response.data.success) {
        navigate("/auth/reset-password", { state: { email: email } });
      } else {
        setErrorMessage("OTP verification failed. Please try again.");
        setIsErrorOpen(true);
      }
    } catch (error) {
      let msg =
        error?.response?.data?.message ||
        "OTP verification failed. Please try again.";
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
              <AlertTriangle
                className="text-red-500"
                size={40}
                strokeWidth={2.5}
              />
            </div>
            <h3 className="text-xl font-bold text-[#27345A] mb-2">
              OTP Failed!
            </h3>
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

      <div className="w-full lg:w-[45%] flex items-center justify-center p-6 bg-white">
        <div className="w-full max-w-md text-center">
          <img
            src={logoSier}
            alt="Logo"
            className="h-20 mx-auto mb-6 object-contain"
          />
          <h1 className="text-2xl font-extrabold text-[#27345A] mb-2">
            OTP Verification
          </h1>
          <p className="text-slate-500 text-sm mb-8">
            We have sent a 5-digit code to <br />{" "}
            <span className="font-bold text-indigo-900">{email}</span>
          </p>

          <form onSubmit={handleVerify}>
            <div className="flex justify-center gap-3 mb-8">
              {otp.map((digit, index) => (
                <input
                  key={index}
                  ref={(el) => (inputRefs.current[index] = el)}
                  type="text"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleChange(index, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(index, e)}
                  onPaste={handlePaste}
                  className="w-12 h-14 text-center text-2xl font-bold border border-slate-300 rounded-lg focus:border-indigo-900 focus:ring-4 focus:ring-indigo-100 outline-none transition-all bg-slate-50 text-slate-800"
                />
              ))}
            </div>

            <button
              type="submit"
              disabled={isLoading || otp.includes("")}
              className="bg-[#354C8F] w-full hover:bg-[#1F2B4D] text-white py-3.5 rounded-xl font-bold text-lg shadow-lg shadow-indigo-200 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
            >
              {isLoading ? <Loader2 className="animate-spin" /> : "Verify"}
            </button>
          </form>

          <p className="mt-6 text-sm text-slate-500">
            Didn't receive the code?
            {timer > 0 ? (
              <span className="font-bold text-slate-400 ml-1">
                Resend ({timer}s)
              </span>
            ) : (
              <button
                onClick={() => setTimer(60)}
                className="font-bold text-indigo-700 ml-1 hover:underline"
              >
                Resend Code
              </button>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
