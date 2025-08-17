// frontend/src/components/ConfirmationDialog/index.jsx
import React from 'react';
import './ConfirmationDialog.sass';

const ConfirmationDialog = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  type = 'warning', // 'warning', 'danger', 'info', 'success'
  icon,
  loading = false,
  disabled = false
}) => {
  if (!isOpen) return null;

  const getTypeStyles = () => {
    const styles = {
      warning: {
        confirmBg: '#f57c00',
        confirmHover: '#e06900',
        iconColor: '#f57c00',
        borderColor: '#fff3e0'
      },
      danger: {
        confirmBg: '#c62828',
        confirmHover: '#a71e1e',
        iconColor: '#c62828',
        borderColor: '#ffebee'
      },
      info: {
        confirmBg: '#1976d2',
        confirmHover: '#1565c0',
        iconColor: '#1976d2',
        borderColor: '#e3f2fd'
      },
      success: {
        confirmBg: '#2e7d32',
        confirmHover: '#1b5e20',
        iconColor: '#2e7d32',
        borderColor: '#e8f5e8'
      }
    };
    return styles[type] || styles.warning;
  };

  const typeStyles = getTypeStyles();

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      onClose();
    }
    if (e.key === 'Enter' && !loading && !disabled) {
      onConfirm();
    }
  };

  React.useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, loading, disabled]);

  return (
    <div 
      className="confirmation-dialog-overlay"
      onClick={handleOverlayClick}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 3000,
        animation: 'fadeIn 0.2s ease-out'
      }}
    >
      <div 
        className="confirmation-dialog-content"
        style={{
          backgroundColor: 'white',
          borderRadius: '12px',
          padding: '24px',
          maxWidth: '450px',
          width: '90%',
          maxHeight: '80vh',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.3)',
          animation: 'slideIn 0.2s ease-out',
          border: `2px solid ${typeStyles.borderColor}`
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          marginBottom: '16px',
          gap: '12px'
        }}>
          {icon && (
            <span style={{ 
              fontSize: '28px',
              color: typeStyles.iconColor,
              lineHeight: 1
            }}>
              {icon}
            </span>
          )}
          <h3 style={{
            margin: 0,
            fontSize: '20px',
            fontWeight: '600',
            color: '#333',
            flex: 1
          }}>
            {title}
          </h3>
        </div>
        
        {/* Message */}
        <div style={{
          margin: '0 0 24px 0',
          color: '#666',
          lineHeight: '1.6',
          fontSize: '15px'
        }}>
          {typeof message === 'string' ? (
            <p style={{ margin: 0 }}>{message}</p>
          ) : (
            message
          )}
        </div>
        
        {/* Actions */}
        <div style={{
          display: 'flex',
          gap: '12px',
          justifyContent: 'flex-end'
        }}>
          <button
            onClick={onClose}
            disabled={loading}
            style={{
              padding: '10px 20px',
              border: '1px solid #ddd',
              backgroundColor: 'white',
              borderRadius: '6px',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontSize: '14px',
              fontWeight: '500',
              transition: 'all 0.2s ease',
              opacity: loading ? 0.6 : 1
            }}
            onMouseEnter={(e) => {
              if (!loading) {
                e.target.style.backgroundColor = '#f5f5f5';
                e.target.style.borderColor = '#ccc';
              }
            }}
            onMouseLeave={(e) => {
              if (!loading) {
                e.target.style.backgroundColor = 'white';
                e.target.style.borderColor = '#ddd';
              }
            }}
          >
            {cancelText}
          </button>
          
          <button
            onClick={onConfirm}
            disabled={loading || disabled}
            style={{
              padding: '10px 20px',
              border: 'none',
              backgroundColor: loading || disabled ? '#ccc' : typeStyles.confirmBg,
              color: 'white',
              borderRadius: '6px',
              cursor: loading || disabled ? 'not-allowed' : 'pointer',
              fontSize: '14px',
              fontWeight: '600',
              transition: 'all 0.2s ease',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              minWidth: '120px',
              justifyContent: 'center'
            }}
            onMouseEnter={(e) => {
              if (!loading && !disabled) {
                e.target.style.backgroundColor = typeStyles.confirmHover;
                e.target.style.transform = 'translateY(-1px)';
                e.target.style.boxShadow = `0 4px 12px ${typeStyles.confirmBg}40`;
              }
            }}
            onMouseLeave={(e) => {
              if (!loading && !disabled) {
                e.target.style.backgroundColor = typeStyles.confirmBg;
                e.target.style.transform = 'translateY(0)';
                e.target.style.boxShadow = 'none';
              }
            }}
          >
            {loading ? (
              <>
                <div style={{
                  width: '16px',
                  height: '16px',
                  border: '2px solid #ffffff40',
                  borderTop: '2px solid white',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite'
                }} />
                Loading...
              </>
            ) : (
              confirmText
            )}
          </button>
        </div>
      </div>
      
      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        
        @keyframes slideIn {
          from { 
            opacity: 0;
            transform: scale(0.9) translateY(-20px);
          }
          to { 
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }
        
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default ConfirmationDialog;