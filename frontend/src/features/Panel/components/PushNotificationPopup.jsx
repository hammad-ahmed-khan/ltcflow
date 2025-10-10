// frontend/src/features/Panel/components/PushNotificationPopup.jsx
// Push Notification Settings Modal - Matching your popup style

import { useState, useEffect } from 'react';
import './Popup.sass';
import { FiX, FiBell, FiBellOff, FiRefreshCw } from 'react-icons/fi';
import { useToasts } from 'react-toast-notifications';
import NotificationService from '../../../services/NotificationService';

function PushNotificationPopup({ onClose }) {
  const { addToast } = useToasts();
  
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [permission, setPermission] = useState(
    typeof Notification !== 'undefined' ? Notification.permission : 'default'
  );
  const [isSupported, setIsSupported] = useState(true);

  useEffect(() => {
    checkSupport();
    checkSubscriptionStatus();
  }, []);

  const checkSupport = () => {
    const supported =
      'serviceWorker' in navigator &&
      'PushManager' in window &&
      'Notification' in window;
    setIsSupported(supported);
  };

  const checkSubscriptionStatus = async () => {
    try {
      const subscribed = await NotificationService.isPushSubscribed();
      setIsSubscribed(subscribed);
    } catch (error) {
      console.error('Failed to check subscription status:', error);
    }
  };

  const handleToggle = async () => {
    setIsLoading(true);

    try {
      if (isSubscribed) {
        // Unsubscribe
        const success = await NotificationService.unsubscribeFromPush();
        if (success) {
          setIsSubscribed(false);
          addToast('Push notifications disabled', {
            appearance: 'success',
            autoDismiss: true,
          });
        }
      } else {
        // Check permission first
        if (permission !== 'granted') {
          await NotificationService.requestPermission();
          setPermission(Notification.permission);

          if (Notification.permission !== 'granted') {
            addToast('Please enable notifications in your browser settings', {
              appearance: 'warning',
              autoDismiss: true,
            });
            setIsLoading(false);
            return;
          }
        }

        // Subscribe
        const subscription = await NotificationService.subscribeToPush();
        if (subscription) {
          setIsSubscribed(true);
          addToast('Push notifications enabled!', {
            appearance: 'success',
            autoDismiss: true,
          });
        } else {
          addToast('Failed to enable push notifications', {
            appearance: 'error',
            autoDismiss: true,
          });
        }
      }
    } catch (error) {
      console.error('Toggle push notification error:', error);
      addToast('Failed to update push notification settings', {
        appearance: 'error',
        autoDismiss: true,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleTestNotification = async () => {
    if (!isSubscribed) {
      addToast('Please enable push notifications first', {
        appearance: 'warning',
        autoDismiss: true,
      });
      return;
    }

    setIsLoading(true);
    try {
      await NotificationService.testPushNotification();
      addToast('Test notification sent! Check your notifications.', {
        appearance: 'success',
        autoDismiss: true,
      });
    } catch (error) {
      console.error('Test notification error:', error);
      addToast('Failed to send test notification', {
        appearance: 'error',
        autoDismiss: true,
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!isSupported) {
    return (
      <div className="admin-overlay">
        <div className="box" style={{ maxWidth: '500px', width: '90vw' }}>
          <div className="top-controls">
            <div className="title uk-flex uk-flex-middle">
              <FiBellOff style={{ marginRight: '8px' }} />
              Push Notifications
            </div>
            <div className="close" onClick={onClose}>
              <FiX />
            </div>
          </div>
          <div className="data-editor">
            <div className="unsupported-notice">
              <p>
                <strong>Push notifications are not supported by your browser.</strong>
              </p>
              <p>
                Please use a modern browser like Chrome, Firefox, Safari, or Edge to enable push notifications.
              </p>
            </div>
            <div className="padding" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-overlay">
      <div className="box" style={{ maxWidth: '500px', width: '90vw' }}>
        <div className="top-controls">
          <div className="title uk-flex uk-flex-middle">
            {isSubscribed ? (
              <FiBell style={{ marginRight: '8px', color: '#28a745' }} />
            ) : (
              <FiBellOff style={{ marginRight: '8px' }} />
            )}
            Push Notifications
          </div>
          <div className="close" onClick={onClose}>
            <FiX />
          </div>
        </div>

        <div className="data-editor">
          <div className="notification-description">
            <p>
              Receive notifications when you're offline or when the app is closed. 
              Perfect for staying updated even when you're not actively using the app.
            </p>
          </div>

          <div className="notification-actions uk-margin-top">
            <button
              className={`uk-button uk-button-large uk-width-1-1 ${
                isSubscribed ? 'uk-button-primary' : 'uk-button-secondary'
              }`}
              onClick={handleToggle}
              disabled={isLoading}
              style={{ 
                marginBottom: '12px',
                backgroundColor: isSubscribed ? '#28a745' : undefined
              }}
            >
              {isLoading ? (
                <span className="uk-flex uk-flex-middle uk-flex-center">
                  <FiRefreshCw className="spin" style={{ marginRight: '8px' }} />
                  Processing...
                </span>
              ) : isSubscribed ? (
                <span className="uk-flex uk-flex-middle uk-flex-center">
                  <FiBell style={{ marginRight: '8px' }} />
                  Enabled - Click to Disable
                </span>
              ) : (
                <span className="uk-flex uk-flex-middle uk-flex-center">
                  <FiBellOff style={{ marginRight: '8px' }} />
                  Disabled - Click to Enable
                </span>
              )}
            </button>

            {isSubscribed && (
              <button
                className="uk-button uk-button-secondary uk-button-large uk-width-1-1"
                onClick={handleTestNotification}
                disabled={isLoading}
              >
                Send Test Notification
              </button>
            )}
          </div>

          {permission === 'denied' && (
            <div className="warning-notice uk-margin-top">
              <p>
                <strong>⚠️ Notifications are blocked.</strong>
              </p>
              <p>To enable notifications:</p>
              <ol>
                <li>Click the lock icon in your address bar</li>
                <li>Find "Notifications" in the permissions</li>
                <li>Change to "Allow"</li>
                <li>Refresh this page</li>
              </ol>
            </div>
          )}

          <div className="info-section uk-margin-top">
            <h4>How it works:</h4>
            <ul>
              <li>✅ Receive messages when app is closed</li>
              <li>✅ Get notifications even when browser is minimized</li>
              <li>✅ Works across all your devices</li>
              <li>✅ Respects your privacy - only you receive your notifications</li>
            </ul>
          </div>

          <div className="padding" />
        </div>
      </div>
    </div>
  );
}

export default PushNotificationPopup;