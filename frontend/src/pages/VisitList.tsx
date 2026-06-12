import { useState, useEffect } from 'react';
import { Table, Tag, Button, Form, Select, Input, DatePicker, Space, Spin, message, Row, Col, Card, InputNumber } from 'antd';
import { SearchOutlined, ReloadOutlined, EyeOutlined, EditOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { getVisits } from '@/api/visits';
import { getCategories } from '@/api/categories';
import { getUsers } from '@/api/users';
import { Visit, Category, User, STATUS_OPTIONS, UNREACHABLE_REASONS, VisitFilter } from '@/types';
import { useVisitFilterStore } from '@/store/visitFilter';
import VisitProcessModal from '@/components/VisitProcessModal';
import { useAuthStore } from '@/store/auth';
import type { ColumnsType } from 'antd/es/table';

const { RangePicker } = DatePicker;

export default function VisitList() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { filter: storedFilter, clearFilter } = useVisitFilterStore();
  const [loading, setLoading] = useState(false);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [handlers, setHandlers] = useState<User[]>([]);
  const [total, setTotal] = useState(0);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10 });
  const [form] = Form.useForm();
  const [currentFilters, setCurrentFilters] = useState<VisitFilter>({});
  const [processModalVisible, setProcessModalVisible] = useState(false);
  const [processingVisit, setProcessingVisit] = useState<Visit | null>(null);

  useEffect(() => {
    fetchCategories();
    fetchHandlers();
  }, []);

  useEffect(() => {
    if (Object.keys(storedFilter).length > 0) {
      const formValues: any = { ...storedFilter };
      if (storedFilter.date_from && storedFilter.date_to) {
        formValues.date_range = [dayjs(storedFilter.date_from), dayjs(storedFilter.date_to)];
      }
      form.setFieldsValue(formValues);
      setCurrentFilters(storedFilter);
      clearFilter();
      fetchVisits(storedFilter);
    } else {
      fetchVisits();
    }
  }, [storedFilter]);

  useEffect(() => {
    if (Object.keys(currentFilters).length === 0) {
      fetchVisits();
    } else {
      fetchVisits(currentFilters);
    }
  }, [pagination.current, pagination.pageSize]);

  const fetchCategories = async () => {
    try {
      const data = await getCategories();
      setCategories(data);
    } catch (err: any) {
      message.error(err.message || '获取分类失败');
    }
  };

  const fetchHandlers = async () => {
    try {
      const data = await getUsers();
      setHandlers(data);
    } catch (err: any) {
      message.error(err.message || '获取处理人失败');
    }
  };

  const fetchVisits = async (filters?: VisitFilter) => {
    setLoading(true);
    try {
      const data = await getVisits({
        ...filters,
        page: pagination.current,
        page_size: pagination.pageSize,
      });
      setVisits(data.items);
      setTotal(data.total);
    } catch (err: any) {
      message.error(err.message || '获取回访列表失败');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (values: any) => {
    const filters: VisitFilter = {};
    if (values.category_id) filters.category_id = values.category_id;
    if (values.handler_id) filters.handler_id = values.handler_id;
    if (values.status) filters.status = values.status;
    if (values.unreachable_reason) filters.unreachable_reason = values.unreachable_reason;
    if (values.keyword) filters.keyword = values.keyword;
    if (values.satisfaction_min !== undefined) filters.satisfaction_min = values.satisfaction_min;
    if (values.satisfaction_max !== undefined) filters.satisfaction_max = values.satisfaction_max;
    if (values.date_range) {
      filters.date_from = values.date_range[0].format('YYYY-MM-DD');
      filters.date_to = values.date_range[1].format('YYYY-MM-DD');
    }
    setCurrentFilters(filters);
    setPagination({ ...pagination, current: 1 });
    fetchVisits({ ...filters, page: 1, page_size: pagination.pageSize });
  };

  const handleReset = () => {
    form.resetFields();
    setCurrentFilters({});
    setPagination({ current: 1, pageSize: 10 });
    fetchVisits();
  };

  const handleTableChange = (page: number, pageSize: number) => {
    setPagination({ current: page, pageSize });
  };

  const handleProcessClick = (visit: Visit) => {
    setProcessingVisit(visit);
    setProcessModalVisible(true);
  };

  const handleProcessSuccess = () => {
    setProcessModalVisible(false);
    setProcessingVisit(null);
    fetchVisits(currentFilters);
  };

  const canProcess = user?.role !== 'auditor';

  const columns: ColumnsType<Visit> = [
    {
      title: '工单号',
      dataIndex: 'repair_order_no',
      key: 'repair_order_no',
      width: 140,
    },
    {
      title: '用户姓名',
      dataIndex: 'user_name',
      key: 'user_name',
      width: 100,
    },
    {
      title: '联系电话',
      dataIndex: 'user_phone',
      key: 'user_phone',
      width: 120,
    },
    {
      title: '地址',
      dataIndex: 'address',
      key: 'address',
      ellipsis: true,
    },
    {
      title: '维修类别',
      dataIndex: 'category_name',
      key: 'category_name',
      width: 120,
    },
    {
      title: '维修内容',
      dataIndex: 'repair_content',
      key: 'repair_content',
      ellipsis: true,
    },
    {
      title: '处理人',
      dataIndex: 'handler_name',
      key: 'handler_name',
      width: 100,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: Visit['status']) => {
        const option = STATUS_OPTIONS.find((opt) => opt.value === status);
        return <Tag color={option?.color}>{option?.label}</Tag>;
      },
    },
    {
      title: '无法联系原因',
      dataIndex: 'unreachable_reason',
      key: 'unreachable_reason',
      width: 120,
      render: (reason: string | null, record: Visit) => {
        if (record.status !== 'unreachable' || !reason) return '-';
        return UNREACHABLE_REASONS.find((r) => r.value === reason)?.label || reason;
      },
    },
    {
      title: '满意度',
      dataIndex: 'satisfaction',
      key: 'satisfaction',
      width: 100,
      render: (val: number | null) => (val !== null ? `${val}分` : '-'),
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 160,
      render: (val: string) => dayjs(val).format('YYYY-MM-DD HH:mm'),
    },
    {
      title: '操作',
      key: 'action',
      width: 160,
      fixed: 'right',
      render: (_, record) => (
        <Space>
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => navigate(`/visits/${record.id}`)}
          >
            详情
          </Button>
          {canProcess && record.status === 'pending' && (
            <Button
              type="link"
              size="small"
              icon={<EditOutlined />}
              onClick={() => handleProcessClick(record)}
            >
              处理
            </Button>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Card title="筛选条件" style={{ marginBottom: 16 }}>
        <Form form={form} layout="vertical" onFinish={handleSearch}>
          <Row gutter={16}>
            <Col xs={24} sm={12} md={8} lg={6}>
              <Form.Item name="keyword" label="关键词">
                <Input placeholder="工单号/用户姓名/电话" allowClear />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={8} lg={6}>
              <Form.Item name="category_id" label="维修类别">
                <Select placeholder="请选择" allowClear>
                  {categories.map((cat) => (
                    <Select.Option key={cat.id} value={cat.id}>
                      {cat.name}
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={8} lg={6}>
              <Form.Item name="handler_id" label="处理人">
                <Select placeholder="请选择" allowClear>
                  {handlers.map((user) => (
                    <Select.Option key={user.id} value={user.id}>
                      {user.name}
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={8} lg={6}>
              <Form.Item name="status" label="状态">
                <Select placeholder="请选择" allowClear>
                  {STATUS_OPTIONS.map((opt) => (
                    <Select.Option key={opt.value} value={opt.value}>
                      {opt.label}
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={8} lg={6}>
              <Form.Item name="unreachable_reason" label="无法联系原因">
                <Select placeholder="请选择" allowClear>
                  {UNREACHABLE_REASONS.map((reason) => (
                    <Select.Option key={reason.value} value={reason.value}>
                      {reason.label}
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={8} lg={6}>
              <Form.Item name="satisfaction_min" label="满意度最小值">
                <InputNumber min={1} max={5} style={{ width: '100%' }} placeholder="1-5" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={8} lg={6}>
              <Form.Item name="satisfaction_max" label="满意度最大值">
                <InputNumber min={1} max={5} style={{ width: '100%' }} placeholder="1-5" />
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

      <Card title="回访列表">
        <Spin spinning={loading}>
          <Table
            columns={columns}
            dataSource={visits}
            rowKey="id"
            pagination={{
              current: pagination.current,
              pageSize: pagination.pageSize,
              total,
              showSizeChanger: true,
              showQuickJumper: true,
              showTotal: (total) => `共 ${total} 条记录`,
              onChange: handleTableChange,
            }}
            scroll={{ x: 1400 }}
          />
        </Spin>
      </Card>

      <VisitProcessModal
        open={processModalVisible}
        visitId={processingVisit?.id || null}
        currentStatus={processingVisit?.status || 'pending'}
        onCancel={() => {
          setProcessModalVisible(false);
          setProcessingVisit(null);
        }}
        onSuccess={handleProcessSuccess}
      />
    </div>
  );
}
