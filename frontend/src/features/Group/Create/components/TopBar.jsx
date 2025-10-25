import React from 'react';
import { useGlobal } from 'reactn';
import { FiArrowLeft, FiX } from 'react-icons/fi';

function TopBar() {
  const setPanel = useGlobal('panel')[1];

  const handleBack = () => {
    setPanel('standard');
  };

  return (
    <div className="top-bar">
      <div className="top-bar-content">
        <button 
          className="back-button"
          onClick={handleBack}
          title="Go back"
        >
          <FiArrowLeft size={20} />
        </button>
        
        <div className="top-bar-title">
          <h2>Create Group</h2>
          <span className="subtitle">Add members and create your group</span>
        </div>
        
        <button 
          className="close-button"
          onClick={handleBack}
          title="Close"
        >
          <FiX size={20} />
        </button>
      </div>
    </div>
  );
}

export default TopBar;