import { useState, useEffect, useCallback } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Clock,
  FileText,
  BarChart2,
  User,
  LogOut,
  ChevronDown,
  ChevronRight,
  Menu,
  X,
  ClipboardCheck,
  FileClock,
  History,
  AlertTriangle,
  Bell,
  Repeat,
  Star
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import PageTransition from '../components/PageTransition';
import TopbarNotificationBell from '../components/TopbarNotificationBell';
import logoSier from '../assets/Logo1.png';
import apiClient from '../api/axiosConfig';
import { fetchSecureBlob } from '../utils/secureFetch';
import { hasPermission } from '../utils/permissionHelpers';

const MainLayout = () => {
  // State UI
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isAttendanceOpen, setIsAttendanceOpen] = useState(true);
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);

  const [notAllowedDialog, setNotAllowedDialog] = useState({ open: false, nextPath: '' });

  // Permission state (menu visibility)
  const [userPermissions, setUserPermissions] = useState(null); // null = loading, [] = no permissions

  // 1. TAMBAHAN: State untuk Dropdown Profil
  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);


  // State Data User
  const [user, setUser] = useState({
    nama: "",
    role: "Intern",
    avatar: null
  });

  // Secure photo for topbar
  const [secureAvatarUrl, setSecureAvatarUrl] = useState(null);

  const location = useLocation();
  const navigate = useNavigate();




  // --- Styles Constants ---
  const btnPrimaryClass = "w-full bg-[#354C8F] hover:bg-[#1F2B4D] text-white py-3 px-6 rounded-xl active:scale-95 transition-all font-bold text-sm shadow-md shadow-indigo-200 flex items-center justify-center gap-2";
  const btnSecondaryClass = "w-full bg-white border border-slate-300 text-slate-700 py-3 px-6 rounded-xl active:scale-95 transition-all font-bold text-sm flex items-center justify-center gap-2 hover:bg-slate-50";

  // Role badge color helper
  const roleBadgeClass = (role) => {
    const r = String(role || '').toLowerCase();
    if (r.includes('admin')) return 'inline-block px-3 py-0.5 bg-[#1F2B4D] text-white text-[10px] font-bold rounded-full mt-0.5';
    if (r.includes('intern')) return 'inline-block px-3 py-0.5 bg-[#FB923C] text-white text-[10px] font-bold rounded-full mt-0.5';
    if (r.includes('mentor')) return 'inline-block px-3 py-0.5 bg-[#7C3AED] text-white text-[10px] font-bold rounded-full mt-0.5';
    return 'inline-block px-3 py-0.5 bg-[#27345A] text-white text-[10px] font-bold rounded-full mt-0.5';
  };

  // --- FETCH DATA USER ---
  useEffect(() => {
    const storedName = localStorage.getItem('nama_lengkap') || "User Magang";

    // 1. Ambil raw data (misal: "intern")
    const rawRole = localStorage.getItem('role') || "Intern";

    // 2. Ubah huruf pertama jadi Kapital (misal: "intern" jadi "Intern")
    const storedRole = rawRole.charAt(0).toUpperCase() + rawRole.slice(1);

    const storedFoto = localStorage.getItem('foto');

    setUser({
      nama: storedName,
      role: storedRole, // Hasilnya sudah "Intern"
      avatar: storedFoto
    });

    if (location.pathname.includes('/magang/attendance') ||
      location.pathname.includes('/magang/permission') ||
      location.pathname.includes('/magang/correction') ||
      location.pathname.includes('/magang/history')) {
      setIsAttendanceOpen(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  // Fetch secure photo for topbar
  useEffect(() => {
    const fetchSecurePhoto = async () => {
      const url = await fetchSecureBlob('/profile/photo');
      if (url) {
        setSecureAvatarUrl(prev => {
          if (prev) URL.revokeObjectURL(prev);
          return url;
        });
      }
    };

    fetchSecurePhoto();

    // Listen for profile photo updates (soft refresh)
    const handleUpdate = () => fetchSecurePhoto();
    window.addEventListener('profile-photo-updated', handleUpdate);

    return () => {
      window.removeEventListener('profile-photo-updated', handleUpdate);
      setSecureAvatarUrl(prev => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
    };
  }, []);

  // Fetch effective permissions for current user
  const fetchMyPermissions = useCallback(async () => {
    try {
      const activeRole = localStorage.getItem('active_role') || localStorage.getItem('role') || 'intern';
      const res = await apiClient.get('/user', { params: { active_role: activeRole } });
      const data = res?.data;
      const permissions = data?.permissions || [];

      if (Array.isArray(permissions)) {
        setUserPermissions(permissions);
        localStorage.setItem('permissions', JSON.stringify(permissions));
      } else {
        setUserPermissions([]);
      }
    } catch (err) {
      console.error('Failed to load user permissions:', err);
      // Fallback: use permissions from localStorage
      try {
        const stored = localStorage.getItem('permissions');
        if (stored) {
          setUserPermissions(JSON.parse(stored));
        } else {
          setUserPermissions([]);
        }
      } catch {
        setUserPermissions([]);
      }
    }
  }, []);

  useEffect(() => {
    // Initial load + background refresh (every 5m).
    fetchMyPermissions();

    // Delay registering focus/visibility listeners to avoid double-fetch on mount
    let listenersRegistered = false;
    const intervalId = setInterval(fetchMyPermissions, 300000);
    const handleFocus = () => fetchMyPermissions();
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') fetchMyPermissions();
    };

    const listenerId = setTimeout(() => {
      listenersRegistered = true;
      window.addEventListener('focus', handleFocus);
      document.addEventListener('visibilitychange', handleVisibility);
    }, 2000);

    // Re-fetch immediately when permissions are changed
    const handlePermUpdate = () => fetchMyPermissions();
    window.addEventListener('permissions-updated', handlePermUpdate);

    return () => {
      clearInterval(intervalId);
      clearTimeout(listenerId);
      window.removeEventListener('permissions-updated', handlePermUpdate);
      if (listenersRegistered) {
        window.removeEventListener('focus', handleFocus);
        document.removeEventListener('visibilitychange', handleVisibility);
      }
    };
  }, [fetchMyPermissions]);

  // Helper
  const getFirstName = (fullName) => {
    if (!fullName) return "User";
    return fullName;
  };

  const isActive = (path) => {
    if (path === '/magang/dashboard' && (location.pathname.includes('/dashboard'))) return true;
    return location.pathname === path;
  };

  const can = (permName) => hasPermission(userPermissions, permName);

  const canViewDashboard = can('view_dashboard');
  const canViewAttendanceToday = can('view_presence');
  const canViewPermission = can('view_leave_request');
  const canViewCorrection = can('view_correction');
  const canViewHistory = can('view_logs');
  const canViewDailyActivities = can('view_logbook');
  const canViewResultEvaluation = can('view_result_evaluation');
  const canViewProfile = can('view_profile');
  const showAttendanceMenu = canViewAttendanceToday || canViewPermission || canViewCorrection || canViewHistory;

  const getFirstAllowedPath = () => {
    const ordered = [
      { allowed: canViewDashboard, path: '/magang/dashboard' },
      { allowed: canViewAttendanceToday, path: '/magang/attendance' },
      { allowed: canViewPermission, path: '/magang/permission' },
      { allowed: canViewCorrection, path: '/magang/correction' },
      { allowed: canViewHistory, path: '/magang/history' },
      { allowed: canViewDailyActivities, path: '/magang/logbook' },
      { allowed: canViewResultEvaluation, path: '/magang/resultEvaluation' },
      { allowed: canViewProfile, path: '/magang/profile' }
    ];

    const first = ordered.find(item => item.allowed);
    return first ? first.path : '/login';
  };

  useEffect(() => {
    if (!userPermissions) return;

    const currentPath = location.pathname;
    const allowedMap = [
      { path: '/magang/dashboard', allowed: canViewDashboard },
      { path: '/magang/attendance', allowed: canViewAttendanceToday },
      { path: '/magang/permission', allowed: canViewPermission },
      { path: '/magang/correction', allowed: canViewCorrection },
      { path: '/magang/history', allowed: canViewHistory },
      { path: '/magang/logbook', allowed: canViewDailyActivities },
      { path: '/magang/resultEvaluation', allowed: canViewResultEvaluation },
      { path: '/magang/profile', allowed: canViewProfile }
    ];

    const currentRule = allowedMap.find(item => currentPath.startsWith(item.path));
    if (currentRule && !currentRule.allowed) {
      const nextPath = getFirstAllowedPath();
      setNotAllowedDialog({ open: true, nextPath });
    }
  }, [userPermissions, location.pathname, canViewDashboard, canViewAttendanceToday, canViewPermission, canViewCorrection, canViewHistory, canViewDailyActivities, canViewResultEvaluation, canViewProfile]);

  // Helper Breadcrumbs
  const getPageHeader = () => {
    const path = location.pathname.toLowerCase();

    if (path.includes('/magang/interns/')) return { category: 'Intern Monitoring', title: 'Detail' };
    if (path.includes('/magang/interns') || path.includes('interns') || path.includes('internmonitoring')) return { category: null, title: 'Intern Monitoring' };

    if (path.includes('attendance')) return { category: 'Attendance', title: 'Today' };
    if (path.includes('permission')) return { category: 'Attendance', title: 'Leave Request' };
    if (path.includes('correction')) return { category: 'Attendance', title: 'Correction' };
    if (path.includes('history')) return { category: 'Attendance', title: 'History' };
    if (path.includes('logbook')) return { category: null, title: 'Daily Activities' };
    if (path.includes('profile')) return { category: null, title: 'Profile' };
    if (path.includes('resultevaluation') || path.includes('result-evaluation')) return { category: null, title: 'Result Evaluation' };
    return { category: null, title: 'Dashboard' };
  };

  const pageHeader = getPageHeader();

  // --- LOGIC LOGOUT ---
  const handleLogoutClick = () => {
    setIsLogoutModalOpen(true);
    setIsProfileDropdownOpen(false); // Tutup dropdown jika terbuka
  };

  const confirmLogout = () => {
    setIsLogoutModalOpen(false);
    localStorage.clear();

    navigate('/login', {
      state: { loggedOut: true },
      replace: true
    });
  };

  return (
    <div className="flex h-screen bg-[#F8FAFC] font-sans overflow-hidden">

      {/* --- MOBILE OVERLAY --- */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden backdrop-blur-sm transition-opacity"
          onClick={() => setIsSidebarOpen(false)}
        ></div>
      )}

      {/* --- SIDEBAR --- */}
      <aside
        className={`
            fixed inset-y-0 left-0 z-50 w-64 bg-[#354C8F] text-white flex flex-col shadow-2xl transition-transform duration-300 ease-in-out
            lg:translate-x-0 lg:static lg:inset-auto
            ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        <div className="h-20 flex items-center gap-3 px-6 border-b border-white/10 bg-gradient-to-r from-[#2B3963] via-[#243357] to-[#1F2B4D] shrink-0 backdrop-blur-sm">
          <div className="w-12 h-12 rounded-2xl  flex items-center justify-center overflow-hidden flex-shrink-0">
            <img src={logoSier} alt="SIER" className="w-full h-full object-contain object-center ml-2" />

          </div>

          <div className="flex flex-col leading-tight text-white">
            <span className="text-lg font-extrabold">SIER</span>
            <span className="text-[10px] font-medium text-white/60">Internship Program</span>
          </div>

          <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden ml-auto text-white/70 hover:text-white">
            <X size={24} />
          </button>
        </div>

        {/* MENU */}
        <nav className="-mt-2 flex-1 px-4 py-8 space-y-2 overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:'none']">

          {canViewDashboard && (
            <Link to="/magang/dashboard" onClick={() => setIsSidebarOpen(false)}>
              <div className={`flex items-center gap-4 px-6 py-4 rounded-2xl transition-all duration-200 cursor-pointer mb-2
                  ${isActive('/magang/dashboard') ? 'bg-[#27345A] text-white shadow-md font-bold' : 'text-slate-50 hover:bg-white/10 hover:text-white'}
              `}>
                <LayoutDashboard size={22} />
                <span className="text-sm tracking-wide">Dashboard</span>
              </div>
            </Link>
          )}

          {/* ATTENDANCE DROPDOWN */}
          {showAttendanceMenu && (
            <div>
              <div
                onClick={() => setIsAttendanceOpen(!isAttendanceOpen)}
                className={`flex items-center justify-between px-6 py-4 rounded-2xl cursor-pointer transition-all duration-200 group mb-1
                    ${location.pathname.includes('/magang/attendance') || location.pathname.includes('/magang/permission') || location.pathname.includes('/magang/correction') || location.pathname.includes('/magang/history')
                    ? 'text-white font-bold'
                    : 'text-slate-50 hover:bg-white/10 hover:text-white'}
                `}
              >
                <div className="flex items-center gap-4">
                  <Clock size={22} />
                  <span className="text-sm tracking-wide">Attendance</span>
                </div>
                {isAttendanceOpen ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
              </div>

              <div className={`overflow-hidden transition-all duration-500 ease-in-out ${isAttendanceOpen ? 'max-h-64 opacity-100' : 'max-h-0 opacity-0'}`}>
                <div className="ml-6 pl-4 border-l border-white/20 space-y-1 mt-1 mb-3">
                  {canViewAttendanceToday && (
                    <Link to="/magang/attendance" onClick={() => setIsSidebarOpen(false)}>
                      <div className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm transition-all duration-200 ${isActive('/magang/attendance') ? 'bg-[#27345A] text-white font-bold shadow-sm' : 'text-slate-50 hover:text-white hover:bg-white/10'}`}>
                        <Clock size={18} /> <span>Today</span>
                      </div>
                    </Link>
                  )}
                  {canViewPermission && (
                    <Link to="/magang/permission" onClick={() => setIsSidebarOpen(false)}>
                      <div className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm transition-all duration-200 ${isActive('/magang/permission') ? 'bg-[#27345A] text-white font-bold shadow-sm' : 'text-slate-50 hover:text-white hover:bg-white/10'}`}>
                        <FileClock size={18} /> <span>Leave Request</span>
                      </div>
                    </Link>
                  )}
                  {canViewCorrection && (
                    <Link to="/magang/correction" onClick={() => setIsSidebarOpen(false)}>
                      <div className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm transition-all duration-200 ${isActive('/magang/correction') ? 'bg-[#27345A] text-white font-bold shadow-sm' : 'text-slate-50 hover:text-white hover:bg-white/10'}`}>
                        <Repeat size={18} /> <span>Correction</span>
                      </div>
                    </Link>
                  )}
                  {canViewHistory && (
                    <Link to="/magang/history" onClick={() => setIsSidebarOpen(false)}>
                      <div className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm transition-all duration-200 ${isActive('/magang/history') ? 'bg-[#27345A] text-white font-bold shadow-sm' : 'text-slate-50 hover:text-white hover:bg-white/10'}`}>
                        <ClipboardCheck size={18} /> <span>History</span>
                      </div>
                    </Link>
                  )}
                </div>
              </div>
            </div>
          )}

          {canViewDailyActivities && (
            <Link to="/magang/logbook" onClick={() => setIsSidebarOpen(false)}>
              <div className={`flex items-center gap-4 px-6 py-4 rounded-2xl transition-all duration-200 cursor-pointer mb-2
                  ${isActive('/magang/logbook') ? 'bg-[#27345A] text-white shadow-md font-bold' : 'text-slate-50 hover:bg-white/10 hover:text-white'}
              `}>
                <BarChart2 size={22} />
                <span className="text-sm tracking-wide">Daily Activities</span>
              </div>
            </Link>
          )}

          {canViewResultEvaluation && (
            <Link to="/magang/resultEvaluation" onClick={() => setIsSidebarOpen(false)}>
              <div className={`flex items-center gap-4 px-6 py-4 rounded-2xl transition-all duration-200 cursor-pointer mb-2
                  ${isActive('/magang/resultEvaluation') ? 'bg-[#27345A] text-white shadow-md font-bold' : 'text-slate-50 hover:bg-white/10 hover:text-white'}
              `}>
                <div className="relative">
                  <Star size={12} className="absolute -top-1 -right-1 text-white" />
                  <User size={22} />
                </div>              <span className="text-sm tracking-wide">Result Evaluation</span>
              </div>
            </Link>
          )}

          {canViewProfile && (
            <Link to="/magang/profile" onClick={() => setIsSidebarOpen(false)}>
              <div className={`flex items-center gap-4 px-6 py-4 rounded-2xl transition-all duration-200 cursor-pointer mb-2
                  ${isActive('/magang/profile') ? 'bg-[#27345A] text-white shadow-md font-bold' : 'text-slate-50 hover:bg-white/10 hover:text-white'}
              `}>
                <User size={22} />
                <span className="text-sm tracking-wide">Profile</span>
              </div>
            </Link>
          )}

        </nav>
      </aside>

      {/* --- MAIN CONTENT --- */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* NAVBAR */}
        <header className="h-20 bg-white border-b border-slate-200 flex items-center justify-between px-4 md:px-8 shadow-sm sticky top-0 z-30 shrink-0">

          <div className="flex items-center gap-2 text-lg">
            <button onClick={() => setIsSidebarOpen(true)} className="p-2 -ml-2 mr-2 text-slate-500 hover:bg-slate-100 rounded-lg lg:hidden transition-colors">
              <Menu size={24} />
            </button>

            <span className="font-bold text-[#3B5998] hidden sm:inline">SIP</span>
            <span className="text-slate-400 text-sm hidden sm:inline">›</span>
            {pageHeader.category && (
              <>
                <span className="text-slate-400 font-medium hidden sm:inline">{pageHeader.category}</span>
                <span className="text-slate-400 text-sm hidden sm:inline">›</span>
              </>
            )}
            <span className="font-bold text-[#27345A]">{pageHeader.title}</span>
          </div>

          <div className="flex items-center gap-6">

            {/* Notifications (shared component) */}
            <TopbarNotificationBell />



            {/* --- 2. DROPDOWN PROFILE --- */}
            <div className="relative">
              <button
                onClick={() => setIsProfileDropdownOpen(!isProfileDropdownOpen)}
                className="flex items-center gap-3 focus:outline-none group"
              >
                <div className="text-right hidden md:block">
                  <p className="text-sm font-bold text-slate-900 leading-tight">{getFirstName(user.nama)}</p>
                  <div className={roleBadgeClass(user.role)}>
                    {user.role}
                  </div>
                </div>
                <div className="h-11 w-11 rounded-full bg-slate-100 border-2 border-white shadow-sm overflow-hidden cursor-pointer hover:ring-2 hover:ring-[#203266] transition-all">
                  <img
                    src={secureAvatarUrl || `https://ui-avatars.com/api/?name=${user.nama}&background=FCD34D`}
                    alt="Profile"
                    className="w-full h-full object-cover"
                  />
                </div>
                <ChevronDown size={16} className={`text-slate-400 transition-transform duration-200 ${isProfileDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {/* Dropdown Content */}
              <AnimatePresence>
                {isProfileDropdownOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setIsProfileDropdownOpen(false)}></div>
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      className="absolute right-0 top-full mt-3 w-60 bg-white rounded-xl shadow-xl border border-slate-100 overflow-hidden py-1 z-50"
                    >
                      {/* Header (Mobile Only) */}
                      <div className="px-4 py-3 border-b border-slate-50 md:hidden">
                        <p className="text-sm font-bold text-[#27345A] truncate">{user.nama}</p>
                        <p className="text-xs text-slate-400 font-medium">{user.role}</p>
                      </div>

                      {/* Menu Links */}
                      <div className="py-1">
                        {canViewProfile && (
                          <Link
                            to="/magang/profile"
                            onClick={() => setIsProfileDropdownOpen(false)}
                            className="flex items-center px-4 py-2.5 text-sm text-slate-600 hover:bg-slate-50 hover:text-[#354C8F] transition-colors"
                          >
                            <User size={16} className="mr-2" /> Profile
                          </Link>
                        )}

                        <button
                          onClick={handleLogoutClick}
                          className="w-full flex items-center px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 transition-colors"
                        >
                          <LogOut size={16} className="mr-2" /> Logout
                        </button>
                      </div>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>

          </div>
        </header>

        <main className={`flex-1 magang-font ${(!location.pathname.includes('/magang/dashboard')) ? 'magang-reduced' : ''} overflow-x-hidden overflow-y-auto p-4 md:p-6 bg-[#F8FAFC]`}>
          <PageTransition key={location.pathname}>
            <Outlet />
          </PageTransition>
        </main>
      </div>

      {/* --- LOGOUT MODAL --- */}
      {isLogoutModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-8 text-center animate-scale-up relative">
            <div className="w-24 h-24 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertTriangle className="text-red-500" size={42} strokeWidth={2.5} />
            </div>
            <h3 className="text-2xl font-bold text-[#27345A] mb-2">Are you sure?</h3>
            <p className="text-slate-500 text-sm mb-8 leading-relaxed">
              You will be logged out of your current session and returned to the login screen.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setIsLogoutModalOpen(false)} className={btnSecondaryClass}>Cancel</button>
              <button onClick={confirmLogout} className={btnPrimaryClass}>Yes, Logout</button>
            </div>
          </div>
        </div>
      )}

      {notAllowedDialog.open && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-8 text-center animate-scale-up relative">
            <div className="w-24 h-24 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertTriangle className="text-red-500" size={42} strokeWidth={2.5} />
            </div>
            <h3 className="text-2xl font-bold text-[#27345A] mb-2">Access Restricted</h3>
            <p className="text-slate-500 text-sm mb-8 leading-relaxed">
              This page is not allowed by the admin. You will be redirected.
            </p>
            <button
              onClick={() => {
                const nextPath = notAllowedDialog.nextPath || '/login';
                setNotAllowedDialog({ open: false, nextPath: '' });
                navigate(nextPath, { replace: true });
              }}
              className={btnPrimaryClass}
            >
              OK
            </button>
          </div>
        </div>
      )}

    </div>
  );
};

export default MainLayout;