// frontend/src/components/NetworkStatus.jsx
import { FiWifiOff, FiWifi } from 'react-icons/fi';
import './NetworkStatus.css';

function NetworkStatus({ isOnline }) {
  return (
    <div className={`network-status ${isOnline ? 'online' : 'offline'}`}>
      <div className="network-status-content">
        {isOnline ? (
          <>
            <FiWifi className="network-icon" />
            <span>Back online</span>
          </>
        ) : (
          <>
            <FiWifiOff className="network-icon" />
            <span>You're offline</span>
          </>
        )}
      </div>
    </div>
  );
}

export default NetworkStatus;