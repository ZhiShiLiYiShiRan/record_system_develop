// src/components/PrivateRoute.tsx
import React from 'react';
import { Navigate } from 'react-router-dom';

interface PrivateRouteProps {
  allowedRoles: string[];        // 支持多角色
  children: React.ReactNode;
}

export function PrivateRoute({ allowedRoles, children }: PrivateRouteProps) {
  const role = localStorage.getItem('userRole')?.toLowerCase();
  return (role && allowedRoles.includes(role))
    ? <>{children}</>
    : <Navigate to="/login" replace />;
}
