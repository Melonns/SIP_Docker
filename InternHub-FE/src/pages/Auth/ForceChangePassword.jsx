import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Lock, AlertCircle, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import apiClient from '../../api/axiosConfig';
import { getSafeErrorMessage, logError } from '../../utils/errorHandler';

const colors = {
  primary: "#354C8F",
  textDark: "#203266",
  bgLight: "#F8F9FD"
};

const btnBase = "py-3 px-6 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed";
const btnPrimary = `${btnBase} bg-[#354C8F] hover:bg-[#2a3c70] text-white shadow-md shadow-indigo-200`;
const btnSecondary = `${btnBase} bg-white border border-slate-300 text-slate-700 hover:bg-slate-50`;

const PasswordInput = ({ label, value, onChange, show, onToggle, placeholder }) => (
  <div className="space-y-2">
    <label className="block text-sm font-bold text-slate-700">{label}</label>
    <div className="relative">
      <input
        type={show ? 'text' : 'password'}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:outline-none focus:border-[#354C8F] focus:ring-2 focus:ring-[#354C8F]/20 text-sm transition-all pr-10"
      />
      <button
        type="button"
        onClick={onToggle}
        className="absolute right-3 top-3.5 text-slate-400 hover:text-slate-600 transition-colors"
      >
        {show ? <EyeOff size={18} /> : <Eye size={18} />}
      </button>
    </div>
  </div>
);

const ForceChangePassword = () => {
  const navigate = useNavigate();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const validateForm = () => {
    if (!currentPassword.trim()) {
      setError('Current password is required');
      return false;
    }
    if (!newPassword.trim()) {
      setError('New password is required');
      return false;
    }
    if (!confirmPassword.trim()) {
      setError('Confirm password is required');
      return false;
    }
    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters');
      return false;
    }
    if (!/[A-Z]/.test(newPassword)) {
      setError('Password must contain at least 1 capital letter [A-Z]');
      return false;
    }
    if (!/[0-9]/.test(newPassword)) {
      setError('Password must contain at least 1 number [0-9]');
      return false;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return false;
    }
    if (currentPassword === newPassword) {
      setError('New password must be different from current password');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!validateForm()) {
      return;
    }

    setLoading(true);
    try {
      const res = await apiClient.post('/change-password', {
        current_password: currentPassword,
        new_password: newPassword,
        new_password_confirmation: confirmPassword,
      });

      if (res.data && res.data.success) {
        setSuccess(true);
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');

        // Clear must_change_password flag
        localStorage.removeItem('must_change_password');
      } else {
        const safeMsg = res.data?.message ? getSafeErrorMessage({ response: { data: res.data } }, 'Failed to change password') : 'Failed to change password';
        setError(safeMsg);
      }
    } catch (err) {
      logError('handleChangePassword', err);
      // Check if it's unauthenticated error
      if (err.response?.status === 401) {
        setError('Your session has expired. Please login again.');
        setTimeout(() => {
          navigate('/login', { replace: true });
        }, 2000);
        return;
      }
      
      setError(getSafeErrorMessage(err, 'Failed to change password. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#354C8F]/10 to-[#F8F9FD] flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center"
        >
          <div className="w-20 h-20 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-6">
            <Check className="text-green-500" size={40} strokeWidth={3} />
          </div>
          <h2 className="text-2xl font-bold text-[#27345A] mb-2">Password Changed Successfully!</h2>
          <p className="text-slate-500 text-sm mb-4">Your password has been updated successfully.</p>
          <p className="text-slate-500 text-sm mb-6">Please login again with your new password to continue.</p>
          <div className="h-1 bg-slate-100 rounded-full overflow-hidden mb-6">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: '100%' }}
              transition={{ duration: 3 }}
              onAnimationComplete={() => navigate('/login', { replace: true })}
              className="h-full bg-green-500"
            />
          </div>
          <p className="text-xs text-slate-400 mb-4">Redirecting in 3 seconds...</p>
          <button
            onClick={() => navigate('/login', { replace: true })}
            className={`${btnPrimary} w-full justify-center`}
          >
            Go to Login Now
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#354C8F]/10 to-[#F8F9FD] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full"
      >
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="w-16 h-16 rounded-full bg-[#354C8F]/10 flex items-center justify-center mx-auto mb-4">
            <Lock className="text-[#354C8F]" size={32} />
          </div>
          <h1 className="text-2xl font-bold text-[#27345A] mb-2">Change Password</h1>
          <p className="text-slate-500 text-sm">
            Your password needs to be updated before you can access your account. Please enter a new password.
          </p>
        </div>

        {/* Error Alert */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 flex items-start gap-3"
            >
              <AlertCircle className="text-red-500 mt-0.5 flex-shrink-0" size={18} />
              <div>
                <p className="text-sm font-semibold text-red-900">{error}</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          <PasswordInput
            label="Current Password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            show={showCurrentPassword}
            onToggle={() => setShowCurrentPassword(!showCurrentPassword)}
            placeholder="Enter your current password"
          />

          <PasswordInput
            label="New Password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            show={showNewPassword}
            onToggle={() => setShowNewPassword(!showNewPassword)}
            placeholder="Enter a new password (min 8 characters)"
          />

          <PasswordInput
            label="Confirm Password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            show={showConfirmPassword}
            onToggle={() => setShowConfirmPassword(!showConfirmPassword)}
            placeholder="Confirm your new password"
          />

          {/* Password Strength Info */}
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
            <p className="text-xs font-semibold text-slate-600 mb-2">Password Requirements:</p>
            <ul className="text-xs text-slate-500 space-y-1">
              <li className={newPassword.length >= 8 ? 'text-green-600 font-semibold' : ''}>
                {newPassword.length >= 8 ? '✓' : '○'} At least 8 characters
              </li>
              <li className={/[A-Z]/.test(newPassword) ? 'text-green-600 font-semibold' : ''}>
                {/[A-Z]/.test(newPassword) ? '✓' : '○'} Minimal 1 Capital Letter [A-Z]
              </li>
              <li className={/[0-9]/.test(newPassword) ? 'text-green-600 font-semibold' : ''}>
                {/[0-9]/.test(newPassword) ? '✓' : '○'} Minimal 1 Number [0-9]
              </li>
              <li className={newPassword === confirmPassword && newPassword ? 'text-green-600 font-semibold' : ''}>
                {newPassword === confirmPassword && newPassword ? '✓' : '○'} Passwords match
              </li>
            </ul>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className={`${btnPrimary} w-full justify-center ${loading ? 'opacity-60 cursor-not-allowed' : ''}`}
          >
            {loading ? (
              <>
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                  className="w-4 h-4 border-2 border-white border-t-transparent rounded-full"
                />
                Changing Password...
              </>
            ) : (
              <>
                <Lock size={18} />
                Change Password
              </>
            )}
          </button>
        </form>

        {/* Info */}
        <div className="mt-6 p-4 rounded-xl bg-blue-50 border border-blue-200">
          <p className="text-xs text-blue-800">
            <strong>Note:</strong> This action is mandatory. You cannot proceed to your dashboard until you change your password.
          </p>
        </div>
      </motion.div>
    </div>
  );
};

export default ForceChangePassword;
