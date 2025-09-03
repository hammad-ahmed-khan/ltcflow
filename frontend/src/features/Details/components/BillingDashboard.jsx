import React from 'react';
import { FiUsers, FiDollarSign, FiTrendingUp, FiAlertTriangle, FiInfo, FiPackage, FiCreditCard } from 'react-icons/fi';

// Import your config
const Config = {
  billing: {
    baseUserLimit: parseInt(import.meta.env.VITE_BASE_USER_LIMIT) || 20,
    perUserRate: parseFloat(import.meta.env.VITE_PER_USER_RATE) || 5.0,
    currency: "USD"
  }
};

const BillingDashboard = ({ userStats = {} }) => {
  // Configuration from your env variables
  const billingConfig = Config.billing;

  const { baseUserLimit, perUserRate, currency = "USD" } = billingConfig;
  const currencySymbol = currency === 'USD' ? '$' : '';

  // Use real data with fallbacks
  const activeUsers = userStats.activeUsers || 0;
  const pendingUsers = userStats.pendingUsers || 0;
  const expiredUsers = userStats.expiredUsers || 0; // These are billed too!
  const deactivatedUsers = userStats.deactivatedUsers || 0;

  // FIXED: Calculate billing metrics correctly
  // All users except deactivated are billable (active, pending, expired + admin user)
  const billableUserCount = activeUsers + pendingUsers + expiredUsers + 1; // +1 for current admin
  const nonBillableUsers = deactivatedUsers; // Only deactivated users are not billed
  
  const remainingUsers = Math.max(0, baseUserLimit - billableUserCount);
  const additionalUsers = Math.max(0, billableUserCount - baseUserLimit);
  const utilizationPercentage = Math.min(100, (billableUserCount / baseUserLimit) * 100);
  const estimatedAdditionalCost = additionalUsers * perUserRate;

  // Status determination
  const getStatus = () => {
    if (utilizationPercentage >= 100) return { type: 'over', color: '#f44336', bgColor: '#ffebee', label: 'Over Limit' };
    if (utilizationPercentage >= 85) return { type: 'warning', color: '#ff9800', bgColor: '#fff3e0', label: 'Near Limit' };
    if (utilizationPercentage >= 70) return { type: 'moderate', color: '#2196f3', bgColor: '#e3f2fd', label: 'Moderate Usage' };
    return { type: 'good', color: '#4caf50', bgColor: '#e8f5e8', label: 'Good Usage' };
  };

  const status = getStatus();

  // Donut Chart Component
  const DonutChart = ({ data, size = 120, strokeWidth = 12 }) => {
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const center = size / 2;

    // Calculate angles for each segment
    const total = data.reduce((sum, item) => sum + item.value, 0);
    let currentAngle = -90; // Start from top

    const segments = data.map((item, index) => {
      const percentage = total > 0 ? (item.value / total) : 0;
      const angle = percentage * 360;
      
      const startAngle = currentAngle;
      const endAngle = currentAngle + angle;
      currentAngle = endAngle;

      // Calculate path for arc
      const startAngleRad = (startAngle * Math.PI) / 180;
      const endAngleRad = (endAngle * Math.PI) / 180;

      const x1 = center + radius * Math.cos(startAngleRad);
      const y1 = center + radius * Math.sin(startAngleRad);
      const x2 = center + radius * Math.cos(endAngleRad);
      const y2 = center + radius * Math.sin(endAngleRad);

      const largeArc = angle > 180 ? 1 : 0;

      const pathData = percentage > 0 ? 
        `M ${center},${center} L ${x1},${y1} A ${radius},${radius} 0 ${largeArc},1 ${x2},${y2} Z` : 
        '';

      return {
        ...item,
        percentage,
        pathData,
        angle: startAngle + angle / 2 // For label positioning
      };
    });

    return (
      <div className="donut-chart-container">
        <svg width={size} height={size} className="donut-chart">
          {segments.map((segment, index) => (
            segment.percentage > 0 && (
              <path
                key={index}
                d={segment.pathData}
                fill={segment.color}
                opacity={0.9}
                className="chart-segment"
                style={{
                  filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.1))'
                }}
              />
            )
          ))}
          
          {/* Center circle for donut effect */}
          <circle
            cx={center}
            cy={center}
            r={radius * 0.6}
            fill="white"
            stroke="#f0f0f0"
            strokeWidth="1"
          />
          
          {/* Center text */}
          <text
            x={center}
            y={center - 8}
            textAnchor="middle"
            className="chart-center-number"
            style={{
              fontSize: '18px',
              fontWeight: 'bold',
              fill: status.color
            }}
          >
            {billableUserCount}
          </text>
          <text
            x={center}
            y={center + 8}
            textAnchor="middle"
            className="chart-center-label"
            style={{
              fontSize: '10px',
              fill: '#666'
            }}
          >
            BILLABLE
          </text>
        </svg>

        {/* Legend */}
        <div className="chart-legend">
          {segments.map((segment, index) => (
            segment.value > 0 && (
              <div key={index} className="legend-item">
                <div 
                  className="legend-color" 
                  style={{ backgroundColor: segment.color }}
                />
                <span className="legend-label">{segment.label}</span>
                <span className="legend-value">{segment.value}</span>
              </div>
            )
          ))}
        </div>
      </div>
    );
  };

  // FIXED: Chart data with correct billing logic
  const chartData = [
    { label: 'Active', value: activeUsers + 1, color: '#4caf50' }, // +1 for admin
    { label: 'Pending', value: pendingUsers, color: '#ff9800' },
    { label: 'Expired (Billed)', value: expiredUsers, color: '#ff5722' }, // Clearly show these are billed
    { label: 'Available', value: Math.max(0, remainingUsers), color: '#e0e0e0' }
  ];

  // If over limit, replace available with over limit
  if (additionalUsers > 0) {
    chartData[3] = { label: 'Over Limit', value: additionalUsers, color: '#f44336' };
  }

  // Show loading state if no data provided
  if (!userStats || (activeUsers === 0 && pendingUsers === 0 && deactivatedUsers === 0 && expiredUsers === 0)) {
    return (
      <div className="billing-dashboard-container">
        <div className="billing-header">
          <div className="billing-title">
            <FiPackage size={16} />
            Base Plan Status
          </div>
          <div className="billing-subtitle">Loading user data...</div>
        </div>
        <div className="billing-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ textAlign: 'center', color: '#666' }}>
            <FiUsers size={24} style={{ marginBottom: '8px' }} />
            <div>Loading billing information...</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="billing-dashboard-container">
      <style>{`
        .billing-dashboard-container {
          width: 100%;
          max-width: 320px;
          height: 100vh;
          background: white;
          border-radius: 12px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.1);
          overflow: hidden;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
          display: flex;
          flex-direction: column;
        }

        .billing-header {
          background: linear-gradient(135deg, ${status.bgColor} 0%, ${status.color}10 100%);
          border-bottom: 2px solid ${status.color}20;
          padding: 20px;
          position: relative;
          flex-shrink: 0;
        }

        .billing-title {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 16px;
          font-weight: 600;
          color: #333;
          margin-bottom: 4px;
        }

        .billing-subtitle {
          font-size: 12px;
          color: #666;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .status-badge {
          position: absolute;
          top: 16px;
          right: 16px;
          background: ${status.color};
          color: white;
          padding: 4px 8px;
          border-radius: 12px;
          font-size: 10px;
          font-weight: 500;
          text-transform: uppercase;
          letter-spacing: 0.3px;
        }

        .billing-content {
          padding: 24px 10px;
          overflow-y: auto;
          flex: 1;
          min-height: 0;
        }

        .billing-content::-webkit-scrollbar {
          width: 4px;
        }

        .billing-content::-webkit-scrollbar-track {
          background: #f1f1f1;
          border-radius: 4px;
        }

        .billing-content::-webkit-scrollbar-thumb {
          background: #c1c1c1;
          border-radius: 4px;
        }

        .billing-content::-webkit-scrollbar-thumb:hover {
          background: #a8a8a8;
        }

        .chart-section {
          display: flex;
          flex-direction: column;
          align-items: center;
          margin-bottom: 24px;
        }

        .donut-chart-container {
          position: relative;
        }

        .donut-chart {
          display: block;
        }

        .chart-segment {
          transition: opacity 0.2s ease;
          cursor: pointer;
        }

        .chart-segment:hover {
          opacity: 1 !important;
        }

        .chart-legend {
          display: flex;
          flex-direction: column;
          gap: 8px;
          margin-top: 16px;
          width: 100%;
        }

        .legend-item {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 12px;
        }

        .legend-color {
          width: 12px;
          height: 12px;
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

        .metrics-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
          margin-bottom: 20px;
        }

        .metric-card {
          background: #f8f9fa;
          border: 1px solid #e9ecef;
          border-radius: 8px;
          padding: 12px;
          text-align: center;
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        }

        .metric-card:hover {
          transform: translateY(-1px);
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }

        .metric-number {
          font-size: 18px;
          font-weight: bold;
          color: #333;
          line-height: 1;
          margin-bottom: 4px;
        }

        .metric-label {
          font-size: 10px;
          color: #666;
          text-transform: uppercase;
          letter-spacing: 0.3px;
        }

        .usage-bar {
          background: #e9ecef;
          border-radius: 6px;
          height: 8px;
          overflow: hidden;
          margin: 16px 0;
          position: relative;
        }

        .usage-fill {
          height: 100%;
          background: linear-gradient(90deg, ${status.color}, ${status.color}dd);
          border-radius: 6px;
          transition: width 0.6s ease;
          position: relative;
        }

        .usage-overflow {
          position: absolute;
          top: 0;
          left: 100%;
          height: 100%;
          background: #f44336;
          border-radius: 0 6px 6px 0;
        }

        .usage-labels {
          display: flex;
          justify-content: space-between;
          font-size: 11px;
          color: #666;
          margin-bottom: 4px;
        }

        .alert-section {
          background: ${additionalUsers > 0 ? '#fff3cd' : '#d1ecf1'};
          border: 1px solid ${additionalUsers > 0 ? '#ffeaa7' : '#bee5eb'};
          border-radius: 8px;
          padding: 12px;
          margin-bottom: 16px;
        }

        .alert-header {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 8px;
        }

        .alert-icon {
          color: ${additionalUsers > 0 ? '#e17b47' : '#0c5460'};
        }

        .alert-title {
          font-size: 13px;
          font-weight: 600;
          color: ${additionalUsers > 0 ? '#8b4513' : '#0c5460'};
        }

        .alert-message {
          font-size: 12px;
          color: ${additionalUsers > 0 ? '#7d5e00' : '#0c5460'};
          line-height: 1.4;
          margin-bottom: 8px;
        }

        .cost-highlight {
          background: rgba(255,255,255,0.7);
          padding: 8px;
          border-radius: 4px;
          font-size: 13px;
          font-weight: 500;
          color: ${additionalUsers > 0 ? '#8b4513' : '#0c5460'};
        }

        .plan-info {
          background: #f8f9fa;
          border: 1px solid #dee2e6;
          border-radius: 8px;
          padding: 12px;
        }

        .plan-header {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 8px;
        }

        .plan-title {
          font-size: 13px;
          font-weight: 600;
          color: #495057;
        }

        .plan-details {
          font-size: 11px;
          color: #6c757d;
          line-height: 1.4;
        }

        .plan-rate {
          font-weight: 500;
          color: #495057;
        }

        .breakdown-list {
          list-style: none;
          padding: 0;
          margin: 8px 0 0 0;
          font-size: 11px;
          color: #6c757d;
        }

        .breakdown-list li {
          padding: 2px 0;
          display: flex;
          justify-content: space-between;
        }

        .breakdown-dot {
          display: inline-block;
          width: 6px;
          height: 6px;
          border-radius: 50%;
          margin-right: 6px;
        }

        .breakdown-active { background: #4caf50; }
        .breakdown-pending { background: #ff9800; }
        .breakdown-expired { background: #ff5722; }
        .breakdown-deactivated { background: #9e9e9e; }

        .billing-note {
          background: #e8f4fd;
          border: 1px solid #b3d9ff;
          border-radius: 6px;
          padding: 8px;
          margin-bottom: 12px;
          font-size: 11px;
          color: #1565c0;
        }

        @media (max-width: 768px) {
          .billing-dashboard-container {
            max-width: 100%;
            height: auto;
            max-height: 100vh;
          }
          
          .billing-header {
            padding: 16px;
          }
          
          .billing-content {
            padding: 20px 16px;
            max-height: calc(100vh - 80px);
          }
          
          .metrics-grid {
            grid-template-columns: 1fr;
          }
        }

        /* Better scrollbar for Firefox */
        .billing-content {
          scrollbar-width: thin;
          scrollbar-color: #c1c1c1 #f1f1f1;
        }
      `}</style>

      {/* Header */}
      <div className="billing-header">
        <div className="billing-title">
          <FiPackage size={16} />
          Base Plan Status
        </div>
        <div className="billing-subtitle">User Management</div>
        <div className="status-badge">{status.label}</div>
      </div>

      {/* Content */}
      <div className="billing-content">
        {/* FIXED: Billing clarification note */}
        {expiredUsers > 0 && (
          <div className="billing-note">
            <strong>Note:</strong> Expired invitations are still billed as they occupy user slots until cancelled or activated.
          </div>
        )}

        {/* Chart Section */}
        <div className="chart-section">
          <DonutChart data={chartData} size={140} />
        </div>

        {/* Metrics Grid */}
        <div className="metrics-grid">
          <div className="metric-card">
            <div className="metric-number">{billableUserCount}</div>
            <div className="metric-label">Billable Users</div>
          </div>
          <div className="metric-card">
            <div className="metric-number">{baseUserLimit}</div>
            <div className="metric-label">Plan Limit</div>
          </div>
        </div>

        {/* Usage Bar */}
        <div className="usage-labels">
          <span>Usage: {utilizationPercentage.toFixed(0)}%</span>
          <span>{billableUserCount}/{baseUserLimit}</span>
        </div>
        <div className="usage-bar">
          <div 
            className="usage-fill" 
            style={{ width: `${Math.min(100, utilizationPercentage)}%` }}
          />
          {additionalUsers > 0 && (
            <div 
              className="usage-overflow"
              style={{ width: `${(additionalUsers / baseUserLimit) * 100}%` }}
            />
          )}
        </div>

        {/* Alert Section */}
        <div className="alert-section">
          <div className="alert-header">
            <div className="alert-icon">
              {additionalUsers > 0 ? <FiAlertTriangle size={14} /> : <FiInfo size={14} />}
            </div>
            <div className="alert-title">
              {additionalUsers > 0 ? 'Over Limit Billing' : 'Usage Alert'}
            </div>
          </div>
          <div className="alert-message">
            {additionalUsers > 0 ? (
              <>
                You have {additionalUsers} user{additionalUsers !== 1 ? 's' : ''} over your base plan limit. 
                Additional users are billed at <strong>{currencySymbol}{perUserRate}/user/month</strong>.
              </>
            ) : (
              <>
                You're using {billableUserCount} of {baseUserLimit} included users. 
                Each additional user will be billed at <strong>{currencySymbol}{perUserRate}/month</strong>.
              </>
            )}
          </div>
          {additionalUsers > 0 && (
            <div className="cost-highlight">
              <FiDollarSign size={12} style={{ verticalAlign: 'middle', marginRight: '4px' }} />
              Estimated additional cost: <strong>{currencySymbol}{estimatedAdditionalCost.toFixed(2)}/month</strong>
            </div>
          )}
        </div>

        {/* Plan Info */}
        <div className="plan-info">
          <div className="plan-header">
            <FiCreditCard size={12} />
            <div className="plan-title">Plan Breakdown</div>
          </div>
          <div className="plan-details">
            Base plan includes {baseUserLimit} users. Additional users: <span className="plan-rate">{currencySymbol}{perUserRate}/month each</span>
          </div>
          <ul className="breakdown-list">
            <li>
              <span><span className="breakdown-dot breakdown-active"></span>Active users</span>
              <span>{activeUsers + 1} (billed)</span>
            </li>
            <li>
              <span><span className="breakdown-dot breakdown-pending"></span>Pending invites</span>
              <span>{pendingUsers} (billed)</span>
            </li>
            {expiredUsers > 0 && (
              <li>
                <span><span className="breakdown-dot breakdown-expired"></span>Expired invites</span>
                <span>{expiredUsers} (billed)</span>
              </li>
            )}
            <li>
              <span><span className="breakdown-dot breakdown-deactivated"></span>Deactivated</span>
              <span>{deactivatedUsers} (not billed)</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default BillingDashboard;