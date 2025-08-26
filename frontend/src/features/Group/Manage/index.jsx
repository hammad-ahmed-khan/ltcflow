import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useGlobal } from 'reactn';
import { useSelector, useDispatch } from 'react-redux';
import { FiArrowLeft, FiUserPlus, FiUserMinus, FiEdit2, FiTrash2, FiSave, FiX } from 'react-icons/fi';
import { useToasts } from 'react-toast-notifications';
import Picture from '../../../components/Picture';
import search from '../../../actions/search';
import apiClient from '../../../api/apiClient';
import getRooms from '../../../actions/getRooms';
import Actions from '../../../constants/Actions';
import './GroupManage.sass';

function GroupManage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { addToast } = useToasts();
  
  const [user] = useGlobal('user');
  const rooms = useSelector((state) => state.io.rooms);
  const [searchResults] = useGlobal('searchResults');
  
  const [group, setGroup] = useState(null);
  const [showAddMembers, setShowAddMembers] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [loading, setLoading] = useState({});

  useEffect(() => {
    const currentGroup = rooms.find(room => room._id === id && room.isGroup);
    if (currentGroup) {
      setGroup(currentGroup);
      setNewTitle(currentGroup.title);
    }
  }, [id, rooms]);

  useEffect(() => {
    // Load initial search results for adding members
    search().then((res) => {
      // searchResults are managed globally
    }).catch(console.error);
  }, []);

  const refreshGroup = async () => {
    try {
      const res = await getRooms();
      dispatch({ type: Actions.SET_ROOMS, rooms: res.data.rooms });
    } catch (err) {
      console.error('Failed to refresh rooms:', err);
    }
  };

  const isGroupMember = group?.people?.some(member => member._id === user.id);
  const isAdmin = ['admin', 'root'].includes(user.level);
  const canManageMembers = isGroupMember || isAdmin;

  const showToast = (message, type = 'success') => {
    addToast(message, {
      appearance: type,
      autoDismiss: true,
    });
  };

  const addMember = async (userId) => {
    const userName = searchResults.find(u => u._id === userId)?.username || 'User';
    setLoading(prev => ({ ...prev, [`add_${userId}`]: true }));
    
    try {
      await apiClient.post('/api/group/add-member', { 
        groupId: id, 
        userId 
      });
      
      showToast(`${userName} added to group successfully`);
      await refreshGroup();
      setShowAddMembers(false);
    } catch (err) {
      const message = err.response?.data?.message || 'Failed to add member';
      showToast(message, 'error');
    } finally {
      setLoading(prev => ({ ...prev, [`add_${userId}`]: false }));
    }
  };

  const removeMember = async (userId) => {
    const member = group.people.find(m => m._id === userId);
    const memberName = member ? `${member.firstName} ${member.lastName}` : 'User';
    
    if (!window.confirm(`Remove ${memberName} from the group?`)) {
      return;
    }

    setLoading(prev => ({ ...prev, [`remove_${userId}`]: true }));
    
    try {
      await apiClient.post('/api/group/remove-member', { 
        groupId: id, 
        userId 
      });
      
      showToast(`${memberName} removed from group`);
      await refreshGroup();
    } catch (err) {
      const message = err.response?.data?.message || 'Failed to remove member';
      showToast(message, 'error');
    } finally {
      setLoading(prev => ({ ...prev, [`remove_${userId}`]: false }));
    }
  };

  const updateGroupTitle = async () => {
    if (!newTitle.trim() || newTitle.trim() === group.title) {
      setEditingTitle(false);
      setNewTitle(group.title);
      return;
    }

    setLoading(prev => ({ ...prev, updateTitle: true }));
    
    try {
      await apiClient.post('/api/group/update-info', {
        groupId: id,
        title: newTitle.trim()
      });
      
      showToast('Group name updated successfully');
      await refreshGroup();
      setEditingTitle(false);
    } catch (err) {
      const message = err.response?.data?.message || 'Failed to update group name';
      showToast(message, 'error');
    } finally {
      setLoading(prev => ({ ...prev, updateTitle: false }));
    }
  };

  if (!group) {
    return (
      <div className="group-manage uk-flex uk-flex-center uk-flex-middle" style={{ height: '100vh' }}>
        <div>Group not found or loading...</div>
      </div>
    );
  }

  if (!canManageMembers) {
    return (
      <div className="group-manage uk-flex uk-flex-center uk-flex-middle" style={{ height: '100vh' }}>
        <div style={{ textAlign: 'center' }}>
          <h3>Access Denied</h3>
          <p>You don't have permission to manage this group.</p>
          <button 
            className="uk-button uk-button-default"
            onClick={() => navigate(`/room/${id}`)}
          >
            Back to Group
          </button>
        </div>
      </div>
    );
  }

  const availableUsers = searchResults.filter(searchUser => 
    !group.people.some(member => member._id === searchUser._id)
  );

  return (
    <div className="group-manage uk-flex uk-flex-column" style={{ height: '100%' }}>
      {/* Header */}
      <div className="group-manage-header" style={{ 
        padding: '16px', 
        borderBottom: '1px solid #eee',
        background: '#fff'
      }}>
        <div className="uk-flex uk-flex-between uk-flex-middle">
          <div className="uk-flex uk-flex-middle" style={{ gap: '12px' }}>
            <button 
              className="uk-button uk-button-small uk-button-default"
              onClick={() => navigate(`/room/${id}`)}
            >
              <FiArrowLeft />
            </button>
            <div>
              {editingTitle ? (
                <div className="uk-flex uk-flex-middle" style={{ gap: '8px' }}>
                  <input
                    type="text"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && updateGroupTitle()}
                    style={{
                      border: '1px solid #ddd',
                      borderRadius: '4px',
                      padding: '4px 8px',
                      fontSize: '16px',
                      fontWeight: '500'
                    }}
                    autoFocus
                  />
                  <button
                    className="uk-button uk-button-small uk-button-primary"
                    onClick={updateGroupTitle}
                    disabled={loading.updateTitle}
                  >
                    <FiSave />
                  </button>
                  <button
                    className="uk-button uk-button-small uk-button-default"
                    onClick={() => {
                      setEditingTitle(false);
                      setNewTitle(group.title);
                    }}
                  >
                    <FiX />
                  </button>
                </div>
              ) : (
                <div>
                  <div className="uk-flex uk-flex-middle" style={{ gap: '8px' }}>
                    <span style={{ fontWeight: '500', fontSize: '16px' }}>{group.title}</span>
                    <button
                      className="uk-button uk-button-small uk-button-default"
                      onClick={() => setEditingTitle(true)}
                      title="Edit group name"
                    >
                      <FiEdit2 size={12} />
                    </button>
                  </div>
                  <div style={{ fontSize: '12px', color: '#666' }}>
                    Manage members and settings
                  </div>
                </div>
              )}
            </div>
          </div>
          <button 
            className="uk-button uk-button-primary uk-button-small"
            onClick={() => setShowAddMembers(!showAddMembers)}
          >
            <FiUserPlus style={{ marginRight: '4px' }} />
            Add Members
          </button>
        </div>
      </div>

      {/* Add Members Section */}
      {showAddMembers && (
        <div className="add-members-section" style={{ 
          background: '#f8f9fa', 
          borderBottom: '1px solid #eee',
          maxHeight: '300px',
          overflowY: 'auto'
        }}>
          <div style={{ padding: '12px', fontWeight: '500', borderBottom: '1px solid #ddd' }}>
            Add New Members ({availableUsers.length} available)
          </div>
          {availableUsers.length === 0 ? (
            <div style={{ padding: '20px', textAlign: 'center', color: '#666' }}>
              No additional users available to add
            </div>
          ) : (
            availableUsers.map(searchUser => (
              <div 
                key={searchUser._id}
                className="uk-flex uk-flex-between uk-flex-middle"
                style={{ padding: '12px', borderBottom: '1px solid #f0f0f0' }}
              >
                <div className="uk-flex uk-flex-middle" style={{ gap: '12px' }}>
                  <Picture user={searchUser} />
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: '500' }}>
                      {searchUser.firstName} {searchUser.lastName}
                    </div>
                    <div style={{ fontSize: '12px', color: '#666' }}>
                      @{searchUser.username}
                    </div>
                  </div>
                </div>
                <button
                  className="uk-button uk-button-small uk-button-primary"
                  onClick={() => addMember(searchUser._id)}
                  disabled={loading[`add_${searchUser._id}`]}
                  style={{ minWidth: '60px' }}
                >
                  {loading[`add_${searchUser._id}`] ? '...' : 'Add'}
                </button>
              </div>
            ))
          )}
        </div>
      )}

      {/* Current Members */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        <div style={{ 
          padding: '16px 12px', 
          fontWeight: '500', 
          borderBottom: '1px solid #eee',
          background: '#fff',
          position: 'sticky',
          top: 0,
          zIndex: 1
        }}>
          Current Members ({group.people.length})
        </div>
        
        <div className="members-list">
          {group.people.map(member => (
            <div 
              key={member._id}
              className="member-item uk-flex uk-flex-between uk-flex-middle"
              style={{ padding: '16px 12px', borderBottom: '1px solid #f0f0f0' }}
            >
              <div className="uk-flex uk-flex-middle" style={{ gap: '12px' }}>
                <Picture user={member} />
                <div>
                  <div style={{ fontSize: '14px', fontWeight: '500' }}>
                    {member.firstName} {member.lastName}
                    {member._id === user.id && (
                      <span style={{ color: '#666', fontWeight: 'normal' }}> (You)</span>
                    )}
                  </div>
                  <div style={{ fontSize: '12px', color: '#666' }}>
                    @{member.username}
                  </div>
                </div>
              </div>
              
              {member._id !== user.id && (
                <button
                  className="uk-button uk-button-small uk-button-danger"
                  onClick={() => removeMember(member._id)}
                  disabled={loading[`remove_${member._id}`]}
                  style={{ fontSize: '11px', padding: '4px 8px' }}
                  title="Remove from group"
                >
                  {loading[`remove_${member._id}`] ? '...' : <FiUserMinus />}
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Group Actions */}
      <div style={{ 
        padding: '16px', 
        borderTop: '1px solid #eee',
        background: '#f8f9fa'
      }}>
        <div style={{ fontSize: '14px', fontWeight: '500', marginBottom: '12px' }}>
          Group Actions
        </div>
        <div className="uk-flex" style={{ gap: '8px' }}>
          <button 
            className="uk-button uk-button-small uk-button-danger"
            onClick={() => {
              if (window.confirm(`Leave "${group.title}"? You can be re-added by other members.`)) {
                removeMember(user.id);
              }
            }}
            disabled={group.people.length === 1}
            title={group.people.length === 1 ? "Cannot leave - you're the only member" : "Leave this group"}
          >
            <FiUserMinus style={{ marginRight: '4px' }} />
            Leave Group
          </button>
        </div>
      </div>
    </div>
  );
}

export default GroupManage;