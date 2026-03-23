import React from 'react';
import { Card, Col, Progress, Row, Statistic, Typography } from 'antd';
import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  RiseOutlined,
  UnorderedListOutlined,
} from '@ant-design/icons';
import { TaskStatistics } from '../types/asana.types';

interface StatisticsSectionProps {
  statistics: TaskStatistics;
}

const pct = (n: number) => Math.round(n);

const StatisticsSection: React.FC<StatisticsSectionProps> = ({ statistics }) => {
  const progressColor =
    statistics.completionPercentage >= 80
      ? '#16a34a'
      : statistics.completionPercentage >= 40
      ? '#1d4ed8'
      : '#b45309';

  return (
    <Card
      style={{ marginBottom: '1.5rem', borderRadius: 8 }}
      styles={{ body: { paddingBottom: 16 } }}
      title={
        <Typography.Text strong style={{ fontSize: 15 }}>
          Estadísticas
        </Typography.Text>
      }
    >
      {/* Progress bar */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
          <Typography.Text type="secondary" style={{ fontSize: 13 }}>
            Progreso General
          </Typography.Text>
          <Typography.Text strong style={{ fontSize: 13, color: progressColor }}>
            {statistics.completionPercentage.toFixed(1)}%
          </Typography.Text>
        </div>
        <Progress
          percent={pct(statistics.completionPercentage)}
          showInfo={false}
          strokeColor={progressColor}
          trailColor="#f3f4f6"
          strokeWidth={10}
          style={{ marginBottom: 0 }}
        />
      </div>

      {/* Stat cards */}
      <Row gutter={[16, 16]}>
        <Col xs={12} sm={6}>
          <Card
            size="small"
            style={{ borderRadius: 8, borderColor: '#e5e7eb', background: '#f8faff' }}
            styles={{ body: { padding: '14px 16px' } }}
          >
            <Statistic
              title={
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  Total Sub‑Actividades
                </Typography.Text>
              }
              value={statistics.total}
              prefix={<UnorderedListOutlined style={{ color: '#1677ff', fontSize: 16 }} />}
              valueStyle={{ fontSize: 26, fontWeight: 700, color: '#1677ff' }}
            />
          </Card>
        </Col>

        <Col xs={12} sm={6}>
          <Card
            size="small"
            style={{ borderRadius: 8, borderColor: '#e5e7eb', background: '#f0fdf4' }}
            styles={{ body: { padding: '14px 16px' } }}
          >
            <Statistic
              title={
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  Completadas
                </Typography.Text>
              }
              value={statistics.completed}
              prefix={<CheckCircleOutlined style={{ color: '#16a34a', fontSize: 16 }} />}
              valueStyle={{ fontSize: 26, fontWeight: 700, color: '#16a34a' }}
            />
          </Card>
        </Col>

        <Col xs={12} sm={6}>
          <Card
            size="small"
            style={{ borderRadius: 8, borderColor: '#e5e7eb', background: '#fffbeb' }}
            styles={{ body: { padding: '14px 16px' } }}
          >
            <Statistic
              title={
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  Pendientes
                </Typography.Text>
              }
              value={statistics.pending}
              prefix={<ClockCircleOutlined style={{ color: '#b45309', fontSize: 16 }} />}
              valueStyle={{ fontSize: 26, fontWeight: 700, color: '#b45309' }}
            />
          </Card>
        </Col>

        <Col xs={12} sm={6}>
          <Card
            size="small"
            style={{ borderRadius: 8, borderColor: '#e5e7eb', background: '#f5f3ff' }}
            styles={{ body: { padding: '14px 16px' } }}
          >
            <Statistic
              title={
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  Progreso
                </Typography.Text>
              }
              value={statistics.completionPercentage.toFixed(1)}
              suffix="%"
              prefix={<RiseOutlined style={{ color: progressColor, fontSize: 16 }} />}
              valueStyle={{ fontSize: 26, fontWeight: 700, color: progressColor }}
            />
          </Card>
        </Col>
      </Row>
    </Card>
  );
};

export default StatisticsSection;
