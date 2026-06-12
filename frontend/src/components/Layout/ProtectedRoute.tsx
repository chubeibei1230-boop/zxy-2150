import { Navigate } from 'react-router-dom';
import { Result, Button } from 'antd';
import { useAuthStore } from '@/store/auth';
import { User } from '@/types';

interface ProtectedRouteProps {
  children: React.ReactNode;
  roles?: User['role'][];
}

export default function ProtectedRoute({ children, roles }: ProtectedRouteProps) {
  const { token, user } = useAuthStore();

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  if (roles && user && !roles.includes(user.role)) {
    return (
      <Result
        status="403"
        title="403"
        subTitle="抱歉，您没有权限访问此页面"
        extra={
          <Button type="primary" onClick={() => window.history.back()}>
            返回上一页
          </Button>
        }
      />
    );
  }

  return <>{children}</>;
}
