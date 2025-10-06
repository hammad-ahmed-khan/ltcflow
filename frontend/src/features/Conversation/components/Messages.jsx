import { useState, useRef, useEffect, useMemo } from 'react';
import { useGlobal } from 'reactn';
import { useDispatch, useSelector } from 'react-redux';
import Message from './Message';
import EnhancedLightbox from './EnhancedLightbox';
import Config from '../../../config';
import './Messages.sass';
import getMoreMessages from '../../../actions/getMoreMessages';
import Actions from '../../../constants/Actions';
import Picture from '../../../components/Picture';
import { buildImageUrl } from '../../../utils/urlUtils';
import typing from '../../../actions/typing';

function Messages() {
  const user = useGlobal('user')[0];
  const messages = useSelector((state) => state.io.messages) || [];
  const room = useSelector((state) => state.io.room);
  const [loading, setLoading] = useState(false);
  const typingUsers = useSelector((state) => state.messages.typingUsers) || [];
  const [isPicker, showPicker] = useGlobal('isPicker');

  const dispatch = useDispatch();
  const chat = useRef(null);
  const [open, setOpen] = useState(null);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  
  // Track if we're loading more messages to preserve scroll position
  const isLoadingMore = useRef(false);
  const previousScrollHeight = useRef(0);
  const previousMessagesLength = useRef(messages.length);
  const previousRoomId = useRef(room?._id);
  const isNearBottom = useRef(true);

  let other = {
    firstName: 'A',
    lastName: 'A',
  };

  if (room && room.people) {
    room.people.forEach((person) => {
      if (person._id !== user.id) other = person;
    });
  }

  // Extract all image messages for the lightbox gallery
  const imageMessages = useMemo(() => {
    return messages.filter(msg => msg.type === 'image' && !msg.isDeleted);
  }, [messages]);

  const Messages = messages.map((message, index) => {
    return (
      <Message
        key={message._id}
        message={message}
        previous={messages[index - 1]}
        next={messages[index + 1]}
        onOpen={setOpen}
      />
    );
  });

  const onScroll = () => {
    if (!chat.current) return;
    
    // Close emoji picker when scrolling
    if (isPicker) {
      showPicker(false);
    }
    
    const { scrollTop, scrollHeight, clientHeight } = chat.current;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
    
    // Show scroll button if user is more than 100px from bottom (more sensitive)
    const shouldShowButton = distanceFromBottom > 100;
    setShowScrollButton(shouldShowButton);
    isNearBottom.current = !shouldShowButton;
    
    // Reset unread count when user scrolls to bottom
    if (!shouldShowButton) {
      setUnreadCount(0);
    }
    
    // Load more messages when scrolled to top
    if (scrollTop === 0) {
      if (loading) return;
      setLoading(true);
      isLoadingMore.current = true;
      previousScrollHeight.current = scrollHeight;
      
      getMoreMessages({ roomID: room._id, firstMessageID: messages[0]._id })
        .then((res) => {
          console.log(res.data.messages);
          dispatch({ type: Actions.MORE_MESSAGES, messages: res.data.messages });
          setLoading(false);
        })
        .catch(() => {
          setLoading(false);
          isLoadingMore.current = false;
        });
    }
  };

  // Only scroll to bottom when NEW messages arrive (not when loading old ones)
  useEffect(() => {
    if (!chat.current) return;

    // If we're loading more messages (scrolling up), preserve scroll position
    if (isLoadingMore.current) {
      const newScrollHeight = chat.current.scrollHeight;
      const scrollDiff = newScrollHeight - previousScrollHeight.current;
      chat.current.scrollTop = scrollDiff;
      isLoadingMore.current = false;
    } 
    // Only scroll to bottom if messages were ADDED (not loaded from history)
    else if (messages.length > previousMessagesLength.current) {
      // If user is near bottom, auto-scroll
      if (isNearBottom.current) {
        chat.current.scrollTop = chat.current.scrollHeight;
      } else {
        // Increment unread count if user is scrolled up
        setUnreadCount(prev => prev + (messages.length - previousMessagesLength.current));
      }
    }
    
    previousMessagesLength.current = messages.length;
  }, [messages.length]);

  // Scroll to bottom when room changes (initial load or switching rooms)
  useEffect(() => {
    if (!chat.current || !room) return;
    
    // Check if room has changed
    if (previousRoomId.current !== room._id) {
      // Close emoji picker when switching rooms
      showPicker(false);
      
      // Longer timeout to ensure messages are fully rendered
      const timeoutId = setTimeout(() => {
        if (chat.current) {
          chat.current.scrollTop = chat.current.scrollHeight;
          setShowScrollButton(false);
          setUnreadCount(0);
          isNearBottom.current = true;
        }
      }, 100);
      
      previousRoomId.current = room._id;
      previousMessagesLength.current = messages.length;
      
      return () => clearTimeout(timeoutId);
    }
  }, [room?._id, messages.length, showPicker]);

  // Initial scroll to bottom on first mount
  useEffect(() => {
    if (chat.current && messages.length > 0) {
      const timeoutId = setTimeout(() => {
        if (chat.current) {
          chat.current.scrollTop = chat.current.scrollHeight;
          setShowScrollButton(false);
          setUnreadCount(0);
          isNearBottom.current = true;
        }
      }, 100);
      
      return () => clearTimeout(timeoutId);
    }
  }, []);

  // Smooth scroll to bottom function
  const scrollToBottom = () => {
    if (chat.current) {
      chat.current.scrollTo({
        top: chat.current.scrollHeight,
        behavior: 'smooth'
      });
      setUnreadCount(0);
    }
  };

  // Filter out current user and check if others are typing
  const otherTypingUsers = typingUsers.filter(typingUser => 
    typingUser.id !== user.id && typingUser._id !== user.id
  );

  useEffect(() => {
    if (otherTypingUsers.length > 0 && chat.current) {
      chat.current.scrollTop = chat.current.scrollHeight;
    }
  }, [otherTypingUsers.length]);

  // Enhanced getTypingText with current user filtering
  const getTypingText = () => {
    if (!otherTypingUsers.length) return '';
    
    console.log('Frontend typingUsers (all):', typingUsers);
    console.log('Frontend otherTypingUsers (excluding self):', otherTypingUsers);
    
    const MAX_DISPLAY = 3;
    
    const names = otherTypingUsers.slice(0, MAX_DISPLAY).map(user => {
      const firstName = user.firstName || user.first_name || user.name;
      const username = user.username || user.userName;
      
      if (firstName) {
        return firstName;
      } else if (username) {
        return username;
      } else if (user._id || user.id) {
        return `User ${(user._id || user.id).toString().slice(-4)}`;
      } else {
        return 'Someone';
      }
    });
    
    console.log('Extracted names (excluding self):', names);
    
    if (otherTypingUsers.length === 1) {
      return `${names[0]} is typing...`;
    } else if (otherTypingUsers.length === 2) {
      return `${names[0]} and ${names[1]} are typing...`;
    } else if (otherTypingUsers.length <= MAX_DISPLAY) {
      return `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]} are typing...`;
    } else {
      const additional = otherTypingUsers.length - MAX_DISPLAY;
      return `${names.join(', ')}, and ${additional} other${additional > 1 ? 's' : ''} are typing...`;
    }
  };

  return (
    <>
      <div 
        className="messages-wrapper" 
        ref={chat} 
        onScroll={onScroll}
        onClick={() => isPicker && showPicker(false)}
      >
        <div className="messages-container">
          {/* Enhanced Lightbox with all room images and download functionality */}
          {open && imageMessages.length > 0 && (
            <EnhancedLightbox
              images={imageMessages}
              currentImage={open}
              onClose={() => setOpen(null)}
              buildImageUrl={buildImageUrl}
            />
          )}
          
          {Messages}
          
          {/* Enhanced typing indicator - only show if OTHER users are typing */}
          {otherTypingUsers.length > 0 && (
            <div className="message left attach-previous">
              <div className="picture">
                <Picture user={otherTypingUsers[0]} />
              </div>
              <div className="content-x">
                <div className="bubble bubble-left left typing-bubble">
                  <div className="typing-text">{getTypingText()}</div>
                  <div id="wave">
                    <span className="dot" />
                    <span className="dot" />
                    <span className="dot" />
                  </div>
                </div>
                <div className="message-details left" style={{ color: 'transparent' }}>
                  -
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* Scroll to bottom button - WhatsApp style - FIXED POSITION */}
      {showScrollButton && (
        <button 
          className="scroll-to-bottom"
          onClick={scrollToBottom}
          aria-label="Scroll to bottom"
        >
          <svg 
            viewBox="0 0 24 24" 
            width="24" 
            height="24"
            fill="currentColor"
          >
            <path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z" />
          </svg>
          {unreadCount > 0 && (
            <span className="unread-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>
          )}
        </button>
      )}
    </>
  );
}

export default Messages;