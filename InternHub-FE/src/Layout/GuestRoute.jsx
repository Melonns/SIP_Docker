import { Navigate, Outlet } from 'react-router-dom';

const GuestRoute = () => {
  const token = localStorage.getItem('token');
  const userRole = localStorage.getItem('role')?.toLowerCase();

  if (token) {
    // Redirect based on role
    if (userRole === 'admin') {
      return <Navigate to="/admin/dashboard" replace />;
    } else if (userRole === 'mentor') {
      return <Navigate to="/mentor/dashboard" replace />;
    } else {
      return <Navigate to="/magang/dashboard" replace />;
    }
  }

  // If no token, allow access to guest routes
  return <Outlet />;
};

export default GuestRoute;
