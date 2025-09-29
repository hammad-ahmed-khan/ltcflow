import { useState, useRef, useEffect } from 'react';
import moment from 'moment';
import './Message.sass';
import emojiRegex from 'emoji-regex';
import { useGlobal } from 'reactn';
import ReactImageAppear from 'react-image-appear';
import { FiDownloadCloud, FiMoreVertical, FiTrash2, FiChevronDown } from 'react-icons/fi';
import striptags from 'striptags';
import Config from '../../../config';
import { buildImageUrl, buildFileUrl } from '../../../utils/urlUtils';
import { useToasts } from 'react-toast-notifications';
import deleteMessage from '../../../actions/deleteMessage';

function Message({
  message, previous, next, onOpen,
}) {
  const { content, date } = message;
  let { author } = message;

  const user = useGlobal('user')[0];
  const { addToast } = useToasts();

  // Context menu states
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState(false);
  const [touchStartTime, setTouchStartTime] = useState(0);
  const [touchTimer, setTouchTimer] = useState(null);

  const messageRef = useRef(null);
  const contextMenuRef = useRef(null);
  const dropdownRef = useRef(null);

  if (!author) author = { firstName: 'Deleted', lastName: 'User' };
  if (previous && !previous.author) previous.author = { firstName: 'Deleted', lastName: 'User' };
  if (next && !next.author) next.author = { firstName: 'Deleted', lastName: 'User' };

  const isMine = user.id === author._id;

  let attachPrevious = false;
  let attachNext = false;

  if (
    previous
    && Math.abs(moment(previous.date).diff(moment(date), 'minutes')) < 3
    && author._id === previous.author._id
  ) attachPrevious = true;
  if (next && Math.abs(moment(next.date).diff(moment(date), 'minutes')) < 3 && author._id === next.author._id) attachNext = true;

  // Close context menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(event.target)) {
        setShowContextMenu(false);
      }
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, []);

  // Handle message deletion
  const handleDeleteMessage = async () => {
    try {
      await deleteMessage(message._id);
      addToast('Message deleted successfully', {
        appearance: 'success',
        autoDismiss: true,
      });
      setShowContextMenu(false);
      setShowDropdown(false);
    } catch (error) {
      addToast('Failed to delete message', {
        appearance: 'error',
        autoDismiss: true,
      });
    }
  };

  // Desktop: Right-click context menu
  const handleContextMenu = (e) => {
    e.preventDefault();
    
    if (!isMine) return; // Only allow deletion of own messages
    
    const rect = messageRef.current.getBoundingClientRect();
    setContextMenuPosition({
      x: e.clientX,
      y: e.clientY
    });
    setShowContextMenu(true);
  };

  // Desktop: Dropdown button click
  const handleDropdownClick = (e) => {
    e.stopPropagation();
    if (!isMine) return;
    setShowDropdown(!showDropdown);
  };

  // Mobile: Touch and hold
  const handleTouchStart = (e) => {
    if (!isMine) return;
    
    const startTime = Date.now();
    setTouchStartTime(startTime);
    
    const timer = setTimeout(() => {
      // Long press detected
      if (Date.now() - startTime >= 500) {
        const touch = e.touches[0];
        const rect = messageRef.current.getBoundingClientRect();
        setContextMenuPosition({
          x: touch.clientX,
          y: touch.clientY
        });
        setShowContextMenu(true);
        
        // Prevent default to stop selection
        e.preventDefault();
      }
    }, 500);
    
    setTouchTimer(timer);
  };

  const handleTouchEnd = () => {
    if (touchTimer) {
      clearTimeout(touchTimer);
      setTouchTimer(null);
    }
  };

  // Utility functions from original component
  function Picture({ user }) {
    if (user.picture) return <img src={`${Config.url || ''}/api/images/${user.picture.shieldedID}/256`} alt="Picture" />;
    return (
      <div className="img">
        {user.firstName.substr(0, 1)}
        {user.lastName.substr(0, 1)}
      </div>
    );
  }

  function Details({ side }) {
    if (!attachNext) {
      return <div className={`message-details ${side}`}>{moment(date).format('MMM DD - h:mm A')}</div>;
    }
    return null;
  }

  function PictureOrSpacer() {
    if (attachPrevious) return <div className="spacer" />;
    return (
      <div className="picture">
        <Picture user={author} />
      </div>
    );
  }

  const noEmoji = content.replace(emojiRegex(), '');
  const isOnlyEmoji = !noEmoji.replace(/[\s\n]/gm, '');

  const getBubble = () => {
    if (attachPrevious || isOnlyEmoji) {
      if (isMine) return ' right';
      return ' left';
    }
    if (isMine) return ' bubble-right right';
    return ' bubble-left left';
  };

  const convertUrls = (text) => {
    const urlRegex = /(\b(https?|ftp|file):\/\/[-A-Z0-9+&@#/%?=~_|!:,.;]*[-A-Z0-9+&@#/%=~_|])/gi;
    return text.replace(urlRegex, (url) => {
      return `<a href="${url}" target="_blank">${url}</a>`;
    });
  };

  function Content() {
    switch (message.type) {
      case 'image':
        return (
          <ReactImageAppear
            src={buildImageUrl(message.content, 512)}
            animationDuration="0.2s"
            onClick={() => onOpen(message)}
          />
        );
      case 'file':
        return (
          <a
            href={buildFileUrl(message.content)}
            download={message.file ? message.file.name : 'File'}
          >
            <div className="content-download">
              <div className="content-file">
                <div className="content-name">{message.file ? message.file.name : 'File'}</div>
                <div className="content-size">
                  {message.file ? `${Math.round((message.file.size / 1024 / 1024) * 10) / 10} MB` : 'Size'}
                </div>
              </div>
              <div className="content-icon">
                <FiDownloadCloud />
              </div>
            </div>
          </a>
        );
      default:
        return (
          <div
            dangerouslySetInnerHTML={{
              __html: convertUrls(striptags(content, ['a', 'strong', 'b', 'i', 'em', 'u', 'br'])),
            }}
          />
        );
    }
  }

  const getBubbleClass = () => {
    if (message.type === 'image') return 'bubble-image';
    return isOnlyEmoji ? 'emoji-bubble' : 'bubble';
  };

  // Check if we should show the dropdown button (desktop only, on hover, for own messages)
  const shouldShowDropdownButton = isMine && isHovered && window.innerWidth >= 768;

  return (
    <div
      ref={messageRef}
      className={`message${isMine ? ' right' : ' left'}${attachPrevious ? ' attach-previous' : ''}${
        attachNext ? ' attach-next' : ''
      } message-with-menu`}
      onContextMenu={handleContextMenu}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <PictureOrSpacer />
      <div
        className={`content-x${isMine ? ' right' : ''}${attachPrevious ? ' attach-previous' : ''}${
          attachNext ? ' attach-next' : ''
        }`}
      >
        <div className="message-content-wrapper">
          <div
            className={`${getBubbleClass()}${getBubble()}${attachPrevious ? ' attach-previous' : ''}${
              attachNext ? ' attach-next' : ''
            }`}
          >
            <Content />
          </div>
          
          {/* Desktop: Dropdown button (appears on hover) */}
          {shouldShowDropdownButton && (
            <div ref={dropdownRef} className="message-dropdown-container">
              <button
                className="message-dropdown-trigger"
                onClick={handleDropdownClick}
                aria-label="Message options"
              >
                <FiChevronDown />
              </button>
              
              {showDropdown && (
                <div className="message-dropdown-menu">
                  <div className="dropdown-item delete-item" onClick={handleDeleteMessage}>
                    <FiTrash2 />
                    <span>Delete Message</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
        <Details side={isMine ? 'right' : 'left'} />
      </div>

      {/* Context Menu (for right-click and long-press) */}
      {showContextMenu && (
        <div
          ref={contextMenuRef}
          className="message-context-menu"
          style={{
            position: 'fixed',
            left: contextMenuPosition.x,
            top: contextMenuPosition.y,
            zIndex: 1000,
          }}
        >
          <div className="context-menu-item delete-item" onClick={handleDeleteMessage}>
            <FiTrash2 />
            <span>Delete Message</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default Message;