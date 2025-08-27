// Create a new component: frontend/src/features/Admin/components/BillingNotification.jsx

import React from 'react';
import { FiInfo, FiCreditCard, FiUsers } from 'react-icons/fi';
import Config from '../../../config';
import './BillingNotification.sass';

function BillingNotification({ userStats }) {
  // Add fallback defaults in case Config.billing is undefined
  const billingConfig = Config.billing || {
    baseUserLimit: 20,
    perUserRate: 5.0,
    currency: "USD"
  };
  
  const { baseUserLimit, perUserRate, currency } = billingConfig;
  
  // Calculate billable users: active + pending (invited users count toward billing)
  // Deactivated and expired users are NOT billable
  const billableUserCount = (userStats?.activeUsers || 0) + (userStats?.pendingUsers || 0);
  
  // DEBUG: Let's see what we're getting
  console.log('=== BILLING NOTIFICATION DEBUG ===');
  console.log('userStats:', userStats);
  console.log('billableUserCount:', billableUserCount);
  console.log('baseUserLimit:', baseUserLimit);
  console.log('Config.billing:', Config.billing);
  console.log('billingConfig:', billingConfig);
  console.log('Will show component?', billableUserCount > baseUserLimit);
  console.log('=== END BILLING DEBUG ===');
  
  // TEMPORARY: Always show for testing (remove this later)
   if (billableUserCount <= baseUserLimit) {
     return null;
   }
  
  // Show component regardless of count for testing
  const additionalUsers = Math.max(0, billableUserCount - baseUserLimit);
  const estimatedAdditionalCost = additionalUsers * perUserRate;
  const currencySymbol = currency === 'USD' ? '$' : currency;

  return (
    <div className="billing-notification">
      <div className="billing-notification-content">
        <div className="billing-icon">
          <FiCreditCard size={20} />
        </div>
        
        <div className="billing-message">
          <div className="billing-title">
            <FiUsers size={16} style={{ marginRight: '6px' }} />
            Additional User Billing
          </div>
          <div className="billing-details">
            {billableUserCount > baseUserLimit ? (
              <>
                You currently have <strong>{billableUserCount} billable users</strong> 
                ({userStats?.activeUsers || 0} active + {userStats?.pendingUsers || 0} pending) 
                which is {additionalUsers} over your base plan limit of {baseUserLimit}. 
                Additional users are billed at <strong>{currencySymbol}{perUserRate}/user/month</strong> through Outseta.
              </>
            ) : (
              <>
                <strong>Testing Mode:</strong> You have {billableUserCount} billable users out of {baseUserLimit} included in your base plan.
                You're currently {baseUserLimit - billableUserCount} users under your limit.
              </>
            )}
          </div>
          <div className="billing-breakdown">
            <small>
              • <strong>Active users:</strong> {userStats?.activeUsers || 0} (billable)
              <br />
              • <strong>Pending invites:</strong> {userStats?.pendingUsers || 0} (billable)
              <br />
              • <strong>Deactivated users:</strong> {userStats?.deactivatedUsers || 0} (not billable)
              {(userStats?.expiredUsers || 0) > 0 && (
                <>
                  <br />
                  • <strong>Expired invites:</strong> {userStats?.expiredUsers || 0} (not billable)
                </>
              )}
            </small>
          </div>
          {additionalUsers > 0 && (
            <div className="billing-cost">
              Estimated additional monthly cost: <strong>{currencySymbol}{estimatedAdditionalCost.toFixed(2)}</strong>
            </div>
          )}
        </div>

        <div className="billing-info-icon">
          <FiInfo size={16} />
        </div>
      </div>
    </div>
  );
}

export default BillingNotification;