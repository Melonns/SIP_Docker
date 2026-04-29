import { useState, useEffect, useCallback } from 'react';
import { Outlet, Link, useLocation, useNavigate, useOutlet } from 'react-router-dom';
import {
  LayoutDashboard,
  Clock,
  CalendarCheck,
  FileText,
  FileCheck,
  Download,
  Users,
  User,
  Star,
  LogOut,
  ChevronDown,
  ChevronRight,
  Menu,
  X,
  Briefcase,
  Repeat,
  AlertTriangle,
  Bell,
  FileClock,
  ClipboardCheck,
  CheckCircle2,
  UserCog,
  Settings,
  MapPin,
  Calendar,
  BookOpen
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import PageTransition from '../components/PageTransition';
import TopbarNotificationBell from '../components/TopbarNotificationBell';
import logoSier from '../assets/Logo1.png';
import apiClient from '../api/axiosConfig';
import { fetchSecureBlob } from '../utils/secureFetch';
import { hasPermission } from '../utils/permissionHelpers';

// Custom component to freeze the outlet during exit animations
const AnimatedOutlet = () => {
  const o = useOutlet();
  const [outlet] = useState(o);
  return outlet;
};

const MentorLayout = () => {
  // --- STATE UI ---
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isAttendanceApprovalOpen, setIsAttendanceApprovalOpen] = useState(true);
  const [isMasterDataOpen, setIsMasterDataOpen] = useState(false);
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);
  const [userPermissions, setUserPermissions] = useState(null); // null = loading, [] = no permissions
  const [notAllowedDialog, setNotAllowedDialog] = useState({ open: false, nextPath: '' });

  // --- STATE USER ---
  const [user, setUser] = useState({
    nama_lengkap: "Loading...",
    role: "mentor",
    avatar: null,
    availableRoles: []
  });

  // Secure photo for topbar
  const [secureAvatarUrl, setSecureAvatarUrl] = useState(null);



  // --- STYLE CONSTANTS ---
  const btnPrimaryClass = "w-full bg-[#354C8F] hover:bg-[#1F2B4D] text-white py-3 px-6 rounded-xl active:scale-95 transition-all font-bold text-sm shadow-md shadow-indigo-200 flex items-center justify-center gap-2";
  const btnSecondaryClass = "w-full bg-white border border-slate-300 text-slate-700 py-3 px-6 rounded-xl active:scale-95 transition-all font-bold text-sm flex items-center justify-center gap-2 hover:bg-slate-50";

  const location = useLocation();
  const navigate = useNavigate();


  const roleBadgeClass = (role) => {
    const r = String(role || '').toLowerCase();
    if (r.includes('admin')) return 'inline-block px-3 py-0.5 bg-[#1F2B4D] text-white text-[10px] font-bold rounded-full mt-0.5';
    if (r.includes('intern')) return 'inline-block px-3 py-0.5 bg-[#FB923C] text-white text-[10px] font-bold rounded-full mt-0.5';
    if (r.includes('mentor')) return 'inline-block px-3 py-0.5 bg-[#7C3AED] text-white text-[10px] font-bold rounded-full mt-0.5';
    return 'inline-block px-3 py-0.5 bg-[#27345A] text-white text-[10px] font-bold rounded-full mt-0.5';
  };

  // load user profile from localStorage
  useEffect(() => {
    try {
      const storedName = localStorage.getItem('nama_lengkap');
      const storedFoto = localStorage.getItem('foto');
      const storedActiveRole = localStorage.getItem('active_role') || localStorage.getItem('role') || 'mentor';
      const storedRolesString = localStorage.getItem('roles');

      let parsedRoles = [];
      if (storedRolesString) {
        try {
          parsedRoles = JSON.parse(storedRolesString);
          if (!Array.isArray(parsedRoles)) parsedRoles = [parsedRoles];
        } catch {
          parsedRoles = [storedActiveRole];
        }
      } else {
        parsedRoles = [storedActiveRole];
      }

      setUser({
        nama_lengkap: storedName || "Mentor User",
        role: storedActiveRole,
        avatar: storedFoto,
        availableRoles: parsedRoles
      });
    } catch (e) {
      console.error("Error loading user data:", e);
    }
  }, []);

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






  const fetchMyPermissions = useCallback(async () => {
    try {
      const activeRole = localStorage.getItem('active_role') || localStorage.getItem('role') || 'mentor';
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
    fetchMyPermissions();

    const intervalId = setInterval(fetchMyPermissions, 180000); // 3 minutes

    // Re-fetch immediately when permissions are changed
    const handlePermUpdate = () => fetchMyPermissions();
    window.addEventListener('permissions-updated', handlePermUpdate);

    return () => {
      clearInterval(intervalId);
      window.removeEventListener('permissions-updated', handlePermUpdate);
    };
  }, [fetchMyPermissions]);

  // NOTE: Removed route-change triggered fetch to avoid excessive calls on every navigation. Permission refresh is handled on mount, focus, visibility, and periodic polling.

  // --- HELPERS ---
  const getFirstName = (fullName) => {
    if (!fullName || fullName === "Loading...") return "User";
    return fullName;
  };

  const formatRole = (r) => {
    if (!r) return "";
    const roleStr = String(r);
    return roleStr.charAt(0).toUpperCase() + roleStr.slice(1);
  };

  const isActive = (path) => {
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };

  const can = (permName) => hasPermission(userPermissions, permName);

  const canViewDashboard = can('view_dashboard');
  const canViewInternMonitoring = can('view_intern_monitoring');
  const canViewPermission = can('view_leave_request');
  const canViewCorrections = can('view_correction');
  const canViewLogs = can('view_logs');
  const canViewLogbookApproval = can('view_logbook');
  const canViewEvaluation = can('view_input_evaluation') || can('view_result_evaluation');
  const canViewReports = can('view_reports');
  const canViewProfile = can('view_profile');

  const canViewUserRole = can('view_user_role');
  const canViewUserPermission = can('view_user_permissions');
  const canViewInternProfiles = can('view_intern_profiles');
  const canViewInternMapping = can('view_intern_mapping');
  const canViewOfficeLocations = can('view_office_locations');
  const canViewWorkingSchedule = can('view_working_schedule');
  const canViewEvaluationTemplate = can('view_evaluation_component');

  const showAttendanceApprovalMenu = canViewPermission || canViewCorrections || canViewLogs;
  const showMasterDataMenu = canViewUserRole || canViewUserPermission || canViewInternProfiles || canViewInternMapping || canViewOfficeLocations || canViewWorkingSchedule || canViewEvaluationTemplate;

  const getFirstAllowedPath = () => {
    const ordered = [
      { allowed: canViewDashboard, path: '/mentor/dashboard' },
      { allowed: canViewInternMonitoring, path: '/mentor/internMonitoring' },
      { allowed: canViewPermission, path: '/mentor/permission' },
      { allowed: canViewCorrections, path: '/mentor/corrections' },
      { allowed: canViewLogs, path: '/mentor/logs' },
      { allowed: canViewLogbookApproval, path: '/mentor/logbook' },
      { allowed: canViewEvaluation, path: '/mentor/evaluationIntern' },
      { allowed: canViewReports, path: '/mentor/reports' },
      { allowed: canViewUserRole, path: '/mentor/masterdata/userRole' },
      { allowed: canViewUserPermission, path: '/mentor/masterdata/userPermission' },
      { allowed: canViewInternProfiles, path: '/mentor/masterdata/internProfile' },
      { allowed: canViewInternMapping, path: '/mentor/masterdata/internMapping' },
      { allowed: canViewOfficeLocations, path: '/mentor/masterdata/officeLocation' },
      { allowed: canViewWorkingSchedule, path: '/mentor/masterdata/workingSchedule' },
      { allowed: canViewEvaluationTemplate, path: '/mentor/masterdata/evaluation' },
      { allowed: canViewProfile, path: '/mentor/profile' }
    ];

    const first = ordered.find(item => item.allowed);
    return first ? first.path : '/login';
  };

  useEffect(() => {
    if (!userPermissions) return;

    const currentPath = location.pathname;
    const allowedMap = [
      { path: '/mentor/dashboard', allowed: canViewDashboard },
      { path: '/mentor/internMonitoring', allowed: canViewInternMonitoring },
      { path: '/mentor/interns', allowed: canViewInternMonitoring },
      { path: '/mentor/permission', allowed: canViewPermission },
      { path: '/mentor/corrections', allowed: canViewCorrections },
      { path: '/mentor/logs', allowed: canViewLogs },
      { path: '/mentor/logbook', allowed: canViewLogbookApproval },
      { path: '/mentor/evaluationIntern', allowed: canViewEvaluation },
      { path: '/mentor/reports', allowed: canViewReports },
      { path: '/mentor/masterdata/userRole', allowed: canViewUserRole },
      { path: '/mentor/masterdata/userPermission', allowed: canViewUserPermission },
      { path: '/mentor/masterdata/internProfile', allowed: canViewInternProfiles },
      { path: '/mentor/masterdata/internMapping', allowed: canViewInternMapping },
      { path: '/mentor/masterdata/officeLocation', allowed: canViewOfficeLocations },
      { path: '/mentor/masterdata/workingSchedule', allowed: canViewWorkingSchedule },
      { path: '/mentor/masterdata/evaluation', allowed: canViewEvaluationTemplate },
      { path: '/mentor/profile', allowed: canViewProfile }
    ];

    const currentRule = allowedMap.find(item => currentPath.startsWith(item.path));
    if (currentRule && !currentRule.allowed) {
      const nextPath = getFirstAllowedPath();
      setNotAllowedDialog({ open: true, nextPath });
    }
  }, [userPermissions, location.pathname, canViewDashboard, canViewInternMonitoring, canViewPermission, canViewCorrections, canViewLogs, canViewLogbookApproval, canViewEvaluation, canViewReports, canViewUserRole, canViewUserPermission, canViewInternProfiles, canViewInternMapping, canViewOfficeLocations, canViewWorkingSchedule, canViewEvaluationTemplate, canViewProfile]);

  // --- LOGIC SWITCH ACCOUNT ---
  const handleSwitchRole = (targetRole) => {
    setIsProfileDropdownOpen(false);

    const lowerRole = targetRole.toLowerCase();
    localStorage.setItem('active_role', lowerRole);
    localStorage.setItem('role', lowerRole);

    setUser(prev => ({ ...prev, role: lowerRole }));

    if (lowerRole === 'mentor') {
      navigate('/mentor/dashboard');
    } else if (lowerRole === 'admin') {
      navigate('/admin/dashboard');
    }
  };



  // --- LOGIC LOGOUT ---
  const handleLogoutClick = () => {
    setIsLogoutModalOpen(true);
    setIsProfileDropdownOpen(false); // Tutup dropdown jika terbuka
  };

  const confirmLogout = () => {
    setIsLogoutModalOpen(false);
    localStorage.clear();

    // --- REVISI DI SINI: Kirim state loggedOut: true ---
    navigate('/login', {
      state: { loggedOut: true },
      replace: true
    });
  };



  const getPageHeader = () => {
    const path = location.pathname.toLowerCase();
    if (path.includes('permission')) return { category: 'Approval', title: 'Leave Request' };
    if (path.includes('corrections')) return { category: 'Approval', title: 'Corrections' };
    if (path.includes('logs')) return { category: 'Approval', title: 'Logs' };
    if (path.includes('evaluation')) return { category: null, title: 'Evaluation' };

    // Interns: detail and list/listing pages should show Intern Monitoring
    if (path.includes('/mentor/interns/')) return { category: 'Intern Monitoring', title: 'Detail' };
    if (path.includes('/mentor/interns') || path.includes('interns')) return { category: null, title: 'Intern Monitoring' };
    if (path.includes('internmonitoring')) return { category: null, title: 'Intern Monitoring' };

    // Master Data
    if (path.includes('masterdata/userrole')) return { category: 'Master Data', title: 'User Management' };
    if (path.includes('masterdata/userpermission')) return { category: 'Master Data', title: 'User Role & Permission' };
    if (path.includes('masterdata/internprofile')) return { category: 'Master Data', title: 'Intern Profiles' };
    if (path.includes('masterdata/internmapping')) return { category: 'Master Data', title: 'Intern Mapping' };
    if (path.includes('masterdata/officelocation')) return { category: 'Master Data', title: 'Office Locations' };
    if (path.includes('masterdata/workingschedule')) return { category: 'Master Data', title: 'Working Schedule' };
    if (path.includes('masterdata/evaluation')) return { category: 'Master Data', title: 'Evaluation Component' };

    if (path.includes('dashboard')) return { category: null, title: 'Dashboard' };
    if (path.includes('ending-soon')) return { category: null, title: 'Ending Soon Interns' };
    if (path.includes('logbook')) return { category: null, title: 'Logbook Approval' };
    if (path.includes('reports')) return { category: null, title: 'Reports' };
    if (path.includes('profile')) return { category: null, title: 'Profile' };
    return { category: null, title: 'Dashboard' };
  };

  const pageHeader = getPageHeader();

  return (
    <div className="flex h-screen bg-[#F8FAFC] font-sans overflow-hidden">

      {/* --- MOBILE OVERLAY --- */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden backdrop-blur-sm transition-opacity"
          onClick={() => setIsSidebarOpen(false)}
        ></div>
      )}

      {/* --- SIDEBAR MENTOR --- */}
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

          <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden ml-auto text-white/70 hover:text-white transition-colors">
            <X size={24} />
          </button>
        </div>

        {/* MENU ITEMS */}
        <nav className="-mt-2 flex-1 px-4 py-8 space-y-2 overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:'none']">

          {canViewDashboard && (
            <Link to="/mentor/dashboard" onClick={() => setIsSidebarOpen(false)}>
              <div className={`flex items-center gap-4 px-6 py-4 rounded-2xl transition-all duration-200 cursor-pointer mb-2
                  ${isActive('/mentor/dashboard') ? 'bg-[#27345A] text-white shadow-md font-bold' : 'text-slate-50 hover:bg-white/10 hover:text-white'}
              `}>
                <LayoutDashboard size={22} />
                <span className="text-sm tracking-wide">Dashboard</span>
              </div>
            </Link>
          )}

          {canViewInternMonitoring && (
            <Link to="/mentor/internMonitoring" onClick={() => setIsSidebarOpen(false)}>
              <div className={`flex items-center gap-4 px-6 py-4 rounded-2xl transition-all duration-200 cursor-pointer mb-2
                  ${isActive('/mentor/internMonitoring') ? 'bg-[#27345A] text-white shadow-md font-bold' : 'text-slate-50 hover:bg-white/10 hover:text-white'}
              `}>
                <Users size={22} />
                <span className="text-sm tracking-wide">Intern Monitoring</span>
              </div>
            </Link>
          )}

          {/* ATTENDANCE DROPDOWN (Updated) */}
          {showAttendanceApprovalMenu && (
            <div>
              <div
                onClick={() => setIsAttendanceApprovalOpen(!isAttendanceApprovalOpen)}
                className={`flex items-center justify-between px-6 py-4 rounded-2xl cursor-pointer transition-all duration-200 group mb-1
                    ${isActive('/mentor/permission') || isActive('/mentor/corrections') || isActive('/mentor/logs')
                    ? 'text-white font-bold'
                    : 'text-slate-50 hover:bg-white/10 hover:text-white'}
                `}
              >
                <div className="flex items-center gap-4">
                  <Clock size={22} />
                  <span className="text-sm tracking-wide">Approval
                  </span>
                </div>
                {isAttendanceApprovalOpen ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
              </div>

              <div className={`overflow-hidden transition-all duration-500 ease-in-out ${isAttendanceApprovalOpen ? 'max-h-64 opacity-100' : 'max-h-0 opacity-0'}`}>
                <div className="ml-6 pl-4 border-l border-white/20 space-y-1 mt-1 mb-3">

                  {/* Permission */}
                  {canViewPermission && (
                    <Link to="/mentor/permission" onClick={() => setIsSidebarOpen(false)}>
                      <div className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm transition-all duration-200
                          ${isActive('/mentor/permission') ? 'bg-[#27345A] text-white font-bold shadow-sm' : 'text-slate-50 hover:text-white hover:bg-white/10'}
                      `}>
                        < FileClock size={18} />
                        <span>Leave Request</span>
                      </div>
                    </Link>
                  )}

                  {/* Corrections */}
                  {canViewCorrections && (
                    <Link to="/mentor/corrections" onClick={() => setIsSidebarOpen(false)}>
                      <div className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm transition-all duration-200
                          ${isActive('/mentor/corrections') ? 'bg-[#27345A] text-white font-bold shadow-sm' : 'text-slate-50 hover:text-white hover:bg-white/10'}
                      `}>
                        < Repeat size={18} />
                        <span>Corrections</span>
                      </div>
                    </Link>
                  )}

                  {/* Logs (New) */}
                  {canViewLogs && (
                    <Link to="/mentor/logs" onClick={() => setIsSidebarOpen(false)}>
                      <div className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm transition-all duration-200
                          ${isActive('/mentor/logs') ? 'bg-[#27345A] text-white font-bold shadow-sm' : 'text-slate-50 hover:text-white hover:bg-white/10'}
                      `}>
                        < ClipboardCheck size={18} />
                        <span>Logs</span>
                      </div>
                    </Link>
                  )}

                </div>
              </div>
            </div>
          )}

          {canViewLogbookApproval && (
            <Link to="/mentor/logbook" onClick={() => setIsSidebarOpen(false)}>
              <div className={`flex items-center gap-4 px-6 py-4 rounded-2xl transition-all duration-200 cursor-pointer mb-2
                  ${isActive('/mentor/logbook') ? 'bg-[#27345A] text-white shadow-md font-bold' : 'text-slate-50 hover:bg-white/10 hover:text-white'}
              `}>
                <FileCheck size={22} />
                <span className="text-sm tracking-wide">Logbook Approval</span>
              </div>
            </Link>
          )}

          {canViewEvaluation && (
            <Link to="/mentor/evaluationIntern" onClick={() => setIsSidebarOpen(false)}>
              <div className={`flex items-center gap-4 px-6 py-4 rounded-2xl transition-all duration-200 cursor-pointer mb-2
                  ${isActive('/mentor/evaluationIntern') ? 'bg-[#27345A] text-white shadow-md font-bold' : 'text-slate-50 hover:bg-white/10 hover:text-white'}
              `}>
                <div className="relative">
                  < Star size={12} className="absolute -top-1 -right-1 text-white" />
                  <User size={22} />
                </div>
                <span className="text-sm tracking-wide">Evaluation</span>
              </div>
            </Link>
          )}

          {canViewReports && (
            <Link to="/mentor/reports" onClick={() => setIsSidebarOpen(false)}>
              <div className={`flex items-center gap-4 px-6 py-4 rounded-2xl transition-all duration-200 cursor-pointer mb-2
                  ${isActive('/mentor/reports') ? 'bg-[#27345A] text-white shadow-md font-bold' : 'text-slate-50 hover:bg-white/10 hover:text-white'}
              `}>
                <Download size={22} />
                <span className="text-sm tracking-wide">Reports</span>
              </div>
            </Link>
          )}

          {/* MASTER DATA GROUP */}
          {showMasterDataMenu && (
              <div>
                  <div
                      onClick={() => setIsMasterDataOpen(!isMasterDataOpen)}
                      className={`flex items-center justify-between px-6 py-4 rounded-2xl cursor-pointer transition-all duration-200 group mb-1
        ${isActive('/mentor/master') ? 'text-white font-bold' : 'text-slate-50 hover:bg-white/10 hover:text-white'}
    `}
                  >
                      <div className="flex items-center gap-4">
                          <Users size={22} />
                          <span className="text-sm tracking-wide">Master Data</span>
                      </div>
                      {isMasterDataOpen ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                  </div>

                  <div className={`overflow-hidden transition-all duration-500 ease-in-out ${isMasterDataOpen ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'}`}>
                      <div className="ml-6 pl-4 border-l border-white/20 space-y-1 mt-1 mb-3">
                          {canViewUserRole && (
                              <Link to="/mentor/masterdata/userRole" onClick={() => setIsSidebarOpen(false)}>
                                  <div className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm transition-all duration-200 ${isActive('/mentor/masterdata/userRole') ? 'bg-[#27345A] font-bold shadow-sm' : 'text-slate-50 hover:bg-white/10  hover:text-white'}`}>
                                      <UserCog size={18} /> <span>User Management</span>
                                  </div>
                              </Link>
                          )}
                          {canViewUserPermission && (
                              <Link to="/mentor/masterdata/userPermission" onClick={() => setIsSidebarOpen(false)}>
                                  <div className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm transition-all duration-200 ${isActive('/mentor/masterdata/userPermission') ? 'bg-[#27345A] font-bold shadow-sm' : 'text-slate-50 hover:bg-white/10 hover:text-white'}`}>
                                      <Settings size={18} /> <span>User Role & Permission</span>
                                  </div>
                              </Link>
                          )}
                          {canViewInternProfiles && (
                              <Link to="/mentor/masterdata/internProfile" onClick={() => setIsSidebarOpen(false)}>
                                  <div className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm transition-all duration-200 ${isActive('/mentor/masterdata/internProfile') ? 'bg-[#27345A] font-bold shadow-sm' : 'text-slate-50 hover:bg-white/10 hover:text-white'}`}>
                                      <Briefcase size={18} /> <span>Intern Profiles</span>
                                  </div>
                              </Link>
                          )}
                          {canViewInternMapping && (
                              <Link to="/mentor/masterdata/internMapping" onClick={() => setIsSidebarOpen(false)}>
                                  <div className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm transition-all duration-200 ${isActive('/mentor/masterdata/internMapping') ? 'bg-[#27345A] font-bold shadow-sm' : 'text-slate-50 hover:bg-white/10 hover:text-white'}`}>
                                      <Users size={18} /> <span>Intern Mapping</span>
                                  </div>
                              </Link>
                          )}
                          {canViewOfficeLocations && (
                              <Link to="/mentor/masterdata/officeLocation" onClick={() => setIsSidebarOpen(false)}>
                                  <div className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm transition-all duration-200 ${isActive('/mentor/masterdata/officeLocation') ? 'bg-[#27345A] font-bold shadow-sm' : 'text-slate-50 hover:bg-white/10 hover:text-white'}`}>
                                      <MapPin size={18} /> <span>Office Locations</span>
                                  </div>
                              </Link>
                          )}
                          {canViewWorkingSchedule && (
                              <Link to="/mentor/masterdata/workingSchedule" onClick={() => setIsSidebarOpen(false)}>
                                  <div className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm transition-all duration-200 ${isActive('/mentor/masterdata/workingSchedule') ? 'bg-[#27345A] font-bold shadow-sm' : 'text-slate-50 hover:bg-white/10 hover:text-white'}`}>
                                      <Calendar size={18} /> <span>Working Schedule</span>
                                  </div>
                              </Link>
                          )}
                          {canViewEvaluationTemplate && (
                              <Link to="/mentor/masterdata/evaluation" onClick={() => setIsSidebarOpen(false)}>
                                  <div className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm transition-all duration-200 ${isActive('/mentor/masterdata/evaluation') ? 'bg-[#27345A] font-bold shadow-sm' : 'text-slate-50 hover:bg-white/10 hover:text-white'}`}>
                                      <BookOpen size={18} /> <span>Evaluation Component</span>
                                  </div>
                              </Link>
                          )}
                      </div>
                  </div>
              </div>
          )}
          {canViewProfile && (
            <Link to="/mentor/profile" onClick={() => setIsSidebarOpen(false)}>
              <div className={`flex items-center gap-4 px-6 py-4 rounded-2xl transition-all duration-200 cursor-pointer mb-2
                  ${isActive('/mentor/profile') ? 'bg-[#27345A] text-white shadow-md font-bold' : 'text-slate-50 hover:bg-white/10 hover:text-white'}
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
        <header className="h-20 bg-white border-b border-slate-200 flex items-center justify-between px-6 md:px-10 shadow-sm sticky top-0 z-30 shrink-0">

          <div className="flex items-center gap-2 text-lg">
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="p-2 -ml-2 mr-2 text-slate-500 hover:bg-slate-100 rounded-lg lg:hidden transition-colors"
            >
              <Menu size={24} />
            </button>

            <span className="font-bold text-[#3B5998] hidden sm:inline --ml">SIP</span>
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

            <TopbarNotificationBell />

            {/* Profile Dropdown */}
            <div className="relative">
              <button
                onClick={() => setIsProfileDropdownOpen(!isProfileDropdownOpen)}
                className="flex items-center gap-3 focus:outline-none group"
              >
                <div className="text-right hidden md:block">
                  <p className="text-sm font-bold text-slate-900 leading-tight">{getFirstName(user.nama_lengkap)}</p>
                  <div className={roleBadgeClass(user.role)}>
                    {formatRole(user.role)}
                  </div>
                </div>
                <div className="h-11 w-11 rounded-full bg-slate-100 border-2 border-white shadow-sm overflow-hidden cursor-pointer hover:ring-2 hover:ring-[#203266] transition-all">
                  <img
                    src={secureAvatarUrl || `https://ui-avatars.com/api/?name=${user.nama_lengkap}&background=0D8ABC&color=fff`}
                    alt="Profile"
                    className="w-full h-full object-cover"
                  />
                </div>
                <ChevronDown size={16} className={`text-slate-400 transition-transform duration-200 ${isProfileDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

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
                      <div className="px-4 py-3 border-b border-slate-50 md:hidden">
                        <p className="text-sm font-bold text-[#27345A] truncate">{user.nama_lengkap}</p>
                        <p className="text-xs text-slate-400 font-medium">{formatRole(user.role)}</p>
                      </div>

                      {/* SWITCH ACCOUNT SECTION */}
                      {user.availableRoles && user.availableRoles.length > 1 && (
                        <div className="py-2 border-b border-slate-50">
                          <p className="px-4 text-[10px] uppercase font-extrabold text-slate-400 mb-1 tracking-wider">Switch Account</p>
                          {user.availableRoles.map((role) => (
                            <button
                              key={role}
                              onClick={() => handleSwitchRole(role)}
                              disabled={String(role).toLowerCase() === String(user.role).toLowerCase()}
                              className={`w-full flex items-center justify-between px-4 py-2.5 text-sm transition-colors ${String(role).toLowerCase() === String(user.role).toLowerCase()
                                ? 'bg-slate-50 text-[#354C8F] font-bold cursor-default'
                                : 'text-slate-600 hover:bg-slate-50 hover:text-[#354C8F]'
                                }`}
                            >
                              <div className="flex items-center gap-2">
                                <Repeat size={14} className={String(role).toLowerCase() === String(user.role).toLowerCase() ? 'opacity-100' : 'opacity-50'} />
                                {formatRole(role)}
                              </div>
                              {String(role).toLowerCase() === String(user.role).toLowerCase() && <CheckCircle2 size={16} className="text-green-500" />}
                            </button>
                          ))}
                        </div>
                      )}

                      {/* Menu Links */}
                      <div className="py-1">
                        {canViewProfile && (
                          <Link
                            to="/mentor/profile"
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

        <main className="flex-1 overflow-x-hidden overflow-y-auto p-6 md:p-8 bg-[#F8FAFC] mentor-font">
          <AnimatePresence mode="wait">
            <PageTransition key={location.pathname}>
              <AnimatedOutlet />
            </PageTransition>
          </AnimatePresence>
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

export default MentorLayout;