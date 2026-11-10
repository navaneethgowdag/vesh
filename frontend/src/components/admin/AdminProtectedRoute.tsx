import React, { useEffect, useState } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { api, adminTokenStorage } from '../../services/api';
import { LuxuryPageLoader } from '../ui/LuxuryPageLoader';

interface AdminProtectedRouteProps {
  children?: React.ReactNode;
}

export const AdminProtectedRoute: React.FC<AdminProtectedRouteProps> = ({ children }) => {
  const [isVerifying, setIsVerifying] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const location = useLocation();

  useEffect(() => {
    let isMounted = true;
    const verifyAdmin = async () => {
      const token = adminTokenStorage.get();
      if (!token) {
        if (isMounted) {
          setIsAdmin(false);
          setIsVerifying(false);
        }
        return;
      }

      try {
        const adminProfile = await api.admin.me();
        if (isMounted) {
          if (adminProfile && (adminProfile.is_admin || adminProfile.role === 'admin')) {
            setIsAdmin(true);
          } else {
            adminTokenStorage.clear();
            setIsAdmin(false);
          }
          setIsVerifying(false);
        }
      } catch (err) {
        console.warn('[AdminProtectedRoute] Verification failed, redirecting to login', err);
        adminTokenStorage.clear();
        if (isMounted) {
          setIsAdmin(false);
          setIsVerifying(false);
        }
      }
    };

    verifyAdmin();
    return () => {
      isMounted = false;
    };
  }, [location.pathname]);

  if (isVerifying) {
    return <LuxuryPageLoader />;
  }

  if (!isAdmin) {
    return <Navigate to="/admin/login" state={{ from: location }} replace />;
  }

  return children ? <>{children}</> : <Outlet />;
};
