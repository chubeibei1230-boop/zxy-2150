import { useState, useEffect } from 'react';
import {
  Tabs, Table, Tag, Button, Form, Input, InputNumber, Select, Switch, Modal, Space, Spin, message, Popconfirm, Card, Row, Col } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, KeyOutlined, BellOutlined, SettingOutlined } from '@ant-design/icons';
import { getRules, createRule, updateRule, deleteRule } from '@/api/rules';
import { getCategories, createCategory, updateCategory, deleteCategory } from '@/api/categories';
import { getUsers, createUser, updateUser, deleteUser, resetPassword } from '@/api/users';
import { getThresholds, updateThresholds, ThresholdConfig } from '@/api/thresholds';
import { getWarningRules, createWarningRule, updateWarningRule, deleteWarningRule, refreshWarnings } from '@/api/warnings';
import { generateReminders } from '@/api/visits';
import { Rule, Category, User, WarningRule, WARNING_TYPE_OPTIONS, WARNING_LEVEL_OPTIONS } from '@/types';
import type { ColumnsType } from 'antd/es/table';

const { TextArea } = Input;
const { TabPane } = Tabs;

const DEFAULT_THRESHOLD: ThresholdConfig = {
  default_visit_days: 7,
  satisfaction_standard: 4,
  max_unreachable_attempts: 3,
  repeat_repair_days: 30,
  warning_pending_days: 3,
  warning_low_satisfaction: 3,
  warning_unreachable_count: 2,
  warning_reprocess_days: 3,
  warning_follow_up_days: 1,
  warning_escalation_days: 2,
};

export default function RulesConfig() {
  const [loading, setLoading] = useState(false);
  const [rules, setRules] = useState<Rule[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [threshold, setThreshold] = useState<ThresholdConfig>(DEFAULT_THRESHOLD);
  const [warningRules, setWarningRules] = useState<WarningRule[]>([]);

  const [categoryModal, setCategoryModal] = useState(false);
  const [ruleModal, setRuleModal] = useState(false);
  const [userModal, setUserModal] = useState(false);
  const [resetPwdModal, setResetPwdModal] = useState(false);
  const [warningRuleModal, setWarningRuleModal] = useState(false);

  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [editingRule, setEditingRule] = useState<Rule | null>(null);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [resetUser, setResetUser] = useState<User | null>(null);
  const [editingWarningRule, setEditingWarningRule] = useState<WarningRule | null>(null);

  const [categoryForm] = Form.useForm();
  const [ruleForm] = Form.useForm();
  const [userForm] = Form.useForm();
  const [thresholdForm] = Form.useForm();
  const [pwdForm] = Form.useForm();
  const [warningRuleForm] = Form.useForm();

  useEffect(() => {
    fetchAllData();
    loadThreshold();
  }, []);

  const fetchAllData = async () => {
    setLoading(true);
    try {
      const [rulesData, categoriesData, usersData, warningRulesData] = await Promise.all([
        getRules(),
        getCategories(),
        getUsers(),
        getWarningRules(),
      ]);
      setRules(rulesData.sort((a, b) => a.priority - b.priority));
      setCategories(categoriesData);
      setUsers(usersData);
      setWarningRules(warningRulesData.sort((a, b) => a.priority - b.priority));
    } catch (err: any) {
      message.error(err.message || '获取数据失败');
    } finally {
      setLoading(false);
    }
  };

  const handleRefreshWarnings = async () => {
    setLoading(true);
    try {
      const result = await refreshWarnings();
      message.success(
        `预警刷新完成：新增 ${result.created} 条，更新 ${result.updated} 条，解除 ${result.resolved} 条`
      );
    } catch (err: any) {
      message.error(err.message || '刷新预警失败');
    } finally {
      setLoading(false);
    }
  };

  const loadThreshold = () => {
    getThresholds()
      .then((data) => {
        setThreshold(data);
        thresholdForm.setFieldsValue(data);
      })
      .catch((err: any) => {
        message.error(err.message || '获取阈值配置失败');
        thresholdForm.setFieldsValue(DEFAULT_THRESHOLD);
      });
  };

  const saveThreshold = async (values: ThresholdConfig) => {
    try {
      const saved = await updateThresholds(values);
      setThreshold(saved);
      message.success('保存成功');
    } catch (err: any) {
      message.error(err.message || '保存失败');
    }
  };

  const handleGenerateReminders = async () => {
    setLoading(true);
    try {
      const result = await generateReminders();
      message.success(`生成完成，新增 ${result.created_count} 条提醒`);
    } catch (err: any) {
      message.error(err.message || '生成提醒失败');
    } finally {
      setLoading(false);
    }
  };

  const handleAddCategory = () => {
    setEditingCategory(null);
    categoryForm.resetFields();
    categoryForm.setFieldsValue({ enabled: true });
    setCategoryModal(true);
  };

  const handleEditCategory = (cat: Category) => {
    setEditingCategory(cat);
    categoryForm.setFieldsValue(cat);
    setCategoryModal(true);
  };

  const handleDeleteCategory = async (id: string) => {
    try {
      await deleteCategory(id);
      message.success('删除成功');
      fetchAllData();
    } catch (err: any) {
      message.error(err.message || '删除失败');
    }
  };

  const handleSubmitCategory = async (values: Partial<Category>) => {
    try {
      if (editingCategory) {
        await updateCategory(editingCategory.id, values);
        message.success('更新成功');
      } else {
        await createCategory(values);
        message.success('创建成功');
      }
      setCategoryModal(false);
      fetchAllData();
    } catch (err: any) {
      message.error(err.message || '保存失败');
    }
  };

  const handleToggleCategory = async (cat: Category, checked: boolean) => {
    try {
      await updateCategory(cat.id, { enabled: checked });
      message.success(checked ? '已启用' : '已禁用');
      fetchAllData();
    } catch (err: any) {
      message.error(err.message || '操作失败');
    }
  };

  const handleAddRule = () => {
    setEditingRule(null);
    ruleForm.resetFields();
    ruleForm.setFieldsValue({
      priority: rules.length + 1,
      days_after_completion: 7,
      satisfaction_threshold: 3,
      check_repeat_repair: false,
      enabled: true,
    });
    setRuleModal(true);
  };

  const handleEditRule = (rule: Rule) => {
    setEditingRule(rule);
    ruleForm.setFieldsValue({ ...rule, category_ids: rule.category_ids });
    setRuleModal(true);
  };

  const handleDeleteRule = async (id: string) => {
    try {
      await deleteRule(id);
      message.success('删除成功');
      fetchAllData();
    } catch (err: any) {
      message.error(err.message || '删除失败');
    }
  };

  const handleSubmitRule = async (values: Partial<Rule>) => {
    try {
      if (editingRule) {
        await updateRule(editingRule.id, values);
        message.success('更新成功');
      } else {
        await createRule(values);
        message.success('创建成功');
      }
      setRuleModal(false);
      fetchAllData();
    } catch (err: any) {
      message.error(err.message || '保存失败');
    }
  };

  const handleToggleRule = async (rule: Rule, checked: boolean) => {
    try {
      await updateRule(rule.id, { enabled: checked });
      message.success(checked ? '已启用' : '已禁用');
      fetchAllData();
    } catch (err: any) {
      message.error(err.message || '操作失败');
    }
  };

  const handleAddUser = () => {
    setEditingUser(null);
    userForm.resetFields();
    userForm.setFieldsValue({ role: 'operator', enabled: true });
    setUserModal(true);
  };

  const handleEditUser = (user: User) => {
    setEditingUser(user);
    userForm.setFieldsValue({ name: user.name, role: user.role, enabled: user.enabled });
    setUserModal(true);
  };

  const handleDeleteUser = async (id: string) => {
    try {
      await deleteUser(id);
      message.success('删除成功');
      fetchAllData();
    } catch (err: any) {
      message.error(err.message || '删除失败');
    }
  };

  const handleSubmitUser = async (values: any) => {
    try {
      if (editingUser) {
        await updateUser(editingUser.id, values);
        message.success('更新成功');
      } else {
        await createUser(values);
        message.success('创建成功');
      }
      setUserModal(false);
      fetchAllData();
    } catch (err: any) {
      message.error(err.message || '保存失败');
    }
  };

  const handleToggleUser = async (user: User, checked: boolean) => {
    try {
      await updateUser(user.id, { enabled: checked });
      message.success(checked ? '已启用' : '已禁用');
      fetchAllData();
    } catch (err: any) {
      message.error(err.message || '操作失败');
    }
  };

  const handleResetPassword = (user: User) => {
    setResetUser(user);
    pwdForm.resetFields();
    setResetPwdModal(true);
  };

  const handleSubmitResetPwd = async (values: { password: string }) => {
    if (!resetUser) return;
    try {
      await resetPassword(resetUser.id, values.password);
      message.success('密码重置成功');
      setResetPwdModal(false);
      setResetUser(null);
    } catch (err: any) {
      message.error(err.message || '重置失败');
    }
  };

  const handleAddWarningRule = () => {
    setEditingWarningRule(null);
    warningRuleForm.resetFields();
    warningRuleForm.setFieldsValue({
      priority: warningRules.length + 1,
      enabled: true,
      level: 'medium',
      params: {},
    });
    setWarningRuleModal(true);
  };

  const handleEditWarningRule = (rule: WarningRule) => {
    setEditingWarningRule(rule);
    warningRuleForm.setFieldsValue({
      ...rule,
      params: { ...rule.params },
    });
    setWarningRuleModal(true);
  };

  const handleDeleteWarningRule = async (id: string) => {
    try {
      await deleteWarningRule(id);
      message.success('删除成功');
      fetchAllData();
    } catch (err: any) {
      message.error(err.message || '删除失败');
    }
  };

  const handleSubmitWarningRule = async (values: any) => {
    try {
      if (editingWarningRule) {
        await updateWarningRule(editingWarningRule.id, values);
        message.success('更新成功');
      } else {
        await createWarningRule(values);
        message.success('创建成功');
      }
      setWarningRuleModal(false);
      setEditingWarningRule(null);
      fetchAllData();
    } catch (err: any) {
      message.error(err.message || '保存失败');
    }
  };

  const handleToggleWarningRule = async (rule: WarningRule, checked: boolean) => {
    try {
      await updateWarningRule(rule.id, { enabled: checked });
      message.success(checked ? '已启用' : '已禁用');
      fetchAllData();
    } catch (err: any) {
      message.error(err.message || '操作失败');
    }
  };

  const categoryColumns: ColumnsType<Category> = [
    { title: '名称', dataIndex: 'name', key: 'name', width: 150 },
    { title: '描述', dataIndex: 'description', key: 'description', ellipsis: true },
    {
      title: '状态', dataIndex: 'enabled', key: 'enabled', width: 100,
      render: (val: boolean, record) => (
        <Switch checked={val} onChange={(checked) => handleToggleCategory(record, checked)} />
      ),
    },
    { title: '创建时间', dataIndex: 'created_at', key: 'created_at', width: 160 },
    {
      title: '操作', key: 'action', width: 150,
      render: (_, record) => (
        <Space>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEditCategory(record)}>编辑</Button>
          <Popconfirm title="确定删除此类别？" onConfirm={() => handleDeleteCategory(record.id)} okText="确定" cancelText="取消">
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const ruleColumns: ColumnsType<Rule> = [
    { title: '优先级', dataIndex: 'priority', key: 'priority', width: 80, render: (v: number) => <Tag color="blue">{v}</Tag> },
    { title: '规则名称', dataIndex: 'name', key: 'name', width: 150 },
    { title: '描述', dataIndex: 'description', key: 'description', ellipsis: true },
    {
      title: '适用分类', dataIndex: 'category_ids', key: 'category_ids', width: 150,
      render: (ids: string[]) => (
        <Space wrap>{ids.map((id) => {
          const cat = categories.find((c) => c.id === id);
          return cat ? <Tag key={id}>{cat.name}</Tag> : null;
        })}</Space>
      ),
    },
    { title: '完成后天数', dataIndex: 'days_after_completion', key: 'days_after_completion', width: 100, render: (v: number) => `${v} 天` },
    { title: '满意度阈值', dataIndex: 'satisfaction_threshold', key: 'satisfaction_threshold', width: 100, render: (v: number) => `≤ ${v} 分` },
    { title: '检查重复', dataIndex: 'check_repeat_repair', key: 'check_repeat_repair', width: 100, render: (v: boolean) => (v ? '是' : '否') },
    {
      title: '状态', dataIndex: 'enabled', key: 'enabled', width: 100,
      render: (val: boolean, record) => (
        <Switch checked={val} onChange={(checked) => handleToggleRule(record, checked)} />
      ),
    },
    {
      title: '操作', key: 'action', width: 150,
      render: (_, record) => (
        <Space>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEditRule(record)}>编辑</Button>
          <Popconfirm title="确定删除此规则？" onConfirm={() => handleDeleteRule(record.id)} okText="确定" cancelText="取消">
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const userColumns: ColumnsType<User> = [
    { title: '用户名', dataIndex: 'username', key: 'username', width: 120 },
    { title: '姓名', dataIndex: 'name', key: 'name', width: 100 },
    {
      title: '角色', dataIndex: 'role', key: 'role', width: 100,
      render: (role: string) => {
        const roleMap: Record<string, string> = { admin: '管理员', operator: '操作员', auditor: '审核员', user: '普通用户' };
        return <Tag color={role === 'admin' ? 'red' : role === 'auditor' ? 'purple' : 'blue'}>{roleMap[role]}</Tag>;
      },
    },
    {
      title: '状态', dataIndex: 'enabled', key: 'enabled', width: 100,
      render: (val: boolean, record) => (
        <Switch checked={val} onChange={(checked) => handleToggleUser(record, checked)} />
      ),
    },
    { title: '创建时间', dataIndex: 'created_at', key: 'created_at', width: 160 },
    {
      title: '操作', key: 'action', width: 220,
      render: (_, record) => (
        <Space>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEditUser(record)}>编辑</Button>
          <Button type="link" size="small" icon={<KeyOutlined />} onClick={() => handleResetPassword(record)}>重置密码</Button>
          <Popconfirm title="确定删除此用户？" onConfirm={() => handleDeleteUser(record.id)} okText="确定" cancelText="取消">
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const warningRuleColumns: ColumnsType<WarningRule> = [
    { title: '优先级', dataIndex: 'priority', key: 'priority', width: 80, render: (v: number) => <Tag color="blue">{v}</Tag> },
    { title: '预警类型', dataIndex: 'type_label', key: 'type_label', width: 150 },
    { title: '规则名称', dataIndex: 'name', key: 'name', width: 150 },
    { title: '描述', dataIndex: 'description', key: 'description', ellipsis: true },
    {
      title: '预警级别', dataIndex: 'level_label', key: 'level_label', width: 100,
      render: (label: string, record) => {
        const opt = WARNING_LEVEL_OPTIONS.find((o) => o.value === record.level);
        return <Tag color={opt?.color}>{label}</Tag>;
      },
    },
    {
      title: '规则参数', dataIndex: 'params', key: 'params', width: 180,
      render: (params: any) => {
        const parts: string[] = [];
        if (params?.pending_days) parts.push(`待处理≥${params.pending_days}天`);
        if (params?.satisfaction_threshold) parts.push(`满意度≤${params.satisfaction_threshold}分`);
        if (params?.unreachable_count) parts.push(`无法联系≥${params.unreachable_count}次`);
        if (params?.reprocess_days) parts.push(`二次处理≥${params.reprocess_days}天`);
        return parts.length > 0 ? parts.join('，') : '-';
      },
    },
    {
      title: '状态', dataIndex: 'enabled', key: 'enabled', width: 100,
      render: (val: boolean, record) => (
        <Switch checked={val} onChange={(checked) => handleToggleWarningRule(record, checked)} />
      ),
    },
    {
      title: '操作', key: 'action', width: 150,
      render: (_, record) => (
        <Space>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEditWarningRule(record)}>编辑</Button>
          <Popconfirm title="确定删除此预警规则？" onConfirm={() => handleDeleteWarningRule(record.id)} okText="确定" cancelText="取消">
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Card>
        <Tabs defaultActiveKey="1">
          <TabPane tab="维修类别" key="1">
            <div style={{ marginBottom: 16, textAlign: 'right' }}>
              <Button type="primary" icon={<PlusOutlined />} onClick={handleAddCategory}>新增类别</Button>
            </div>
            <Spin spinning={loading}>
              <Table columns={categoryColumns} dataSource={categories} rowKey="id" pagination={false} scroll={{ x: 800 }} />
            </Spin>
          </TabPane>

          <TabPane tab="回访规则" key="2">
            <div style={{ marginBottom: 16, textAlign: 'right' }}>
              <Space>
                <Button icon={<BellOutlined />} onClick={handleGenerateReminders}>生成新提醒</Button>
                <Button type="primary" icon={<PlusOutlined />} onClick={handleAddRule}>新增规则</Button>
              </Space>
            </div>
            <Spin spinning={loading}>
              <Table columns={ruleColumns} dataSource={rules} rowKey="id" pagination={false} scroll={{ x: 1200 }} />
            </Spin>
          </TabPane>

          <TabPane tab="提醒阈值" key="3">
            <Card title="全局阈值配置" style={{ maxWidth: 700 }}>
              <Form form={thresholdForm} layout="vertical" onFinish={saveThreshold}>
                <Row gutter={16}>
                  <Col span={12}>
                    <Form.Item name="default_visit_days" label="默认回访天数" rules={[{ required: true, message: '请输入天数' }]}>
                      <InputNumber min={1} style={{ width: '100%' }} placeholder="完成后多少天回访" />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item name="satisfaction_standard" label="满意度达标线" rules={[{ required: true, message: '请输入分数' }]}>
                      <InputNumber min={1} max={5} style={{ width: '100%' }} placeholder="1-5分" />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item name="max_unreachable_attempts" label="无法联系最大尝试次数" rules={[{ required: true, message: '请输入次数' }]}>
                      <InputNumber min={1} style={{ width: '100%' }} placeholder="最多尝试次数" />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item name="repeat_repair_days" label="重复报修判断天数" rules={[{ required: true, message: '请输入天数' }]}>
                      <InputNumber min={1} style={{ width: '100%' }} placeholder="多少天内算重复" />
                    </Form.Item>
                  </Col>
                </Row>
                <Card type="inner" title="预警阈值配置" style={{ marginTop: 16, marginBottom: 16 }} size="small">
                  <Row gutter={16}>
                    <Col span={12}>
                      <Form.Item name="warning_pending_days" label="长期未处理阈值(天)" rules={[{ required: true, message: '请输入天数' }]}>
                        <InputNumber min={1} style={{ width: '100%' }} placeholder="待处理超过多少天触发预警" />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item name="warning_low_satisfaction" label="低满意度阈值(分)" rules={[{ required: true, message: '请输入分数' }]}>
                        <InputNumber min={1} max={5} style={{ width: '100%' }} placeholder="低于多少分触发预警" />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item name="warning_unreachable_count" label="无法联系次数阈值" rules={[{ required: true, message: '请输入次数' }]}>
                        <InputNumber min={1} style={{ width: '100%' }} placeholder="超过多少次触发预警" />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item name="warning_reprocess_days" label="二次处理超时阈值(天)" rules={[{ required: true, message: '请输入天数' }]}>
                        <InputNumber min={1} style={{ width: '100%' }} placeholder="二次处理超过多少天触发预警" />
                      </Form.Item>
                    </Col>
                  </Row>
                </Card>
                <Card type="inner" title="跟进超时配置" style={{ marginBottom: 16 }} size="small">
                  <Row gutter={16}>
                    <Col span={12}>
                      <Form.Item name="warning_follow_up_days" label="跟进提醒阈值(天)" rules={[{ required: true, message: '请输入天数' }]}>
                        <InputNumber min={1} style={{ width: '100%' }} placeholder="预警未跟进多少天触发提醒" />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item name="warning_escalation_days" label="自动升级阈值(天)" rules={[{ required: true, message: '请输入天数' }]}>
                        <InputNumber min={1} style={{ width: '100%' }} placeholder="预警未跟进多少天自动升级级别" />
                      </Form.Item>
                    </Col>
                  </Row>
                </Card>
                <Form.Item style={{ marginBottom: 0 }}>
                  <Button type="primary" htmlType="submit">保存配置</Button>
                </Form.Item>
              </Form>
            </Card>
          </TabPane>

          <TabPane tab="处理人员" key="4">
            <div style={{ marginBottom: 16, textAlign: 'right' }}>
              <Button type="primary" icon={<PlusOutlined />} onClick={handleAddUser}>新增用户</Button>
            </div>
            <Spin spinning={loading}>
              <Table columns={userColumns} dataSource={users} rowKey="id" pagination={false} scroll={{ x: 900 }} />
            </Spin>
          </TabPane>

          <TabPane tab={<span><SettingOutlined /> 预警规则</span>} key="5">
            <div style={{ marginBottom: 16, textAlign: 'right' }}>
              <Space>
                <Button icon={<BellOutlined />} onClick={handleRefreshWarnings}>刷新预警</Button>
                <Button type="primary" icon={<PlusOutlined />} onClick={handleAddWarningRule}>新增预警规则</Button>
              </Space>
            </div>
            <Spin spinning={loading}>
              <Table columns={warningRuleColumns} dataSource={warningRules} rowKey="id" pagination={false} scroll={{ x: 1200 }} />
            </Spin>
          </TabPane>
        </Tabs>
      </Card>

      <Modal title={editingCategory ? '编辑类别' : '新增类别'} open={categoryModal} onCancel={() => setCategoryModal(false)} footer={null} width={500} destroyOnClose>
        <Form form={categoryForm} layout="vertical" onFinish={handleSubmitCategory}>
          <Form.Item name="name" label="名称" rules={[{ required: true, message: '请输入名称' }]}><Input placeholder="请输入名称" /></Form.Item>
          <Form.Item name="description" label="描述" rules={[{ required: true, message: '请输入描述' }]}><TextArea rows={3} placeholder="请输入描述" /></Form.Item>
          <Form.Item name="enabled" label="是否启用" valuePropName="checked"><Switch defaultChecked /></Form.Item>
          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space><Button onClick={() => setCategoryModal(false)}>取消</Button><Button type="primary" htmlType="submit">保存</Button></Space>
          </Form.Item>
        </Form>
      </Modal>

      <Modal title={editingRule ? '编辑规则' : '新增规则'} open={ruleModal} onCancel={() => setRuleModal(false)} footer={null} width={700} destroyOnClose>
        <Form form={ruleForm} layout="vertical" onFinish={handleSubmitRule}>
          <Row gutter={16}>
            <Col span={12}><Form.Item name="name" label="规则名称" rules={[{ required: true }]}><Input /></Form.Item></Col>
            <Col span={12}><Form.Item name="priority" label="优先级" rules={[{ required: true }]}><InputNumber min={1} style={{ width: '100%' }} /></Form.Item></Col>
          </Row>
          <Form.Item name="description" label="规则描述" rules={[{ required: true }]}><TextArea rows={2} /></Form.Item>
          <Form.Item name="reminder_text" label="提醒文案" rules={[{ required: true }]}><TextArea rows={2} /></Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="category_ids" label="适用维修分类" rules={[{ required: true }]}>
                <Select mode="multiple" placeholder="请选择">
                  {categories.map((cat) => (
                    <Select.Option key={cat.id} value={cat.id}>{cat.name}</Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}><Form.Item name="days_after_completion" label="维修完成后天数" rules={[{ required: true }]}><InputNumber min={1} style={{ width: '100%' }} /></Form.Item></Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}><Form.Item name="satisfaction_threshold" label="满意度阈值" rules={[{ required: true }]}><InputNumber min={1} max={5} style={{ width: '100%' }} /></Form.Item></Col>
            <Col span={12}><Form.Item name="check_repeat_repair" label="检查重复维修" valuePropName="checked"><Switch /></Form.Item></Col>
          </Row>
          <Form.Item name="enabled" label="是否启用" valuePropName="checked"><Switch defaultChecked /></Form.Item>
          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space><Button onClick={() => setRuleModal(false)}>取消</Button><Button type="primary" htmlType="submit">保存</Button></Space>
          </Form.Item>
        </Form>
      </Modal>

      <Modal title={editingUser ? '编辑用户' : '新增用户'} open={userModal} onCancel={() => setUserModal(false)} footer={null} width={500} destroyOnClose>
        <Form form={userForm} layout="vertical" onFinish={handleSubmitUser}>
          {!editingUser && <Form.Item name="username" label="用户名" rules={[{ required: true, message: '请输入用户名' }]}><Input placeholder="请输入用户名" /></Form.Item>}
          <Form.Item name="name" label="姓名" rules={[{ required: true, message: '请输入姓名' }]}><Input placeholder="请输入姓名" /></Form.Item>
          <Form.Item name="role" label="角色" rules={[{ required: true, message: '请选择角色' }]}>
              <Select placeholder="请选择">
                <Select.Option value="admin">管理员</Select.Option>
                <Select.Option value="operator">操作员</Select.Option>
                <Select.Option value="auditor">审核员</Select.Option>
                <Select.Option value="user">普通用户</Select.Option>
              </Select>
          </Form.Item>
          {!editingUser && <Form.Item name="password" label="密码" rules={[{ required: true, message: '请输入密码' }]}><Input.Password placeholder="请输入密码" /></Form.Item>}
          {editingUser && <Form.Item name="enabled" label="是否启用" valuePropName="checked"><Switch defaultChecked /></Form.Item>}
          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space><Button onClick={() => setUserModal(false)}>取消</Button><Button type="primary" htmlType="submit">保存</Button></Space>
          </Form.Item>
        </Form>
      </Modal>

      <Modal title={`重置密码 - ${resetUser?.name}`} open={resetPwdModal} onCancel={() => setResetPwdModal(false)} footer={null} width={400} destroyOnClose>
        <Form form={pwdForm} layout="vertical" onFinish={handleSubmitResetPwd}>
          <Form.Item name="password" label="新密码" rules={[{ required: true, message: '请输入新密码' }, { min: 6, message: '密码至少6位' }]}><Input.Password placeholder="请输入新密码" /></Form.Item>
          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space><Button onClick={() => setResetPwdModal(false)}>取消</Button><Button type="primary" htmlType="submit">确认重置</Button></Space>
          </Form.Item>
        </Form>
      </Modal>

      <Modal title={editingWarningRule ? '编辑预警规则' : '新增预警规则'} open={warningRuleModal} onCancel={() => { setWarningRuleModal(false); setEditingWarningRule(null); }} footer={null} width={600} destroyOnClose>
        <Form form={warningRuleForm} layout="vertical" onFinish={handleSubmitWarningRule}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="type" label="预警类型" rules={[{ required: true, message: '请选择预警类型' }]}>
                <Select placeholder="请选择">
                  {WARNING_TYPE_OPTIONS.map((opt) => (
                    <Select.Option key={opt.value} value={opt.value}>{opt.label}</Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="level" label="预警级别" rules={[{ required: true, message: '请选择预警级别' }]}>
                <Select placeholder="请选择">
                  {WARNING_LEVEL_OPTIONS.map((opt) => (
                    <Select.Option key={opt.value} value={opt.value}>{opt.label}</Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="name" label="规则名称" rules={[{ required: true, message: '请输入规则名称' }]}>
                <Input placeholder="请输入规则名称" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="priority" label="优先级" rules={[{ required: true, message: '请输入优先级' }]}>
                <InputNumber min={1} style={{ width: '100%' }} placeholder="数字越小优先级越高" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="description" label="规则描述" rules={[{ required: true, message: '请输入规则描述' }]}>
            <TextArea rows={2} placeholder="请输入规则描述" />
          </Form.Item>
          <Form.Item name="reminder_text" label="预警提醒文案" rules={[{ required: true, message: '请输入提醒文案' }]}>
            <TextArea rows={2} placeholder="预警触发时显示的提醒内容" />
          </Form.Item>
          <Card type="inner" title="规则参数" size="small" style={{ marginBottom: 16 }}>
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item name={['params', 'pending_days']} label="待处理天数阈值">
                  <InputNumber min={1} style={{ width: '100%' }} placeholder="长期未处理规则使用" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name={['params', 'satisfaction_threshold']} label="满意度阈值">
                  <InputNumber min={1} max={5} style={{ width: '100%' }} placeholder="低满意度规则使用" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name={['params', 'unreachable_count']} label="无法联系次数阈值">
                  <InputNumber min={1} style={{ width: '100%' }} placeholder="无法联系规则使用" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name={['params', 'reprocess_days']} label="二次处理天数阈值">
                  <InputNumber min={1} style={{ width: '100%' }} placeholder="二次处理超时规则使用" />
                </Form.Item>
              </Col>
            </Row>
          </Card>
          <Form.Item name="enabled" label="是否启用" valuePropName="checked">
            <Switch defaultChecked />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => { setWarningRuleModal(false); setEditingWarningRule(null); }}>取消</Button>
              <Button type="primary" htmlType="submit">保存</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
