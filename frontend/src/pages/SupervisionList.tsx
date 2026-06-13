import { useState, useEffect } from 'react';
import {
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
  Row,
  Col,
  Card,
  Modal,
  Input as AntdInput,
  Descriptions,
  Timeline,
  Divider,
  Tooltip,
} from 'antd';
import {
  SearchOutlined,
  ReloadOutlined,
  EyeOutlined,
  AuditOutlined,
  CheckCircleOutlined,
  SwapOutlined,
  CloseCircleOutlined,
  StopOutlined,
  ExclamationCircleOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import { useNavigate, useLocation } from 'react-router-dom';
import dayjs from 'dayjs';
import {
  getSupervisions,
  getSupervisionDetail,
  generateSupervisions,
  followUpSupervision,
  resolveSupervision,
  reassignSupervision,
  closeSupervision,
  dismissSupervision,
} from '@/api/supervisions';
import { getUsers } from '@/api/users';
import { getVisitDetail } from '@/api/visits';
import {
  Supervision,
  SupervisionFilter,
  User,
  SUPERVISION_SOURCE_OPTIONS,
  SUPERVISION_RISK_OPTIONS,
  SUPERVISION_STATUS_OPTIONS,
  STATUS_OPTIONS,
} from '@/types';
import { useAuthStore } from '@/store/auth';
import type { ColumnsType } from 'antd/es/table';

const { RangePicker } = DatePicker;
const { TextArea } = AntdInput;

export default function SupervisionList() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [supervisions, setSupervisions] = useState<Supervision[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [total, setTotal] = useState(0);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10 });
  const [form] = Form.useForm();
  const [currentFilters, setCurrentFilters] = useState<SupervisionFilter>({});

  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [currentItem, setCurrentItem] = useState<Supervision | null>(null);
  const [followUpModalVisible, setFollowUpModalVisible] = useState(false);
  const [resolveModalVisible, setResolveModalVisible] = useState(false);
  const [reassignModalVisible, setReassignModalVisible] = useState(false);
  const [closeModalVisible, setCloseModalVisible] = useState(false);
  const [dismissModalVisible, setDismissModalVisible] = useState(false);
  const [followUpForm] = Form.useForm();
  const [resolveForm] = Form.useForm();
  const [reassignForm] = Form.useForm();
  const [closeForm] = Form.useForm();
  const [dismissForm] = Form.useForm();

  useEffect(() => {
    fetchUsers();
    const params = new URLSearchParams(location.search);
    const initialFilter: SupervisionFilter = {};
    if (params.get('source_type')) initialFilter.source_type = params.get('source_type') as any;
    if (params.get('risk')) initialFilter.risk = params.get('risk') as any;
    if (params.get('status')) initialFilter.status = params.get('status') as any;
    if (params.get('assignee_id')) initialFilter.assignee_id = params.get('assignee_id') as string;
    if (params.get('keyword')) initialFilter.keyword = params.get('keyword') as string;
    if (params.get('date_from')) initialFilter.date_from = params.get('date_from') as string;
    if (params.get('date_to')) initialFilter.date_to = params.get('date_to') as string;

    const nextPagination = {
      current: Number(params.get('page')) || 1,
      pageSize: Number(params.get('page_size')) || 10,
    };
    const formValues: any = { ...initialFilter };
    if (initialFilter.date_from && initialFilter.date_to) {
      formValues.date_range = [dayjs(initialFilter.date_from), dayjs(initialFilter.date_to)];
    }
    form.setFieldsValue(formValues);
    setCurrentFilters(initialFilter);
    setPagination(nextPagination);
    fetchSupervisions(initialFilter, nextPagination);
  }, [location.search]);

  useEffect(() => {
    if (Object.keys(currentFilters).length === 0) {
      fetchSupervisions();
    } else {
      fetchSupervisions(currentFilters);
    }
  }, [pagination.current, pagination.pageSize]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchSupervisions(currentFilters);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [currentFilters]);

  const fetchUsers = async () => {
    try {
      const data = await getUsers();
      setUsers(data);
    } catch (err: any) {
      message.error(err.message || '获取用户列表失败');
    }
  };

  const fetchSupervisions = async (filters?: SupervisionFilter, pageConfig = pagination) => {
    setLoading(true);
    try {
      const data = await getSupervisions({
        ...filters,
        page: pageConfig.current,
        page_size: pageConfig.pageSize,
      });
      setSupervisions(data.items);
      setTotal(data.total);
    } catch (err: any) {
      message.error(err.message || '获取督办列表失败');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const result = await generateSupervisions();
      message.success(
        `生成完成：新增 ${result.created} 条，更新 ${result.updated} 条，关闭 ${result.resolved} 条，当前进行中 ${result.total_active} 条`
      );
      fetchSupervisions(currentFilters);
    } catch (err: any) {
      message.error(err.message || '生成失败');
    } finally {
      setGenerating(false);
    }
  };

  const handleSearch = (values: any) => {
    const filters: SupervisionFilter = {};
    if (values.source_type) filters.source_type = values.source_type;
    if (values.risk) filters.risk = values.risk;
    if (values.status) filters.status = values.status;
    if (values.assignee_id) filters.assignee_id = values.assignee_id;
    if (values.keyword) filters.keyword = values.keyword;
    if (values.date_range) {
      filters.date_from = values.date_range[0].format('YYYY-MM-DD');
      filters.date_to = values.date_range[1].format('YYYY-MM-DD');
    }
    setCurrentFilters(filters);
    setPagination({ ...pagination, current: 1 });
    fetchSupervisions(filters, { ...pagination, current: 1 });
  };

  const handleReset = () => {
    form.resetFields();
    setCurrentFilters({});
    setPagination({ current: 1, pageSize: 10 });
    fetchSupervisions();
  };

  const handleTableChange = (page: number, pageSize: number) => {
    setPagination({ current: page, pageSize });
  };

  const handleViewDetail = async (item: Supervision) => {
    setLoading(true);
    try {
      const [supervisionDetail, visitDetail] = await Promise.all([
        getSupervisionDetail(item.id),
        getVisitDetail(item.visit_id),
      ]);
      const updated = {
        ...supervisionDetail,
        visit_info: {
          ...supervisionDetail.visit_info,
          status: visitDetail.status,
          satisfaction: visitDetail.satisfaction,
        },
      };
      setCurrentItem(updated);
      setDetailModalVisible(true);
    } catch (err: any) {
      message.error(err.message || '获取详情失败');
    } finally {
      setLoading(false);
    }
  };

  const handleFollowUp = (item: Supervision) => {
    setCurrentItem(item);
    followUpForm.resetFields();
    setFollowUpModalVisible(true);
  };

  const handleFollowUpSubmit = async (values: any) => {
    if (!currentItem) return;
    try {
      await followUpSupervision(currentItem.id, {
        note: values.note,
        action: values.action || 'note',
      });
      message.success('跟进记录已添加');
      setFollowUpModalVisible(false);
      setCurrentItem(null);
      followUpForm.resetFields();
      fetchSupervisions(currentFilters);
    } catch (err: any) {
      message.error(err.message || '操作失败');
    }
  };

  const handleResolve = (item: Supervision) => {
    setCurrentItem(item);
    resolveForm.resetFields();
    setResolveModalVisible(true);
  };

  const handleResolveSubmit = async (values: any) => {
    if (!currentItem) return;
    try {
      await resolveSupervision(currentItem.id, { note: values.note });
      message.success('事项已解决');
      setResolveModalVisible(false);
      setCurrentItem(null);
      resolveForm.resetFields();
      fetchSupervisions(currentFilters);
    } catch (err: any) {
      message.error(err.message || '操作失败');
    }
  };

  const handleReassign = (item: Supervision) => {
    setCurrentItem(item);
    reassignForm.resetFields();
    setReassignModalVisible(true);
  };

  const handleReassignSubmit = async (values: any) => {
    if (!currentItem) return;
    try {
      await reassignSupervision(currentItem.id, {
        assignee_id: values.assignee_id,
        note: values.note || '',
      });
      message.success('事项已转派');
      setReassignModalVisible(false);
      setCurrentItem(null);
      reassignForm.resetFields();
      fetchSupervisions(currentFilters);
    } catch (err: any) {
      message.error(err.message || '转派失败');
    }
  };

  const handleClose = (item: Supervision) => {
    setCurrentItem(item);
    closeForm.resetFields();
    setCloseModalVisible(true);
  };

  const handleCloseSubmit = async (values: any) => {
    if (!currentItem) return;
    try {
      await closeSupervision(currentItem.id, { note: values.note });
      message.success('事项已关闭');
      setCloseModalVisible(false);
      setCurrentItem(null);
      closeForm.resetFields();
      fetchSupervisions(currentFilters);
    } catch (err: any) {
      message.error(err.message || '操作失败');
    }
  };

  const handleDismiss = (item: Supervision) => {
    setCurrentItem(item);
    dismissForm.resetFields();
    setDismissModalVisible(true);
  };

  const handleDismissSubmit = async (values: any) => {
    if (!currentItem) return;
    try {
      await dismissSupervision(currentItem.id, { note: values.note });
      message.success('事项已标记无需处理');
      setDismissModalVisible(false);
      setCurrentItem(null);
      dismissForm.resetFields();
      fetchSupervisions(currentFilters);
    } catch (err: any) {
      message.error(err.message || '操作失败');
    }
  };

  const isAdmin = user?.role === 'admin';
  const canOperate = user?.role !== 'auditor';
  const isItemActive = (status: string) => !['resolved', 'closed', 'dismissed'].includes(status);

  const renderRiskTag = (risk: string) => {
    const option = SUPERVISION_RISK_OPTIONS.find((o) => o.value === risk);
    return <Tag color={option?.color}>{option?.label || risk}</Tag>;
  };

  const renderStatusTag = (status: string) => {
    const option = SUPERVISION_STATUS_OPTIONS.find((o) => o.value === status);
    return <Tag color={option?.color}>{option?.label || status}</Tag>;
  };

  const renderSourceDetail = (item: Supervision) => {
    const detail = item.source_detail || {};
    const parts: string[] = [];
    if (detail.satisfaction !== undefined) parts.push(`满意度 ${detail.satisfaction} 分`);
    if (detail.unreachable_count) parts.push(`无法联系 ${detail.unreachable_count} 次`);
    if (detail.unreachable_reason) parts.push(`原因: ${detail.unreachable_reason}`);
    if (detail.overdue_days) parts.push(`超期 ${detail.overdue_days} 天`);
    if (detail.unresolved_note) parts.push(`备注: ${detail.unresolved_note}`);
    return parts.join('，');
  };

  const columns: ColumnsType<Supervision> = [
    {
      title: '风险级别',
      dataIndex: 'risk',
      key: 'risk',
      width: 90,
      render: (val: string) => renderRiskTag(val),
    },
    {
      title: '异常来源',
      dataIndex: 'source_type_label',
      key: 'source_type_label',
      width: 110,
    },
    {
      title: '异常说明',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
      render: (text: string) => (
        <Tooltip title={text}>
          <Space>
            <ExclamationCircleOutlined style={{ color: '#FAAD14' }} />
            <span>{text}</span>
          </Space>
        </Tooltip>
      ),
    },
    {
      title: '工单号',
      dataIndex: ['visit_info', 'repair_order_no'],
      key: 'repair_order_no',
      width: 140,
    },
    {
      title: '用户姓名',
      dataIndex: ['visit_info', 'user_name'],
      key: 'user_name',
      width: 100,
    },
    {
      title: '维修类别',
      dataIndex: ['visit_info', 'category_name'],
      key: 'category_name',
      width: 110,
    },
    {
      title: '回访状态',
      dataIndex: ['visit_info', 'status'],
      key: 'visit_status',
      width: 100,
      render: (status: string) => {
        const opt = STATUS_OPTIONS.find((o) => o.value === status);
        return <Tag color={opt?.color}>{opt?.label || status}</Tag>;
      },
    },
    {
      title: '责任人',
      dataIndex: 'assignee_name',
      key: 'assignee_name',
      width: 100,
      render: (val: string | null) => val || <span style={{ color: '#999' }}>未分配</span>,
    },
    {
      title: '处理状态',
      dataIndex: 'status',
      key: 'status',
      width: 90,
      render: (val: string) => renderStatusTag(val),
    },
    {
      title: '发现时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 160,
      render: (val: string) => dayjs(val).format('YYYY-MM-DD HH:mm'),
    },
    {
      title: '操作',
      key: 'action',
      width: 280,
      fixed: 'right',
      render: (_, record) => (
        <Space size={4}>
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => handleViewDetail(record)}>
            详情
          </Button>
          <Button
            type="link"
            size="small"
            icon={<AuditOutlined />}
            onClick={() => {
              navigate(`/visits/${record.visit_id}`);
            }}
          >
            跳转业务
          </Button>
          {canOperate && isItemActive(record.status) && (
            <>
              <Button
                type="link"
                size="small"
                icon={<CheckCircleOutlined />}
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
          {isAdmin && isItemActive(record.status) && (
            <>
              <Button
                type="link"
                size="small"
                icon={<SwapOutlined />}
                onClick={() => handleReassign(record)}
              >
                转派
              </Button>
              <Button
                type="link"
                size="small"
                danger
                icon={<CloseCircleOutlined />}
                onClick={() => handleClose(record)}
              >
                关闭
              </Button>
              <Button
                type="link"
                size="small"
                icon={<StopOutlined />}
                onClick={() => handleDismiss(record)}
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
      <Card
        title="筛选条件"
        style={{ marginBottom: 16 }}
        extra={
          <Button type="primary" icon={<ThunderboltOutlined />} loading={generating} onClick={handleGenerate}>
            生成督办事项
          </Button>
        }
      >
        <Form form={form} layout="vertical" onFinish={handleSearch}>
          <Row gutter={16}>
            <Col xs={24} sm={12} md={8} lg={6}>
              <Form.Item name="keyword" label="关键词">
                <Input placeholder="工单号/用户姓名/电话" allowClear />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={8} lg={6}>
              <Form.Item name="source_type" label="异常来源">
                <Select placeholder="请选择" allowClear>
                  {SUPERVISION_SOURCE_OPTIONS.map((opt) => (
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
                  {SUPERVISION_RISK_OPTIONS.map((opt) => (
                    <Select.Option key={opt.value} value={opt.value}>
                      {opt.label}
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={8} lg={6}>
              <Form.Item name="status" label="处理状态">
                <Select placeholder="请选择" allowClear>
                  {SUPERVISION_STATUS_OPTIONS.map((opt) => (
                    <Select.Option key={opt.value} value={opt.value}>
                      {opt.label}
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={8} lg={6}>
              <Form.Item name="assignee_id" label="责任人">
                <Select placeholder="请选择" allowClear>
                  {users.map((u) => (
                    <Select.Option key={u.id} value={u.id}>
                      {u.name}
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={8} lg={6}>
              <Form.Item name="date_range" label="发现时间">
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

      <Card title={`督办事项列表（共 ${total} 条）`}>
        <Spin spinning={loading}>
          <Table
            columns={columns}
            dataSource={supervisions}
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
            scroll={{ x: 1700 }}
          />
        </Spin>
      </Card>

      <Modal
        title="督办详情"
        open={detailModalVisible}
        onCancel={() => {
          setDetailModalVisible(false);
          setCurrentItem(null);
        }}
        footer={[
          <Button key="close" onClick={() => setDetailModalVisible(false)}>
            关闭
          </Button>,
          currentItem && (
            <Button
              key="visit"
              type="primary"
              onClick={() => navigate(`/visits/${currentItem.visit_id}`)}
            >
              前往业务处理 <AuditOutlined />
            </Button>
          ),
        ]}
        width={800}
        destroyOnClose
      >
        {currentItem && (
          <div>
            <Descriptions title="督办信息" bordered column={2} size="small">
              <Descriptions.Item label="风险级别">
                {renderRiskTag(currentItem.risk)}
              </Descriptions.Item>
              <Descriptions.Item label="处理状态">
                {renderStatusTag(currentItem.status)}
              </Descriptions.Item>
              <Descriptions.Item label="异常来源">
                {currentItem.source_type_label}
              </Descriptions.Item>
              <Descriptions.Item label="责任人">
                {currentItem.assignee_name || '未分配'}
              </Descriptions.Item>
              <Descriptions.Item label="异常说明" span={2}>
                {currentItem.description}
              </Descriptions.Item>
              <Descriptions.Item label="异常详情" span={2}>
                {renderSourceDetail(currentItem) || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="发现时间">
                {dayjs(currentItem.created_at).format('YYYY-MM-DD HH:mm:ss')}
              </Descriptions.Item>
              <Descriptions.Item label="最后更新">
                {dayjs(currentItem.updated_at).format('YYYY-MM-DD HH:mm:ss')}
              </Descriptions.Item>
              {currentItem.resolved_at && (
                <Descriptions.Item label="关闭时间" span={2}>
                  {dayjs(currentItem.resolved_at).format('YYYY-MM-DD HH:mm:ss')}
                  {currentItem.resolved_note && ` - ${currentItem.resolved_note}`}
                </Descriptions.Item>
              )}
            </Descriptions>

            <Divider orientation="left">关联回访单</Divider>
            <Descriptions bordered column={2} size="small">
              <Descriptions.Item label="工单号">
                {currentItem.visit_info.repair_order_no}
              </Descriptions.Item>
              <Descriptions.Item label="维修类别">
                {currentItem.visit_info.category_name}
              </Descriptions.Item>
              <Descriptions.Item label="用户姓名">
                {currentItem.visit_info.user_name}
              </Descriptions.Item>
              <Descriptions.Item label="联系电话">
                {currentItem.visit_info.user_phone}
              </Descriptions.Item>
              <Descriptions.Item label="地址" span={2}>
                {currentItem.visit_info.address}
              </Descriptions.Item>
              <Descriptions.Item label="维修内容" span={2}>
                {currentItem.visit_info.repair_content}
              </Descriptions.Item>
              <Descriptions.Item label="回访状态">
                {STATUS_OPTIONS.find((o) => o.value === currentItem.visit_info.status)?.label ||
                  currentItem.visit_info.status}
              </Descriptions.Item>
              <Descriptions.Item label="满意度">
                {currentItem.visit_info.satisfaction !== null
                  ? `${currentItem.visit_info.satisfaction} 分`
                  : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="维修处理人">
                {currentItem.visit_info.handler_name}
              </Descriptions.Item>
              <Descriptions.Item label="维修完成时间">
                {dayjs(currentItem.visit_info.completed_at).format('YYYY-MM-DD HH:mm')}
              </Descriptions.Item>
            </Descriptions>

            <Divider orientation="left">跟进记录</Divider>
            {currentItem.progress_records && currentItem.progress_records.length > 0 ? (
              <Timeline
                items={currentItem.progress_records
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
            ) : (
              <div style={{ color: '#999', textAlign: 'center', padding: 20 }}>暂无跟进记录</div>
            )}
          </div>
        )}
      </Modal>

      <Modal
        title="添加跟进记录"
        open={followUpModalVisible}
        onCancel={() => {
          setFollowUpModalVisible(false);
          setCurrentItem(null);
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
                  setCurrentItem(null);
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
        title="提交解决结果"
        open={resolveModalVisible}
        onCancel={() => {
          setResolveModalVisible(false);
          setCurrentItem(null);
          resolveForm.resetFields();
        }}
        footer={null}
        destroyOnClose
      >
        <Form form={resolveForm} layout="vertical" onFinish={handleResolveSubmit}>
          <Form.Item name="note" label="解决说明" rules={[{ required: true, message: '请填写解决说明' }]}>
            <TextArea rows={4} placeholder="请填写问题解决的情况" />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button
                onClick={() => {
                  setResolveModalVisible(false);
                  setCurrentItem(null);
                  resolveForm.resetFields();
                }}
              >
                取消
              </Button>
              <Button type="primary" htmlType="submit" style={{ background: '#52c41a' }}>
                确认解决
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
          setCurrentItem(null);
          reassignForm.resetFields();
        }}
        footer={null}
        destroyOnClose
      >
        <Form form={reassignForm} layout="vertical" onFinish={handleReassignSubmit}>
          <Form.Item name="assignee_id" label="新责任人" rules={[{ required: true, message: '请选择新责任人' }]}>
            <Select placeholder="请选择责任人">
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
                  setCurrentItem(null);
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

      <Modal
        title="关闭督办事项"
        open={closeModalVisible}
        onCancel={() => {
          setCloseModalVisible(false);
          setCurrentItem(null);
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
                  setCurrentItem(null);
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
          setCurrentItem(null);
          dismissForm.resetFields();
        }}
        footer={null}
        destroyOnClose
      >
        <Form form={dismissForm} layout="vertical" onFinish={handleDismissSubmit}>
          <Form.Item name="note" label="无需处理原因" rules={[{ required: true, message: '请填写无需处理的原因' }]}>
            <TextArea rows={4} placeholder="请填写标记此事项无需处理的原因" />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button
                onClick={() => {
                  setDismissModalVisible(false);
                  setCurrentItem(null);
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
    </div>
  );
}
