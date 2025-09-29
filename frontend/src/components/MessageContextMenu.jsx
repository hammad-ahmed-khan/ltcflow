// frontend/src/components/MessageContextMenu.jsx
import React, { useEffect, useRef } from 'react';
import { FiTrash2, FiCopy, FiCornerUpLeft, FiCornerUpRight, FiEdit3, FiInfo } from 'react-icons/fi';
import './MessageContextMenu.sass';

function MessageContextMenu({ 
  message, 
  isVisible, 
  position, 
  onClose, 
  onDelete, 
  onCopy, 
  onReply, 
  onForward,
  onEdit,
  onInfo,
  isMine,
  className = ''
}) {
  const menuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        onClose();
      }
    };

    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    const handleScroll = () => {
      onClose();
    };

    if (isVisible) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
      document.addEventListener('scroll', handleScroll, true);
      
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
        document.removeEventListener('keydown', handleEscape);
        document.removeEventListener('scroll', handleScroll, true);
      };
    }
  }, [isVisible, onClose]);

  // Auto-position menu to prevent going off-screen
  useEffect(() => {
    if (isVisible && menuRef.current) {
      const menu = menuRef.current;
      const rect = menu.getBoundingClientRect();
      const windowWidth = window.innerWidth;
      const windowHeight = window.innerHeight;
      
      let adjustedX = position.x;
      let adjustedY = position.y;
      
      // Adjust horizontal position
      if (rect.right > windowWidth) {
        adjustedX = windowWidth - rect.width - 10;
      }
      if (adjustedX < 10) {
        adjustedX = 10;
      }
      
      // Adjust vertical position
      if (rect.bottom > windowHeight) {
        adjustedY = windowHeight - rect.height - 10;
      }
      if (adjustedY < 10) {
        adjustedY = 10;
      }
      
      menu.style.left = `${adjustedX}px`;
      menu.style.top = `${adjustedY}px`;
    }
  }, [isVisible, position]);

  if (!isVisible) return null;

  const handleCopy = () => {
    if (message.content) {
      navigator.clipboard.writeText(message.content).then(() => {
        onCopy?.();
      }).catch(err => {
        console.error('Failed to copy message:', err);
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = message.content;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        onCopy?.();
      });
    }
    onClose();
  };

  const handleDelete = () => {
    const confirmDelete = window.confirm(
      `Are you sure you want to delete this ${message.type === 'image' ? 'image' : 'message'}? This action cannot be undone.`
    );
    
    if (confirmDelete) {
      onDelete?.(message._id);
    }
    onClose();
  };

  const handleReply = () => {
    onReply?.(message);
    onClose();
  };

  const handleForward = () => {
    onForward?.(message);
    onClose();
  };

  const handleEdit = () => {
    onEdit?.(message);
    onClose();
  };

  const handleInfo = () => {
    onInfo?.(message);
    onClose();
  };

  // Determine which actions to show based on message type and ownership
  const canCopy = message.content && message.type !== 'file';
  const canEdit = isMine && message.type === 'text' && message.content;
  const canDelete = isMine;
  const canReply = true;
  const canForward = true;
  const canShowInfo = true;

  return (
    <div 
      className={`message-context-menu ${className}`}
      ref={menuRef}
      style={{
        left: position.x,
        top: position.y,
      }}
    >
      <div className="context-menu-content">
        {canCopy && (
          <button className="context-menu-item" onClick={handleCopy}>
            <FiCopy size={16} />
            <span>Copy</span>
          </button>
        )}
        
        {canReply && (
          <button className="context-menu-item" onClick={handleReply}>
            <FiCornerUpLeft size={16} />
            <span>Reply</span>
          </button>
        )}
        
        {canForward && (
          <button className="context-menu-item" onClick={handleForward}>
            <FiCornerUpRight size={16} />
            <span>Forward</span>
          </button>
        )}
        
        {canEdit && (
          <button className="context-menu-item" onClick={handleEdit}>
            <FiEdit3 size={16} />
            <span>Edit</span>
          </button>
        )}
        
        {canShowInfo && (
          <button className="context-menu-item" onClick={handleInfo}>
            <FiInfo size={16} />
            <span>Info</span>
          </button>
        )}
        
        {canDelete && (
          <>
            <div className="context-menu-divider" />
            <button className="context-menu-item delete" onClick={handleDelete}>
              <FiTrash2 size={16} />
              <span>Delete</span>
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default MessageContextMenu;