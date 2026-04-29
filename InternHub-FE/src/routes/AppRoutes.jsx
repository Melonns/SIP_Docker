import React, { Suspense } from 'react';
import SkeletonLoader from '../components/SkeletonLoader';
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
const Login = React.lazy(() => import('../pages/Auth/Login'));
const ForgotPassword = React.lazy(() => import('../pages/Auth/ForgotPassword'));
const OtpVerification = React.lazy(() => import('../pages/Auth/OtpVerification'));
const ResetPassword = React.lazy(() => import('../pages/Auth/ResetPassword'));
const ForceChangePassword = React.lazy(() => import('../pages/Auth/ForceChangePassword'));
const Dashboard = React.lazy(() => import('../pages/Magang/Dashboard'));
const Attendance = React.lazy(() => import('../pages/Magang/Attendance'));
const Permission = React.lazy(() => import('../pages/Magang/Permission'));
const Correction = React.lazy(() => import('../pages/Magang/Correction'));
const Profile = React.lazy(() => import('../pages/Magang/Profile'));
const History = React.lazy(() => import('../pages/Magang/History'));
const Logbook = React.lazy(() => import('../pages/Magang/Logbook'));
const ResultEvaluation = React.lazy(() => import('../pages/Magang/ResultEvaluation'));
const DashboardMentor = React.lazy(() => import('../pages/Mentor/Dashboard'));
const FileViewer = React.lazy(() => import('../pages/Magang/FileViewer'));
const InternMonitoring = React.lazy(() => import('../pages/Mentor/InternMonitoring'));
const PermissionApproval = React.lazy(() => import('../pages/Mentor/Permission'));
const CorrectionApproval = React.lazy(() => import('../pages/Mentor/Corrections'));
const ProfileMentor = React.lazy(() => import('../pages/Mentor/Profile'));
const ReportsMentor = React.lazy(() => import('../pages/Mentor/Reports'));
const AdminDashboard = React.lazy(() => import('../pages/Admin/Dashboard'));
const AdminPermission = React.lazy(() => import('../pages/Admin/Permission'));
const AdminCorrection = React.lazy(() => import('../pages/Admin/Corrections'));
const Logs = React.lazy(() => import('../pages/Mentor/Logs'));
const DetailIntern = React.lazy(() => import('../pages/Mentor/DetailIntern'));
const DetailInternAdmin = React.lazy(() => import('../pages/Admin/DetailInternAdmin'));
const EndingSoonInterns = React.lazy(() => import('../pages/Admin/EndingSoonInterns'));
const EndingSoonInternsMentor = React.lazy(() => import('../pages/Mentor/EndingSoonInterns'));
const InternMonitoringAdmin = React.lazy(() => import('../pages/Admin/InternMonitoring'));
const AdminLogs = React.lazy(() => import('../pages/Admin/Logs'));
const UserRole = React.lazy(() => import('../pages/Admin/Masterdata/UserRole'));
const UserPermission = React.lazy(() => import('../pages/Admin/Masterdata/UserPermission'));
const InternProfile = React.lazy(() => import('../pages/Admin/Masterdata/InternProfile'));
const InternMapping = React.lazy(() => import('../pages/Admin/Masterdata/InternMapping'));
const OfficeLocation = React.lazy(() => import('../pages/Admin/Masterdata/Officelocation'));
const WorkingSchedule = React.lazy(() => import('../pages/Admin/Masterdata/WorkingSchedule'));
const Evaluation = React.lazy(() => import('../pages/Admin/Masterdata/Evaluation'));
const Tags = React.lazy(() => import('../pages/Admin/Masterdata/Tags'));
const AdminReports = React.lazy(() => import('../pages/Admin/Reports'));
const AdminLogbook = React.lazy(() => import('../pages/Admin/Logbook'));
const AdminEvaluation = React.lazy(() => import('../pages/Admin/Evaluation'));
const GenerateSertif = React.lazy(() => import('../pages/Admin/GenerateSertif'));
const ProfileAdmin = React.lazy(() => import('../pages/Admin/Profile'));
const LogbookMentor = React.lazy(() => import('../pages/Mentor/Logbook'));
const EvaluationMentor = React.lazy(() => import('../pages/Mentor/EvaluationIntern'));

const AppRoutes = () => {
  return (
    <Suspense fallback={<SkeletonLoader />}>
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
    </Routes>
      </Suspense>
  );
};

export default AppRoutes;