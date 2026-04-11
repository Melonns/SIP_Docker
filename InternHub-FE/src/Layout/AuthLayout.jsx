import { Outlet } from "react-router-dom";

const AuthLayout = () => {
  return (
    // Outlet adalah tempat Login.jsx, ForgotPassword.jsx, dll akan muncul
    <main>
       <Outlet />
    </main>
  );
};

export default AuthLayout;