import React, { useState, useEffect } from 'react';
import {
  FiUsers,
  FiPackage,
  FiCalendar,
  FiChevronLeft,
  FiChevronRight,
} from 'react-icons/fi';
import apiClient from '../../../api/apiClient';

const MONTHS_FULL = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const MONTHS_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

const pad2 = (n) => String(n).padStart(2, '0');
// Build a "YYYY-MM" string from a year and a 0-based month index.
const toMonthStr = (year, monthIndex0) => `${year}-${pad2(monthIndex0 + 1)}`;

const BillingDashboard = ({ userStats = {} }) => {
  const [monthlyActiveUsers, setMonthlyActiveUsers] = useState(null);
  const [billingConfig, setBillingConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(false);

  // Compute "now" once so it stays stable across renders.
  const [{ currentMonthStr, currentYear }] = useState(() => {
    const d = new Date();
    return {
      currentMonthStr: toMonthStr(d.getFullYear(), d.getMonth()),
      currentYear: d.getFullYear(),
    };
  });

  // The month currently being viewed (defaults to the current month).
  const [selectedMonth, setSelectedMonth] = useState(currentMonthStr);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerYear, setPickerYear] = useState(currentYear);

  const isViewingCurrentMonth = selectedMonth === currentMonthStr;

  // Fetch the billing config once on mount (doesn't change by month).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await apiClient.get('/api/billing/config');
        if (!cancelled && res.data?.success) {
          setBillingConfig(res.data.data);
        }
      } catch (error) {
        console.error('Error fetching billing config:', error);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Fetch billing data whenever the selected month changes.
  useEffect(() => {
    let cancelled = false;
    const fetchBilling = async () => {
      setDataLoading(true);
      try {
        const url = isViewingCurrentMonth
          ? '/api/billing/company/current'
          : `/api/billing/company/month/${selectedMonth}`;
        const res = await apiClient.get(url);
        if (!cancelled) {
          setMonthlyActiveUsers(res.data?.success ? res.data.data : null);
        }
      } catch (error) {
        console.error('Error fetching billing data:', error);
        if (!cancelled) setMonthlyActiveUsers(null);
      } finally {
        if (!cancelled) {
          setDataLoading(false);
          setLoading(false);
        }
      }
    };
    fetchBilling();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMonth]);

  // ---- Month picker helpers ----

  // Move the selected month by `delta` months, never into the future.
  const shiftMonth = (delta) => {
    const [y, m] = selectedMonth.split('-').map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    const next = toMonthStr(d.getFullYear(), d.getMonth());
    if (next > currentMonthStr) return; // lexicographic compare is valid for YYYY-MM
    setSelectedMonth(next);
  };

  const openPicker = () => {
    setPickerYear(parseInt(selectedMonth.split('-')[0], 10));
    setPickerOpen((open) => !open);
  };

  const selMonthIndex = parseInt(selectedMonth.split('-')[1], 10) - 1;
  const selYear = selectedMonth.split('-')[0];
  const selectedLabel = `${MONTHS_FULL[selMonthIndex]} ${selYear}`;

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
            transition: 'stroke-dasharray 0.6s ease',
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
    currencySymbol: '$',
  };

  // Normalize across the two endpoints: /current returns `activeUsers`,
  // /month/:month returns `totalBillableUsers`.
  const activeUsers =
    monthlyActiveUsers?.activeUsers ??
    monthlyActiveUsers?.activeRecords ??
    monthlyActiveUsers?.totalBillableUsers ??
    0;

  // Pending invites reflect the live user list, so they only apply to the
  // current month. Historical months have no pending snapshot.
  const pendingUsers = isViewingCurrentMonth ? userStats.pendingUsers || 0 : 0;
  const additionalUsers = Math.max(0, activeUsers - config.baseUserLimit);
  const monthlyCost = additionalUsers * config.perUserRate;

  const chartData = [
    { label: 'Active', value: activeUsers, color: '#4caf50' },
    { label: 'Pending', value: pendingUsers, color: '#ff9800' },
  ].filter((item) => item.value > 0);

  const showNoData = !dataLoading && !isViewingCurrentMonth && activeUsers === 0;

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

        /* ---- Month picker ---- */
        .month-picker {
          position: relative;
          z-index: 5;
          display: flex;
          align-items: center;
          gap: 6px;
          margin-bottom: 16px;
        }

        .mp-nav {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 30px;
          height: 32px;
          border: 1px solid #e9ecef;
          background: #f8f9fa;
          border-radius: 8px;
          color: #555;
          cursor: pointer;
          flex-shrink: 0;
          transition: background 0.15s ease, color 0.15s ease;
        }

        .mp-nav:hover:not(:disabled) {
          background: #e3f2fd;
          color: #2196f3;
        }

        .mp-nav:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }

        .mp-nav.small {
          width: 26px;
          height: 26px;
        }

        .mp-current {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          height: 32px;
          padding: 0 10px;
          border: 1px solid #e9ecef;
          background: #f8f9fa;
          border-radius: 8px;
          font-size: 13px;
          font-weight: 600;
          color: #333;
          cursor: pointer;
          transition: background 0.15s ease, border-color 0.15s ease;
        }

        .mp-current:hover {
          background: #e3f2fd;
          border-color: #2196f350;
        }

        .mp-current svg {
          color: #2196f3;
          flex-shrink: 0;
        }

        .mp-backdrop {
          position: fixed;
          inset: 0;
          z-index: 10;
          background: transparent;
        }

        .mp-dropdown {
          position: absolute;
          top: 38px;
          left: 0;
          right: 0;
          z-index: 20;
          background: white;
          border: 1px solid #e9ecef;
          border-radius: 10px;
          box-shadow: 0 8px 24px rgba(0,0,0,0.12);
          padding: 10px;
        }

        .mp-year-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 8px;
        }

        .mp-year {
          font-size: 14px;
          font-weight: 600;
          color: #333;
        }

        .mp-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 6px;
        }

        .mp-month {
          padding: 8px 0;
          border: 1px solid transparent;
          background: #f8f9fa;
          border-radius: 6px;
          font-size: 12px;
          font-weight: 500;
          color: #444;
          cursor: pointer;
          transition: background 0.15s ease, color 0.15s ease;
        }

        .mp-month:hover:not(:disabled) {
          background: #e3f2fd;
          color: #2196f3;
        }

        .mp-month.active {
          background: #2196f3;
          color: white;
        }

        .mp-month:disabled {
          opacity: 0.35;
          cursor: not-allowed;
        }

        .view-hint {
          font-size: 11px;
          color: #ff9800;
          text-align: center;
          margin: -8px 0 12px;
          font-weight: 500;
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

        /* Data area dims while a different month is loading */
        .data-area {
          position: relative;
          transition: opacity 0.2s ease;
        }

        .data-area.is-loading {
          opacity: 0.5;
          pointer-events: none;
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
          font-size: 22px;
          font-weight: bold;
          color: #333;
          line-height: 1;
        }

        .chart-label {
          font-size: 10px;
          color: #666;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .chart-legend {
          display: flex;
          gap: 16px;
          margin-top: 10px;
        }

        .legend-item {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
          color: #555;
        }

        .legend-color {
          width: 10px;
          height: 10px;
          border-radius: 50%;
        }

        .legend-value {
          font-weight: 600;
          color: #333;
        }

        .metrics {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
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
          font-size: 18px;
          font-weight: bold;
          color: #333;
        }

        .metric-label {
          font-size: 10px;
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

        .no-data {
          background: #f8f9fa;
          border: 1px dashed #d6dade;
          border-radius: 8px;
          padding: 24px 12px;
          text-align: center;
          color: #888;
          font-size: 12px;
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
        {/* Month picker — view past billing periods; future months disabled */}
        <div className="month-picker">
          <button
            type="button"
            className="mp-nav"
            onClick={() => shiftMonth(-1)}
            aria-label="Previous month"
          >
            <FiChevronLeft size={16} />
          </button>

          <button
            type="button"
            className="mp-current"
            onClick={openPicker}
            aria-haspopup="true"
            aria-expanded={pickerOpen}
          >
            <FiCalendar size={14} />
            <span>{selectedLabel}</span>
          </button>

          <button
            type="button"
            className="mp-nav"
            onClick={() => shiftMonth(1)}
            disabled={isViewingCurrentMonth}
            aria-label="Next month"
          >
            <FiChevronRight size={16} />
          </button>

          {pickerOpen && (
            <>
              <div
                className="mp-backdrop"
                onClick={() => setPickerOpen(false)}
              />
              <div className="mp-dropdown" role="dialog" aria-label="Select month">
                <div className="mp-year-row">
                  <button
                    type="button"
                    className="mp-nav small"
                    onClick={() => setPickerYear((y) => y - 1)}
                    aria-label="Previous year"
                  >
                    <FiChevronLeft size={14} />
                  </button>
                  <span className="mp-year">{pickerYear}</span>
                  <button
                    type="button"
                    className="mp-nav small"
                    onClick={() => setPickerYear((y) => y + 1)}
                    disabled={pickerYear >= currentYear}
                    aria-label="Next year"
                  >
                    <FiChevronRight size={14} />
                  </button>
                </div>
                <div className="mp-grid">
                  {MONTHS_SHORT.map((label, idx) => {
                    const value = toMonthStr(pickerYear, idx);
                    const disabled = value > currentMonthStr; // future month
                    const active = value === selectedMonth;
                    return (
                      <button
                        key={value}
                        type="button"
                        className={`mp-month${active ? ' active' : ''}`}
                        disabled={disabled}
                        onClick={() => {
                          setSelectedMonth(value);
                          setPickerOpen(false);
                        }}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>

        {!isViewingCurrentMonth && (
          <div className="view-hint">Viewing past billing period</div>
        )}

        <div className="plan-info">
          <div className="plan-name">{config.planName}</div>
          <div className="plan-pricing">
            Includes {config.baseUserLimit} users • {config.currencySymbol}
            {config.perUserRate}/user/month for additional
          </div>
        </div>

        <div className={`data-area${dataLoading ? ' is-loading' : ''}`}>
          {showNoData ? (
            <div className="no-data">
              No billing data recorded for {selectedLabel}.
            </div>
          ) : (
            <>
              <div className="chart-section">
                <DonutChart data={chartData} />
                <div className="chart-legend">
                  {chartData.map((item, index) => (
                    <div key={index} className="legend-item">
                      <div
                        className="legend-color"
                        style={{ backgroundColor: item.color }}
                      ></div>
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
                  <div className="metric-number">
                    {config.currencySymbol}
                    {monthlyCost.toFixed(2)}
                  </div>
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
                      <span>
                        {additionalUsers} × {config.currencySymbol}
                        {config.perUserRate}
                      </span>
                    </li>
                  )}
                </ul>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default BillingDashboard;