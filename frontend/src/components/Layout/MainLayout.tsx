import { Layout, Menu, Dropdown, Avatar, theme, Badge } from 'antd';
import {
  DashboardOutlined,
  UnorderedListOutlined,
  SettingOutlined,
  LogoutOutlined,
  UserOutlined,
  BellOutlined,
  FlagOutlined,
} from '@ant-design/icons';
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
      key: '/supervisions',
      icon: (
        <Badge dot size="default" offset={[6, 2]}>
          <FlagOutlined />
        </Badge>
      ),
      label: '异常督办',
    },
    {
      key: '/warnings',
      icon: (
        <Badge dot size="default" offset={[6, 2]}>
          <BellOutlined />
        </Badge>
      ),
      label: '异常预警',
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
    if (location.pathname.startsWith('/warnings/')) {
      return '/warnings';
    }
    if (location.pathname.startsWith('/supervisions')) {
      return '/supervisions';
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
