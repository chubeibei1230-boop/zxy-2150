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
  BellOutlined,
  CheckCircleOutlined,
  StopOutlined,
  EditOutlined,
  ArrowRightOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';
import { useNavigate, useLocation } from 'react-router-dom';
import dayjs from 'dayjs';
import {
  getWarnings,
  getWarningDetail,
  refreshWarnings,
  followUpWarning,
  resolveWarning,
  ignoreWarning,
} from '@/api/warnings';
import { getUsers } from '@/api/users';
import { getVisitDetail } from '@/api/visits';
import {
  Warning,
  WarningFilter,
  User,
  WARNING_TYPE_OPTIONS,
  WARNING_LEVEL_OPTIONS,
  WARNING_STATUS_OPTIONS,
  STATUS_OPTIONS,
} from '@/types';
import { useAuthStore } from '@/store/auth';
import type { ColumnsType } from 'antd/es/table';

const { RangePicker } = DatePicker;
const { TextArea } = AntdInput;

export default function WarningList() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [warnings, setWarnings] = useState<Warning[]>([]);
  const [handlers, setHandlers] = useState<User[]>([]);
  const [total, setTotal] = useState(0);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10 });
  const [form] = Form.useForm();
  const [currentFilters, setCurrentFilters] = useState<WarningFilter>({});

  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [currentWarning, setCurrentWarning] = useState<Warning | null>(null);
  const [followUpModalVisible, setFollowUpModalVisible] = useState(false);
  const [resolveModalVisible, setResolveModalVisible] = useState(false);
  const [ignoreModalVisible, setIgnoreModalVisible] = useState(false);
  const [followUpForm] = Form.useForm();
  const [resolveForm] = Form.useForm();
  const [ignoreForm] = Form.useForm();

  useEffect(() => {
    fetchHandlers();
    const params = new URLSearchParams(location.search);
    const initialFilter: WarningFilter = {};
    if (params.get('warning_type')) initialFilter.warning_type = params.get('warning_type') as any;
    if (params.get('level')) initialFilter.level = params.get('level') as any;
    if (Object.keys(initialFilter).length > 0) {
      form.setFieldsValue(initialFilter);
      setCurrentFilters(initialFilter);
    }
    fetchWarnings(initialFilter);
  }, [location.search]);

  useEffect(() => {
    if (Object.keys(currentFilters).length === 0) {
      fetchWarnings();
    } else {
      fetchWarnings(currentFilters);
    }
  }, [pagination.current, pagination.pageSize]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchWarnings(currentFilters);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [currentFilters]);

  const fetchHandlers = async () => {
    try {
      const data = await getUsers();
      setHandlers(data);
    } catch (err: any) {
      message.error(err.message || '获取处理人失败');
    }
  };

  const fetchWarnings = async (filters?: WarningFilter) => {
    setLoading(true);
    try {
      const data = await getWarnings({
        ...filters,
        page: pagination.current,
        page_size: pagination.pageSize,
      });
      setWarnings(data.items);
      setTotal(data.total);
    } catch (err: any) {
      message.error(err.message || '获取预警列表失败');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const result = await refreshWarnings();
      const escalatedText = result.escalated ? `，升级 ${result.escalated} 条` : '';
      message.success(
        `刷新完成：新增 ${result.created} 条，更新 ${result.updated} 条，解除 ${result.resolved} 条${escalatedText}，当前进行中 ${result.total_active} 条`
      );
      fetchWarnings(currentFilters);
    } catch (err: any) {
      message.error(err.message || '刷新失败');
    } finally {
      setRefreshing(false);
    }
  };

  const handleSearch = (values: any) => {
    const filters: WarningFilter = {};
    if (values.warning_type) filters.warning_type = values.warning_type;
    if (values.level) filters.level = values.level;
    if (values.status) filters.status = values.status;
    if (values.handler_id) filters.handler_id = values.handler_id;
    if (values.keyword) filters.keyword = values.keyword;
    if (values.date_range) {
      filters.date_from = values.date_range[0].format('YYYY-MM-DD');
      filters.date_to = values.date_range[1].format('YYYY-MM-DD');
    }
    setCurrentFilters(filters);
    setPagination({ ...pagination, current: 1 });
    fetchWarnings({ ...filters, page: 1, page_size: pagination.pageSize });
  };

  const handleReset = () => {
    form.resetFields();
    setCurrentFilters({});
    setPagination({ current: 1, pageSize: 10 });
    fetchWarnings();
  };

  const handleTableChange = (page: number, pageSize: number) => {
    setPagination({ current: page, pageSize });
  };

  const handleViewDetail = async (warning: Warning) => {
    setLoading(true);
    try {
      const [warningDetail, visitDetail] = await Promise.all([
        getWarningDetail(warning.id),
        getVisitDetail(warning.visit_id),
      ]);
      const updatedWarning = {
        ...warningDetail,
        visit_info: {
          ...warningDetail.visit_info,
          status: visitDetail.status,
          satisfaction: visitDetail.satisfaction,
        },
      };
      setCurrentWarning(updatedWarning);
      setDetailModalVisible(true);
    } catch (err: any) {
      message.error(err.message || '获取详情失败');
    } finally {
      setLoading(false);
    }
  };

  const handleFollowUp = (warning: Warning) => {
    setCurrentWarning(warning);
    followUpForm.resetFields();
    setFollowUpModalVisible(true);
  };

  const handleFollowUpSubmit = async (values: any) => {
    if (!currentWarning) return;
    try {
      await followUpWarning(currentWarning.id, {
        note: values.note,
        action: values.action || 'note',
      });
      message.success('跟进记录已添加');
      setFollowUpModalVisible(false);
      setCurrentWarning(null);
      followUpForm.resetFields();
      fetchWarnings(currentFilters);
    } catch (err: any) {
      message.error(err.message || '操作失败');
    }
  };

  const handleResolve = (warning: Warning) => {
    setCurrentWarning(warning);
    resolveForm.resetFields();
    setResolveModalVisible(true);
  };

  const handleResolveSubmit = async (values: any) => {
    if (!currentWarning) return;
    try {
      await resolveWarning(currentWarning.id, { note: values.note });
      message.success('预警已解除');
      setResolveModalVisible(false);
      setCurrentWarning(null);
      resolveForm.resetFields();
      fetchWarnings(currentFilters);
    } catch (err: any) {
      message.error(err.message || '操作失败');
    }
  };

  const handleIgnore = (warning: Warning) => {
    setCurrentWarning(warning);
    ignoreForm.resetFields();
    setIgnoreModalVisible(true);
  };

  const handleIgnoreSubmit = async (values: any) => {
    if (!currentWarning) return;
    try {
      await ignoreWarning(currentWarning.id, { note: values.note });
      message.success('预警已忽略');
      setIgnoreModalVisible(false);
      setCurrentWarning(null);
      ignoreForm.resetFields();
      fetchWarnings(currentFilters);
    } catch (err: any) {
      message.error(err.message || '操作失败');
    }
  };

  const canOperate = user?.role !== 'auditor';

  const renderLevelTag = (level: string) => {
    const option = WARNING_LEVEL_OPTIONS.find((o) => o.value === level);
    return <Tag color={option?.color}>{option?.label || level}</Tag>;
  };

  const renderStatusTag = (status: string) => {
    const option = WARNING_STATUS_OPTIONS.find((o) => o.value === status);
    return <Tag color={option?.color}>{option?.label || status}</Tag>;
  };

  const renderDetailExtra = (warning: Warning) => {
    const detail = warning.detail || {};
    const parts: string[] = [];
    if (detail.pending_days) parts.push(`已待处理 ${detail.pending_days} 天`);
    if (detail.satisfaction !== undefined) parts.push(`满意度 ${detail.satisfaction} 分`);
    if (detail.unreachable_count) parts.push(`无法联系 ${detail.unreachable_count} 次`);
    if (detail.reprocess_days) parts.push(`二次处理 ${detail.reprocess_days} 天未关闭`);
    return parts.join('，');
  };

  const columns: ColumnsType<Warning> = [
    {
      title: '预警级别',
      dataIndex: 'level',
      key: 'level',
      width: 90,
      render: (val: string) => renderLevelTag(val),
    },
    {
      title: '预警类型',
      dataIndex: 'warning_type_label',
      key: 'warning_type_label',
      width: 140,
    },
    {
      title: '预警说明',
      dataIndex: 'reminder_text',
      key: 'reminder_text',
      ellipsis: true,
      render: (text: string, record) => (
        <Tooltip title={renderDetailExtra(record)}>
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
      title: '联系电话',
      dataIndex: ['visit_info', 'user_phone'],
      key: 'user_phone',
      width: 120,
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
      title: '处理人',
      dataIndex: ['visit_info', 'handler_name'],
      key: 'handler_name',
      width: 100,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 90,
      render: (val: string) => renderStatusTag(val),
    },
    {
      title: '预警时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 160,
      render: (val: string) => dayjs(val).format('YYYY-MM-DD HH:mm'),
    },
    {
      title: '操作',
      key: 'action',
      width: 260,
      fixed: 'right',
      render: (_, record) => (
        <Space size={4}>
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => handleViewDetail(record)}>
            详情
          </Button>
          <Button
            type="link"
            size="small"
            icon={<ArrowRightOutlined />}
            onClick={() => {
              const params = new URLSearchParams();
              params.set('from', 'warnings');
              if (currentFilters.warning_type) params.set('warning_type', currentFilters.warning_type);
              if (currentFilters.level) params.set('level', currentFilters.level);
              if (currentFilters.status) params.set('status', currentFilters.status);
              if (currentFilters.handler_id) params.set('handler_id', currentFilters.handler_id);
              if (currentFilters.keyword) params.set('keyword', currentFilters.keyword);
              if (currentFilters.date_from) params.set('date_from', currentFilters.date_from);
              if (currentFilters.date_to) params.set('date_to', currentFilters.date_to);
              params.set('page', String(pagination.current));
              params.set('page_size', String(pagination.pageSize));
              navigate(`/visits/${record.visit_id}?${params.toString()}`);
            }}
          >
            跳转业务
          </Button>
          {canOperate && record.status !== 'resolved' && record.status !== 'ignored' && (
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
                onClick={() => handleIgnore(record)}
              >
                忽略
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
          <Button type="primary" icon={<BellOutlined />} loading={refreshing} onClick={handleRefresh}>
            刷新预警
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
              <Form.Item name="warning_type" label="预警类型">
                <Select placeholder="请选择" allowClear>
                  {WARNING_TYPE_OPTIONS.map((opt) => (
                    <Select.Option key={opt.value} value={opt.value}>
                      {opt.label}
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={8} lg={6}>
              <Form.Item name="level" label="预警级别">
                <Select placeholder="请选择" allowClear>
                  {WARNING_LEVEL_OPTIONS.map((opt) => (
                    <Select.Option key={opt.value} value={opt.value}>
                      {opt.label}
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={8} lg={6}>
              <Form.Item name="status" label="预警状态">
                <Select placeholder="请选择" allowClear>
                  {WARNING_STATUS_OPTIONS.map((opt) => (
                    <Select.Option key={opt.value} value={opt.value}>
                      {opt.label}
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={8} lg={6}>
              <Form.Item name="handler_id" label="处理人">
                <Select placeholder="请选择" allowClear>
                  {handlers.map((u) => (
                    <Select.Option key={u.id} value={u.id}>
                      {u.name}
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={8} lg={6}>
              <Form.Item name="date_range" label="预警时间">
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

      <Card title={`异常预警列表（共 ${total} 条）`}>
        <Spin spinning={loading}>
          <Table
            columns={columns}
            dataSource={warnings}
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
            scroll={{ x: 1600 }}
          />
        </Spin>
      </Card>

      <Modal
        title="预警详情"
        open={detailModalVisible}
        onCancel={() => {
          setDetailModalVisible(false);
          setCurrentWarning(null);
        }}
        footer={[
          <Button key="close" onClick={() => setDetailModalVisible(false)}>
            关闭
          </Button>,
          currentWarning && (
            <Button
              key="visit"
              type="primary"
              onClick={() => {
                const params = new URLSearchParams();
                params.set('from', 'warnings');
                if (currentFilters.warning_type) params.set('warning_type', currentFilters.warning_type);
                if (currentFilters.level) params.set('level', currentFilters.level);
                if (currentFilters.status) params.set('status', currentFilters.status);
                if (currentFilters.handler_id) params.set('handler_id', currentFilters.handler_id);
                if (currentFilters.keyword) params.set('keyword', currentFilters.keyword);
                if (currentFilters.date_from) params.set('date_from', currentFilters.date_from);
                if (currentFilters.date_to) params.set('date_to', currentFilters.date_to);
                params.set('page', String(pagination.current));
                params.set('page_size', String(pagination.pageSize));
                navigate(`/visits/${currentWarning.visit_id}?${params.toString()}`);
              }}
            >
              前往业务处理 <ArrowRightOutlined />
            </Button>
          ),
        ]}
        width={800}
        destroyOnClose
      >
        {currentWarning && (
          <div>
            <Descriptions title="预警信息" bordered column={2} size="small">
              <Descriptions.Item label="预警级别">
                {renderLevelTag(currentWarning.level)}
              </Descriptions.Item>
              <Descriptions.Item label="预警状态">
                {renderStatusTag(currentWarning.status)}
              </Descriptions.Item>
              <Descriptions.Item label="预警类型">
                {currentWarning.warning_type_label}
              </Descriptions.Item>
              <Descriptions.Item label="优先级">{currentWarning.priority}</Descriptions.Item>
              <Descriptions.Item label="预警说明" span={2}>
                {currentWarning.reminder_text}
              </Descriptions.Item>
              <Descriptions.Item label="预警详情" span={2}>
                {renderDetailExtra(currentWarning) || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="预警时间">
                {dayjs(currentWarning.created_at).format('YYYY-MM-DD HH:mm:ss')}
              </Descriptions.Item>
              <Descriptions.Item label="最后更新">
                {dayjs(currentWarning.updated_at).format('YYYY-MM-DD HH:mm:ss')}
              </Descriptions.Item>
              {currentWarning.resolved_at && (
                <Descriptions.Item label="解除时间" span={2}>
                  {dayjs(currentWarning.resolved_at).format('YYYY-MM-DD HH:mm:ss')}
                  {currentWarning.resolved_note && ` - ${currentWarning.resolved_note}`}
                </Descriptions.Item>
              )}
            </Descriptions>

            <Divider orientation="left">关联回访单</Divider>
            <Descriptions bordered column={2} size="small">
              <Descriptions.Item label="工单号">
                {currentWarning.visit_info.repair_order_no}
              </Descriptions.Item>
              <Descriptions.Item label="维修类别">
                {currentWarning.visit_info.category_name}
              </Descriptions.Item>
              <Descriptions.Item label="用户姓名">
                {currentWarning.visit_info.user_name}
              </Descriptions.Item>
              <Descriptions.Item label="联系电话">
                {currentWarning.visit_info.user_phone}
              </Descriptions.Item>
              <Descriptions.Item label="地址" span={2}>
                {currentWarning.visit_info.address}
              </Descriptions.Item>
              <Descriptions.Item label="维修内容" span={2}>
                {currentWarning.visit_info.repair_content}
              </Descriptions.Item>
              <Descriptions.Item label="回访状态">
                {STATUS_OPTIONS.find((o) => o.value === currentWarning.visit_info.status)?.label ||
                  currentWarning.visit_info.status}
              </Descriptions.Item>
              <Descriptions.Item label="满意度">
                {currentWarning.visit_info.satisfaction !== null
                  ? `${currentWarning.visit_info.satisfaction} 分`
                  : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="处理人">
                {currentWarning.visit_info.handler_name}
              </Descriptions.Item>
              <Descriptions.Item label="维修完成时间">
                {dayjs(currentWarning.visit_info.completed_at).format('YYYY-MM-DD HH:mm')}
              </Descriptions.Item>
            </Descriptions>

            <Divider orientation="left">跟进记录</Divider>
            {currentWarning.follow_up_records && currentWarning.follow_up_records.length > 0 ? (
              <Timeline
                items={currentWarning.follow_up_records
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
          setCurrentWarning(null);
          followUpForm.resetFields();
        }}
        footer={null}
        destroyOnClose
      >
        <Form form={followUpForm} layout="vertical" onFinish={handleFollowUpSubmit}>
          <Form.Item
            name="action"
            label="操作类型"
            initialValue="note"
          >
            <Select>
              <Select.Option value="note">备注</Select.Option>
              <Select.Option value="contact">已联系用户</Select.Option>
              <Select.Option value="escalate">已上报</Select.Option>
              <Select.Option value="other">其他</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="note" label="跟进内容" rules={[{ required: true, message: '请填写跟进内容' }]}>
            <TextArea rows={4} placeholder="请填写跟进说明" />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button
                onClick={() => {
                  setFollowUpModalVisible(false);
                  setCurrentWarning(null);
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
        title="解除预警"
        open={resolveModalVisible}
        onCancel={() => {
          setResolveModalVisible(false);
          setCurrentWarning(null);
          resolveForm.resetFields();
        }}
        footer={null}
        destroyOnClose
      >
        <Form form={resolveForm} layout="vertical" onFinish={handleResolveSubmit}>
          <Form.Item name="note" label="处理说明" rules={[{ required: true, message: '请填写处理说明' }]}>
            <TextArea rows={4} placeholder="请填写解除预警的原因和处理情况" />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button
                onClick={() => {
                  setResolveModalVisible(false);
                  setCurrentWarning(null);
                  resolveForm.resetFields();
                }}
              >
                取消
              </Button>
              <Button type="primary" htmlType="submit">
                确认解除
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
          setCurrentWarning(null);
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
                  setCurrentWarning(null);
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
    </div>
  );
}
