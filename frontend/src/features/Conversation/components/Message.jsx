import { useState, useRef, useEffect, memo, useMemo, useCallback } from 'react';
import moment from 'moment';
import './Message.sass';
import emojiRegex from 'emoji-regex';
import { useGlobal } from 'reactn';
import ReactImageAppear from 'react-image-appear';
import { FiDownloadCloud, FiMoreVertical, FiTrash2, FiPhone, FiPhoneOff, FiVideo, FiInfo } from 'react-icons/fi';
import striptags from 'striptags';
import Config from '../../../config';
import { buildImageUrl, buildFileUrl } from '../../../utils/urlUtils';
import { useToasts } from 'react-toast-notifications';
import deleteMessage from '../../../actions/deleteMessage';
import { useDispatch, useSelector } from 'react-redux';
import Actions from '../../../constants/Actions';
import ReadReceipt from './ReadReceipt';
import MessageInfo from './MessageInfo';

const Message = memo(({
  message, previous, next, onOpen,
}) => {
  const { content, date } = message;
  let { author } = message;

  const user = useGlobal('user')[0];
  const { addToast } = useToasts();
  const dispatch = useDispatch();
  const isGroup = useSelector((state) => state.io.room?.isGroup);

  // Context menu states
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
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

  const handleDeleteMessage = useCallback(async () => {
    try {
      await deleteMessage(message._id);
      
      dispatch({
        type: Actions.MESSAGE_UPDATE,
        message: {
          ...message,
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
      
      setShowContextMenu(false);
      setShowDropdown(false);
    } catch (error) {
      console.error('Failed to delete message:', error);
      
      addToast('Failed to delete message', {
        appearance: 'error',
        autoDismiss: true,
      });
    }
  }, [message, user.id, dispatch, addToast]);

  const handleShowInfo = useCallback(() => {
    setShowInfo(true);
    setShowContextMenu(false);
    setShowDropdown(false);
  }, []);

  const handleContextMenu = useCallback((e) => {
    e.preventDefault();

    if (!isMine) return;
    
    const menuWidth = 200;
    const menuHeight = 60;
    
    let x = e.clientX;
    let y = e.clientY;
    
    if (x + menuWidth > window.innerWidth) {
      x = window.innerWidth - menuWidth - 10;
    }
    
    if (y + menuHeight > window.innerHeight) {
      y = window.innerHeight - menuHeight - 10;
    }
    
    if (x < 10) x = 10;
    if (y < 10) y = 10;
    
    setContextMenuPosition({ x, y });
    setShowContextMenu(true);
  }, [isMine]);

  const handleDropdownClick = useCallback((e) => {
    e.stopPropagation();
    if (!isMine) return;
    setShowDropdown(!showDropdown);
  }, [isMine, showDropdown]);

  const handleTouchStart = useCallback((e) => {
    if (!isMine) return;

    const startTime = Date.now();
    setTouchStartTime(startTime);

    const timer = setTimeout(() => {
      if (Date.now() - startTime >= 500) {
        const touch = e.touches[0];

        const screenWidth = window.innerWidth;
        const screenHeight = window.innerHeight;

        const menuWidth = 185;
        const menuHeight = 60;

        let posX = touch.clientX;
        let posY = touch.clientY;

        if (posX + menuWidth > screenWidth) {
          posX = screenWidth - menuWidth - 23;
        }

        if (posY + menuHeight > screenHeight) {
          posY = screenHeight - menuHeight - 23;
        }

        posX = Math.max(8, posX);
        posY = Math.max(8, posY);

        setContextMenuPosition({ x: posX, y: posY });
        setShowContextMenu(true);

        e.preventDefault();
      }
    }, 500);

    setTouchTimer(timer);
  }, [isMine]);

  const handleTouchEnd = useCallback(() => {
    if (touchTimer) {
      clearTimeout(touchTimer);
      setTouchTimer(null);
    }
  }, [touchTimer]);

  const Picture = useMemo(() => {
    if (author.picture) return <img src={`${Config.url || ''}/api/images/${author.picture.shieldedID}/256`} alt="Picture" />;
    return (
      <div className="img">
        {author.firstName.substr(0, 1)}
        {author.lastName.substr(0, 1)}
      </div>
    );
  }, [author.picture, author.firstName, author.lastName]);

  const Details = useMemo(() => {
    // Read-receipt tick: only on my own, non-deleted chat messages.
    const tick = isMine && !message.isDeleted ? <ReadReceipt status={message.status} /> : null;

    if (!attachNext) {
      const side = isMine ? 'right' : 'left';
      return (
        <div className={`message-details ${side}`}>
          {moment(date).format('MMM DD - h:mm A')}
          {tick}
        </div>
      );
    }
    // Messages attached to the next one hide the timestamp, but still show the
    // tick so every own message reflects its delivery state (WhatsApp-like).
    if (tick) {
      return <div className="message-details right only-status">{tick}</div>;
    }
    return null;
  }, [attachNext, isMine, date, message.isDeleted, message.status]);

  const PictureOrSpacer = useMemo(() => {
    if (attachPrevious) return <div className="spacer" />;
    return (
      <div className="picture">
        {Picture}
      </div>
    );
  }, [attachPrevious, Picture]);

  const noEmoji = content ? content.replace(emojiRegex(), '') : '';
  const isOnlyEmoji = content ? !noEmoji.replace(/[\s\n]/gm, '') : false;

  const getBubble = useCallback(() => {
    if (attachPrevious || isOnlyEmoji) {
      if (isMine) return ' right';
      return ' left';
    }
    if (isMine) return ' bubble-right right';
    return ' bubble-left left';
  }, [attachPrevious, isOnlyEmoji, isMine]);

  const convertUrls = useCallback((text) => {
    if (!text) return '';
    
    // First preserve line breaks by converting them to <br> tags
    let processedText = text.replace(/\n/g, '<br>');
    
    // Then convert URLs
    const urlRegex = /(\b(https?|ftp|file):\/\/[-A-Z0-9+&@#/%?=~_|!:,.;]*[-A-Z0-9+&@#/%=~_|])/gi;
    processedText = processedText.replace(urlRegex, (url) => {
      return `<a href="${url}" target="_blank">${url}</a>`;
    });
    
    return processedText;
  }, []);

  const ContentComponent = useMemo(() => {
    switch (message.type) {
      case 'image':
        return (
          <ReactImageAppear
            key={message._id}
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
              __html: convertUrls(striptags(content || '', ['a', 'strong', 'b', 'i', 'em', 'u', 'br'])),
            }}
          />
        );
    }
  }, [message._id, message.type, message.content, message.file, convertUrls, content, onOpen]);

  const getBubbleClass = useCallback(() => {
    if (message.type === 'image') return 'bubble-image';
    return isOnlyEmoji ? 'emoji-bubble' : 'bubble';
  }, [message.type, isOnlyEmoji]);

  const shouldShowDropdownButton = isMine && isHovered && window.innerWidth >= 768;

  // ── Call event bubble (Phase 6b) ──
  // A `type: 'call'` message is centered call history, not a left/right chat
  // bubble. content is a small JSON blob written by the server on call end.
  if (message.type === 'call') {
    let meta = {};
    try { meta = JSON.parse(message.content || '{}'); } catch (e) { meta = {}; }

    const isVideo = meta.media === 'video';
    const mediaWord = isVideo ? 'video' : 'voice';
    const mediaLabel = isVideo ? 'Video call' : 'Voice call';
    const answered = !!meta.answeredAt;
    const isGroupCall = meta.type === 'group';
    // For call messages the author IS the initiator, so `isMine` == "I started it".
    const initiatorIsMe = isMine || String(meta.initiator) === String(user.id);

    // Group calls are attributed to the initiator and labeled by action, not by
    // a per-viewer "missed" outcome (which is ambiguous across many members and
    // already shown per-member in the Missed tab). 1:1 stays viewer-relative.
    if (isGroupCall) {
      const who = initiatorIsMe
        ? 'You'
        : `${author.firstName || 'Someone'}`;
      return (
        <div
          className="message message-call"
          style={{ display: 'flex', justifyContent: 'center', margin: '8px 0' }}
        >
          <div
            className="call-event"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 14px',
              borderRadius: 16,
              fontSize: 13,
              background: '#f0f0f0',
              color: '#555',
            }}
          >
            {isVideo ? <FiVideo style={{ flexShrink: 0 }} /> : <FiPhone style={{ flexShrink: 0 }} />}
            <span>{`${who} started a ${mediaWord} call`}</span>
            <span style={{ opacity: 0.5, marginLeft: 4 }}>
              {moment(date).format('h:mm A')}
            </span>
          </div>
        </div>
      );
    }

    // 1:1 — viewer-relative outcome.
    let statusLabel;
    if (answered) {
      const secs = Number(meta.duration) || 0;
      const mm = Math.floor(secs / 60);
      const ss = String(secs % 60).padStart(2, '0');
      statusLabel = secs > 0 ? `${mm}:${ss}` : 'Call ended';
    } else {
      switch (meta.outcome) {
        case 'declined':
          statusLabel = initiatorIsMe ? 'Declined' : 'Missed call';
          break;
        case 'cancelled':
          statusLabel = initiatorIsMe ? 'Cancelled' : 'Missed call';
          break;
        case 'no_answer':
          statusLabel = initiatorIsMe ? 'No answer' : 'Missed call';
          break;
        case 'abandoned':
          statusLabel = 'Call ended';
          break;
        default:
          statusLabel = initiatorIsMe ? 'No answer' : 'Missed call';
      }
    }

    const isMissed = !answered && (statusLabel === 'Missed call' || statusLabel === 'No answer');
    const Icon = isMissed ? FiPhoneOff : (isVideo ? FiVideo : FiPhone);

    return (
      <div
        className="message message-call"
        style={{ display: 'flex', justifyContent: 'center', margin: '8px 0' }}
      >
        <div
          className={`call-event${isMissed ? ' missed' : ''}`}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 14px',
            borderRadius: 16,
            fontSize: 13,
            background: isMissed ? '#fdecea' : '#f0f0f0',
            color: isMissed ? '#d61314' : '#555',
          }}
        >
          <Icon style={{ flexShrink: 0 }} />
          <span style={{ fontWeight: 600 }}>{mediaLabel}</span>
          <span style={{ opacity: 0.7 }}>·</span>
          <span>{statusLabel}</span>
          <span style={{ opacity: 0.5, marginLeft: 4 }}>
            {moment(date).format('h:mm A')}
          </span>
        </div>
      </div>
    );
  }

  if (message.isDeleted) {
    return (
      <div
        className={`message${isMine ? ' right' : ' left'}${attachPrevious ? ' attach-previous' : ''}${attachNext ? ' attach-next' : ''}`}
        ref={messageRef}
      >
        {attachPrevious ? (
          <div className="spacer" />
        ) : (
          <div className="picture">
            {author.picture ? (
              <img
                src={`${Config.url || ''}/api/images/${author.picture.shieldedID}/256`}
                alt="Picture"
              />
            ) : (
              <div className="img">
                {author.firstName.substr(0, 1)}
                {author.lastName.substr(0, 1)}
              </div>
            )}
          </div>
        )}

        <div
          className={`content-x${isMine ? ' right' : ''}${attachPrevious ? ' attach-previous' : ''}${attachNext ? ' attach-next' : ''} deleted-message`}
        >
          <div className={`bubble bubble-${isMine ? 'right' : 'left'} ${isMine ? 'right' : 'left'}`}>
            <span className="deleted-icon">🚫</span>
            <span className="deleted-text">This message was deleted</span>
          </div>
          {!attachNext && (
            <div className={`message-details ${isMine ? 'right' : 'left'}`}>
              {moment(date).format('MMM DD - h:mm A')}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      ref={messageRef}
      className={`message${isMine ? ' right' : ' left'}${attachPrevious ? ' attach-previous' : ''}${
        attachNext ? ' attach-next' : ''
      } message-with-menu`}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {PictureOrSpacer}
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
            {ContentComponent}
          </div>
          
          {shouldShowDropdownButton && (
            <div ref={dropdownRef} className="message-dropdown-container">
              <button
                className="message-dropdown-trigger"
                onClick={handleDropdownClick}
                aria-label="Message options"
              >
                <FiMoreVertical />
              </button>
              
              {showDropdown && (
                <div className="message-dropdown-menu">
                  {isGroup && (
                    <div className="dropdown-item" onClick={handleShowInfo}>
                      <FiInfo />
                      <span>Message Info</span>
                    </div>
                  )}
                  <div className="dropdown-item delete-item" onClick={handleDeleteMessage}>
                    <FiTrash2 />
                    <span>Delete Message</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
        {Details}
      </div>

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
          {isGroup && (
            <div className="context-menu-item" onClick={handleShowInfo}>
              <FiInfo />
              <span>Message Info</span>
            </div>
          )}
          <div className="context-menu-item delete-item" onClick={handleDeleteMessage}>
            <FiTrash2 />
            <span>Delete Message</span>
          </div>
        </div>
      )}

      {showInfo && (
        <MessageInfo messageId={message._id} onClose={() => setShowInfo(false)} />
      )}
    </div>
  );
}, (prevProps, nextProps) => {
  return (
    prevProps.message._id === nextProps.message._id &&
    prevProps.message.content === nextProps.message.content &&
    prevProps.message.isDeleted === nextProps.message.isDeleted &&
    prevProps.message.type === nextProps.message.type &&
    // Re-render when the read-receipt status changes (no page refresh needed).
    prevProps.message.status === nextProps.message.status &&
    prevProps.previous?._id === nextProps.previous?._id &&
    prevProps.next?._id === nextProps.next?._id
  );
}); 

Message.displayName = 'Message';

export default Message;