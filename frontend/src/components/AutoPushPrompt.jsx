// frontend/src/components/AutoPushPrompt.jsx
// Automatically prompts for push notifications on first login

import { useEffect, useState } from 'react';
import { FiBell, FiX } from 'react-icons/fi';
import { useToasts } from 'react-toast-notifications';
import NotificationService from '../services/NotificationService';
import './AutoPushPrompt.sass';

function AutoPushPrompt() {
  const { addToast } = useToasts();
  const [showPrompt, setShowPrompt] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    checkIfShouldPrompt();
  }, []);

  const checkIfShouldPrompt = async () => {
    // Check if user has been prompted before
    const hasBeenPrompted = localStorage.getItem('pushNotificationPrompted');
    if (hasBeenPrompted) {
      return; // Don't prompt again
    }

    // Check if notifications are supported
    if (!('Notification' in window) || !('serviceWorker' in navigator)) {
      return;
    }

    // Check if already granted
    if (Notification.permission === 'granted') {
      localStorage.setItem('pushNotificationPrompted', 'true');
      return;
    }

    // Check if already denied
    if (Notification.permission === 'denied') {
      localStorage.setItem('pushNotificationPrompted', 'true');
      return;
    }

    // Check if already subscribed
    const isSubscribed = await NotificationService.isPushSubscribed();
    if (isSubscribed) {
      localStorage.setItem('pushNotificationPrompted', 'true');
      return;
    }

    // Show prompt after 5 seconds (give user time to orient)
    setTimeout(() => {
      setShowPrompt(true);
    }, 5000);
  };

  const handleEnable = async () => {
    setIsLoading(true);

    try {
      // Request permission
      await NotificationService.requestPermission();

      if (Notification.permission !== 'granted') {
        addToast('Please enable notifications in your browser settings', {
          appearance: 'warning',
          autoDismiss: true,
        });
        setIsLoading(false);
        return;
      }

      // Subscribe to push
      const subscription = await NotificationService.subscribeToPush();

      if (subscription) {
        addToast('Push notifications enabled! You\'ll now receive alerts.', {
          appearance: 'success',
          autoDismiss: true,
        });
        localStorage.setItem('pushNotificationPrompted', 'true');
        setShowPrompt(false);
      } else {
        addToast('Failed to enable push notifications', {
          appearance: 'error',
          autoDismiss: true,
        });
      }
    } catch (error) {
      console.error('Failed to enable push notifications:', error);
      addToast('Failed to enable push notifications', {
        appearance: 'error',
        autoDismiss: true,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDismiss = () => {
    localStorage.setItem('pushNotificationPrompted', 'true');
    setShowPrompt(false);
    
    addToast('You can enable notifications later in Settings', {
      appearance: 'info',
      autoDismiss: true,
    });
  };

  if (!showPrompt) {
    return null;
  }

  return (
    <div className="auto-push-prompt">
      <div className="prompt-content">
        <div className="prompt-icon">
          <FiBell size={32} />
        </div>
        
        <div className="prompt-text">
          <h3>Stay Connected</h3>
          <p>Enable push notifications to receive instant alerts for messages and calls, even when the app is closed.</p>
        </div>

        <div className="prompt-actions">
          <button
            className="enable-btn"
            onClick={handleEnable}
            disabled={isLoading}
          >
            {isLoading ? 'Enabling...' : 'Enable Notifications'}
          </button>
          <button
            className="dismiss-btn"
            onClick={handleDismiss}
            disabled={isLoading}
          >
            Maybe Later
          </button>
        </div>

        <button className="close-btn" onClick={handleDismiss}>
          <FiX size={20} />
        </button>
      </div>
    </div>
  );
}

export default AutoPushPrompt;