import { useState, useEffect, useCallback } from 'react';
import { Outlet, Link, useLocation, useNavigate, useOutlet } from 'react-router-dom';
import {
    LayoutDashboard,
    Clock,
    CalendarCheck,
    FileText,
    Download,
    Users,
    User,
    Star,
    LogOut,
    ChevronDown,
    ChevronRight,
    Menu,
    X,
    FileCheck,
    Briefcase,
    MapPin,
    Settings,
    UserCog,
    Calendar,
    Repeat,
    CheckCircle2,
    Bell,
    AlertTriangle,
    FileClock,
    ClipboardCheck,
    BookOpen,
    Tag
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

const AdminLayout = () => {
    // --- STATE UI ---
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
    const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);
    const [userPermissions, setUserPermissions] = useState(null); // null = loading, [] = no permissions
    const [notAllowedDialog, setNotAllowedDialog] = useState({ open: false, nextPath: '' });

    // State Dropdown Sidebar (Default False semua agar tertutup)
    const [expandedMenus, setExpandedMenus] = useState({
        attendance: false,
        masterData: false
    });

    // --- STATE USER & ROLE ---
    const [user, setUser] = useState({
        name: "Loading...",
        role: "admin",
        avatar: null,
        availableRoles: []
    });

    // Secure photo for topbar
    const [secureAvatarUrl, setSecureAvatarUrl] = useState(null);

    const location = useLocation();
    const navigate = useNavigate();

    // --- STYLE CONSTANTS ---
    const btnPrimaryClass = "w-full bg-[#354C8F] hover:bg-[#1F2B4D] text-white py-3 px-6 rounded-xl active:scale-95 transition-all font-bold text-sm shadow-md shadow-indigo-200 flex items-center justify-center gap-2";
    const btnSecondaryClass = "w-full bg-white border border-slate-300 text-slate-700 py-3 px-6 rounded-xl active:scale-95 transition-all font-bold text-sm flex items-center justify-center gap-2 hover:bg-slate-50";

    // Role badge color helper
    const roleBadgeClass = (role) => {
        const r = String(role || '').toLowerCase();
        if (r.includes('admin')) return 'inline-block px-3 py-0.5 bg-[#1F2B4D] text-white text-[10px] font-bold rounded-full mt-0.5'; // dark blue
        if (r.includes('intern')) return 'inline-block px-3 py-0.5 bg-[#FB923C] text-white text-[10px] font-bold rounded-full mt-0.5'; // orange
        if (r.includes('mentor')) return 'inline-block px-3 py-0.5 bg-[#7C3AED] text-white text-[10px] font-bold rounded-full mt-0.5'; // purple
        return 'inline-block px-3 py-0.5 bg-[#27345A] text-white text-[10px] font-bold rounded-full mt-0.5';
    };

    // --- 1. FETCH REAL DATA FROM LOCALSTORAGE ---
    useEffect(() => {
        try {
            const storedName = localStorage.getItem('nama_lengkap');
            const storedFoto = localStorage.getItem('foto');

            // Ambil role yang sedang aktif (prioritas active_role, fallback ke role biasa)
            const storedActiveRole = localStorage.getItem('active_role') || localStorage.getItem('role') || 'admin';
            const storedRolesString = localStorage.getItem('roles');

            let parsedRoles = [];
            if (storedRolesString) {
                try {
                    parsedRoles = JSON.parse(storedRolesString);
                    if (!Array.isArray(parsedRoles)) {
                        parsedRoles = [parsedRoles];
                    }
                } catch (e) {
                    console.error("Gagal parse roles:", e);
                    parsedRoles = [storedActiveRole];
                }
            } else {
                parsedRoles = [storedActiveRole];
            }

            setUser({
                name: storedName || "Admin User",
                role: storedActiveRole,
                avatar: storedFoto,
                availableRoles: parsedRoles
            });

        } catch (error) {
            console.error("Error loading user data:", error);
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
            const activeRole = localStorage.getItem('active_role') || localStorage.getItem('role') || 'admin';
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

        // Re-fetch immediately when permissions are changed (e.g. from UserPermission page)
        const handlePermUpdate = () => fetchMyPermissions();
        window.addEventListener('permissions-updated', handlePermUpdate);

        return () => {
            clearInterval(intervalId);
            window.removeEventListener('permissions-updated', handlePermUpdate);
        };
    }, [fetchMyPermissions]);

    // --- HELPERS ---
    const toggleSubMenu = (menuKey) => {
        setExpandedMenus(prev => ({
            ...prev,
            [menuKey]: !prev[menuKey]
        }));
    };

    const getFirstName = (fullName) => {
        if (!fullName) return "Admin";
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
    const canViewLogbookMonitoring = can('view_logbook');
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

    const canViewLogbookTags = can('view_logbook_tags');

    const showAttendanceMenu = canViewPermission || canViewCorrections || canViewLogs;
    const showMasterDataMenu = canViewUserRole || canViewUserPermission || canViewInternProfiles || canViewInternMapping || canViewOfficeLocations || canViewWorkingSchedule || canViewEvaluationTemplate || canViewLogbookTags;

    const getFirstAllowedPath = () => {
        const ordered = [
            { allowed: canViewDashboard, path: '/admin/dashboard' },
            { allowed: canViewInternMonitoring, path: '/admin/internMonitoring' },
            { allowed: canViewPermission, path: '/admin/permission' },
            { allowed: canViewCorrections, path: '/admin/corrections' },
            { allowed: canViewLogs, path: '/admin/logs' },
            { allowed: canViewLogbookMonitoring, path: '/admin/logbook' },
            { allowed: canViewEvaluation, path: '/admin/evaluation' },
            { allowed: canViewReports, path: '/admin/reports' },
            { allowed: canViewUserRole, path: '/admin/masterdata/userRole' },
            { allowed: canViewUserPermission, path: '/admin/masterdata/userPermission' },
            { allowed: canViewInternProfiles, path: '/admin/masterdata/internProfile' },
            { allowed: canViewInternMapping, path: '/admin/masterdata/internMapping' },
            { allowed: canViewOfficeLocations, path: '/admin/masterdata/officeLocation' },
            { allowed: canViewWorkingSchedule, path: '/admin/masterdata/workingSchedule' },
            { allowed: canViewEvaluationTemplate, path: '/admin/masterdata/evaluation' },
            { allowed: canViewLogbookTags, path: '/admin/masterdata/tags' },
            { allowed: canViewProfile, path: '/admin/profile' }
        ];

        const first = ordered.find(item => item.allowed);
        return first ? first.path : '/login';
    };

    useEffect(() => {
        if (!userPermissions) return;

        const currentPath = location.pathname;
        const allowedMap = [
            { path: '/admin/dashboard', allowed: canViewDashboard },
            { path: '/admin/internMonitoring', allowed: canViewInternMonitoring },
            { path: '/admin/interns', allowed: canViewInternMonitoring },
            { path: '/admin/permission', allowed: canViewPermission },
            { path: '/admin/corrections', allowed: canViewCorrections },
            { path: '/admin/logs', allowed: canViewLogs },
            { path: '/admin/logbook', allowed: canViewLogbookMonitoring },
            { path: '/admin/evaluation', allowed: canViewEvaluation },
            { path: '/admin/reports', allowed: canViewReports },
            { path: '/admin/masterdata/userRole', allowed: canViewUserRole },
            { path: '/admin/masterdata/userPermission', allowed: canViewUserPermission },
            { path: '/admin/masterdata/internProfile', allowed: canViewInternProfiles },
            { path: '/admin/masterdata/internMapping', allowed: canViewInternMapping },
            { path: '/admin/masterdata/officeLocation', allowed: canViewOfficeLocations },
            { path: '/admin/masterdata/workingSchedule', allowed: canViewWorkingSchedule },
            { path: '/admin/masterdata/evaluation', allowed: canViewEvaluationTemplate },
            { path: '/admin/masterdata/tags', allowed: canViewLogbookTags },
            { path: '/admin/profile', allowed: canViewProfile }
        ];

        const currentRule = allowedMap.find(item => currentPath.startsWith(item.path));
        if (currentRule && !currentRule.allowed) {
            const nextPath = getFirstAllowedPath();
            setNotAllowedDialog({ open: true, nextPath });
        }
    }, [userPermissions, location.pathname, canViewDashboard, canViewInternMonitoring, canViewPermission, canViewCorrections, canViewLogs, canViewLogbookMonitoring, canViewEvaluation, canViewReports, canViewUserRole, canViewUserPermission, canViewInternProfiles, canViewInternMapping, canViewOfficeLocations, canViewWorkingSchedule, canViewEvaluationTemplate, canViewProfile]);

    useEffect(() => {
        setExpandedMenus(prev => ({
            ...prev,
            attendance: showAttendanceMenu ? prev.attendance : false,
            masterData: showMasterDataMenu ? prev.masterData : false
        }));
    }, [showAttendanceMenu, showMasterDataMenu]);

    // --- LOGIC SWITCH ACCOUNT (UPDATED FIX) ---
    const handleSwitchRole = (targetRole) => {
        setIsProfileDropdownOpen(false);

        // 1. UPDATE SEMUA KEY ROLE DI LOCALSTORAGE (Agar Route Protection Valid)
        const lowerRole = targetRole.toLowerCase(); // Standarisasi ke huruf kecil

        localStorage.setItem('active_role', lowerRole);
        localStorage.setItem('role', lowerRole); // Ini KUNCI agar tidak dilempar ke login!

        // 2. Update state lokal
        setUser(prev => ({ ...prev, role: lowerRole }));

        // 3. Redirect ke dashboard yang sesuai
        // Gunakan 'replace: true' agar history bersih
        if (lowerRole === 'mentor') {
            navigate('/mentor/dashboard', { replace: true });
        } else if (lowerRole === 'admin') {
            navigate('/admin/dashboard', { replace: true });
        } else if (lowerRole === 'intern') {
            navigate('/magang/dashboard', { replace: true });
        }
    };

    // --- LOGIC LOGOUT ---
    const confirmLogout = () => {
        setIsLogoutModalOpen(false);
        localStorage.clear();

        // --- MODIFIKASI: Kirim state loggedOut: true ---
        navigate('/login', {
            state: { loggedOut: true },
            replace: true
        });
    };

    const getPageHeader = () => {
        const path = location.pathname.toLowerCase();

        if (path.includes('dashboard')) return { category: null, title: 'Dashboard' };

        if (path.includes('ending-soon')) return { category: null, title: 'Ending Soon Interns' };
        if (path.includes('/admin/interns/')) return { category: 'Intern Monitoring', title: 'Detail' };
        // List page or other intern-related paths
        if (path.includes('/admin/interns') || path.includes('interns')) return { category: null, title: 'Intern Monitoring' };

        // Normalize to lowercase path matches — route uses camelCase but location.pathname is lowercased
        if (path.includes('/admin/internmonitoring') || path.includes('internmonitoring')) return { category: null, title: 'Intern Monitoring' };
        if (path.includes('attendance')) return { category: 'Attendance', title: 'Logs' }; // Ubah category jadi Attendance
        // if (path.includes('logbook')) return { category: null, title: 'Logbook Monitoring' };
        if (path.includes('reports')) return { category: null, title: 'Reports' };
        if (path.includes('generate-sertif')) return { category: null, title: 'Generate Certificate' };
        if (path.includes('evaluation')) return { category: null, title: 'Evaluation' };

        // Masterdata pages (check before generic profile match)
        if (path.includes('user-role') || path.includes('userrole')) return { category: 'Master Data', title: 'User Management' };
        if (path.includes('user-permission') || path.includes('userpermission')) return { category: 'Master Data', title: 'User Role & Permission' };
        if (path.includes('intern-profile') || path.includes('internprofile')) return { category: 'Master Data', title: 'Intern Profiles' };
        if (path.includes('intern-mapping') || path.includes('internmapping')) return { category: 'Master Data', title: 'Intern Mapping' };
        if (path.includes('office')) return { category: 'Master Data', title: 'Office Locations' };
        if (path.includes('schedule')) return { category: 'Master Data', title: 'Working Schedule' };
        if (path.includes('/admin/masterdata/tags')) return { category: 'Master Data', title: 'Logbook Tags' };

        if (path.includes('/admin/profile')) return { category: null, title: 'Profile' };

        if (path.includes('permission')) return { category: 'Attendance', title: 'Leave Request' }; // Ubah category jadi Attendance
        if (path.includes('corrections')) return { category: 'Attendance', title: 'Corrections' }; // Ubah category jadi Attendance
        if (path.includes('logs')) return { category: 'Attendance', title: 'Logs' }; // Ubah category jadi Attendance

        return { category: null, title: 'Admin Panel' };
    };

    const pageHeader = getPageHeader();

    useEffect(() => {
        const path = location.pathname.toLowerCase();
        const isAttendancePath = path.includes('/admin/permission') || path.includes('/admin/corrections') || path.includes('/admin/logs') || path.includes('/attendance');
        const isMasterDataPath = path.includes('/admin/masterdata') || path.includes('/admin/master');
        setExpandedMenus(prev => ({ ...prev, attendance: isAttendancePath, masterData: isMasterDataPath }));
    }, [location.pathname]);




    return (
        <div className="flex h-screen bg-[#F8FAFC] font-sans overflow-hidden">

            {/* --- MOBILE OVERLAY --- */}
            {isSidebarOpen && (
                <div
                    className="fixed inset-0 z-40 bg-black/50 lg:hidden backdrop-blur-sm transition-opacity"
                    onClick={() => setIsSidebarOpen(false)}
                ></div>
            )}

            {/* --- SIDEBAR ADMIN --- */}
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
                <nav className=" -mt-2 flex-1 px-4 py-8 space-y-2 overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:'none']">

                    {canViewDashboard && (
                        <Link to="/admin/dashboard" onClick={() => setIsSidebarOpen(false)}>
                            <div className={`flex items-center gap-4 px-6 py-4 rounded-2xl transition-all duration-200 cursor-pointer mb-2
                ${isActive('/admin/dashboard') ? 'bg-[#27345A] text-white shadow-md font-bold' : 'text-slate-50 hover:bg-white/10 hover:text-white'}
            `}>
                                <LayoutDashboard size={22} />
                                <span className="text-sm tracking-wide">Dashboard</span>
                            </div>
                        </Link>
                    )}

                    {canViewInternMonitoring && (
                        <Link to="/admin/internMonitoring" onClick={() => setIsSidebarOpen(false)}>
                            <div className={`flex items-center gap-4 px-6 py-4 rounded-2xl transition-all duration-200 cursor-pointer mb-2
                ${isActive('/admin/internMonitoring') ? 'bg-[#27345A] text-white shadow-md font-bold' : 'text-slate-50 hover:bg-white/10 hover:text-white'}
            `}>
                                <ClipboardCheck size={22} />
                                <span className="text-sm tracking-wide">Intern Monitoring</span>
                            </div>
                        </Link>
                    )}
                    {/* ATTENDANCE GROUP (Permission, Correction, Logs) */}
                    {showAttendanceMenu && (
                        <div>
                            <div
                                onClick={() => toggleSubMenu('attendance')}
                                className={`flex items-center justify-between px-6 py-4 rounded-2xl cursor-pointer transition-all duration-200 group mb-1
                  ${isActive('/admin/permission') || isActive('/admin/corrections') || isActive('/admin/logs') ? ' text-white  font-bold' : 'text-slate-50 hover:bg-white/10 hover:text-white'}
              `}
                            >
                                <div className="flex items-center gap-4">
                                    <Clock size={22} />
                                    <span className={`text-sm tracking-wide ${isActive('/admin/permission') || isActive('/admin/corrections') || isActive('/admin/logs') ? 'font-bold' : ''}`}>Attendance</span>
                                </div>
                                {expandedMenus.attendance ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                            </div>

                            <div className={`overflow-hidden transition-all duration-500 ease-in-out ${expandedMenus.attendance ? 'max-h-64 opacity-100' : 'max-h-0 opacity-0'}`}>
                                <div className="ml-6 pl-4 border-l border-white/20 space-y-1 mt-1 mb-3">

                                    {/* Permission Submenu */}
                                    {canViewPermission && (
                                        <Link to="/admin/permission" onClick={() => setIsSidebarOpen(false)}>
                                            <div className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm transition-all duration-200 ${isActive('/admin/permission') ? 'bg-[#27345A] font-bold shadow-sm' : 'text-slate-50 hover:bg-white/10 hover:text-white'}`}>
                                                <FileText size={18} />
                                                <span>Leave Request</span>
                                            </div>
                                        </Link>
                                    )}

                                    {/* Corrections Submenu */}
                                    {canViewCorrections && (
                                        <Link to="/admin/corrections" onClick={() => setIsSidebarOpen(false)}>
                                            <div className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm transition-all duration-200 ${isActive('/admin/corrections') ? 'bg-[#27345A] font-bold shadow-sm' : 'text-slate-50 hover:bg-white/10 hover:text-white'}`}>
                                                <Repeat size={18} />
                                                <span>Corrections</span>
                                            </div>
                                        </Link>
                                    )}

                                    {/* Logs Submenu (Moved Here) */}
                                    {canViewLogs && (
                                        <Link to="/admin/logs" onClick={() => setIsSidebarOpen(false)}>
                                            <div className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm transition-all duration-200 ${isActive('/admin/logs') ? 'bg-[#27345A] font-bold shadow-sm' : 'text-slate-50 hover:bg-white/10 hover:text-white'}`}>
                                                <Clock size={18} />
                                                <span>Logs</span>
                                            </div>
                                        </Link>
                                    )}

                                </div>
                            </div>
                        </div>
                    )}

                    {canViewLogbookMonitoring && (
                        <Link to="/admin/logbook" onClick={() => setIsSidebarOpen(false)}>
                            <div className={`flex items-center gap-4 px-6 py-4 rounded-2xl transition-all duration-200 cursor-pointer mb-2
                ${isActive('/admin/logbook') ? 'bg-[#27345A] text-white shadow-md font-bold' : 'text-slate-50 hover:bg-white/10 hover:text-white'}
            `}>
                                <FileCheck size={22} />
                                <span className="text-sm tracking-wide">Logbook Monitoring</span>
                            </div>
                        </Link>
                    )}
                    {canViewEvaluation && (
                        <Link to="/admin/evaluation" onClick={() => setIsSidebarOpen(false)}>
                            <div className={`flex items-center gap-4 px-6 py-4 rounded-2xl transition-all duration-200 cursor-pointer mb-2
                ${isActive('/admin/evaluation') ? 'bg-[#27345A] text-white shadow-md font-bold' : 'text-slate-50 hover:bg-white/10 hover:text-white'}
            `}>
                                <div className="relative">
                                    <Star size={12} className="absolute -top-1 -right-1 text-white" />

                                    <User size={22} />
                                </div>
                                <span className="text-sm tracking-wide">Evaluation</span>
                            </div>
                        </Link>
                    )}
                    {canViewReports && (
                        <Link to="/admin/reports" onClick={() => setIsSidebarOpen(false)}>
                            <div className={`flex items-center gap-4 px-6 py-4 rounded-2xl transition-all duration-200 cursor-pointer mb-2
                ${isActive('/admin/reports') ? 'bg-[#27345A] text-white shadow-md font-bold' : 'text-slate-50 hover:bg-white/10 hover:text-white'}
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
                                onClick={() => toggleSubMenu('masterData')}
                                className={`flex items-center justify-between px-6 py-4 rounded-2xl cursor-pointer transition-all duration-200 group mb-1
                  ${isActive('/admin/master') ? 'text-white font-bold' : 'text-slate-50 hover:bg-white/10 hover:text-white'}
              `}
                            >
                                <div className="flex items-center gap-4">
                                    <Users size={22} />
                                    <span className="text-sm tracking-wide">Master Data</span>
                                </div>
                                {expandedMenus.masterData ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                            </div>

                            <div className={`overflow-hidden transition-all duration-500 ease-in-out ${expandedMenus.masterData ? 'max-h-[1000px] opacity-100' : 'max-h-0 opacity-0'}`}>
                                <div className="ml-6 pl-4 border-l border-white/20 space-y-1 mt-1 mb-3">
                                    {canViewUserRole && (
                                        <Link to="/admin/masterdata/userRole" onClick={() => setIsSidebarOpen(false)}>
                                            <div className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm transition-all duration-200 ${isActive('/admin/masterdata/userRole') ? 'bg-[#27345A] font-bold shadow-sm' : 'text-slate-50 hover:bg-white/10  hover:text-white'}`}>
                                                <UserCog size={18} /> <span>User Management</span>
                                            </div>
                                        </Link>
                                    )}
                                    {canViewUserPermission && (
                                        <Link to="/admin/masterdata/userPermission" onClick={() => setIsSidebarOpen(false)}>
                                            <div className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm transition-all duration-200 ${isActive('/admin/masterdata/userPermission') ? 'bg-[#27345A] font-bold shadow-sm' : 'text-slate-50 hover:bg-white/10 hover:text-white'}`}>
                                                <Settings size={18} /> <span>User Role & Permission</span>
                                            </div>
                                        </Link>
                                    )}
                                    {canViewInternProfiles && (
                                        <Link to="/admin/masterdata/internProfile" onClick={() => setIsSidebarOpen(false)}>
                                            <div className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm transition-all duration-200 ${isActive('/admin/masterdata/internProfile') ? 'bg-[#27345A] font-bold shadow-sm' : 'text-slate-50 hover:bg-white/10 hover:text-white'}`}>
                                                <Briefcase size={18} /> <span>Intern Profiles</span>
                                            </div>
                                        </Link>
                                    )}
                                    {canViewInternMapping && (
                                        <Link to="/admin/masterdata/internMapping" onClick={() => setIsSidebarOpen(false)}>
                                            <div className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm transition-all duration-200 ${isActive('/admin/masterdata/internMapping') ? 'bg-[#27345A] font-bold shadow-sm' : 'text-slate-50 hover:bg-white/10 hover:text-white'}`}>
                                                <Users size={18} /> <span>Intern Mapping</span>
                                            </div>
                                        </Link>
                                    )}
                                    {canViewOfficeLocations && (
                                        <Link to="/admin/masterdata/officeLocation" onClick={() => setIsSidebarOpen(false)}>
                                            <div className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm transition-all duration-200 ${isActive('/admin/masterdata/officeLocation') ? 'bg-[#27345A] font-bold shadow-sm' : 'text-slate-50 hover:bg-white/10 hover:text-white'}`}>
                                                <MapPin size={18} /> <span>Office Locations</span>
                                            </div>
                                        </Link>
                                    )}
                                    {canViewWorkingSchedule && (
                                        <Link to="/admin/masterdata/workingSchedule" onClick={() => setIsSidebarOpen(false)}>
                                            <div className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm transition-all duration-200 ${isActive('/admin/masterdata/workingSchedule') ? 'bg-[#27345A] font-bold shadow-sm' : 'text-slate-50 hover:bg-white/10 hover:text-white'}`}>
                                                <Calendar size={18} /> <span>Working Schedule</span>
                                            </div>
                                        </Link>
                                    )}
                                    {canViewEvaluationTemplate && (
                                        <Link to="/admin/masterdata/evaluation" onClick={() => setIsSidebarOpen(false)}>
                                            <div className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm transition-all duration-200 ${isActive('/admin/masterdata/evaluation') ? 'bg-[#27345A] font-bold shadow-sm' : 'text-slate-50 hover:bg-white/10 hover:text-white'}`}>
                                                <BookOpen size={18} /> <span>Evaluation Component</span>
                                            </div>
                                        </Link>
                                    )}
                                    {canViewLogbookTags && (
                                        <Link to="/admin/masterdata/tags" onClick={() => setIsSidebarOpen(false)}>
                                            <div className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm transition-all duration-200 ${isActive('/admin/masterdata/tags') ? 'bg-[#27345A] font-bold shadow-sm' : 'text-slate-50 hover:bg-white/10 hover:text-white'}`}>
                                                <Tag size={18} /> <span>Logbook Tags</span>
                                            </div>
                                        </Link>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* PROFILE */}
                    {canViewProfile && (
                        <Link to="/admin/profile" onClick={() => setIsSidebarOpen(false)}>
                            <div className={`flex items-center gap-4 px-6 py-4 rounded-2xl transition-all duration-200 cursor-pointer mt-2
                ${isActive('/admin/profile') ? 'bg-[#27345A] text-white shadow-md font-bold' : 'text-slate-50 hover:bg-white/10 hover:text-white'}
            `}>
                                <User size={22} />
                                <span className="text-sm tracking-wide">Profile</span>
                            </div>
                        </Link>
                    )}

                </nav>
            </aside>

            {/* --- MAIN CONTENT AREA --- */}
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

                        <TopbarNotificationBell />

                        {/* Profile Dropdown */}
                        <div className="relative">
                            <button
                                onClick={() => setIsProfileDropdownOpen(!isProfileDropdownOpen)}
                                className="flex items-center gap-3 focus:outline-none group"
                            >
                                <div className="text-right hidden md:block">
                                    <p className="text-sm font-bold text-slate-900 leading-tight">{getFirstName(user.name)}</p>
                                    <div className={roleBadgeClass(user.role)}>
                                        {formatRole(user.role)}
                                    </div>
                                </div>
                                <div className="h-11 w-11 rounded-full bg-slate-100 border-2 border-white shadow-sm overflow-hidden cursor-pointer hover:ring-2 hover:ring-[#203266] transition-all">
                                    <img
                                        src={secureAvatarUrl || `https://ui-avatars.com/api/?name=${user.name}&background=FCD34D`}
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
                                                <p className="text-sm font-bold text-[#27345A] truncate">{user.name}</p>
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
                                                        to="/admin/profile"
                                                        onClick={() => setIsProfileDropdownOpen(false)}
                                                        className="flex items-center px-4 py-2.5 text-sm text-slate-600 hover:bg-slate-50 hover:text-[#354C8F] transition-colors"
                                                    >
                                                        <User size={16} className="mr-2" /> Profile
                                                    </Link>
                                                )}
                                                <button
                                                    onClick={() => setIsLogoutModalOpen(true)}
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

                <main className="flex-1 overflow-x-hidden overflow-y-auto p-6 md:p-8 bg-[#F8FAFC] admin-font">
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
                            <button
                                onClick={() => setIsLogoutModalOpen(false)}
                                className={btnSecondaryClass}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={confirmLogout}
                                className={btnPrimaryClass}
                            >
                                Yes, Logout
                            </button>
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

export default AdminLayout;