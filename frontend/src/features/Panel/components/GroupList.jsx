// frontend/src/features/Panel/components/GroupList.jsx
import React from 'react';
import { useSelector } from 'react-redux';
import { useGlobal } from 'reactn';
import { FiUsers, FiMessageCircle, FiSettings } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import moment from 'moment';
import Picture from '../../../components/Picture';
import './GroupList.sass';

function GroupList() {
  const rooms = useSelector((state) => state.io.rooms);
  const groupsWithNewMessages = useSelector((state) => state.messages.groupsWithNewMessages); // NEW
  const [user] = useGlobal('user');
  const setPanel = useGlobal('panel')[1];
  const navigate = useNavigate();

  // Filter only groups the user belongs to
  const userGroups = rooms.filter(room => 
    room.isGroup && room.people && room.people.some(person => person._id === user.id)
  );

  // Check if user can create groups
  const canCreateGroups = ['manager', 'admin', 'root'].includes(user.level);

  const handleGroupClick = (groupId) => {
    navigate(`/room/${groupId}`);
  };

  const handleGroupSettings = (e, groupId) => {
    e.stopPropagation();
    navigate(`/room/${groupId}/manage`);
  };

  const handleCreateFirstGroup = () => {
    setPanel('createGroup');
  };

  console.log("GroupList - Unread groups:", groupsWithNewMessages); // DEBUG

  if (userGroups.length === 0) {
    return (
      <div className="groups-notice" style={{ 
        padding: '40px 20px', 
        textAlign: 'center',
        color: '#666'
      }}>
        <FiUsers size={48} style={{ marginBottom: '16px', opacity: 0.5 }} />
        <h3 style={{ marginBottom: '8px' }}>No Groups Yet</h3>
        
        {canCreateGroups ? (
          <>
            <p style={{ marginBottom: '20px' }}>You're not a member of any groups yet.</p>
            <button
              className="uk-button uk-button-primary"
              onClick={handleCreateFirstGroup}
              style={{ marginTop: '12px' }}
            >
              Create Your First Group
            </button>
          </>
        ) : (
          <p style={{ marginBottom: '20px' }}>
            You're not a member of any groups yet. Ask a manager or administrator to add you to a group.
          </p>
        )}
      </div>
    );
  }

  return (
    <>
      {userGroups.map(group => {
        // NEW: Check if this group has unread messages
        const hasUnreadMessages = groupsWithNewMessages.includes(group._id);
        
        // NEW: Get last message info for groups
        let { lastMessage } = group;
        let messageText = '';
        
        if (!lastMessage) {
          messageText = 'No messages yet.';
        } else {
          if (lastMessage.author === user.id) messageText += 'You: ';
          
          switch (lastMessage.type) {
            case 'file':
              messageText += 'Sent a file.';
              break;
            case 'image':
              messageText += 'Sent a picture.';
              break;
            default:
              messageText += lastMessage.content || '';
          }
        }
        
        const date = lastMessage ? moment(lastMessage.date).format('MMM D') : '';
        const time = lastMessage ? moment(lastMessage.date).format('h:mm A') : '';
        
        return (
          <div 
            key={`${group._id}-${hasUnreadMessages ? 'unread' : 'read'}`} // ENHANCED: Dynamic key for re-render
            className={`room uk-flex${hasUnreadMessages ? ' room-unread' : ''}`} // NEW: Add unread class
            onClick={() => handleGroupClick(group._id)}
          >
            <div className="profile">
              <Picture 
                group={true} 
                picture={group.picture} 
                title={group.title}
              />
            </div>
            <div className="text">
              <div className={`title${hasUnreadMessages ? ' highlight' : ''}`}> {/* NEW: Bold if unread */}
                {group.title.length > 20 ? `${group.title.substr(0, 20)}...` : group.title}
              </div>
              {/* NEW: Show last message preview */}
              <div className={`message${hasUnreadMessages ? ' highlight' : ''}`}>
                {messageText.length > 26 ? `${messageText.substr(0, 26)}...` : messageText}
              </div>
            </div>
            <div className="controls" hidden={!canCreateGroups}> {/* FIXED: Hide when no settings button */}
              <div className="date">
                {/* Show last message time or member count */}
                {lastMessage ? (
                  <>
                    {date}
                    <br />
                    {time}
                  </>
                ) : (
                  group.people ? `${group.people.length} member${group.people.length !== 1 ? 's' : ''}` : '0 members'
                )}
              </div>
            </div>
            {/* FIXED: Settings button with proper positioning */}
            {canCreateGroups && (
              <div className="controls">
                <div 
                  className="button"
                  onClick={(e) => handleGroupSettings(e, group._id)}
                  title="Manage group"
                  style={{ marginLeft: '8px' }}
                >
                  <FiSettings />
                </div>
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}

export default GroupList;