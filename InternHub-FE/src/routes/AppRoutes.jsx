import { Routes, Route, Navigate } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion'; // Pastikan ini diimport
// --- IMPORT LAYOUT ---
import MagangLayout from '../Layout/MagangLayout';
import AuthLayout from '../Layout/AuthLayout';
import MentorLayout from '../Layout/MentorLayout';
import AdminLayout from '../Layout/AdminLayout'; // Pastikan diimport jika dipakai
import ProtectedRoute from '../Layout/ProtectedRoute';
import GuestRoute from '../Layout/GuestRoute';

// --- IMPORT PAGES ---
import Login from '../pages/Auth/Login';
import ForgotPassword from '../pages/Auth/ForgotPassword';
import OtpVerification from '../pages/Auth/OtpVerification';
import ResetPassword from '../pages/Auth/ResetPassword';
import ForceChangePassword from '../pages/Auth/ForceChangePassword';
import Dashboard from '../pages/Magang/Dashboard';
import Attendance from '../pages/Magang/Attendance';
import Permission from '../pages/Magang/Permission';
import Correction from '../pages/Magang/Correction';
import Profile from '../pages/Magang/Profile';
import History from '../pages/Magang/History';
import Logbook from '../pages/Magang/Logbook';
import ResultEvaluation from '../pages/Magang/ResultEvaluation';
import DashboardMentor from '../pages/Mentor/Dashboard';
import FileViewer from '../pages/Magang/FileViewer';
import InternMonitoring from '../pages/Mentor/InternMonitoring';
import PermissionApproval from '../pages/Mentor/Permission';
import CorrectionApproval from '../pages/Mentor/Corrections';
import ProfileMentor from '../pages/Mentor/Profile';
import ReportsMentor from '../pages/Mentor/Reports';
import AdminDashboard from '../pages/Admin/Dashboard';
import AdminPermission from '../pages/Admin/Permission';
import AdminCorrection from '../pages/Admin/Corrections';
import Logs from '../pages/Mentor/Logs';
import DetailIntern from '../pages/Mentor/DetailIntern';
import DetailInternAdmin from '../pages/Admin/DetailInternAdmin';
import EndingSoonInterns from '../pages/Admin/EndingSoonInterns';
import EndingSoonInternsMentor from '../pages/Mentor/EndingSoonInterns';
import InternMonitoringAdmin from '../pages/Admin/InternMonitoring';
import AdminLogs from '../pages/Admin/Logs';
import UserRole from '../pages/Admin/Masterdata/UserRole';
import UserPermission from '../pages/Admin/Masterdata/UserPermission';
import InternProfile from '../pages/Admin/Masterdata/InternProfile';
import InternMapping from '../pages/Admin/Masterdata/InternMapping';
import OfficeLocation from '../pages/Admin/Masterdata/Officelocation';
import WorkingSchedule from '../pages/Admin/Masterdata/WorkingSchedule';
import Evaluation from '../pages/Admin/Masterdata/Evaluation';
import Tags from '../pages/Admin/Masterdata/Tags';
import AdminReports from '../pages/Admin/Reports';
import AdminLogbook from '../pages/Admin/Logbook';
import AdminEvaluation from '../pages/Admin/Evaluation';
import GenerateSertif from '../pages/Admin/GenerateSertif';
import ProfileAdmin from '../pages/Admin/Profile';
import LogbookMentor from '../pages/Mentor/Logbook';
import EvaluationMentor from '../pages/Mentor/EvaluationIntern';

const AppRoutes = () => {
  return (<AnimatePresence mode="wait">

    <Routes>


      {/* --- BAGIAN 1: AUTHENTICATION --- */}
      <Route element={<GuestRoute />}>
        <Route element={<AuthLayout />}>
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/login" element={<Login />} />
          <Route path="/auth/forgot-password" element={<ForgotPassword />} />
          <Route path="/auth/otp-verification" element={<OtpVerification />} />
          <Route path="/auth/reset-password" element={<ResetPassword />} />
        </Route>
      </Route>

      {/* --- FORCE CHANGE PASSWORD (Unclosable) --- */}
      <Route element={<ProtectedRoute />}>
        <Route path="/force-change-password" element={<ForceChangePassword />} />
      </Route>

      {/* --- BAGIAN 2: MAGANG ROUTES --- */}
      {/* Perhatikan: layout={MagangLayout} (Tanpa < />) */}
      <Route element={<ProtectedRoute requiredRole="intern" layout={MagangLayout} />}>
        <Route path="/magang/dashboard" element={<Dashboard />} />
        <Route path="/magang/attendance" element={<Attendance />} />
        <Route path="/magang/permission" element={<Permission />} />
        <Route path="/magang/correction" element={<Correction />} />
        <Route path="/magang/history" element={<History />} />
        <Route path="/magang/logbook" element={<Logbook />} />

        <Route path="/magang/profile" element={<Profile />} />
        <Route path="/magang/resultEvaluation" element={<ResultEvaluation/>}/>

      </Route>

      {/* --- STANDALONE MAGANG ROUTES (No Layout) --- */}
      <Route element={<ProtectedRoute requiredRole="intern" />}>
        <Route path="/magang/file-viewer" element={<FileViewer />} />
      </Route>
      {/* --- BAGIAN 3: MENTOR ROUTES (YANG DIPERBAIKI) --- */ }
  {/* UBAH DARI layout={<MentorLayout />} MENJADI layout={MentorLayout} */ }
  <Route element={<ProtectedRoute requiredRole="mentor" layout={MentorLayout} />}>
    <Route path="/mentor/dashboard" element={<DashboardMentor />} />
    <Route path="/mentor/internMonitoring" element={<InternMonitoring />} />
    <Route path="/mentor/interns/:id" element={<DetailIntern />} />
    <Route path="/mentor/ending-soon" element={<EndingSoonInternsMentor />} />
    <Route path="/mentor/permission" element={<PermissionApproval />} />
    <Route path="/mentor/corrections" element={<CorrectionApproval />} />
    <Route path="/mentor/logs" element={<Logs />} />
    <Route path="/mentor/reports" element={<ReportsMentor />} />
    <Route path="/mentor/profile" element={<ProfileMentor />} />
    <Route path="/mentor/logbook" element={<LogbookMentor />} />
    <Route path="/mentor/evaluationIntern" element={<EvaluationMentor />} />
    <Route path="/mentor/masterdata/userRole" element={<UserRole />} />
    <Route path="/mentor/masterdata/userPermission" element={<UserPermission />} />
    <Route path="/mentor/masterdata/internProfile" element={<InternProfile />} />
    <Route path="/mentor/masterdata/internMapping" element={<InternMapping />} />
    <Route path="/mentor/masterdata/officelocation" element={<OfficeLocation />} />
    <Route path="/mentor/masterdata/workingSchedule" element={<WorkingSchedule />} />
    <Route path="/mentor/masterdata/evaluation" element={<Evaluation />} />
  </Route>

  {/* --- STANDALONE MENTOR ROUTES (No Layout) --- */}
  <Route element={<ProtectedRoute requiredRole="mentor" />}>
    <Route path="/mentor/file-viewer" element={<FileViewer />} />
  </Route>

  {/* --- ADMIN ROUTES  */ }

    <Route element={<ProtectedRoute requiredRole="admin" layout={AdminLayout} />}>
      <Route path="/admin/dashboard" element={<AdminDashboard />} />
      <Route path="/admin/interns/:id" element={<DetailInternAdmin />} />
      <Route path="/admin/ending-soon" element={<EndingSoonInterns />} />
      <Route path="/admin/internMonitoring" element={<InternMonitoringAdmin />} />

      <Route path="/admin/permission" element={<AdminPermission />} />
      <Route path="/admin/corrections" element={<AdminCorrection />} />
      <Route path="/admin/logs" element={<AdminLogs />} />

      <Route path="/admin/masterdata/userRole" element={<UserRole />} />
      <Route path="/admin/masterdata/userPermission" element={<UserPermission />} />
      <Route path="/admin/masterdata/internProfile" element={<InternProfile />} />
      <Route path="/admin/masterdata/internMapping" element={<InternMapping />}></Route>
      <Route path="/admin/masterdata/officelocation" element={<OfficeLocation />} />
      <Route path="/admin/masterdata/workingSchedule" element={<WorkingSchedule />} />
      <Route path="/admin/masterdata/evaluation" element={<Evaluation />} />
      <Route path="/admin/masterdata/tags" element={<Tags />} />
      <Route path="/admin/reports" element={<AdminReports />} />
      <Route path="/admin/logbook" element={<AdminLogbook />} />
      <Route path="/admin/evaluation" element={<AdminEvaluation />} />
      <Route path="/admin/generate-sertif" element={<GenerateSertif />} />
      <Route path="/admin/profile" element={<ProfileAdmin />} />
      {/* <Route path="/admin/users" element={<UserManagement />} /> */}
    </Route>

    {/* --- STANDALONE ADMIN ROUTES (No Layout) --- */}
    <Route element={<ProtectedRoute requiredRole="admin" />}>
      <Route path="/admin/file-viewer" element={<FileViewer />} />
    </Route>


  {/* 404 */ }
      <Route path="/izin/view/:id/:index" element={<FileViewer />} />
      <Route path="/koreksi/view/:id/:index" element={<FileViewer />} />
      <Route path="*" element={<div className="p-10 text-center font-bold text-2xl">404 - Halaman Tidak Ditemukan</div>} />
    </Routes >
      </AnimatePresence>

  );
};

export default AppRoutes;