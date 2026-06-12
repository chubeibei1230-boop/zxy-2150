import { Layout, Menu, Dropdown, Avatar, theme } from 'antd';
import { DashboardOutlined, UnorderedListOutlined, SettingOutlined, LogoutOutlined, UserOutlined } from '@ant-design/icons';
import { useLocation, useNavigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '@/store/auth';
import { User } from '@/types';

const { Header, Sider, Content } = Layout;

const roleLabels: Record<User['role'], string> = {
  admin: '管理员',
  operator: '操作员',
  auditor: '审核员',
  user: '普通用户',
};

export default function MainLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, clearAuth } = useAuthStore();
  const {
    token: { colorBgContainer, borderRadiusLG },
  } = theme.useToken();

  const handleLogout = () => {
    clearAuth();
    navigate('/login');
  };

  const menuItems = [
    {
      key: '/',
      icon: <DashboardOutlined />,
      label: '统计看板',
    },
    {
      key: '/visits',
      icon: <UnorderedListOutlined />,
      label: '回访列表',
    },
    ...(user?.role === 'admin'
      ? [
          {
            key: '/rules',
            icon: <SettingOutlined />,
            label: '规则配置',
          },
        ]
      : []),
  ];

  const userMenuItems = [
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: '退出登录',
      onClick: handleLogout,
    },
  ];

  const getSelectedKey = () => {
    if (location.pathname.startsWith('/visits/')) {
      return '/visits';
    }
    return location.pathname;
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider width={220} theme="dark">
        <div className="sidebar-logo">社区维修回访管理系统</div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[getSelectedKey()]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
        />
      </Sider>
      <Layout>
        <Header
          style={{
            padding: '0 24px',
            background: colorBgContainer,
            display: 'flex',
            justifyContent: 'flex-end',
            alignItems: 'center',
          }}
        >
          {user && (
            <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
              <div style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Avatar size="small" icon={<UserOutlined />} />
                <span>
                  {user.name} ({roleLabels[user.role]})
                </span>
              </div>
            </Dropdown>
          )}
        </Header>
        <Content
          style={{
            margin: '24px',
            padding: '24px',
            background: colorBgContainer,
            borderRadius: borderRadiusLG,
          }}
        >
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}
