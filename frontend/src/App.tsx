import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from '@/pages/Login';
import Dashboard from '@/pages/Dashboard';
import VisitList from '@/pages/VisitList';
import VisitDetail from '@/pages/VisitDetail';
import WarningList from '@/pages/WarningList';
import SupervisionList from '@/pages/SupervisionList';
import RulesConfig from '@/pages/RulesConfig';
import NotFound from '@/pages/NotFound';
import MainLayout from '@/components/Layout/MainLayout';
import ProtectedRoute from '@/components/Layout/ProtectedRoute';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/"
          element={
            <ProtectedRoute roles={['admin', 'operator', 'auditor', 'user']}>
              <MainLayout />
            </ProtectedRoute>
          }
        >
          <Route
            index
            element={
              <ProtectedRoute roles={['admin', 'operator', 'auditor']}>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="visits"
            element={
              <ProtectedRoute roles={['admin', 'operator', 'auditor']}>
                <VisitList />
              </ProtectedRoute>
            }
          />
          <Route
            path="visits/:id"
            element={
              <ProtectedRoute roles={['admin', 'operator', 'auditor']}>
                <VisitDetail />
              </ProtectedRoute>
            }
          />
          <Route
            path="warnings"
            element={
              <ProtectedRoute roles={['admin', 'operator', 'auditor']}>
                <WarningList />
              </ProtectedRoute>
            }
          />
          <Route
            path="supervisions"
            element={
              <ProtectedRoute roles={['admin', 'operator', 'auditor']}>
                <SupervisionList />
              </ProtectedRoute>
            }
          />
          <Route
            path="rules"
            element={
              <ProtectedRoute roles={['admin']}>
                <RulesConfig />
              </ProtectedRoute>
            }
          />
        </Route>
        <Route path="/404" element={<NotFound />} />
        <Route path="*" element={<Navigate to="/404" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
