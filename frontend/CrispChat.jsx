// frontend/src/components/InstallPrompt.jsx
import { FiDownload, FiX } from 'react-icons/fi';
import './InstallPrompt.css';

function InstallPrompt({ onInstall, onDismiss }) {
  return (
    <div className="install-prompt">
      <div className="install-prompt-content">
        <div className="install-prompt-icon">
          <img src="/flowicon 32.webp" alt="LTC Flow" width="40" height="40" />
        </div>
        <div className="install-prompt-text">
         <h3>Install LTC Flow</h3>
<p>Launch LTC Flow like a native app — faster and available offline.</p>
        </div>
        <div className="install-prompt-actions">
          <button 
            className="install-btn" 
            onClick={onInstall}
            aria-label="Install app"
          >
            <FiDownload /> Install
          </button>
          <button 
            className="dismiss-btn" 
            onClick={onDismiss}
            aria-label="Dismiss install prompt"
          >
            <FiX />
          </button>
        </div>
      </div>
    </div>
  );
}

export default InstallPrompt;