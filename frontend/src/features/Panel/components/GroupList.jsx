// frontend/src/features/Panel/components/GroupList.jsx
import React from 'react';
import { useSelector } from 'react-redux';
import { useGlobal } from 'reactn';
import { FiUsers, FiMessageCircle, FiSettings } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import Picture from '../../../components/Picture';
import './GroupList.sass';

function GroupList() {
  const rooms = useSelector((state) => state.io.rooms);
  const [user] = useGlobal('user');
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
              onClick={() => navigate('/create-group')}
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
      {userGroups.map(group => (
        <div 
          key={group._id} 
          className="room uk-flex"
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
            <div className="title">
              {group.title}
            </div>
          </div>
          <div className="controls">
            <div className="date">
              {group.people ? `${group.people.length} member${group.people.length !== 1 ? 's' : ''}` : '0 members'}
            </div>
          </div>        
          {canCreateGroups &&
          <div className="controls">
            <div 
              className="button"
              onClick={(e) => handleGroupSettings(e, group._id)}
              style={{ marginLeft: '4px' }}
              title="Manage group"
            >
              <FiSettings />
            </div>
          </div>
          }
        </div>
      ))}
    </>
  );
}

export default GroupList;