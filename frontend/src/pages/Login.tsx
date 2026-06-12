import { useState } from 'react';
import { Form, Input, Button, Card, message, Space, Divider } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { login } from '@/api/auth';
import { useAuthStore } from '@/store/auth';

interface LoginForm {
  username: string;
  password: string;
}

export default function Login() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const { setAuth } = useAuthStore();

  const quickAccounts = [
    { label: '管理员', username: 'admin', password: '123456' },
    { label: '操作员', username: 'operator', password: '123456' },
    { label: '审计员', username: 'auditor', password: '123456' },
    { label: '普通用户', username: 'user', password: '123456' },
  ];

  const handleSubmit = async (values: LoginForm) => {
    setLoading(true);
    try {
      const response = await login(values.username, values.password);
      setAuth(response.token, response.user);
      message.success('登录成功');
      navigate('/');
    } catch (err: any) {
      message.error(err.message || '登录失败，请检查用户名和密码');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = (username: string, password: string) => {
    handleSubmit({ username, password });
  };

  return (
    <div
      style={{
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      }}
    >
      <Card
        style={{
          width: 400,
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <h1 style={{ fontSize: 24, fontWeight: 600, marginBottom: 8, color: '#1a1a1a' }}>
            社区维修回访管理系统
          </h1>
          <p style={{ color: '#8c8c8c', fontSize: 14 }}>请登录您的账号</p>
        </div>
        <Form<LoginForm>
          name="login"
          onFinish={handleSubmit}
          autoComplete="off"
          size="large"
        >
          <Form.Item
            name="username"
            rules={[{ required: true, message: '请输入用户名' }]}
          >
            <Input
              prefix={<UserOutlined />}
              placeholder="用户名"
            />
          </Form.Item>

          <Form.Item
            name="password"
            rules={[{ required: true, message: '请输入密码' }]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="密码"
            />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0 }}>
            <Button
              type="primary"
              htmlType="submit"
              loading={loading}
              style={{ width: '100%' }}
            >
              登录
            </Button>
          </Form.Item>
        </Form>

        <Divider style={{ margin: '24px 0 16px' }}>快捷登录</Divider>
        <Space wrap style={{ width: '100%', justifyContent: 'center' }}>
          {quickAccounts.map((account) => (
            <Button
              key={account.username}
              loading={loading}
              onClick={() => handleQuickLogin(account.username, account.password)}
            >
              {account.label}
            </Button>
          ))}
        </Space>
      </Card>
    </div>
  );
}
