// frontend/src/features/Conversation/components/SelectionNavBar.jsx
// Mobile selection navbar for message actions

import { useGlobal } from 'reactn';
import { useToasts } from 'react-toast-notifications';
import { useDispatch } from 'react-redux';
import { FiX, FiTrash2, FiCopy, FiCornerUpRight } from 'react-icons/fi';
import './SelectionNavBar.sass';
import deleteMessage from '../../../actions/deleteMessage';
import Actions from '../../../constants/Actions';

function SelectionNavBar() {
  const [selectedMessage, setSelectedMessage] = useGlobal('selectedMessage');
  const [user] = useGlobal('user');
  const { addToast } = useToasts();
  const dispatch = useDispatch();

  if (!selectedMessage) return null;

  const handleClose = () => {
    setSelectedMessage(null);
  };

  const handleDelete = async () => {
    try {
      await deleteMessage(selectedMessage.id);
      
      dispatch({
        type: Actions.MESSAGE_UPDATE,
        message: {
          ...selectedMessage.message,
          isDeleted: true,
          deletedAt: new Date(),
          deletedBy: user.id,
          content: null,
        },
      });

      addToast('Message deleted successfully', {
        appearance: 'success',
        autoDismiss: true,
      });

      setSelectedMessage(null);
    } catch (error) {
      console.error('Failed to delete message:', error);
      addToast('Failed to delete message', {
        appearance: 'error',
        autoDismiss: true,
      });
    }
  };

  const handleCopy = () => {
    if (selectedMessage.message.content) {
      navigator.clipboard.writeText(selectedMessage.message.content);
      addToast('Message copied to clipboard', {
        appearance: 'success',
        autoDismiss: true,
      });
      setSelectedMessage(null);
    }
  };

  const handleForward = () => {
    // TODO: Implement forward functionality
    addToast('Forward feature coming soon', {
      appearance: 'info',
      autoDismiss: true,
    });
    setSelectedMessage(null);
  };

  return (
    <div className="selection-navbar">
      <div className="selection-navbar-content">
        <button
          className="selection-action close"
          onClick={handleClose}
          aria-label="Close selection"
        >
          <FiX />
        </button>

        <div className="selection-info">
          <span className="selection-count">1 selected</span>
        </div>

        <div className="selection-actions">
          {selectedMessage.message.content && (
            <button
              className="selection-action"
              onClick={handleCopy}
              aria-label="Copy message"
            >
              <FiCopy />
            </button>
          )}

          <button
            className="selection-action"
            onClick={handleForward}
            aria-label="Forward message"
          >
            <FiCornerUpRight />
          </button>

          <button
            className="selection-action delete"
            onClick={handleDelete}
            aria-label="Delete message"
          >
            <FiTrash2 />
          </button>
        </div>
      </div>
    </div>
  );
}

export default SelectionNavBar;