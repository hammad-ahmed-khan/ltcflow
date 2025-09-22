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
  const groupsWithNewMessages = useSelector((state) => state.messages.groupsWithNewMessages);
  const [user] = useGlobal('user');
  const setPanel = useGlobal('panel')[1];
  const navigate = useNavigate();

  // Updated filter: Include groups where user is either a member OR the creator
  const userGroups = rooms.filter(room => 
    room.isGroup && (
      // User is a member
      (room.people && room.people.some(person => person._id === user.id)) ||
      // User is the creator (even if not a member)
      (room.creator && room.creator._id === user.id)
    )
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

  console.log("GroupList - Unread groups:", groupsWithNewMessages);

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
        // Check user's relationship to the group
        const isGroupMember = group.people && group.people.some(person => person._id === user.id);
        const isCreator = group.creator && group.creator._id === user.id;
        
        // Only show unread indicator for groups where user is a member
        const hasUnreadMessages = isGroupMember && groupsWithNewMessages.includes(group._id);
        
        // Get last message info for groups (only for member groups)
        let { lastMessage } = group;
        let messageText = '';
        
        if (!isGroupMember) {
          // For creator-only groups, show different message
          messageText = 'Created by you (not joined)';
        } else if (!lastMessage) {
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
        
        const date = lastMessage && isGroupMember ? moment(lastMessage.date).format('MMM D') : '';
        const time = lastMessage && isGroupMember ? moment(lastMessage.date).format('h:mm A') : '';
        
        return (
          <div 
            key={`${group._id}-${hasUnreadMessages ? 'unread' : 'read'}`}
            className={`room uk-flex${hasUnreadMessages ? ' room-unread' : ''}${!isGroupMember ? ' room-creator-only' : ''}`}
            onClick={() => handleGroupClick(group._id)}
            style={{
              background: !isGroupMember ? '#f8f9fa' : undefined, // Subtle visual difference for creator-only groups
              borderLeft: !isGroupMember ? '3px solid #007bff' : undefined // Creator indicator
            }}
          >
            <div className="profile" style={{ position: 'relative' }}>
              <Picture 
                group={true} 
                picture={group.picture} 
                title={group.title}
              />
              {/* Creator badge overlay */}
              {isCreator && !isGroupMember && (
                <div style={{
                  position: 'absolute',
                  bottom: '-2px',
                  right: '-2px',
                  background: '#007bff',
                  color: 'white',
                  borderRadius: '50%',
                  width: '16px',
                  height: '16px',
                  fontSize: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 'bold',
                  border: '2px solid white',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
                }}>
                  👑
                </div>
              )}
            </div>
            <div className="text">
              <div className={`title${hasUnreadMessages ? ' highlight' : ''}`}>
                {group.title.length > 20 ? `${group.title.substr(0, 20)}...` : group.title}
              </div>
              <div className={`message${hasUnreadMessages ? ' highlight' : ''}`} style={{
                color: !isGroupMember ? '#007bff' : undefined,
                fontStyle: !isGroupMember ? 'italic' : 'normal'
              }}>
                {messageText.length > 36 ? `${messageText.substr(0, 36)}...` : messageText}
              </div>
            </div>
            <div className="controls">
              <div className="date">
                {/* Show different info based on membership */}
                {isGroupMember && lastMessage ? (
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
            {/* Settings button - show for creators or members with permissions */}
            {(canCreateGroups && (isGroupMember || isCreator)) && (
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