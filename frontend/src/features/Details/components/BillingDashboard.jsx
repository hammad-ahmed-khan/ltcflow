import React, { useState, useEffect } from 'react';
import { FiUsers, FiBox, FiChevronLeft, FiChevronRight, FiCalendar } from 'react-icons/fi';
import apiClient from '../../../api/apiClient';
import './BillingDashboard.sass';

const BillingDashboard = ({ userStats = {} }) => {
  const [monthlyActiveUsers, setMonthlyActiveUsers] = useState(null);
  const [billingConfig, setBillingConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM format
  const [monthDataLoading, setMonthDataLoading] = useState(false);

  const currentMonth = new Date().toISOString().slice(0, 7);
  const minMonth = '2025-10'; // October 2025 minimum

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
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

  // Fetch billing data for a specific month
  const fetchMonthlyBilling = async (month) => {
    try {
      setMonthDataLoading(true);
      const response = await apiClient.get(`/api/billing/company/month/${month}`);
      
      if (response.data?.success) {
        return response.data.data;
      }
      return null;
    } catch (error) {
      console.error(`Error fetching billing data for ${month}:`, error);
      return null;
    } finally {
      setMonthDataLoading(false);
    }
  };

  // Navigate to different months
  const navigateMonth = async (direction) => {
    const currentDate = new Date(selectedMonth + '-01');
    currentDate.setMonth(currentDate.getMonth() + direction);
    const newMonth = currentDate.toISOString().slice(0, 7);
    setSelectedMonth(newMonth);
    
    // Always fetch data for the new month to ensure it updates
    if (newMonth === currentMonth) {
      // Fetch current month data
      try {
        setMonthDataLoading(true);
        const response = await apiClient.get('/api/billing/company/current');
        if (response.data?.success) {
          setMonthlyActiveUsers(response.data.data);
        }
      } catch (error) {
        console.error('Error fetching current month data:', error);
      } finally {
        setMonthDataLoading(false);
      }
    } else {
      // Fetch historical month data
      const data = await fetchMonthlyBilling(newMonth);
      if (data) {
        setMonthlyActiveUsers(data);
      }
    }
  };

  // Format month for display
  const formatMonthDisplay = (monthStr) => {
    const date = new Date(monthStr + '-01');
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short'  // Changed from 'long' to 'short'
    });
  };

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
    planName: 'Connect',
    baseUserLimit: 20,
    perUserRate: 2.97,
    currencySymbol: '$'
  };

  // Handle different data structures from the API
  const activeUsers = monthlyActiveUsers?.totalBillableUsers || 
                     monthlyActiveUsers?.activeUsers || 
                     monthlyActiveUsers?.totalActiveUsers || 
                     monthlyActiveUsers?.activeRecords || 0;
  
  // For pending users, prioritize the passed userStats, but also check the API data
  const pendingUsers = userStats.pendingUsers || 
                      monthlyActiveUsers?.pendingUsers || 0;
  
  const additionalUsers = Math.max(0, activeUsers - config.baseUserLimit);
  const monthlyCost = additionalUsers * config.perUserRate;

  // Ensure chart data updates when month changes
  const chartData = [
    { label: 'Active', value: activeUsers, color: '#4caf50' }
  ];
  
  // Only add pending if we have the data and it's > 0
  if (pendingUsers > 0) {
    chartData.push({ label: 'Pending', value: pendingUsers, color: '#ff9800' });
  }

  return (
    <div className="billing-dashboard">
      <div className="header">
        <div className="title-section">
          <div className="title">
            <FiBox size={16} />
            {config.planName}
          </div>
          <div className="subtitle">BILLING STATUS</div>
        </div>
        
        {/* Month Navigation in header */}
        <div className="month-navigation">
          <button 
            className="month-nav-btn" 
            onClick={() => navigateMonth(-1)}
            disabled={monthDataLoading || selectedMonth <= minMonth}
          >
            <FiChevronLeft size={16} />
          </button>
          
          <div className="current-month-indicator">
            <FiCalendar size={14} />
            {formatMonthDisplay(selectedMonth)}
          </div>
          
          <button 
            className="month-nav-btn" 
            onClick={() => navigateMonth(1)}
            disabled={selectedMonth >= currentMonth || monthDataLoading}
          >
            <FiChevronRight size={16} />
          </button>
        </div>
      </div>

      <div className="content">
        <div className="plan-info">
          <div className="plan-name">{config.planName}</div>
          <div className="plan-pricing">
            Includes {config.baseUserLimit} users • {config.currencySymbol}{config.perUserRate}/user/month for additional
          </div>
        </div>

        {monthDataLoading ? (
          <div className="loading">
            <div>Loading month data...</div>
          </div>
        ) : (
          <>
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
          </>
        )}
      </div>
    </div>
  );
};

export default BillingDashboard;