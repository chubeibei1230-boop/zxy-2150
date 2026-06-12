import { useState, useEffect } from 'react';
import {
  Card,
  Descriptions,
  Tag,
  Button,
  Timeline,
  Spin,
  message,
  Alert,
  Space,
  Row,
  Col,
  Rate,
} from 'antd';
import { ArrowLeftOutlined, EditOutlined } from '@ant-design/icons';
import { useParams, useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { getVisitDetail } from '@/api/visits';
import {
  Visit,
  STATUS_OPTIONS,
  UNREACHABLE_REASONS,
} from '@/types';
import VisitProcessModal from '@/components/VisitProcessModal';
import { useAuthStore } from '@/store/auth';

export default function VisitDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [visit, setVisit] = useState<Visit | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

  useEffect(() => {
    if (id) {
      fetchDetail();
    }
  }, [id]);

  const fetchDetail = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const data = await getVisitDetail(id);
      setVisit(data);
    } catch (err: any) {
      message.error(err.message || '获取回访详情失败');
    } finally {
      setLoading(false);
    }
  };

  const handleProcessSuccess = () => {
    setModalVisible(false);
    fetchDetail();
  };

  const getStatusOption = (status: string) => {
    return STATUS_OPTIONS.find((opt) => opt.value === status);
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '100px' }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!visit) {
    return <Alert type="error" message="未找到该回访记录" />;
  }

  const statusOption = getStatusOption(visit.status);

  return (
    <div>
      <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/visits')}>
        返回列表
      </Button>

      <Card
        style={{ marginTop: 16 }}
        title="基本信息"
        extra={
          user?.role !== 'auditor' && visit.status !== 'closed' && (
            <Button type="primary" icon={<EditOutlined />} onClick={() => setModalVisible(true)}>
              处理回访
            </Button>
          )
        }
      >
        <Descriptions column={2} bordered>
          <Descriptions.Item label="工单号">{visit.repair_order_no}</Descriptions.Item>
          <Descriptions.Item label="状态">
            <Tag color={statusOption?.color}>{statusOption?.label}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="用户姓名">{visit.user_name}</Descriptions.Item>
          <Descriptions.Item label="联系电话">{visit.user_phone}</Descriptions.Item>
          <Descriptions.Item label="地址" span={2}>
            {visit.address}
          </Descriptions.Item>
          <Descriptions.Item label="维修类别">{visit.category_name}</Descriptions.Item>
          <Descriptions.Item label="处理人">{visit.handler_name}</Descriptions.Item>
          <Descriptions.Item label="维修内容" span={2}>
            {visit.repair_content}
          </Descriptions.Item>
          <Descriptions.Item label="完成时间">
            {dayjs(visit.completed_at).format('YYYY-MM-DD HH:mm')}
          </Descriptions.Item>
          <Descriptions.Item label="创建时间">
            {dayjs(visit.created_at).format('YYYY-MM-DD HH:mm')}
          </Descriptions.Item>
        </Descriptions>
      </Card>

      {visit.matched_rules.length > 0 && (
        <Card title="命中规则" style={{ marginTop: 16 }}>
          {visit.matched_rules.map((rule, index) => (
            <Alert
              key={rule.rule_id}
              style={{ marginTop: index > 0 ? 8 : 0 }}
              type="warning"
              showIcon
              message={rule.rule_name}
              description={
                <div>
                  <p>{rule.rule_description}</p>
                  <p style={{ color: '#fa8c16' }}>提醒：{rule.reminder_text}</p>
                </div>
              }
            />
          ))}
        </Card>
      )}

      {(visit.visit_result || visit.satisfaction !== null || visit.unreachable_reason) && (
        <Card title="回访结果" style={{ marginTop: 16 }}>
          <Row gutter={16}>
            {visit.satisfaction !== null && (
              <Col span={24}>
                <div style={{ marginBottom: 12 }}>
                  <span style={{ marginRight: 8 }}>满意度：</span>
                  <Rate disabled value={visit.satisfaction} />
                  <span style={{ marginLeft: 8 }}>{visit.satisfaction}分</span>
                </div>
              </Col>
            )}
            {visit.visit_result && (
              <Col span={24}>
                <div style={{ marginBottom: 12 }}>
                  <span style={{ marginRight: 8 }}>回访结果：</span>
                  {visit.visit_result}
                </div>
              </Col>
            )}
            {visit.unresolved_note && (
              <Col span={24}>
                <div style={{ marginBottom: 12 }}>
                  <span style={{ marginRight: 8 }}>未解决说明：</span>
                  {visit.unresolved_note}
                </div>
              </Col>
            )}
            {visit.unreachable_reason && (
              <Col span={24}>
                <div>
                  <span style={{ marginRight: 8 }}>无法联系原因：</span>
                  {UNREACHABLE_REASONS.find((r) => r.value === visit.unreachable_reason)?.label}
                </div>
              </Col>
            )}
          </Row>
        </Card>
      )}

      <Card title="状态变更记录" style={{ marginTop: 16 }}>
        <Timeline
          items={visit.status_timeline.map((event) => ({
            color: getStatusOption(event.status)?.color || 'blue',
            children: (
              <div>
                <div>
                  <Tag color={getStatusOption(event.status)?.color}>
                    {getStatusOption(event.status)?.label}
                  </Tag>
                  <span style={{ marginLeft: 8 }}>{event.operator_name}</span>
                  <span style={{ marginLeft: 8, color: '#8c8c8c' }}>
                    {dayjs(event.timestamp).format('YYYY-MM-DD HH:mm')}
                  </span>
                </div>
                {event.remark && <div style={{ marginTop: 4, color: '#595959' }}>{event.remark}</div>}
              </div>
            ),
          }))}
        />
      </Card>

      <VisitProcessModal
        open={modalVisible}
        visitId={visit.id}
        currentStatus={visit.status}
        onCancel={() => setModalVisible(false)}
        onSuccess={handleProcessSuccess}
      />
    </div>
  );
}
