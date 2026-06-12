import { useState, useEffect, useCallback } from 'react';
import { Row, Col, Card, Statistic, Spin, message } from 'antd';
import { ClockCircleOutlined, ReloadOutlined, SmileOutlined, FileTextOutlined } from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';
import { useNavigate } from 'react-router-dom';
import { getDashboardStats } from '@/api/stats';
import { DashboardStats, VisitFilter, STATUS_OPTIONS, UNREACHABLE_REASONS } from '@/types';
import { useVisitFilterStore } from '@/store/visitFilter';

export default function Dashboard() {
  const navigate = useNavigate();
  const setFilter = useVisitFilterStore((state) => state.setFilter);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats | null>(null);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const data = await getDashboardStats();
      setStats(data);
    } catch (err: any) {
      message.error(err.message || '获取统计数据失败');
    } finally {
      setLoading(false);
    }
  };

  const navigateWithFilter = useCallback(
    (filter: VisitFilter) => {
      setFilter(filter);
      const params = new URLSearchParams();
      Object.entries(filter).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          params.append(key, String(value));
        }
      });
      const queryString = params.toString();
      navigate(queryString ? `/visits?${queryString}` : '/visits');
    },
    [navigate, setFilter]
  );

  const handleStatClick = (type: string) => {
    switch (type) {
      case 'pending':
        navigateWithFilter({ status: 'pending' });
        break;
      case 'reprocess':
        navigateWithFilter({ status: 'reprocess' });
        break;
      case 'satisfaction':
        navigateWithFilter({ satisfaction_max: 3 });
        break;
      case 'total':
        navigateWithFilter({});
        break;
    }
  };

  const statusChartOption = stats
    ? {
        tooltip: { trigger: 'item' },
        legend: { bottom: '5%', left: 'center' },
        series: [
          {
            name: '回访状态',
            type: 'pie',
            radius: ['40%', '70%'],
            avoidLabelOverlap: false,
            itemStyle: { borderRadius: 10, borderColor: '#fff', borderWidth: 2 },
            label: { show: false },
            emphasis: {
              label: { show: true, fontSize: 16, fontWeight: 'bold' },
            },
            data: stats.status_distribution.map((item) => ({
              value: item.count,
              name: STATUS_OPTIONS.find((opt) => opt.value === item.status)?.label || item.status,
              status: item.status,
            })),
          },
        ],
      }
    : {};

  const ruleChartOption = stats
    ? {
        tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
        grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
        xAxis: {
          type: 'value',
          axisLabel: { formatter: '{value} 次' },
        },
        yAxis: {
          type: 'category',
          data: stats.rule_hit_ranking.map((item) => item.rule_name),
        },
        series: [
          {
            name: '命中次数',
            type: 'bar',
            data: stats.rule_hit_ranking.map((item) => item.hit_count),
            itemStyle: { color: '#1677ff' },
          },
        ],
      }
    : {};

  const unreachableChartOption = stats
    ? {
        tooltip: { trigger: 'item' },
        series: [
          {
            name: '无法联系原因',
            type: 'pie',
            radius: '50%',
            data: stats.unreachable_reasons.map((item) => ({
              value: item.count,
              name: UNREACHABLE_REASONS.find((reason) => reason.value === item.reason)?.label || item.reason,
              reason: item.reason,
            })),
            emphasis: {
              itemStyle: {
                shadowBlur: 10,
                shadowOffsetX: 0,
                shadowColor: 'rgba(0, 0, 0, 0.5)',
              },
            },
          },
        ],
      }
    : {};

  const statusChartEvents = {
    click: (params: any) => {
      const statusName = params.name;
      const statusOption = STATUS_OPTIONS.find((opt) => opt.label === statusName);
      const statusValue = statusOption ? statusOption.value : statusName;
      navigateWithFilter({ status: statusValue });
    },
  };

  const ruleChartEvents = {
    click: (params: any) => {
      const item = stats?.rule_hit_ranking.find((rule) => rule.rule_name === params.name);
      navigateWithFilter(item?.rule_id ? { rule_id: item.rule_id } : { keyword: params.name });
    },
  };

  const unreachableChartEvents = {
    click: (params: any) => {
      navigateWithFilter({ status: 'unreachable', unreachable_reason: params.data.reason });
    },
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '100px' }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div>
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} lg={6}>
          <Card className="stat-card" onClick={() => handleStatClick('pending')} style={{ cursor: 'pointer' }}>
            <Statistic
              title="待回访"
              value={stats?.pending_count || 0}
              prefix={<ClockCircleOutlined style={{ color: '#fa8c16' }} />}
              valueStyle={{ color: '#fa8c16' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card className="stat-card" onClick={() => handleStatClick('reprocess')} style={{ cursor: 'pointer' }}>
            <Statistic
              title="二次处理率"
              value={stats?.reprocess_rate || 0}
              suffix="%"
              prefix={<ReloadOutlined style={{ color: '#ff4d4f' }} />}
              valueStyle={{ color: '#ff4d4f' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card className="stat-card" onClick={() => handleStatClick('satisfaction')} style={{ cursor: 'pointer' }}>
            <Statistic
              title="平均满意度"
              value={stats?.avg_satisfaction || 0}
              prefix={<SmileOutlined style={{ color: '#52c41a' }} />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card className="stat-card" onClick={() => handleStatClick('total')} style={{ cursor: 'pointer' }}>
            <Statistic
              title="回访总数"
              value={stats?.total_visits || 0}
              prefix={<FileTextOutlined style={{ color: '#1677ff' }} />}
              valueStyle={{ color: '#1677ff' }}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <Card title="回访状态分布">
            <ReactECharts
              option={statusChartOption}
              style={{ height: 300, cursor: 'pointer' }}
              onEvents={statusChartEvents}
            />
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title="规则命中排行">
            <ReactECharts
              option={ruleChartOption}
              style={{ height: 300, cursor: 'pointer' }}
              onEvents={ruleChartEvents}
            />
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title="无法联系原因分布">
            <ReactECharts
              option={unreachableChartOption}
              style={{ height: 300, cursor: 'pointer' }}
              onEvents={unreachableChartEvents}
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
}
