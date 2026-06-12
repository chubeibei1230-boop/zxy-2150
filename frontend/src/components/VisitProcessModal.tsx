import { useState, useEffect } from 'react';
import { Modal, Form, Select, Input, Rate, Button, Space, message } from 'antd';
import { processVisit } from '@/api/visits';
import { STATUS_OPTIONS, UNREACHABLE_REASONS, ProcessVisitRequest, VisitStatus } from '@/types';

const { TextArea } = Input;

interface VisitProcessModalProps {
  open: boolean;
  visitId: string | null;
  currentStatus: VisitStatus;
  onCancel: () => void;
  onSuccess: () => void;
}

export default function VisitProcessModal({
  open,
  visitId,
  currentStatus,
  onCancel,
  onSuccess,
}: VisitProcessModalProps) {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      form.resetFields();
    }
  }, [open, form]);

  const getAvailableStatuses = () => {
    const exclude: VisitStatus[] = ['pending'];
    if (currentStatus === 'contacted') {
      exclude.push('contacted');
    }
    if (currentStatus === 'reprocess') {
      exclude.push('reprocess');
    }
    if (currentStatus === 'unreachable') {
      exclude.push('unreachable');
    }
    return STATUS_OPTIONS.filter((opt) => !exclude.includes(opt.value));
  };

  const handleSubmit = async (values: ProcessVisitRequest) => {
    if (!visitId) return;
    setLoading(true);
    try {
      await processVisit(visitId, values);
      message.success('处理成功');
      form.resetFields();
      onSuccess();
    } catch (err: any) {
      message.error(err.message || '处理失败');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    form.resetFields();
    onCancel();
  };

  return (
    <Modal
      title="处理回访"
      open={open}
      onCancel={handleCancel}
      footer={null}
      width={600}
      destroyOnClose
      maskClosable={false}
    >
      <Form form={form} layout="vertical" onFinish={handleSubmit}>
        <Form.Item
          name="status"
          label="处理结果"
          rules={[{ required: true, message: '请选择处理结果' }]}
        >
          <Select placeholder="请选择">
            {getAvailableStatuses().map((opt) => (
              <Select.Option key={opt.value} value={opt.value}>
                {opt.label}
              </Select.Option>
            ))}
          </Select>
        </Form.Item>

        <Form.Item
          noStyle
          shouldUpdate={(prevValues, curValues) => prevValues.status !== curValues.status}
        >
          {({ getFieldValue }) => {
            const status = getFieldValue('status');
            return (
              <>
                {status === 'contacted' && (
                  <>
                    <Form.Item>
                      <div style={{ marginBottom: 12 }}>
                        <span style={{ marginRight: 8 }}>满意度：</span>
                        <Form.Item
                          name="satisfaction"
                          rules={[{ required: true, message: '请选择满意度' }]}
                          style={{ display: 'inline-block', marginBottom: 0 }}
                        >
                          <Rate />
                        </Form.Item>
                      </div>
                    </Form.Item>
                    <Form.Item
                      name="visit_result"
                      label="回访结果"
                      rules={[{ required: true, message: '请填写回访结果' }]}
                    >
                      <TextArea rows={3} placeholder="请填写回访结果" />
                    </Form.Item>
                  </>
                )}
                {status === 'reprocess' && (
                  <Form.Item
                    name="unresolved_note"
                    label="未解决说明"
                    rules={[{ required: true, message: '请填写未解决说明' }]}
                  >
                    <TextArea rows={3} placeholder="请填写未解决说明" />
                  </Form.Item>
                )}
                {status === 'unreachable' && (
                  <Form.Item
                    name="unreachable_reason"
                    label="无法联系原因"
                    rules={[{ required: true, message: '请选择无法联系原因' }]}
                  >
                    <Select placeholder="请选择">
                      {UNREACHABLE_REASONS.map((reason) => (
                        <Select.Option key={reason.value} value={reason.value}>
                          {reason.label}
                        </Select.Option>
                      ))}
                    </Select>
                  </Form.Item>
                )}
                {status === 'closed' && (
                  <Form.Item
                    name="visit_result"
                    label="回访结果"
                    rules={[{ required: true, message: '请填写回访结果' }]}
                  >
                    <TextArea rows={3} placeholder="请填写回访结果" />
                  </Form.Item>
                )}
                <Form.Item name="remark" label="备注">
                  <TextArea rows={2} placeholder="请填写备注" />
                </Form.Item>
              </>
            );
          }}
        </Form.Item>

        <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
          <Space>
            <Button onClick={handleCancel} disabled={loading}>
              取消
            </Button>
            <Button type="primary" htmlType="submit" loading={loading}>
              确认
            </Button>
          </Space>
        </Form.Item>
      </Form>
    </Modal>
  );
}
