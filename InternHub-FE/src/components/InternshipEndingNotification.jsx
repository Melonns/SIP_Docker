import { useState, useEffect } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const InternshipEndingNotification = ({ akhirMagang }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [daysRemaining, setDaysRemaining] = useState(null);

  useEffect(() => {
    if (!akhirMagang) {
      return;
    }

    const calculateDaysRemaining = () => {
      try {
        const endDate = new Date(akhirMagang);
        const today = new Date();
        
        // Reset time to start of day for accurate calculation
        today.setHours(0, 0, 0, 0);
        endDate.setHours(0, 0, 0, 0);
        
        const timeDiff = endDate - today;
        const days = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));
        
        return days;
      } catch (err) {
        return null;
      }
    };

    const remaining = calculateDaysRemaining();
    setDaysRemaining(remaining);

    // Show notification if 10 days or less remaining
    const shouldShow = remaining !== null && remaining >= 0 && remaining <= 10;
    setIsVisible(shouldShow);
  }, [akhirMagang]);

  if (!isVisible || daysRemaining === null) return null;

  const getWarningColor = () => {
    if (daysRemaining === 0) return 'bg-red-50 border-red-200';
    if (daysRemaining <= 3) return 'bg-orange-50 border-orange-200';
    return 'bg-yellow-50 border-yellow-200';
  };

  const getTextColor = () => {
    if (daysRemaining === 0) return 'text-red-800';
    if (daysRemaining <= 3) return 'text-orange-800';
    return 'text-yellow-800';
  };

  const getIconColor = () => {
    if (daysRemaining === 0) return 'text-red-600';
    if (daysRemaining <= 3) return 'text-orange-600';
    return 'text-yellow-600';
  };

  const getMessage = () => {
    if (daysRemaining === 0) return 'Your internship ends today!';
    if (daysRemaining === 1) return 'Your internship ends tomorrow!';
    return `Your internship ends in ${daysRemaining} days`;
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: -20, x: 20 }}
          animate={{ opacity: 1, y: 0, x: 0 }}
          exit={{ opacity: 0, y: -20, x: 20 }}
          transition={{ duration: 0.3 }}
          className={`fixed top-4 right-4 max-w-sm p-4 rounded-lg border-l-4 ${getWarningColor()} shadow-lg z-50`}
        >
          <div className="flex items-start gap-3">
            <AlertTriangle className={`flex-shrink-0 mt-0.5 ${getIconColor()}`} size={20} />
            <div className="flex-1">
              <h3 className={`font-semibold ${getTextColor()}`}>Internship Ending Soon</h3>
              <p className={`text-sm ${getTextColor()} opacity-90 mt-1`}>
                {getMessage()}
              </p>
            </div>
            <button
              onClick={() => setIsVisible(false)}
              className={`flex-shrink-0 p-1 rounded hover:bg-black/10 transition-colors ${getTextColor()}`}
              aria-label="Close notification"
            >
              <X size={18} />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default InternshipEndingNotification;
