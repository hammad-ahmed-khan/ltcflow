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
    console.log('[AutoPushPrompt] Component mounted, checking if should prompt...');
    
    // Add a small delay to ensure everything is initialized
    const initTimer = setTimeout(() => {
      checkIfShouldPrompt();
    }, 1000);

    return () => clearTimeout(initTimer);
  }, []); // Empty dependency array - only run once on mount

  const checkIfShouldPrompt = async () => {
    console.log('[AutoPushPrompt] Starting prompt check...');

    try {
      // Check if user has been prompted before
      const hasBeenPrompted = localStorage.getItem('pushNotificationPrompted');
      if (hasBeenPrompted) {
        console.log('[AutoPushPrompt] Already prompted, not showing again');
        return;
      }

      // Check if notifications are supported
      if (!('Notification' in window)) {
        console.log('[AutoPushPrompt] Notifications not supported');
        return;
      }

      if (!('serviceWorker' in navigator)) {
        console.log('[AutoPushPrompt] Service Worker not supported');
        return;
      }

      // Check current permission state
      const permission = Notification.permission;
      console.log('[AutoPushPrompt] Current permission:', permission);

      // If already granted, mark as prompted and subscribe if needed
      if (permission === 'granted') {
        console.log('[AutoPushPrompt] Permission already granted');
        localStorage.setItem('pushNotificationPrompted', 'true');
        
        try {
          const isSubscribed = await NotificationService.isPushSubscribed();
          if (!isSubscribed) {
            console.log('[AutoPushPrompt] Subscribing silently...');
            await NotificationService.subscribeToPush();
          }
        } catch (error) {
          console.error('[AutoPushPrompt] Subscription error:', error);
        }
        return;
      }

      // If already denied, mark as prompted
      if (permission === 'denied') {
        console.log('[AutoPushPrompt] Permission denied');
        localStorage.setItem('pushNotificationPrompted', 'true');
        return;
      }

      // Wait for service worker to be ready
      console.log('[AutoPushPrompt] Waiting for service worker...');
      try {
        await navigator.serviceWorker.ready;
        console.log('[AutoPushPrompt] Service worker ready');
      } catch (error) {
        console.error('[AutoPushPrompt] Service worker error:', error);
      }

      // Check if already subscribed
      try {
        const isSubscribed = await NotificationService.isPushSubscribed();
        console.log('[AutoPushPrompt] Is subscribed:', isSubscribed);
        
        if (isSubscribed) {
          console.log('[AutoPushPrompt] Already subscribed');
          localStorage.setItem('pushNotificationPrompted', 'true');
          return;
        }
      } catch (error) {
        console.error('[AutoPushPrompt] Subscription check error:', error);
      }

      // All checks passed - show prompt after delay
      console.log('[AutoPushPrompt] All checks passed, showing prompt in 5 seconds...');
      setTimeout(() => {
        console.log('[AutoPushPrompt] Showing prompt now');
        setShowPrompt(true);
      }, 5000);

    } catch (error) {
      console.error('[AutoPushPrompt] Error in checkIfShouldPrompt:', error);
    }
  };

  const handleEnable = async () => {
    console.log('[AutoPushPrompt] Enable clicked');
    setIsLoading(true);

    try {
      console.log('[AutoPushPrompt] Requesting permission...');
      await NotificationService.requestPermission();
      console.log('[AutoPushPrompt] Permission result:', Notification.permission);

      if (Notification.permission !== 'granted') {
        console.log('[AutoPushPrompt] Permission not granted');
        addToast('Please enable notifications in your browser settings', {
          appearance: 'warning',
          autoDismiss: true,
        });
        setIsLoading(false);
        return;
      }

      console.log('[AutoPushPrompt] Subscribing to push...');
      const subscription = await NotificationService.subscribeToPush();

      if (subscription) {
        console.log('[AutoPushPrompt] Successfully subscribed');
        addToast('Push notifications enabled! You\'ll now receive alerts.', {
          appearance: 'success',
          autoDismiss: true,
        });
        localStorage.setItem('pushNotificationPrompted', 'true');
        setShowPrompt(false);
      } else {
        console.log('[AutoPushPrompt] Failed to subscribe');
        addToast('Failed to enable push notifications', {
          appearance: 'error',
          autoDismiss: true,
        });
      }
    } catch (error) {
      console.error('[AutoPushPrompt] Error enabling push:', error);
      addToast('Failed to enable push notifications: ' + error.message, {
        appearance: 'error',
        autoDismiss: true,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDismiss = () => {
    console.log('[AutoPushPrompt] Dismissed by user');
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