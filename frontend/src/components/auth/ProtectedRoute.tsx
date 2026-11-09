import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { LuxuryPageLoader } from '../ui/LuxuryPageLoader';

interface ProtectedRouteProps {
  children?: React.ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { isAuthenticated, isBootstrapping, currentUser } = useApp();
  const location = useLocation();

  if (isBootstrapping) {
    return <LuxuryPageLoader />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // First-time onboarding redirect check
  if (currentUser && currentUser.onboarding_completed === false && location.pathname !== '/onboarding') {
    return <Navigate to="/onboarding" replace />;
  }

  return children ? <>{children}</> : <Outlet />;
};

export const PublicOnlyRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { isAuthenticated, isBootstrapping, currentUser } = useApp();

  if (isBootstrapping) {
    return <LuxuryPageLoader />;
  }

  if (isAuthenticated) {
    const dest = currentUser?.onboarding_completed === false ? '/onboarding' : '/home';
    return <Navigate to={dest} replace />;
  }

  return children ? <>{children}</> : <Outlet />;
};
