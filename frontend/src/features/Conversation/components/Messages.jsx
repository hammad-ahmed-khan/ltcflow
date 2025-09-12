
import { useState, useRef, useEffect } from 'react';
import { Lightbox } from 'react-modal-image';
import { useGlobal } from 'reactn';
import { useDispatch, useSelector } from 'react-redux';
import Message from './Message';
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

  const dispatch = useDispatch();
  const chat = useRef(null);
  const [open, setOpen] = useState(null);

  let other = {
    firstName: 'A',
    lastName: 'A',
  };

  if (room && room.people) {
    room.people.forEach((person) => {
      if (person._id !== user.id) other = person;
    });
  }

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
    if (chat.current.scrollTop === 0) {
      if (loading) return;
      setLoading(true);
      getMoreMessages({ roomID: room._id, firstMessageID: messages[0]._id })
        .then((res) => {
          console.log(res.data.messages);
          dispatch({ type: Actions.MORE_MESSAGES, messages: res.data.messages });
          setLoading(false);
        })
        .catch(() => {
          setLoading(false);
        });
    }
  };

  useEffect(() => {
    if (chat.current) chat.current.scrollTop = chat.current.scrollHeight;
  }, [messages.length]);

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
    <div className="messages-wrapper" ref={chat} onScroll={onScroll}>
      <div className="messages-container">
        {open && (
          <Lightbox
            medium={buildImageUrl(open.content, 1024)}
            large={buildImageUrl(open.content, 2048)}
            alt="Lightbox"
            hideDownload
            onClose={() => setOpen(null)}
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
  );
}

export default Messages;