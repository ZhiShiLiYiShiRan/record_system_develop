// src/App.tsx
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { PrivateRoute } from './components/PrivateRoute'
import Login from './pages/Login'
import RecordForm from './pages/RecordForm'  // 先占位
import QCPage from './pages/QCPage'  // 先占位
import Stats from './pages/stats'
import UserMgmt from './pages/UserManagement';

export default function App() {
  // const role = localStorage.getItem('userRole')  // e.g. 'recorder' or 'qc'
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />

        <Route
          path="/record"
          element={
            <PrivateRoute allowedRoles={['recorder', 'admin', 'superadmin']}>
              <RecordForm />
            </PrivateRoute>
          }
        />

        <Route
          path="/qc"
          element={
            <PrivateRoute allowedRoles={['qc', 'admin', 'superadmin']}>
              <QCPage />
            </PrivateRoute>
          }
        />

        <Route
          path="/stats"
          element={
            <PrivateRoute allowedRoles={['recorder', 'admin', 'superadmin']}>
              <Stats />
            </PrivateRoute>
          }
        />

        <Route
          path="/admin"
          element={
            <PrivateRoute allowedRoles={['superadmin']}>
              <UserMgmt />
            </PrivateRoute>
          }
        />

        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </Router>
  );
}