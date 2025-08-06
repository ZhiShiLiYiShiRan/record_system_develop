// src/App.tsx
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { PrivateRoute } from './components/PrivateRoute';
import NavBar from './components/NavBar';
import Login from './pages/Login';
import RecordForm from './pages/RecordForm';
import QCPage from './pages/QCPage';
import Stats from './pages/stats';
import UserMgmt from './pages/UserManagement';

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />

        <Route
          path="/record"
          element={
            <PrivateRoute allowedRoles={['recorder', 'admin', 'superadmin']}>
              <>
                <NavBar />
                <RecordForm />
              </>
            </PrivateRoute>
          }
        />

        <Route
          path="/qc"
          element={
            <PrivateRoute allowedRoles={['qc', 'admin', 'superadmin']}>
              <>
                <NavBar />
                <QCPage />
              </>
            </PrivateRoute>
          }
        />

        <Route
          path="/stats"
          element={
            <PrivateRoute allowedRoles={['recorder', 'admin', 'superadmin']}>
              <>
                <NavBar />
                <Stats />
              </>
            </PrivateRoute>
          }
        />

        {/* 超管才能进入用户管理页面 */}
        <Route
          path="/admin"
          element={
            <PrivateRoute allowedRoles={['superadmin']}>
              <>
                <NavBar />
                <UserMgmt />
              </>
            </PrivateRoute>
          }
        />

        {/* 默认重定向到登录 */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </Router>
  );
}
