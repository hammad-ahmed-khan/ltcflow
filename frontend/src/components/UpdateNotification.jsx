import { useState, useEffect } from 'react';
import './UpdateNotification.sass';

function UpdateNotification() {
  const [showUpdate, setShowUpdate] = useState(false);
  const [registration, setRegistration] = useState(null);

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then((reg) => {
        setRegistration(reg);

        // Check for updates every 60 seconds
        setInterval(() => {
          reg.update();
        }, 60000);

        // Listen for new service worker waiting
        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing;
          
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // New service worker available
              console.log('📦 New version available!');
              setShowUpdate(true);
            }
          });
        });
      });

      // Listen for controller change (new SW activated)
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        console.log('🔄 New service worker activated, reloading...');
        window.location.reload();
      });
    }
  }, []);

  const handleUpdate = () => {
    if (registration && registration.waiting) {
      // Tell the waiting service worker to skip waiting
      registration.waiting.postMessage({ type: 'SKIP_WAITING' });
    }
  };

  const handleDismiss = () => {
    setShowUpdate(false);
  };

  if (!showUpdate) return null;

  return (
    <div className="update-notification">
      <div className="update-content">
        <div className="update-icon">🔄</div>
        <div className="update-text">
          <strong>New version available!</strong>
          <p>An update is ready to install.</p>
        </div>
        <div className="update-actions">
          <button className="update-btn" onClick={handleUpdate}>
            Update Now
          </button>
          <button className="dismiss-btn" onClick={handleDismiss}>
            Later
          </button>
        </div>
      </div>
    </div>
  );
}

export default UpdateNotification;