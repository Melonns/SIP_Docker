import React, { useState, useEffect, useRef } from 'react';
import { Bell, CheckSquare, X, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import axios from '../api/axiosConfig';
import echo from '../echo';

const TopbarNotificationBell = () => {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const btnRef = useRef(null);
  const [dropdownStyle, setDropdownStyle] = useState({});

  // Get user ID for private channel subscription
  const getUserId = () => {
    try {
      const raw = localStorage.getItem('user_profile');
      if (!raw) return null;
      const p = JSON.parse(raw);
      return p?.id_user ?? p?.id ?? p?.user_id ?? null;
    } catch { return null; }
  };

  const fetchUnreadCount = async () => {
    try {
      const activeRole = localStorage.getItem('active_role') || localStorage.getItem('role');
      const res = await axios.get('/notifications/unread-count', {
        params: { role: activeRole }
      });
      setUnreadCount(res.data.data.count);
    } catch (error) {
      console.error('Failed to fetch unread badge count', error);
    }
  };

  const fetchNotifications = async () => {
    try {
      const activeRole = localStorage.getItem('active_role') || localStorage.getItem('role');
      const res = await axios.get('/notifications', {
        params: { 
          role: activeRole,
          limit: 10 
        }
      });
      if (res.data?.data?.data) {
        setItems(res.data.data.data);
      }
    } catch (error) {
      console.error('Failed to load notifications', error);
    }
  };


  useEffect(() => {
    // Fetch initial unread count on mount
    fetchUnreadCount();

    // Subscribe to real-time Pusher channel for instant notifications
    let channelName = null;
    const userId = getUserId();

    if (userId) {
      channelName = `App.Models.User.${userId}`;
      try {
        const channel = echo.private(channelName);

        channel.notification((notification) => {
          setUnreadCount(prev => prev + 1);
          setItems(prev => [{
            id: notification.id,
            data: notification,
            read_at: null,
            created_at: new Date().toISOString(),
          }, ...prev]);
        });
      } catch (e) {
        // Silent catch for subscription errors in production
      }
    }

    return () => {
      if (channelName) {
        try { echo.leave(channelName); } catch {}
      }
    };
  }, []);

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next) {
      fetchNotifications();
    }
  };

  const positionDropdown = () => {
    const btn = btnRef.current;
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    const padding = 8;
    const maxWidth = 370;
    const width = Math.min(maxWidth, window.innerWidth - padding * 2);
    // align right edge of dropdown with button right edge when possible
    let left = rect.right - width;
    if (left < padding) left = padding;
    if (left + width > window.innerWidth - padding) left = window.innerWidth - width - padding;
    const top = rect.bottom + padding + window.scrollY;
    setDropdownStyle({ position: 'absolute', top: `${top}px`, left: `${left}px`, width: `${width}px`, zIndex: 9999 });
  };

  useEffect(() => {
    if (!open) return;
    positionDropdown();
    const onResize = () => positionDropdown();
    window.addEventListener('resize', onResize);
    window.addEventListener('scroll', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('scroll', onResize);
    };
  }, [open]);

  const handleNotificationClick = (notification) => {
    // Close dropdown immediately
    setOpen(false);

    // Parse data if it's a JSON string (some backends return it stringified)
    let notifData = notification.data;
    if (typeof notifData === 'string') {
      try { notifData = JSON.parse(notifData); } catch { notifData = {}; }
    }

    const rawUrl = notifData?.actionUrl || notifData?.link;
    console.log('[Notif Click] target:', rawUrl, '| data:', notifData);
    
    if (rawUrl) {
      const targetUrl = mapActionUrl(rawUrl);
      console.log('[Notif Click] navigating to:', targetUrl);
      try {
        navigate(targetUrl);
      } catch {
        // Fallback if navigate doesn't work
        window.location.href = targetUrl;
      }
    }

    // Fire-and-forget: mark as read in the background
    if (!notification.read_at) {
      axios.put(`/notifications/${notification.id}/read`)
        .then(() => {
          setUnreadCount(prev => Math.max(0, prev - 1));
          setItems(prev => prev.map(n => 
             n.id === notification.id ? { ...n, read_at: new Date() } : n
          ));
        })
        .catch(e => console.error('Failed to mark notification as read', e));
    }
  };

  // Map backend actionUrl to actual frontend routes
  const routeMap = {
    // Intern (backend uses /intern/*, frontend uses /magang/*)
    '/intern/logbook': '/magang/logbook',
    '/intern/koreksi': '/magang/correction',
    '/intern/izin': '/magang/permission',
    '/intern/absensi': '/magang/attendance',
    '/intern/evaluation': '/magang/resultEvaluation',
    '/intern/evaluations': '/magang/resultEvaluation',
    '/intern/evaluasi': '/magang/resultEvaluation',
    // Mentor
    '/mentor/izin': '/mentor/permission',
    '/mentor/koreksi': '/mentor/corrections',
    '/mentor/evaluasi': '/mentor/evaluationIntern',
    // Admin
    '/admin/izin': '/admin/permission',
    '/admin/koreksi': '/admin/corrections',
    '/admin/evaluations': '/admin/evaluation',
    '/admin/evaluasi': '/admin/evaluation',
  };

  const mapActionUrl = (url) => {
    if (!url) return '/';
    // Exact match first
    if (routeMap[url]) return routeMap[url];
    // Try prefix match for deeper paths (e.g. /intern/logbook/123)
    for (const [key, val] of Object.entries(routeMap)) {
      if (url.startsWith(key)) return url.replace(key, val);
    }
    // No mapping needed, return as-is
    return url;
  };

  const markAllRead = async () => {
    try {
      const activeRole = localStorage.getItem('active_role') || localStorage.getItem('role');
      await axios.put('/notifications/mark-all-read', { 
        role: activeRole 
      });
      setUnreadCount(0);
      setItems(prev => prev.map(n => ({ ...n, read_at: new Date() })));
    } catch(error) {
       console.error("Failed to mark all as read", error);
    }
  };

  const handleDeleteNotification = async (e, id) => {
    e.stopPropagation();
    try {
      await axios.delete(`/notifications/${id}`);
      setItems(prev => prev.filter(n => n.id !== id));
      // Refresh unread count if deleted notification was unread
      fetchUnreadCount();
    } catch (error) {
      console.error('Failed to delete notification', error);
    }
  };

  const handleDeleteAll = async () => {
    try {
      const activeRole = localStorage.getItem('active_role') || localStorage.getItem('role');
      await axios.delete('/notifications/', {
        params: { role: activeRole }
      });
      setItems([]);
      setUnreadCount(0);
    } catch (error) {
      console.error('Failed to delete all notifications', error);
    }
  };

  // Helper for generating relative time or basic string
  const formatTimeAgo = (dateString) => {
      if (!dateString) return '';
      const date = new Date(dateString);
      const now = new Date();
      const diffMs = now - date;
      const diffSec = Math.floor(diffMs / 1000);
      
      if (diffSec < 60) return `Just now`;
      
      const diffMin = Math.floor(diffSec / 60);
      if (diffMin < 60) return `${diffMin} minute${diffMin > 1 ? 's' : ''} ago`;
      
      const diffHours = Math.floor(diffMin / 60);
      if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
      
      const diffDays = Math.floor(diffHours / 24);
      if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
      
      return date.toLocaleDateString();
  };

  return (
      <div className="relative">
      <button
        type="button"
        ref={btnRef}
        onClick={toggle}
        className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors relative"
        aria-label="Notifications"
        title="Notifications"
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 flex items-center justify-center min-w-[14px] h-[14px] px-1 bg-red-500 rounded-full text-[9px] font-bold text-white shadow-sm ring-1 ring-white">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && createPortal(
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            style={dropdownStyle}
            className="bg-white rounded-xl shadow-xl border border-slate-100 overflow-hidden z-50 flex flex-col"
          >
            <div className="px-3 sm:px-4 py-3 border-b border-slate-100 bg-slate-50/60 flex items-center justify-between">
              <div>
                <div className="text-sm font-extrabold text-[#27345A]">Notifications</div>
                <div className="text-[11px] text-slate-500 font-semibold mt-0.5">Recent updates</div>
              </div>
              <div className="flex items-center gap-3">
                {unreadCount > 0 && (
                  <button 
                    type="button" 
                    onClick={markAllRead} 
                    className="text-xs text-[#354C8F] hover:text-blue-800 font-semibold flex items-center gap-1 transition-colors"
                  >
                    <CheckSquare size={14} />
                    Mark all read
                  </button>
                )}
                {items.length > 0 && (
                  <button 
                    type="button" 
                    onClick={handleDeleteAll} 
                    className="text-xs text-red-600 hover:text-red-800 font-semibold flex items-center gap-1 transition-colors"
                  >
                    <Trash2 size={14} />
                    Clear all
                  </button>
                )}
              </div>
            </div>

            <div className="max-h-[380px] overflow-y-auto w-full custom-scrollbar">
              {items && items.length > 0 ? (
                items.map((n) => {
                  const isUnread = n.read_at === null;
                  return (
                    <div
                      key={n.id}
                      className={`relative group border-b border-slate-50 transition-colors ${isUnread ? 'bg-indigo-50/20 hover:bg-indigo-50/40' : 'hover:bg-slate-50'}`}
                    >
                      <button
                        type="button"
                        onClick={() => handleNotificationClick(n)}
                        className="w-full text-left pl-6 sm:pl-7 pr-12 py-3.5 sm:py-4 flex flex-col gap-1.5"
                      >
                        <div className={`text-[13px] ${isUnread ? 'font-bold text-[#27345A]' : 'font-semibold text-slate-700'} leading-snug`}>
                          {n.data?.title || 'Notification'}
                        </div>
                        <div className={`text-[12px] mt-0.5 leading-relaxed ${isUnread ? 'text-slate-800 font-medium' : 'text-slate-600'}`}>
                          {n.data?.message || ''}
                        </div>
                        <div className={`text-[10px] mt-2 font-medium ${isUnread ? 'text-[#354C8F]' : 'text-slate-400'}`}>
                          {formatTimeAgo(n.created_at)}
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={(e) => handleDeleteNotification(e, n.id)}
                        className="absolute right-3 sm:right-4 top-1/2 -translate-y-1/2 p-2 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-all duration-200 opacity-0 group-hover:opacity-100"
                        title="Delete notification"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  );
                })
              ) : (
                <div className="px-3 sm:px-4 py-10 flex flex-col items-center text-center">
                  <div className="w-12 h-12 bg-slate-50 rounded-full flex justify-center items-center mb-3">
                    <Bell size={24} className="text-slate-300" />
                  </div>
                  <p className="text-sm text-slate-500 font-semibold mb-1">No notifications yet</p>
                  <p className="text-xs text-slate-400">When you receive updates, they'll appear here.</p>
                </div>
              )}
            </div>
          </motion.div>
        </>,
        document.body
      )}
    </div>
  );
};

export default TopbarNotificationBell;
