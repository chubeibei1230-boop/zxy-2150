import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from '@/pages/Login';
import Dashboard from '@/pages/Dashboard';
import VisitList from '@/pages/VisitList';
import VisitDetail from '@/pages/VisitDetail';
import WarningList from '@/pages/WarningList';
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
          <Route index element={<Dashboard />} />
          <Route path="visits" element={<VisitList />} />
          <Route path="visits/:id" element={<VisitDetail />} />
          <Route path="warnings" element={<WarningList />} />
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
