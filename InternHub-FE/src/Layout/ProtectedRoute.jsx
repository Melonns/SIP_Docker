import { Navigate, Outlet } from 'react-router-dom';

const ProtectedRoute = ({ requiredRole, layout: Layout }) => {
  // Ambil token & role dari localStorage
  const token = localStorage.getItem('token');
  const userRole = localStorage.getItem('role');
  const mustChangePassword = localStorage.getItem('must_change_password') === 'true';
  const currentPath = window.location.pathname;

  // Jika tidak ada token, redirect ke login
  if (!token) {
    return <Navigate to="/login" replace />;
  }

  // PRIORITY 1: Jika user harus change password, redirect ke force change password page
  // KECUALI mereka sudah di halaman force-change-password
  if (mustChangePassword && !currentPath.includes('/force-change-password')) {
    return <Navigate to="/force-change-password" replace />;
  }

  // PRIORITY 2: Jika ada requiredRole tapi user role tidak match, redirect ke login
  if (requiredRole && userRole?.toLowerCase() !== requiredRole.toLowerCase()) {
    return <Navigate to="/login" replace />;
  }

  // Jika ada Layout component, wrap Outlet dengan layout
  // Jika tidak ada Layout, langsung render Outlet
  return Layout ? (
    <Layout>
      <Outlet />
    </Layout>
  ) : (
    <Outlet />
  );
};

export default ProtectedRoute;
