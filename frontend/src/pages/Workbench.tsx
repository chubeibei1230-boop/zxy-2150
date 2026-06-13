import { useState, useEffect, useCallback } from 'react';
import {
  Row,
  Col,
  Card,
  Statistic,
  Table,
  Tag,
  Button,
  Form,
  Select,
  Input,
  DatePicker,
  Space,
  Spin,
  message,
  Modal,
  Drawer,
  Descriptions,
  Timeline,
  Divider,
  Tooltip,
  Rate,
  Badge,
  Progress,
  Typography,
} from 'antd';
import {
  SearchOutlined,
  ReloadOutlined,
  EyeOutlined,
  ClockCircleOutlined,
  AlertOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  FileTextOutlined,
  BellOutlined,
  FlagOutlined,
  EditOutlined,
  ArrowRightOutlined,
  StopOutlined,
  SwapOutlined,
  ThunderboltOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import {
  WorkbenchItem,
  WorkbenchStats,
  WorkbenchFilter,
  WORKBENCH_ITEM_TYPE_OPTIONS,
  WORKBENCH_RISK_OPTIONS,
  WORKBENCH_PROGRESS_STAGE_OPTIONS,
  User,
  Visit,
  Warning,
  Supervision,
  STATUS_OPTIONS,
  WARNING_LEVEL_OPTIONS,
  WARNING_STATUS_OPTIONS,
  SUPERVISION_RISK_OPTIONS,
  SUPERVISION_STATUS_OPTIONS,
  VisitStatus,
} from '@/types';
import { getWorkbenchStats, getWorkbenchItems } from '@/api/workbench';
import { getUsers } from '@/api/users';
import { getVisitDetail } from '@/api/visits';
import { getWarningDetail, followUpWarning, resolveWarning, ignoreWarning } from '@/api/warnings';
import {
  getSupervisionDetail,
  followUpSupervision,
  resolveSupervision,
  closeSupervision,
  dismissSupervision,
  reassignSupervision,
} from '@/api/supervisions';
import { useAuthStore } from '@/store/auth';
import VisitProcessModal from '@/components/VisitProcessModal';
import type { ColumnsType } from 'antd/es/table';

const { RangePicker } = DatePicker;
const { TextArea } = Input;
const { Title } = Typography;

const PROGRESS_STAGE_STEPS: Record<string, { percent: number; strokeColor: string }> = {
  pending: { percent: 10, strokeColor: '#d9d9d9' },
  contacting: { percent: 35, strokeColor: '#1677ff' },
  following_up: { percent: 60, strokeColor: '#1677ff' },
  resolving: { percent: 80, strokeColor: '#fa8c16' },
  closed: { percent: 100, strokeColor: '#52c41a' },
};

export default function Workbench() {
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const [loading, setLoading] = useState(false);
  const [statsLoading, setStatsLoading] = useState(false);
  const [stats, setStats] = useState<WorkbenchStats | null>(null);
  const [items, setItems] = useState<WorkbenchItem[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [total, setTotal] = useState(0);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10 });
  const [form] = Form.useForm();
  const [currentFilters, setCurrentFilters] = useState<WorkbenchFilter>({});

  const [detailDrawerVisible, setDetailDrawerVisible] = useState(false);
  const [currentItem, setCurrentItem] = useState<WorkbenchItem | null>(null);
  const [visitDetail, setVisitDetail] = useState<Visit | null>(null);
  const [warningDetail, setWarningDetail] = useState<Warning | null>(null);
  const [supervisionDetail, setSupervisionDetail] = useState<Supervision | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [processModalVisible, setProcessModalVisible] = useState(false);
  const [processingVisit, setProcessingVisit] = useState<Visit | null>(null);

  const [followUpModalVisible, setFollowUpModalVisible] = useState(false);
  const [followUpForm] = Form.useForm();
  const [followUpTarget, setFollowUpTarget] = useState<{ type: 'warning' | 'supervision'; id: string } | null>(null);

  const [resolveModalVisible, setResolveModalVisible] = useState(false);
  const [resolveForm] = Form.useForm();
  const [resolveTarget, setResolveTarget] = useState<{ type: 'warning' | 'supervision'; id: string } | null>(null);

  const [ignoreModalVisible, setIgnoreModalVisible] = useState(false);
  const [ignoreForm] = Form.useForm();

  const [closeModalVisible, setCloseModalVisible] = useState(false);
  const [closeForm] = Form.useForm();

  const [dismissModalVisible, setDismissModalVisible] = useState(false);
  const [dismissForm] = Form.useForm();

  const [reassignModalVisible, setReassignModalVisible] = useState(false);
  const [reassignForm] = Form.useForm();

  const fetchUsers = async () => {
    try {
      const data = await getUsers();
      setUsers(data);
    } catch (err: any) {
      message.error(err.message || '获取用户列表失败');
    }
  };

  const fetchStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const data = await getWorkbenchStats();
      setStats(data);
    } catch (err: any) {
      message.error(err.message || '获取统计数据失败');
    } finally {
      setStatsLoading(false);
    }
  }, []);

  const fetchItems = useCallback(
    async (filters?: WorkbenchFilter, pageConfig = pagination) => {
      setLoading(true);
      try {
        const data = await getWorkbenchItems({
          ...filters,
          page: pageConfig.current,
          page_size: pageConfig.pageSize,
        });
        setItems(data.items);
        setTotal(data.total);
      } catch (err: any) {
        message.error(err.message || '获取工作台列表失败');
      } finally {
        setLoading(false);
      }
    },
    [pagination]
  );

  const refreshAll = useCallback(() => {
    fetchStats();
    fetchItems(currentFilters);
  }, [fetchStats, fetchItems, currentFilters]);

  useEffect(() => {
    fetchUsers();
    fetchStats();
    fetchItems();
  }, [fetchUsers, fetchStats, fetchItems]);

  useEffect(() => {
    if (Object.keys(currentFilters).length === 0) {
      fetchItems();
    } else {
      fetchItems(currentFilters);
    }
  }, [pagination.current, pagination.pageSize, fetchItems, currentFilters]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refreshAll();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [refreshAll]);

  const handleSearch = (values: any) => {
    const filters: WorkbenchFilter = {};
    if (values.item_type) filters.item_type = values.item_type;
    if (values.handler_id) filters.handler_id = values.handler_id;
    if (values.risk) filters.risk = values.risk;
    if (values.status) filters.status = values.status;
    if (values.keyword) filters.keyword = values.keyword;
    if (values.is_overdue) filters.is_overdue = values.is_overdue;
    if (values.date_range) {
      filters.date_from = values.date_range[0].format('YYYY-MM-DD');
      filters.date_to = values.date_range[1].format('YYYY-MM-DD');
    }
    setCurrentFilters(filters);
    setPagination({ ...pagination, current: 1 });
    fetchItems(filters, { ...pagination, current: 1 });
  };

  const handleReset = () => {
    form.resetFields();
    setCurrentFilters({});
    setPagination({ current: 1, pageSize: 10 });
    fetchItems();
  };

  const handleTableChange = (page: number, pageSize: number) => {
    setPagination({ current: page, pageSize });
  };

  const handleViewDetail = async (item: WorkbenchItem) => {
    setDetailLoading(true);
    setCurrentItem(item);
    setVisitDetail(null);
    setWarningDetail(null);
    setSupervisionDetail(null);
    try {
      const vDetail = await getVisitDetail(item.visit_id);
      setVisitDetail(vDetail);

      if (item.item_type === 'warning' && item.warning_id) {
        const wDetail = await getWarningDetail(item.warning_id);
        setWarningDetail(wDetail);
      } else if (item.item_type === 'supervision' && item.supervision_id) {
        const sDetail = await getSupervisionDetail(item.supervision_id);
        setSupervisionDetail(sDetail);
      }
      setDetailDrawerVisible(true);
    } catch (err: any) {
      message.error(err.message || '获取详情失败');
    } finally {
      setDetailLoading(false);
    }
  };

  const handleProcessVisit = async (item: WorkbenchItem) => {
    try {
      const vDetail = await getVisitDetail(item.visit_id);
      setProcessingVisit(vDetail);
      setProcessModalVisible(true);
    } catch (err: any) {
      message.error(err.message || '获取回访详情失败');
    }
  };

  const handleProcessSuccess = () => {
    setProcessModalVisible(false);
    setProcessingVisit(null);
    refreshAll();
    if (detailDrawerVisible && currentItem) {
      handleViewDetail(currentItem);
    }
  };

  const handleFollowUp = (item: WorkbenchItem) => {
    if (item.item_type === 'warning' && item.warning_id) {
      setFollowUpTarget({ type: 'warning', id: item.warning_id });
    } else if (item.item_type === 'supervision' && item.supervision_id) {
      setFollowUpTarget({ type: 'supervision', id: item.supervision_id });
    } else {
      return;
    }
    followUpForm.resetFields();
    setFollowUpModalVisible(true);
  };

  const handleFollowUpSubmit = async (values: any) => {
    if (!followUpTarget) return;
    try {
      if (followUpTarget.type === 'warning') {
        await followUpWarning(followUpTarget.id, {
          note: values.note,
          action: values.action || 'note',
        });
      } else {
        await followUpSupervision(followUpTarget.id, {
          note: values.note,
          action: values.action || 'note',
        });
      }
      message.success('跟进记录已添加');
      setFollowUpModalVisible(false);
      setFollowUpTarget(null);
      followUpForm.resetFields();
      refreshAll();
      if (detailDrawerVisible && currentItem) {
        handleViewDetail(currentItem);
      }
    } catch (err: any) {
      message.error(err.message || '操作失败');
    }
  };

  const handleResolve = (item: WorkbenchItem) => {
    if (item.item_type === 'warning' && item.warning_id) {
      setResolveTarget({ type: 'warning', id: item.warning_id });
    } else if (item.item_type === 'supervision' && item.supervision_id) {
      setResolveTarget({ type: 'supervision', id: item.supervision_id });
    } else {
      return;
    }
    resolveForm.resetFields();
    setResolveModalVisible(true);
  };

  const handleResolveSubmit = async (values: any) => {
    if (!resolveTarget) return;
    try {
      if (resolveTarget.type === 'warning') {
        await resolveWarning(resolveTarget.id, { note: values.note });
        message.success('预警已解除');
      } else {
        await resolveSupervision(resolveTarget.id, { note: values.note });
        message.success('督办事项已解决');
      }
      setResolveModalVisible(false);
      setResolveTarget(null);
      resolveForm.resetFields();
      refreshAll();
      if (detailDrawerVisible) {
        setDetailDrawerVisible(false);
      }
    } catch (err: any) {
      message.error(err.message || '操作失败');
    }
  };

  const handleIgnoreWarning = (item: WorkbenchItem) => {
    if (item.item_type === 'warning' && item.warning_id) {
      setFollowUpTarget({ type: 'warning', id: item.warning_id });
      ignoreForm.resetFields();
      setIgnoreModalVisible(true);
    }
  };

  const handleIgnoreSubmit = async (values: any) => {
    if (!followUpTarget || followUpTarget.type !== 'warning') return;
    try {
      await ignoreWarning(followUpTarget.id, { note: values.note });
      message.success('预警已忽略');
      setIgnoreModalVisible(false);
      setFollowUpTarget(null);
      ignoreForm.resetFields();
      refreshAll();
      if (detailDrawerVisible) {
        setDetailDrawerVisible(false);
      }
    } catch (err: any) {
      message.error(err.message || '操作失败');
    }
  };

  const handleCloseSupervision = (item: WorkbenchItem) => {
    if (item.item_type === 'supervision' && item.supervision_id) {
      setFollowUpTarget({ type: 'supervision', id: item.supervision_id });
      closeForm.resetFields();
      setCloseModalVisible(true);
    }
  };

  const handleCloseSubmit = async (values: any) => {
    if (!followUpTarget || followUpTarget.type !== 'supervision') return;
    try {
      await closeSupervision(followUpTarget.id, { note: values.note });
      message.success('督办事项已关闭');
      setCloseModalVisible(false);
      setFollowUpTarget(null);
      closeForm.resetFields();
      refreshAll();
      if (detailDrawerVisible) {
        setDetailDrawerVisible(false);
      }
    } catch (err: any) {
      message.error(err.message || '操作失败');
    }
  };

  const handleDismissSupervision = (item: WorkbenchItem) => {
    if (item.item_type === 'supervision' && item.supervision_id) {
      setFollowUpTarget({ type: 'supervision', id: item.supervision_id });
      dismissForm.resetFields();
      setDismissModalVisible(true);
    }
  };

  const handleDismissSubmit = async (values: any) => {
    if (!followUpTarget || followUpTarget.type !== 'supervision') return;
    try {
      await dismissSupervision(followUpTarget.id, { note: values.note });
      message.success('已标记为无需处理');
      setDismissModalVisible(false);
      setFollowUpTarget(null);
      dismissForm.resetFields();
      refreshAll();
      if (detailDrawerVisible) {
        setDetailDrawerVisible(false);
      }
    } catch (err: any) {
      message.error(err.message || '操作失败');
    }
  };

  const handleReassignSupervision = (item: WorkbenchItem) => {
    if (item.item_type === 'supervision' && item.supervision_id) {
      setFollowUpTarget({ type: 'supervision', id: item.supervision_id });
      reassignForm.resetFields();
      setReassignModalVisible(true);
    }
  };

  const handleReassignSubmit = async (values: any) => {
    if (!followUpTarget || followUpTarget.type !== 'supervision') return;
    try {
      await reassignSupervision(followUpTarget.id, {
        assignee_id: values.assignee_id,
        note: values.note || '',
      });
      message.success('事项已转派');
      setReassignModalVisible(false);
      setFollowUpTarget(null);
      reassignForm.resetFields();
      refreshAll();
      if (detailDrawerVisible && currentItem) {
        handleViewDetail(currentItem);
      }
    } catch (err: any) {
      message.error(err.message || '转派失败');
    }
  };

  const isAdmin = user?.role === 'admin';
  const canOperate = user?.role !== 'auditor';

  const renderItemTypeTag = (type: string, label: string, isOverdue: boolean) => {
    const opt = WORKBENCH_ITEM_TYPE_OPTIONS.find((o) => o.value === type);
    const color = isOverdue ? 'red' : opt?.color || 'default';
    return (
      <Badge dot={isOverdue} offset={[4, 2]}>
        <Tag color={color}>{label}</Tag>
      </Badge>
    );
  };

  const renderRiskTag = (risk: string) => {
    const opt = WORKBENCH_RISK_OPTIONS.find((o) => o.value === risk);
    return <Tag color={opt?.color}>{opt?.label || risk}</Tag>;
  };

  const renderProgressStage = (stage: string, label: string) => {
    const opt = WORKBENCH_PROGRESS_STAGE_OPTIONS.find((o) => o.value === stage);
    const stepInfo = PROGRESS_STAGE_STEPS[stage] || PROGRESS_STAGE_STEPS.pending;
    return (
      <Tooltip title={label}>
        <div style={{ minWidth: 100 }}>
          <Progress
            percent={stepInfo.percent}
            size="small"
            strokeColor={stepInfo.strokeColor}
            format={() => (
              <span style={{ fontSize: 11, color: opt?.color === 'success' ? '#52c41a' : opt?.color === 'processing' ? '#1677ff' : undefined }}>
                {label}
              </span>
            )}
          />
        </div>
      </Tooltip>
    );
  };

  const renderStatusTag = (item: WorkbenchItem) => {
    let color = 'default';
    if (item.item_type === 'visit') {
      const opt = STATUS_OPTIONS.find((o) => o.value === item.status);
      color = opt?.color || 'default';
    } else if (item.item_type === 'warning') {
      const opt = WARNING_STATUS_OPTIONS.find((o) => o.value === item.status);
      color = opt?.color || 'default';
    } else if (item.item_type === 'supervision') {
      const opt = SUPERVISION_STATUS_OPTIONS.find((o) => o.value === item.status);
      color = opt?.color || 'default';
    }
    return (
      <Tag color={color}>
        {item.is_overdue && <ClockCircleOutlined style={{ marginRight: 4, color: '#ff4d4f' }} />}
        {item.status_label}
      </Tag>
    );
  };

  const canOperateOnItem = (item: WorkbenchItem) => {
    if (!canOperate) return false;
    if (item.item_type === 'visit') {
      return item.status === 'pending';
    }
    if (item.item_type === 'warning') {
      return !['resolved', 'ignored'].includes(item.status);
    }
    if (item.item_type === 'supervision') {
      if (['resolved', 'closed', 'dismissed'].includes(item.status)) return false;
      if (isAdmin) return true;
      return item.assignee_id === user?.id;
    }
    return false;
  };

  const isSupervisionActive = (status: string) => !['resolved', 'closed', 'dismissed'].includes(status);

  const columns: ColumnsType<WorkbenchItem> = [
    {
      title: '事项类型',
      dataIndex: 'item_type',
      key: 'item_type',
      width: 110,
      filters: WORKBENCH_ITEM_TYPE_OPTIONS.filter((o) => o.value !== 'all').map((o) => ({ text: o.label, value: o.value })),
      onFilter: (value, record) => record.item_type === value,
      render: (_: string, record) =>
        renderItemTypeTag(record.item_type, record.item_type_label, record.is_overdue),
    },
    {
      title: '风险级别',
      dataIndex: 'risk',
      key: 'risk',
      width: 90,
      sorter: (a, b) => {
        const priority = { high: 0, medium: 1, low: 2 };
        return (priority[a.risk] ?? 3) - (priority[b.risk] ?? 3);
      },
      render: (val: string) => renderRiskTag(val),
    },
    {
      title: '处理进度',
      dataIndex: 'progress_stage',
      key: 'progress_stage',
      width: 140,
      sorter: (a, b) => {
        const order = { pending: 0, contacting: 1, following_up: 2, resolving: 3, closed: 4 };
        return (order[a.progress_stage] ?? 0) - (order[b.progress_stage] ?? 0);
      },
      render: (val: string, record) => renderProgressStage(val, record.progress_stage_label),
    },
    {
      title: '事项说明',
      dataIndex: 'title',
      key: 'title',
      ellipsis: true,
      width: 200,
      render: (text: string, record) => (
        <Tooltip title={`${record.item_type_label}: ${text}`}>
          <Space>
            {record.item_type === 'warning' ? (
              <BellOutlined style={{ color: '#FAAD14' }} />
            ) : record.item_type === 'supervision' ? (
              <FlagOutlined style={{ color: '#ff4d4f' }} />
            ) : (
              <FileTextOutlined style={{ color: '#1677ff' }} />
            )}
            <span>{text}</span>
          </Space>
        </Tooltip>
      ),
    },
    {
      title: '工单号',
      dataIndex: 'repair_order_no',
      key: 'repair_order_no',
      width: 130,
    },
    {
      title: '用户姓名',
      dataIndex: 'user_name',
      key: 'user_name',
      width: 90,
    },
    {
      title: '联系电话',
      dataIndex: 'user_phone',
      key: 'user_phone',
      width: 120,
    },
    {
      title: '维修类别',
      dataIndex: 'category_name',
      key: 'category_name',
      width: 100,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (_: string, record) => renderStatusTag(record),
    },
    {
      title: '处理人',
      dataIndex: 'handler_name',
      key: 'handler_name',
      width: 100,
      render: (val: string | null, record) => {
        if (record.item_type === 'supervision' && record.assignee_name) {
          return record.assignee_name;
        }
        return val || <span style={{ color: '#999' }}>-</span>;
      },
    },
    {
      title: '无法联系',
      dataIndex: 'unreachable_count',
      key: 'unreachable_count',
      width: 80,
      sorter: (a, b) => a.unreachable_count - b.unreachable_count,
      render: (val: number) => (val > 0 ? <Tag color="red">{val} 次</Tag> : '-'),
    },
    {
      title: '满意度',
      dataIndex: 'satisfaction',
      key: 'satisfaction',
      width: 90,
      sorter: (a, b) => (a.satisfaction ?? 0) - (b.satisfaction ?? 0),
      render: (val: number | null) => {
        if (val === null) return '-';
        return (
          <Space>
            <Rate disabled count={5} value={val} style={{ fontSize: 12 }} />
            <span>{val}分</span>
          </Space>
        );
      },
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 150,
      sorter: (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
      render: (val: string) => dayjs(val).format('YYYY-MM-DD HH:mm'),
    },
    {
      title: '操作',
      key: 'action',
      width: 280,
      fixed: 'right',
      render: (_, record) => (
        <Space size={2} wrap>
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => handleViewDetail(record)}
          >
            详情
          </Button>
          <Button
            type="link"
            size="small"
            icon={<ArrowRightOutlined />}
            onClick={() => navigate(`/visits/${record.visit_id}`)}
          >
            跳转业务
          </Button>
          {canOperateOnItem(record) && record.item_type === 'visit' && (
            <Button
              type="link"
              size="small"
              icon={<EditOutlined />}
              onClick={() => handleProcessVisit(record)}
            >
              回访处理
            </Button>
          )}
          {canOperateOnItem(record) && record.item_type === 'warning' && (
            <>
              <Button
                type="link"
                size="small"
                icon={<EditOutlined />}
                onClick={() => handleFollowUp(record)}
              >
                跟进
              </Button>
              <Button
                type="link"
                size="small"
                style={{ color: '#52c41a' }}
                icon={<CheckCircleOutlined />}
                onClick={() => handleResolve(record)}
              >
                解除
              </Button>
              <Button
                type="link"
                size="small"
                danger
                icon={<StopOutlined />}
                onClick={() => handleIgnoreWarning(record)}
              >
                忽略
              </Button>
            </>
          )}
          {canOperateOnItem(record) && record.item_type === 'supervision' && (
            <>
              <Button
                type="link"
                size="small"
                icon={<EditOutlined />}
                onClick={() => handleFollowUp(record)}
              >
                跟进
              </Button>
              <Button
                type="link"
                size="small"
                style={{ color: '#52c41a' }}
                onClick={() => handleResolve(record)}
              >
                解决
              </Button>
            </>
          )}
          {isAdmin && record.item_type === 'supervision' && isSupervisionActive(record.status) && (
            <>
              <Button
                type="link"
                size="small"
                icon={<SwapOutlined />}
                onClick={() => handleReassignSupervision(record)}
              >
                转派
              </Button>
              <Button
                type="link"
                size="small"
                danger
                icon={<CloseCircleOutlined />}
                onClick={() => handleCloseSupervision(record)}
              >
                关闭
              </Button>
              <Button
                type="link"
                size="small"
                icon={<StopOutlined />}
                onClick={() => handleDismissSupervision(record)}
              >
                无需处理
              </Button>
            </>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <Title level={4} style={{ margin: 0 }}>
            <ThunderboltOutlined style={{ marginRight: 8, color: '#1677ff' }} />
            重点回访闭环工作台
          </Title>
          <div style={{ color: '#999', fontSize: 13, marginTop: 4 }}>
            自动汇总待回访、预警、督办中的重点事项，按风险等级、超期状态、满意度、无法联系次数、处理人维度形成待办清单
          </div>
        </div>
        <Button
          type="primary"
          icon={<ReloadOutlined />}
          onClick={refreshAll}
          loading={loading || statsLoading}
        >
          刷新数据
        </Button>
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} lg={6}>
          <Card
            className="stat-card"
            onClick={() => {
              form.setFieldsValue({ item_type: 'visit' });
              handleSearch({ item_type: 'visit' });
            }}
            style={{ cursor: 'pointer' }}
          >
            <Statistic
              title="今日待处理"
              value={stats?.today_pending || 0}
              prefix={<ClockCircleOutlined style={{ color: '#1677ff' }} />}
              valueStyle={{ color: '#1677ff' }}
              loading={statsLoading}
            />
            <div style={{ marginTop: 8, fontSize: 12, color: '#999' }}>
              回访待办 {stats?.pending_visits || 0} · 预警 {stats?.active_warnings || 0} · 督办 {stats?.active_supervisions || 0}
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card
            className="stat-card"
            onClick={() => {
              form.setFieldsValue({ risk: 'high' });
              handleSearch({ risk: 'high' });
            }}
            style={{ cursor: 'pointer', borderLeft: '3px solid #ff4d4f' }}
          >
            <Statistic
              title="高风险事项"
              value={stats?.high_risk || 0}
              prefix={<AlertOutlined style={{ color: '#ff4d4f' }} />}
              valueStyle={{ color: '#ff4d4f' }}
              loading={statsLoading}
            />
            <div style={{ marginTop: 8, fontSize: 12, color: '#999' }}>
              需优先关注并尽快处理
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card
            className="stat-card"
            onClick={() => {
              form.setFieldsValue({ is_overdue: 'true' });
              handleSearch({ is_overdue: 'true' });
            }}
            style={{ cursor: 'pointer', borderLeft: '3px solid #fa8c16' }}
          >
            <Statistic
              title="超期待办"
              value={stats?.overdue || 0}
              prefix={<ExclamationCircleOutlined style={{ color: '#fa8c16' }} />}
              valueStyle={{ color: '#fa8c16' }}
              loading={statsLoading}
            />
            <div style={{ marginTop: 8, fontSize: 12, color: '#999' }}>
              回访 {stats?.overdue_visits || 0} · 预警 {stats?.overdue_warnings || 0} · 督办 {stats?.overdue_supervisions || 0}
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card className="stat-card" style={{ borderLeft: '3px solid #52c41a' }}>
            <Statistic
              title="已闭环"
              value={stats?.closed || 0}
              prefix={<CheckCircleOutlined style={{ color: '#52c41a' }} />}
              valueStyle={{ color: '#52c41a' }}
              loading={statsLoading}
            />
            <div style={{ marginTop: 8, fontSize: 12, color: '#999' }}>
              今日闭环 {stats?.today_closed || 0} 项
            </div>
          </Card>
        </Col>
      </Row>

      <Card
        title="筛选条件"
        style={{ marginBottom: 16 }}
      >
        <Form form={form} layout="vertical" onFinish={handleSearch}>
          <Row gutter={16}>
            <Col xs={24} sm={12} md={8} lg={6}>
              <Form.Item name="keyword" label="关键词">
                <Input placeholder="工单号/用户姓名/电话/事项" allowClear />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={8} lg={6}>
              <Form.Item name="item_type" label="事项类型">
                <Select placeholder="请选择" allowClear>
                  {WORKBENCH_ITEM_TYPE_OPTIONS.map((opt) => (
                    <Select.Option key={opt.value} value={opt.value}>
                      {opt.label}
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={8} lg={6}>
              <Form.Item name="risk" label="风险级别">
                <Select placeholder="请选择" allowClear>
                  {WORKBENCH_RISK_OPTIONS.map((opt) => (
                    <Select.Option key={opt.value} value={opt.value}>
                      {opt.label}
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={8} lg={6}>
              <Form.Item name="handler_id" label="处理人">
                <Select placeholder="请选择" allowClear showSearch optionFilterProp="children">
                  {users.map((u) => (
                    <Select.Option key={u.id} value={u.id}>
                      {u.name}
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={8} lg={6}>
              <Form.Item name="status" label="状态">
                <Select placeholder="请选择" allowClear>
                  {STATUS_OPTIONS.map((opt) => (
                    <Select.Option key={`visit_${opt.value}`} value={opt.value}>
                      回访-{opt.label}
                    </Select.Option>
                  ))}
                  {WARNING_STATUS_OPTIONS.map((opt) => (
                    <Select.Option key={`warning_${opt.value}`} value={opt.value}>
                      预警-{opt.label}
                    </Select.Option>
                  ))}
                  {SUPERVISION_STATUS_OPTIONS.slice(0, 6).map((opt) => (
                    <Select.Option key={`supervision_${opt.value}`} value={opt.value}>
                      督办-{opt.label}
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={8} lg={6}>
              <Form.Item name="is_overdue" label="超期状态">
                <Select placeholder="请选择" allowClear>
                  <Select.Option value="true">已超期</Select.Option>
                  <Select.Option value="false">未超期</Select.Option>
                </Select>
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={8} lg={6}>
              <Form.Item name="date_range" label="创建时间">
                <RangePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col xs={24}>
              <Form.Item>
                <Space>
                  <Button type="primary" htmlType="submit" icon={<SearchOutlined />}>
                    查询
                  </Button>
                  <Button icon={<ReloadOutlined />} onClick={handleReset}>
                    重置
                  </Button>
                </Space>
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Card>

      <Card title={`重点事项清单（共 ${total} 条）`}>
        <Spin spinning={loading}>
          <Table
            columns={columns}
            dataSource={items}
            rowKey="id"
            pagination={{
              current: pagination.current,
              pageSize: pagination.pageSize,
              total,
              showSizeChanger: true,
              showQuickJumper: true,
              showTotal: (t) => `共 ${t} 条记录`,
              onChange: handleTableChange,
            }}
            scroll={{ x: 1900 }}
          />
        </Spin>
      </Card>

      <Drawer
        title={currentItem ? `${currentItem.item_type_label} - 详情` : '详情'}
        width={760}
        open={detailDrawerVisible}
        onClose={() => {
          setDetailDrawerVisible(false);
          setCurrentItem(null);
          setVisitDetail(null);
          setWarningDetail(null);
          setSupervisionDetail(null);
        }}
        extra={
          currentItem && (
            <Space>
              <Button onClick={() => navigate(`/visits/${currentItem.visit_id}`)} type="primary">
                前往业务处理 <ArrowRightOutlined />
              </Button>
            </Space>
          )
        }
      >
        <Spin spinning={detailLoading}>
          {currentItem && (
            <div>
              <Descriptions title="事项概览" bordered column={2} size="small">
                <Descriptions.Item label="事项类型">
                  {renderItemTypeTag(currentItem.item_type, currentItem.item_type_label, currentItem.is_overdue)}
                </Descriptions.Item>
                <Descriptions.Item label="风险级别">
                  {renderRiskTag(currentItem.risk)}
                </Descriptions.Item>
                <Descriptions.Item label="处理进度">
                  {renderProgressStage(currentItem.progress_stage, currentItem.progress_stage_label)}
                </Descriptions.Item>
                <Descriptions.Item label="处理人">
                  {currentItem.item_type === 'supervision' && currentItem.assignee_name
                    ? currentItem.assignee_name
                    : currentItem.handler_name || '-'}
                </Descriptions.Item>
                <Descriptions.Item label="处理状态">
                  {renderStatusTag(currentItem)}
                </Descriptions.Item>
                <Descriptions.Item label="事项来源">
                  {currentItem.item_type === 'warning' && currentItem.warning_type_label
                    ? currentItem.warning_type_label
                    : currentItem.item_type === 'supervision' && currentItem.source_type_label
                    ? currentItem.source_type_label
                    : '回访系统'}
                </Descriptions.Item>
                <Descriptions.Item label="事项说明" span={2}>
                  {currentItem.title}
                </Descriptions.Item>
                {currentItem.unreachable_count > 0 && (
                  <Descriptions.Item label="无法联系次数">
                    <Tag color="red">{currentItem.unreachable_count} 次</Tag>
                  </Descriptions.Item>
                )}
                {currentItem.satisfaction !== null && (
                  <Descriptions.Item label="满意度">
                    <Space>
                      <Rate disabled count={5} value={currentItem.satisfaction} style={{ fontSize: 14 }} />
                      <span>{currentItem.satisfaction} 分</span>
                    </Space>
                  </Descriptions.Item>
                )}
                <Descriptions.Item label="创建时间">
                  {dayjs(currentItem.created_at).format('YYYY-MM-DD HH:mm:ss')}
                </Descriptions.Item>
                <Descriptions.Item label="最后更新">
                  {dayjs(currentItem.updated_at).format('YYYY-MM-DD HH:mm:ss')}
                </Descriptions.Item>
              </Descriptions>

              {warningDetail && (
                <>
                  <Divider orientation="left">预警详情</Divider>
                  <Descriptions bordered column={2} size="small">
                    <Descriptions.Item label="预警级别">
                      {WARNING_LEVEL_OPTIONS.find((o) => o.value === warningDetail.level)?.label ||
                        warningDetail.level}
                    </Descriptions.Item>
                    <Descriptions.Item label="预警类型">
                      {warningDetail.warning_type_label}
                    </Descriptions.Item>
                    <Descriptions.Item label="预警详情" span={2}>
                      {warningDetail.reminder_text}
                    </Descriptions.Item>
                    {warningDetail.resolved_at && (
                      <Descriptions.Item label="解除时间" span={2}>
                        {dayjs(warningDetail.resolved_at).format('YYYY-MM-DD HH:mm:ss')}
                        {warningDetail.resolved_note && ` - ${warningDetail.resolved_note}`}
                      </Descriptions.Item>
                    )}
                  </Descriptions>
                </>
              )}

              {supervisionDetail && (
                <>
                  <Divider orientation="left">督办详情</Divider>
                  <Descriptions bordered column={2} size="small">
                    <Descriptions.Item label="风险级别">
                      {SUPERVISION_RISK_OPTIONS.find((o) => o.value === supervisionDetail.risk)?.label ||
                        supervisionDetail.risk}
                    </Descriptions.Item>
                    <Descriptions.Item label="异常来源">
                      {supervisionDetail.source_type_label}
                    </Descriptions.Item>
                    <Descriptions.Item label="责任人">
                      {supervisionDetail.assignee_name || '未分配'}
                    </Descriptions.Item>
                    <Descriptions.Item label="处理状态">
                      {SUPERVISION_STATUS_OPTIONS.find((o) => o.value === supervisionDetail.status)?.label ||
                        supervisionDetail.status}
                    </Descriptions.Item>
                    <Descriptions.Item label="异常说明" span={2}>
                      {supervisionDetail.description}
                    </Descriptions.Item>
                    {supervisionDetail.resolved_at && (
                      <Descriptions.Item label="关闭时间" span={2}>
                        {dayjs(supervisionDetail.resolved_at).format('YYYY-MM-DD HH:mm:ss')}
                        {supervisionDetail.resolved_note && ` - ${supervisionDetail.resolved_note}`}
                      </Descriptions.Item>
                    )}
                  </Descriptions>
                </>
              )}

              <Divider orientation="left">关联工单</Divider>
              {visitDetail && (
                <Descriptions bordered column={2} size="small">
                  <Descriptions.Item label="工单号">
                    {visitDetail.repair_order_no}
                  </Descriptions.Item>
                  <Descriptions.Item label="维修类别">
                    {visitDetail.category_name}
                  </Descriptions.Item>
                  <Descriptions.Item label="用户姓名">
                    {visitDetail.user_name}
                  </Descriptions.Item>
                  <Descriptions.Item label="联系电话">
                    {visitDetail.user_phone}
                  </Descriptions.Item>
                  <Descriptions.Item label="地址" span={2}>
                    {visitDetail.address}
                  </Descriptions.Item>
                  <Descriptions.Item label="维修内容" span={2}>
                    {visitDetail.repair_content}
                  </Descriptions.Item>
                  <Descriptions.Item label="回访状态">
                    {STATUS_OPTIONS.find((o) => o.value === visitDetail.status)?.label || visitDetail.status}
                  </Descriptions.Item>
                  <Descriptions.Item label="处理人">
                    {visitDetail.handler_name}
                  </Descriptions.Item>
                  {visitDetail.satisfaction !== null && (
                    <Descriptions.Item label="满意度" span={2}>
                      <Space>
                        <Rate disabled count={5} value={visitDetail.satisfaction} style={{ fontSize: 14 }} />
                        <span>{visitDetail.satisfaction} 分</span>
                      </Space>
                    </Descriptions.Item>
                  )}
                  {visitDetail.visit_result && (
                    <Descriptions.Item label="回访结果" span={2}>
                      {visitDetail.visit_result}
                    </Descriptions.Item>
                  )}
                  <Descriptions.Item label="维修完成时间">
                    {dayjs(visitDetail.completed_at).format('YYYY-MM-DD HH:mm')}
                  </Descriptions.Item>
                  <Descriptions.Item label="无法联系次数">
                    {visitDetail.unreachable_count > 0 ? `${visitDetail.unreachable_count} 次` : '-'}
                  </Descriptions.Item>
                </Descriptions>
              )}

              {visitDetail && visitDetail.status_timeline && visitDetail.status_timeline.length > 0 && (
                <>
                  <Divider orientation="left">回访状态流转</Divider>
                  <Timeline
                    items={visitDetail.status_timeline
                      .slice()
                      .reverse()
                      .map((r) => ({
                        children: (
                          <div>
                            <div>
                              <strong>{r.operator_name}</strong>
                              <Tag style={{ marginLeft: 8 }}>
                                {STATUS_OPTIONS.find((o) => o.value === r.status)?.label || r.status}
                              </Tag>
                              <span style={{ color: '#999', marginLeft: 8, fontSize: 12 }}>
                                {dayjs(r.timestamp).format('YYYY-MM-DD HH:mm:ss')}
                              </span>
                            </div>
                            {r.remark && <div style={{ marginTop: 4 }}>{r.remark}</div>}
                          </div>
                        ),
                      }))}
                  />
                </>
              )}

              {warningDetail && warningDetail.follow_up_records && warningDetail.follow_up_records.length > 0 && (
                <>
                  <Divider orientation="left">预警跟进记录</Divider>
                  <Timeline
                    items={warningDetail.follow_up_records
                      .slice()
                      .reverse()
                      .map((r) => ({
                        children: (
                          <div>
                            <div>
                              <strong>{r.operator_name}</strong>
                              {r.action && r.action !== 'note' && (
                                <Tag style={{ marginLeft: 8 }}>{r.action}</Tag>
                              )}
                              <span style={{ color: '#999', marginLeft: 8, fontSize: 12 }}>
                                {dayjs(r.timestamp).format('YYYY-MM-DD HH:mm:ss')}
                              </span>
                            </div>
                            <div style={{ marginTop: 4 }}>{r.note}</div>
                          </div>
                        ),
                      }))}
                  />
                </>
              )}

              {supervisionDetail &&
                supervisionDetail.progress_records &&
                supervisionDetail.progress_records.length > 0 && (
                  <>
                    <Divider orientation="left">督办跟进记录</Divider>
                    <Timeline
                      items={supervisionDetail.progress_records
                        .slice()
                        .reverse()
                        .map((r) => ({
                          children: (
                            <div>
                              <div>
                                <strong>{r.operator_name}</strong>
                                {r.action && r.action !== 'note' && (
                                  <Tag style={{ marginLeft: 8 }}>{r.action}</Tag>
                                )}
                                <span style={{ color: '#999', marginLeft: 8, fontSize: 12 }}>
                                  {dayjs(r.timestamp).format('YYYY-MM-DD HH:mm:ss')}
                                </span>
                              </div>
                              <div style={{ marginTop: 4 }}>{r.note}</div>
                            </div>
                          ),
                        }))}
                    />
                  </>
                )}

              <Divider />
              <Space wrap>
                {canOperate && visitDetail && visitDetail.status === 'pending' && (
                  <Button type="primary" icon={<EditOutlined />} onClick={() => handleProcessVisit(currentItem!)}>
                    回访处理
                  </Button>
                )}
                {canOperateOnItem(currentItem) && currentItem.item_type === 'warning' && (
                  <>
                    <Button icon={<EditOutlined />} onClick={() => handleFollowUp(currentItem)}>
                      添加跟进
                    </Button>
                    <Button
                      style={{ background: '#52c41a', borderColor: '#52c41a' }}
                      type="primary"
                      icon={<CheckCircleOutlined />}
                      onClick={() => handleResolve(currentItem)}
                    >
                      解除预警
                    </Button>
                    <Button danger icon={<StopOutlined />} onClick={() => handleIgnoreWarning(currentItem)}>
                      忽略预警
                    </Button>
                  </>
                )}
                {canOperateOnItem(currentItem) && currentItem.item_type === 'supervision' && (
                  <>
                    <Button icon={<EditOutlined />} onClick={() => handleFollowUp(currentItem)}>
                      添加跟进
                    </Button>
                    <Button
                      style={{ background: '#52c41a', borderColor: '#52c41a' }}
                      type="primary"
                      icon={<CheckCircleOutlined />}
                      onClick={() => handleResolve(currentItem)}
                    >
                      完成督办
                    </Button>
                  </>
                )}
                {isAdmin && currentItem.item_type === 'supervision' && isSupervisionActive(currentItem.status) && (
                  <>
                    <Button icon={<SwapOutlined />} onClick={() => handleReassignSupervision(currentItem)}>
                      转派
                    </Button>
                    <Button danger icon={<CloseCircleOutlined />} onClick={() => handleCloseSupervision(currentItem)}>
                      关闭
                    </Button>
                    <Button icon={<StopOutlined />} onClick={() => handleDismissSupervision(currentItem)}>
                      无需处理
                    </Button>
                  </>
                )}
              </Space>
            </div>
          )}
        </Spin>
      </Drawer>

      <VisitProcessModal
        open={processModalVisible}
        visitId={processingVisit?.id || null}
        currentStatus={(processingVisit?.status as VisitStatus) || 'pending'}
        onCancel={() => {
          setProcessModalVisible(false);
          setProcessingVisit(null);
        }}
        onSuccess={handleProcessSuccess}
      />

      <Modal
        title="添加跟进记录"
        open={followUpModalVisible}
        onCancel={() => {
          setFollowUpModalVisible(false);
          setFollowUpTarget(null);
          followUpForm.resetFields();
        }}
        footer={null}
        destroyOnClose
      >
        <Form form={followUpForm} layout="vertical" onFinish={handleFollowUpSubmit}>
          <Form.Item name="action" label="操作类型" initialValue="note">
            <Select>
              <Select.Option value="note">备注</Select.Option>
              <Select.Option value="contact">已联系用户</Select.Option>
              <Select.Option value="escalate">已上报</Select.Option>
              <Select.Option value="other">其他</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="note" label="跟进说明" rules={[{ required: true, message: '请填写跟进说明' }]}>
            <TextArea rows={4} placeholder="请填写跟进说明" />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button
                onClick={() => {
                  setFollowUpModalVisible(false);
                  setFollowUpTarget(null);
                  followUpForm.resetFields();
                }}
              >
                取消
              </Button>
              <Button type="primary" htmlType="submit">
                提交
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={resolveTarget?.type === 'warning' ? '解除预警' : '提交解决结果'}
        open={resolveModalVisible}
        onCancel={() => {
          setResolveModalVisible(false);
          setResolveTarget(null);
          resolveForm.resetFields();
        }}
        footer={null}
        destroyOnClose
      >
        <Form form={resolveForm} layout="vertical" onFinish={handleResolveSubmit}>
          <Form.Item
            name="note"
            label={resolveTarget?.type === 'warning' ? '处理说明' : '解决说明'}
            rules={[{ required: true, message: '请填写说明' }]}
          >
            <TextArea
              rows={4}
              placeholder={
                resolveTarget?.type === 'warning'
                  ? '请填写解除预警的原因和处理情况'
                  : '请填写问题解决的情况'
              }
            />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button
                onClick={() => {
                  setResolveModalVisible(false);
                  setResolveTarget(null);
                  resolveForm.resetFields();
                }}
              >
                取消
              </Button>
              <Button
                type="primary"
                htmlType="submit"
                style={{ background: '#52c41a', borderColor: '#52c41a' }}
              >
                确认{resolveTarget?.type === 'warning' ? '解除' : '解决'}
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="忽略预警"
        open={ignoreModalVisible}
        onCancel={() => {
          setIgnoreModalVisible(false);
          setFollowUpTarget(null);
          ignoreForm.resetFields();
        }}
        footer={null}
        destroyOnClose
      >
        <Form form={ignoreForm} layout="vertical" onFinish={handleIgnoreSubmit}>
          <Form.Item name="note" label="忽略原因" rules={[{ required: true, message: '请填写忽略原因' }]}>
            <TextArea rows={4} placeholder="请填写忽略此预警的原因" />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button
                onClick={() => {
                  setIgnoreModalVisible(false);
                  setFollowUpTarget(null);
                  ignoreForm.resetFields();
                }}
              >
                取消
              </Button>
              <Button type="primary" danger htmlType="submit">
                确认忽略
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="关闭督办事项"
        open={closeModalVisible}
        onCancel={() => {
          setCloseModalVisible(false);
          setFollowUpTarget(null);
          closeForm.resetFields();
        }}
        footer={null}
        destroyOnClose
      >
        <Form form={closeForm} layout="vertical" onFinish={handleCloseSubmit}>
          <Form.Item name="note" label="关闭原因" rules={[{ required: true, message: '请填写关闭原因' }]}>
            <TextArea rows={4} placeholder="请填写关闭此督办事项的原因" />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button
                onClick={() => {
                  setCloseModalVisible(false);
                  setFollowUpTarget(null);
                  closeForm.resetFields();
                }}
              >
                取消
              </Button>
              <Button type="primary" danger htmlType="submit">
                确认关闭
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="标记无需处理"
        open={dismissModalVisible}
        onCancel={() => {
          setDismissModalVisible(false);
          setFollowUpTarget(null);
          dismissForm.resetFields();
        }}
        footer={null}
        destroyOnClose
      >
        <Form form={dismissForm} layout="vertical" onFinish={handleDismissSubmit}>
          <Form.Item
            name="note"
            label="无需处理原因"
            rules={[{ required: true, message: '请填写无需处理的原因' }]}
          >
            <TextArea rows={4} placeholder="请填写标记此事项无需处理的原因" />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button
                onClick={() => {
                  setDismissModalVisible(false);
                  setFollowUpTarget(null);
                  dismissForm.resetFields();
                }}
              >
                取消
              </Button>
              <Button type="primary" htmlType="submit">
                确认标记
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="转派督办事项"
        open={reassignModalVisible}
        onCancel={() => {
          setReassignModalVisible(false);
          setFollowUpTarget(null);
          reassignForm.resetFields();
        }}
        footer={null}
        destroyOnClose
      >
        <Form form={reassignForm} layout="vertical" onFinish={handleReassignSubmit}>
          <Form.Item
            name="assignee_id"
            label="新责任人"
            rules={[{ required: true, message: '请选择新责任人' }]}
          >
            <Select placeholder="请选择责任人" showSearch optionFilterProp="children">
              {users
                .filter((u) => u.role === 'operator' || u.role === 'admin')
                .map((u) => (
                  <Select.Option key={u.id} value={u.id}>
                    {u.name} ({u.role === 'admin' ? '管理员' : '操作员'})
                  </Select.Option>
                ))}
            </Select>
          </Form.Item>
          <Form.Item name="note" label="转派说明">
            <TextArea rows={3} placeholder="请填写转派原因（可选）" />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button
                onClick={() => {
                  setReassignModalVisible(false);
                  setFollowUpTarget(null);
                  reassignForm.resetFields();
                }}
              >
                取消
              </Button>
              <Button type="primary" htmlType="submit">
                确认转派
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
