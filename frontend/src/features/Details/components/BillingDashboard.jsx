import React, { useState, useEffect } from 'react';
import { FiUsers, FiPackage } from 'react-icons/fi';
import apiClient from '../../../api/apiClient';

const BillingDashboard = ({ userStats = {} }) => {
  const [monthlyActiveUsers, setMonthlyActiveUsers] = useState(null);
  const [billingConfig, setBillingConfig] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [usersResponse, configResponse] = await Promise.all([
          apiClient.get('/api/billing/company/current'),
          apiClient.get('/api/billing/config')
        ]);
        
        if (usersResponse.data?.success) {
          setMonthlyActiveUsers(usersResponse.data.data);
        }
        
        if (configResponse.data?.success) {
          setBillingConfig(configResponse.data.data);
        }
      } catch (error) {
        console.error('Error fetching billing data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Donut Chart Component
  const DonutChart = ({ data, size = 100, strokeWidth = 10 }) => {
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const center = size / 2;

    const total = data.reduce((sum, item) => sum + item.value, 0);
    let currentAngle = -90;

    const segments = data.map((item, index) => {
      const percentage = total > 0 ? (item.value / total) * 100 : 0;
      const strokeDasharray = `${(percentage * circumference) / 100} ${circumference}`;
      const rotation = currentAngle;
      currentAngle += (percentage * 360) / 100;

      return (
        <circle
          key={index}
          cx={center}
          cy={center}
          r={radius}
          stroke={item.color}
          strokeWidth={strokeWidth}
          strokeDasharray={strokeDasharray}
          strokeDashoffset={0}
          fill="transparent"
          transform={`rotate(${rotation} ${center} ${center})`}
          style={{ 
            strokeLinecap: 'round',
            transition: 'stroke-dasharray 0.6s ease'
          }}
        />
      );
    });

    return (
      <div className="chart-container">
        <svg width={size} height={size}>
          {segments}
        </svg>
        <div className="chart-center">
          <div className="chart-total">{total}</div>
          <div className="chart-label">USERS</div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="billing-dashboard">
        <div className="loading">
          <FiUsers size={24} />
          <div>Loading...</div>
        </div>
      </div>
    );
  }

  const config = billingConfig || {
    planName: 'Professional Plan',
    baseUserLimit: 20,
    perUserRate: 2.97,
    currencySymbol: '$'
  };

  const activeUsers = monthlyActiveUsers?.activeUsers || 0;
  const pendingUsers = userStats.pendingUsers || 0;
  const additionalUsers = Math.max(0, activeUsers - config.baseUserLimit);
  const monthlyCost = additionalUsers * config.perUserRate;

  const chartData = [
    { label: 'Active', value: activeUsers, color: '#4caf50' },
    { label: 'Pending', value: pendingUsers, color: '#ff9800' }
  ].filter(item => item.value > 0);

  return (
    <div className="billing-dashboard">
      <style>{`
        .billing-dashboard {
          width: 100%;
          max-width: 320px;
          height: 100vh;
          background: white;
          border-radius: 12px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.1);
          overflow: hidden;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          display: flex;
          flex-direction: column;
        }

        .header {
          background: linear-gradient(135deg, #e3f2fd 0%, #2196f310 100%);
          padding: 15px 20px;
          border-bottom: 2px solid #2196f320;
          flex-shrink: 0;
        }

        .title {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 16px;
          font-weight: 600;
          color: #333;
          margin-bottom: 2px;
        }

        .subtitle {
          font-size: 12px;
          color: #666;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .content {
          padding: 16px 20px;
          flex: 1;
          overflow-y: auto;
        }

        .content::-webkit-scrollbar {
          width: 4px;
        }

        .content::-webkit-scrollbar-track {
          background: #f1f1f1;
        }

        .content::-webkit-scrollbar-thumb {
          background: #c1c1c1;
          border-radius: 4px;
        }

        .plan-info {
          background: #f8f9fa;
          border: 1px solid #e9ecef;
          border-radius: 8px;
          padding: 12px;
          margin-bottom: 16px;
          text-align: center;
        }

        .plan-name {
          font-size: 16px;
          font-weight: bold;
          color: #333;
          margin-bottom: 6px;
        }

        .plan-pricing {
          font-size: 13px;
          color: #666;
        }

        .chart-section {
          display: flex;
          flex-direction: column;
          align-items: center;
          margin-bottom: 16px;
        }

        .chart-container {
          position: relative;
        }

        .chart-center {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          text-align: center;
        }

        .chart-total {
          font-size: 20px;
          font-weight: bold;
          color: #333;
          line-height: 1;
        }

        .chart-label {
          font-size: 9px;
          color: #666;
          text-transform: uppercase;
          letter-spacing: 0.3px;
          margin-top: 2px;
        }

        .chart-legend {
          display: flex;
          flex-direction: column;
          gap: 6px;
          margin-top: 12px;
          width: 100%;
        }

        .legend-item {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 11px;
        }

        .legend-color {
          width: 10px;
          height: 10px;
          border-radius: 2px;
          flex-shrink: 0;
        }

        .legend-label {
          flex: 1;
          color: #555;
        }

        .legend-value {
          font-weight: 500;
          color: #333;
        }

        .metrics {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
          margin-bottom: 16px;
        }

        .metric {
          background: #f8f9fa;
          border: 1px solid #e9ecef;
          border-radius: 8px;
          padding: 10px;
          text-align: center;
        }

        .metric-number {
          font-size: 16px;
          font-weight: bold;
          color: #333;
          margin-bottom: 3px;
        }

        .metric-label {
          font-size: 9px;
          color: #666;
          text-transform: uppercase;
          letter-spacing: 0.3px;
        }

        .breakdown {
          background: #f8f9fa;
          border: 1px solid #e9ecef;
          border-radius: 8px;
          padding: 12px;
        }

        .breakdown-title {
          font-size: 13px;
          font-weight: 600;
          color: #333;
          margin-bottom: 10px;
        }

        .breakdown-list {
          list-style: none;
          padding: 0;
          margin: 0;
        }

        .breakdown-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 3px 0;
          font-size: 11px;
          color: #666;
        }

        .breakdown-item span:last-child {
          font-weight: 500;
          color: #333;
        }

        .loading {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 40px;
          color: #666;
          gap: 8px;
        }
      `}</style>

      <div className="header">
        <div className="title">
          <FiPackage size={16} />
          {config.planName}
        </div>
        <div className="subtitle">BILLING STATUS</div>
      </div>

      <div className="content">
        <div className="plan-info">
          <div className="plan-name">{config.planName}</div>
          <div className="plan-pricing">
            Includes {config.baseUserLimit} users • {config.currencySymbol}{config.perUserRate}/user/month for additional
          </div>
        </div>

        <div className="chart-section">
          <DonutChart data={chartData} />
          <div className="chart-legend">
            {chartData.map((item, index) => (
              <div key={index} className="legend-item">
                <div className="legend-color" style={{ backgroundColor: item.color }}></div>
                <span className="legend-label">{item.label}</span>
                <span className="legend-value">{item.value}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="metrics">
          <div className="metric">
            <div className="metric-number">{activeUsers}</div>
            <div className="metric-label">ACTIVE USERS</div>
          </div>
          <div className="metric">
            <div className="metric-number">{config.baseUserLimit}</div>
            <div className="metric-label">INCLUDED</div>
          </div>
          <div className="metric">
            <div className="metric-number">{pendingUsers}</div>
            <div className="metric-label">PENDING</div>
          </div>
          <div className="metric">
            <div className="metric-number">{config.currencySymbol}{monthlyCost.toFixed(2)}</div>
            <div className="metric-label">MONTHLY COST</div>
          </div>
        </div>

        <div className="breakdown">
          <div className="breakdown-title">Billing Breakdown</div>
          <ul className="breakdown-list">
            <li className="breakdown-item">
              <span>Active users</span>
              <span>{activeUsers} (billed)</span>
            </li>
            <li className="breakdown-item">
              <span>Pending invites</span>
              <span>{pendingUsers} (not billed)</span>
            </li>
            {additionalUsers > 0 && (
              <li className="breakdown-item">
                <span>Additional users</span>
                <span>{additionalUsers} × {config.currencySymbol}{config.perUserRate}</span>
              </li>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
};

export default BillingDashboard;