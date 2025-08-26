import React from 'react';
import { useSelector } from 'react-redux';
import { useGlobal } from 'reactn';
import { FiUsers, FiSettings } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import Picture from '../../../components/Picture';
import moment from 'moment';
import './GroupList.sass';

function GroupList() {
  const rooms = useSelector((state) => state.io.rooms);
  const [user] = useGlobal('user');
  const navigate = useNavigate();

  // Filter only groups the user belongs to
  const userGroups = rooms.filter(room => 
    room.isGroup && room.people && room.people.some(person => person._id === user.id)
  );

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
        <p style={{ marginBottom: '20px' }}>You're not a member of any groups yet.</p>
        <button
          className="uk-button uk-button-primary"
          onClick={() => navigate('/create-group')}
          style={{ marginTop: '12px' }}
        >
          Create Your First Group
        </button>
      </div>
    );
  }

  return (
    <div className="groups-list">
      {userGroups.map(group => (
        <div 
          key={group._id} 
          className="group-item uk-flex uk-flex-between uk-flex-middle"
          onClick={() => handleGroupClick(group._id)}
          style={{ 
            padding: '12px', 
            cursor: 'pointer',
            borderBottom: '1px solid #eee',
            transition: 'background-color 0.2s'
          }}
          onMouseEnter={(e) => e.target.style.backgroundColor = '#f8f9fa'}
          onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
        >
          <div className="uk-flex uk-flex-middle" style={{ gap: '12px' }}>
            <Picture 
              group={true} 
              picture={group.picture} 
              title={group.title}
            />
            <div>
              <div style={{ fontWeight: '500', fontSize: '14px' }}>
                {group.title}
              </div>
              <div style={{ fontSize: '12px', color: '#666' }}>
                {group.people ? group.people.length : 0} members
              </div>
              {group.lastMessage && (
                <div style={{ fontSize: '11px', color: '#999' }}>
                  Last message: {moment(group.lastMessage.date).fromNow()}
                </div>
              )}
            </div>
          </div>
          <div className="uk-flex" style={{ gap: '8px' }}>
            <button
              className="uk-button uk-button-small uk-button-default"
              onClick={(e) => handleGroupSettings(e, group._id)}
              style={{ padding: '4px 8px' }}
              title="Manage group members"
            >
              <FiSettings size={12} />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

export default GroupList;