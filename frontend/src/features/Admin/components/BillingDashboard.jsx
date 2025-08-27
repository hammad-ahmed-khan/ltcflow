// Enhanced component: frontend/src/features/Admin/components/BillingDashboard.jsx

import React from 'react';
import { FiInfo, FiCreditCard, FiUsers, FiTrendingUp, FiPackage } from 'react-icons/fi';
import Config from '../../../config';
import './BillingDashboard.sass';

function BillingDashboard({ userStats }) {
  // Add fallback defaults in case Config.billing is undefined
  const billingConfig = Config.billing || {
    baseUserLimit: 20,
    perUserRate: 5.0,
    currency: "USD"
  };
  
  const { baseUserLimit, perUserRate, currency } = billingConfig;
  
  // Calculate billable users: active + pending (invited users count toward billing)
  const billableUserCount = (userStats?.activeUsers || 0) + (userStats?.pendingUsers || 0);
  const remainingUsers = Math.max(0, baseUserLimit - billableUserCount);
  const additionalUsers = Math.max(0, billableUserCount - baseUserLimit);
  const utilizationPercentage = Math.min(100, (billableUserCount / baseUserLimit) * 100);
  const estimatedAdditionalCost = additionalUsers * perUserRate;
  const currencySymbol = currency === 'USD' ? '$' : currency;

  // Status colors based on usage
  const getStatusColor = () => {
    if (utilizationPercentage >= 100) return { bg: '#ffebee', border: '#f44336', text: '#c62828' }; // Red - over limit
    if (utilizationPercentage >= 80) return { bg: '#fff3e0', border: '#ff9800', text: '#f57c00' }; // Orange - warning
    if (utilizationPercentage >= 60) return { bg: '#e3f2fd', border: '#2196f3', text: '#1976d2' }; // Blue - moderate
    return { bg: '#e8f5e8', border: '#4caf50', text: '#2e7d32' }; // Green - good
  };

  const statusColor = getStatusColor();

  // Chart data for pie chart representation
  const chartData = [
    { label: 'Active Users', value: userStats?.activeUsers || 0, color: '#4caf50' },
    { label: 'Pending Users', value: userStats?.pendingUsers || 0, color: '#ff9800' },
    { label: 'Available Slots', value: remainingUsers, color: '#e0e0e0' },
  ];

  // If over limit, adjust the chart
  if (additionalUsers > 0) {
    chartData[2] = { label: 'Over Limit', value: additionalUsers, color: '#f44336' };
  }

  return (
    <div className="billing-dashboard" style={{ 
      backgroundColor: statusColor.bg, 
      borderColor: statusColor.border 
    }}>
      {/* Header */}
      <div className="billing-header">
        <div className="billing-title">
          <FiPackage size={20} />
          <span>User Package Status</span>
        </div>
        <div className="billing-usage">
          {billableUserCount}/{baseUserLimit} users
        </div>
      </div>

      {/* Progress Bar */}
      <div className="progress-section">
        <div className="progress-bar">
          <div 
            className="progress-fill" 
            style={{ 
              width: `${Math.min(100, utilizationPercentage)}%`,
              backgroundColor: utilizationPercentage >= 100 ? '#f44336' : 
                             utilizationPercentage >= 80 ? '#ff9800' : '#4caf50'
            }}
          />
          {utilizationPercentage >= 100 && (
            <div 
              className="progress-overflow"
              style={{ 
                width: `${((additionalUsers / baseUserLimit) * 100)}%`,
                backgroundColor: '#f44336',
                opacity: 0.7
              }}
            />
          )}
        </div>
        <div className="progress-labels">
          <span>0</span>
          <span className="progress-percentage" style={{ color: statusColor.text }}>
            {utilizationPercentage.toFixed(0)}%
          </span>
          <span>{baseUserLimit}</span>
        </div>
      </div>          
    </div>
  );
}

export default BillingDashboard;