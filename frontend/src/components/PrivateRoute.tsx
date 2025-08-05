import React from 'react';
import { Navigate } from 'react-router-dom';

/**
 * 受保护的路由包装组件。
 *
 * 根据 localStorage 中保存的 userRole 判断是否有访问权限。
 * 如果当前用户角色不在允许列表中，则重定向到登录页面。
 */
interface PrivateRouteProps {
  /** 允许访问此路由的角色列表（统一为小写）。*/
  allowedRoles: string[];
  /** 要渲染的子元素。*/
  children: React.ReactNode;
}

export function PrivateRoute({ allowedRoles, children }: PrivateRouteProps) {
  const role = localStorage.getItem('userRole')?.toLowerCase();
  return role && allowedRoles.includes(role) ? (
    <>{children}</>
  ) : (
    <Navigate to="/login" replace />
  );
}
