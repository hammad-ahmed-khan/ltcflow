import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useGlobal } from 'reactn';
import { useSelector, useDispatch } from 'react-redux';
import { FiArrowLeft, FiUserPlus, FiUserMinus, FiEdit2, FiTrash2, FiSave, FiX, FiSearch, FiCamera } from 'react-icons/fi';
import { useToasts } from 'react-toast-notifications';
import Picture from '../../../components/Picture';
import search from '../../../actions/search';
import apiClient from '../../../api/apiClient';
import getRooms from '../../../actions/getRooms';
import upload from '../../../actions/uploadImage';
import Actions from '../../../constants/Actions';
import './GroupManage.sass';

function GroupManage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { addToast } = useToasts();
  
  const [user] = useGlobal('user');
  const rooms = useSelector((state) => state.io.rooms);
  const [searchResults, setSearchResults] = useGlobal('searchResults');
  
  const [group, setGroup] = useState(null);
  const [showAddMembers, setShowAddMembers] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [loading, setLoading] = useState({});
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredSearchResults, setFilteredSearchResults] = useState([]);

  const searchInputRef = useRef();
  const fileInputRef = useRef();

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
      setSearchResults(res.data.users);
    }).catch(console.error);
  }, []);

  // Filter search results based on query and exclude current members
  useEffect(() => {
    if (!searchResults || !group) return;
    
    let filtered = searchResults;
    
    // Exclude current group members
    const memberIds = group.people.map(member => member._id);
    filtered = filtered.filter(user => !memberIds.includes(user._id));
    
    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(user => 
        user.firstName?.toLowerCase().includes(query) ||
        user.lastName?.toLowerCase().includes(query) ||
        user.username?.toLowerCase().includes(query)
      );
    }
    
    setFilteredSearchResults(filtered);
  }, [searchResults, searchQuery, group]);

  const refreshGroup = async () => {
    try {
      const res = await getRooms();
      dispatch({ type: Actions.SET_ROOMS, rooms: res.data.rooms });
    } catch (err) {
      console.error('Failed to refresh rooms:', err);
    }
  };

 

  // frontend/src/features/Group/Manage/index.jsx
// Replace the existing permission logic (around line 45-50) with this:

// Updated permission logic - only managers, admins, and root can manage members
const isGroupMember = group?.people?.some(member => member._id === user.id);
const isManagerOrAbove = ['manager', 'admin', 'root'].includes(user.level);

// Root can manage globally, managers/admins need to be group members  
const canManageMembers = user.level === 'root' || (isManagerOrAbove && isGroupMember);

// Note: Users can still leave groups (self-removal) regardless of their level
// This is handled separately in the UI and backend

  const showToast = (message, type = 'success') => {
    addToast(message, {
      appearance: type,
      autoDismiss: true,
    });
  };

  const handleSearchChange = (e) => {
    const value = e.target.value;
    setSearchQuery(value);
    
    // Perform live search
    if (value.trim()) {
      search(value).then((res) => {
        setSearchResults(res.data.users);
      }).catch(console.error);
    }
  };

  const addMember = async (userId) => {
    const userName = filteredSearchResults.find(u => u._id === userId)?.username || 'User';
    setLoading(prev => ({ ...prev, [`add_${userId}`]: true }));
    
    try {
      await apiClient.post('/api/group/add-member', { 
        groupId: id, 
        userId 
      });
      
      showToast(`${userName} added to group successfully`);
      await refreshGroup();
      setSearchQuery(''); // Clear search
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
    setLoading(prev => ({ ...prev, [`remove_${userId}`]: true }));
    
    try {
      await apiClient.post('/api/group/remove-member', { 
        groupId: id, 
        userId 
      });
      
      if (userId === user.id) {
        showToast('Left group successfully');
        navigate('/');
      } else {
        showToast(`${memberName} removed from group`);
        await refreshGroup();
      }
    } catch (err) {
      const message = err.response?.data?.message || 'Failed to remove member';
      showToast(message, 'error');
    } finally {
      setLoading(prev => ({ ...prev, [`remove_${userId}`]: false }));
    }
  };

  const updateGroupTitle = async () => {
    if (!newTitle.trim()) {
      showToast('Group name cannot be empty', 'error');
      return;
    }
    
    setLoading(prev => ({ ...prev, updateTitle: true }));
    
    try {
      await apiClient.post('/api/group/update-title', { 
        groupId: id, 
        title: newTitle.trim() 
      });
      
      showToast('Group name updated successfully');
      setEditingTitle(false);
      await refreshGroup();
    } catch (err) {
      const message = err.response?.data?.message || 'Failed to update group name';
      showToast(message, 'error');
    } finally {
      setLoading(prev => ({ ...prev, updateTitle: false }));
    }
  };

  const changeGroupPicture = async (imageFile) => {
    setLoading(prev => ({ ...prev, changePicture: true }));
    
    try {
      // Upload the image
      const uploadResult = await upload(imageFile, null, () => {}, 'square');
      
      // Update group picture
      await apiClient.post('/api/group/update-picture', {
        groupId: id,
        pictureId: uploadResult.data.image._id
      });
      
      showToast('Group picture updated successfully');
      await refreshGroup();
    } catch (err) {
      const message = err.response?.data?.message || 'Failed to update group picture';
      showToast(message, 'error');
    } finally {
      setLoading(prev => ({ ...prev, changePicture: false }));
    }
  };

  const removeGroupPicture = async () => {
    const confirmed = window.confirm("Are you sure you want to remove the group picture?");
    if (!confirmed) return;

    setLoading(prev => ({ ...prev, removePicture: true }));
    
    try {
      await apiClient.post('/api/group/remove-picture', {
        groupId: id
      });
      
      showToast('Group picture removed successfully');
      await refreshGroup();
    } catch (err) {
      const message = err.response?.data?.message || 'Failed to remove group picture';
      showToast(message, 'error');
    } finally {
      setLoading(prev => ({ ...prev, removePicture: false }));
    }
  };

// Replace the access denied section in GroupManage.jsx with this more descriptive message:

if (!group || !canManageMembers) {
  const accessDeniedMessage = !group ? 
    'Group not found' : 
    user.level === 'user' ? 
      'Access denied: Only managers and administrators can manage group members' :
      'Access denied: You must be a member of this group to manage it';

  return (
    <div style={{ 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center', 
      height: '100%',
      flexDirection: 'column',
      gap: '16px',
      padding: '20px',
      textAlign: 'center'
    }}>
      <div style={{ fontSize: '16px', color: '#666' }}>
        {accessDeniedMessage}
      </div>
      {user.level === 'user' && group && (
        <div style={{ fontSize: '14px', color: '#999', maxWidth: '400px' }}>
          Standard users can participate in groups but cannot add or remove members. 
          Contact a manager or administrator if you need to modify group membership.
        </div>
      )}
      <button 
        className="uk-button uk-button-primary"
        onClick={() => navigate('/')}
      >
        <FiArrowLeft style={{ marginRight: '8px' }} />
        Go Back
      </button>
    </div>
  );
}

  return (
    <div className="group-manage uk-flex uk-flex-column" style={{ height: '100%' }}>
      {/* Hidden file input for group picture */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={(e) => {
          const file = e.target.files[0];
          if (file) {
            changeGroupPicture(file);
          }
        }}
      />

      {/* Header */}
      <div className="group-manage-header" style={{ 
        padding: '16px', 
        borderBottom: '1px solid #eee',
        background: '#fff',
        flexShrink: 0
      }}>
        {/* Top row with back button and add members button */}
        <div className="uk-flex uk-flex-between uk-flex-middle" style={{ marginBottom: '16px' }}>
          <button 
            className="uk-button uk-button-small uk-button-default"
            onClick={() => navigate(-1)}
            style={{ padding: '8px 12px' }}
          >
            <FiArrowLeft style={{ marginRight: '4px' }} />
            Back
          </button>

          <button
            className="uk-button uk-button-small uk-button-primary"
            onClick={() => setShowAddMembers(!showAddMembers)}
            style={{ padding: '8px 12px' }}
          >
            <FiUserPlus style={{ marginRight: '4px' }} />
            <span className="uk-visible@s">Add Members</span>
          </button>
        </div>

        {/* Group info section with picture and title */}
        <div className="uk-flex uk-flex-middle" style={{ gap: '16px' }}>
          {/* Group Picture */}
          <div className="group-picture-container" style={{ position: 'relative' }}>
            <div 
              className="group-picture"
              style={{
                width: '80px',
                height: '80px',
                cursor: 'pointer',
                position: 'relative',
                borderRadius: '40px',
                overflow: 'hidden',
                border: '2px solid #e0e0e0',
                transition: 'all 0.2s ease'
              }}
              onClick={() => fileInputRef.current?.click()}
              onMouseOver={(e) => {
                const overlay = e.currentTarget.querySelector('.picture-overlay');
                if (overlay) overlay.style.opacity = '0.8';
              }}
              onMouseOut={(e) => {
                const overlay = e.currentTarget.querySelector('.picture-overlay');
                if (overlay) overlay.style.opacity = '0';
              }}
            >
              {/* Picture component scaled appropriately */}
              <div style={{ width: '76px', height: '76px', transform: 'scale(1.9)' }}>
                <Picture 
                  group={true} 
                  picture={group.picture} 
                  title={group.title} 
                />
              </div>
              
              {/* Hover overlay */}
              <div 
                className="picture-overlay"
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  background: 'rgba(0, 0, 0, 0.6)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: 0,
                  transition: 'opacity 0.2s ease',
                  borderRadius: '40px'
                }}
              >
                {loading.changePicture ? (
                  <div style={{ color: '#fff', fontSize: '12px' }}>Updating...</div>
                ) : (
                  <FiCamera style={{ color: '#fff', fontSize: '20px' }} />
                )}
              </div>
            </div>
            
            {/* Picture actions */}
            {group.picture && (
              <button
                className="uk-button uk-button-small uk-button-danger"
                onClick={(e) => {
                  e.stopPropagation();
                  removeGroupPicture();
                }}
                disabled={loading.removePicture}
                style={{
                  position: 'absolute',
                  top: '-4px',
                  right: '-4px',
                  width: '24px',
                  height: '24px',
                  borderRadius: '12px',
                  padding: '0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '10px',
                  background: '#dc3545',
                  border: '2px solid #fff'
                }}
                title="Remove group picture"
              >
                {loading.removePicture ? '...' : <FiX />}
              </button>
            )}
          </div>

          {/* Group Title Section */}
          <div style={{ flex: 1, minWidth: 0 }}>
            {editingTitle ? (
              <div className="uk-flex uk-flex-middle" style={{ gap: '8px' }}>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  style={{ 
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    padding: '8px 12px',
                    fontSize: '18px',
                    fontWeight: '500',
                    minWidth: '200px',
                    flex: 1
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') updateGroupTitle();
                    if (e.key === 'Escape') {
                      setEditingTitle(false);
                      setNewTitle(group.title);
                    }
                  }}
                  autoFocus
                />
                <button
                  className="uk-button uk-button-small uk-button-primary"
                  onClick={updateGroupTitle}
                  disabled={loading.updateTitle}
                  style={{ padding: '6px 10px' }}
                >
                  {loading.updateTitle ? '...' : <FiSave />}
                </button>
                <button
                  className="uk-button uk-button-small uk-button-default"
                  onClick={() => {
                    setEditingTitle(false);
                    setNewTitle(group.title);
                  }}
                  style={{ padding: '6px 10px' }}
                >
                  <FiX />
                </button>
              </div>
            ) : (
              <div>
                <div 
                  className="uk-flex uk-flex-middle" 
                  style={{ 
                    gap: '8px', 
                    cursor: 'pointer',
                    padding: '4px 8px',
                    borderRadius: '4px',
                    transition: 'background 0.2s',
                    marginBottom: '4px'
                  }}
                  onClick={() => setEditingTitle(true)}
                  onMouseOver={(e) => e.target.closest('div').style.background = '#f8f9fa'}
                  onMouseOut={(e) => e.target.closest('div').style.background = 'transparent'}
                >
                  <span style={{ 
                    fontSize: '20px', 
                    fontWeight: '600',
                    color: '#333'
                  }}>
                    {group.title}
                  </span>
                  <FiEdit2 style={{ fontSize: '14px', color: '#666' }} />
                </div>
                <div style={{ 
                  fontSize: '13px', 
                  color: '#666',
                  paddingLeft: '8px'
                }}>
                  {group.people.length} member{group.people.length !== 1 ? 's' : ''}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Add Members Section */}
      {showAddMembers && (
        <div className="add-members-section" style={{ 
          borderBottom: '1px solid #eee',
          background: '#f8f9fa',
          flexShrink: 0
        }}>
          {/* Search Bar */}
          <div style={{ padding: '16px 16px 8px 16px' }}>
            <div className="search-bar uk-flex uk-flex-center uk-flex-middle" style={{
              background: '#fff',
              border: '1px solid #ddd',
              borderRadius: '25px',
              padding: '0',
              height: '40px'
            }}>
              <div 
                className="icon" 
                onClick={() => searchInputRef.current?.focus()}
                style={{
                  padding: '0 12px',
                  color: '#666',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center'
                }}
              >
                <FiSearch />
              </div>
              <input
                ref={searchInputRef}
                className="uk-input"
                placeholder="Search users to add..."
                value={searchQuery}
                onChange={handleSearchChange}
                style={{
                  background: 'transparent',
                  border: 'none',
                  borderRadius: '0',
                  outline: 'none',
                  boxShadow: 'none',
                  flexGrow: 1,
                  padding: '0 12px 0 0'
                }}
              />
            </div>
          </div>

          {/* Search Results */}
          <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
            {filteredSearchResults.length > 0 ? (
              filteredSearchResults.slice(0, 10).map(searchUser => (
                <div
                  key={searchUser._id}
                  className="uk-flex uk-flex-between uk-flex-middle"
                  style={{ 
                    padding: '12px 16px', 
                    borderBottom: '1px solid #f0f0f0',
                    background: '#fff',
                    margin: '0 16px 1px 16px',
                    borderRadius: '4px'
                  }}
                >
                  <div className="uk-flex uk-flex-middle" style={{ gap: '12px', flex: 1, minWidth: 0 }}>
                    <div style={{ flexShrink: 0, width: '32px', height: '32px' }}>
                      <Picture user={searchUser} />
                    </div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ 
                        fontSize: '14px', 
                        fontWeight: '500',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                      }}>
                        {searchUser.firstName} {searchUser.lastName}
                      </div>
                      <div style={{ 
                        fontSize: '12px', 
                        color: '#666',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                      }}>
                        @{searchUser.username}
                      </div>
                    </div>
                  </div>
                  
                  <button
                    className="uk-button uk-button-small uk-button-primary"
                    onClick={() => addMember(searchUser._id)}
                    disabled={loading[`add_${searchUser._id}`]}
                    style={{ 
                      fontSize: '11px', 
                      padding: '6px 12px',
                      flexShrink: 0,
                      marginLeft: '8px'
                    }}
                    title="Add to group"
                  >
                    {loading[`add_${searchUser._id}`] ? '...' : <FiUserPlus />}
                  </button>
                </div>
              ))
            ) : (
              <div style={{ 
                padding: '24px 16px', 
                textAlign: 'center', 
                color: '#666',
                fontSize: '14px'
              }}>
                {searchQuery.trim() 
                  ? `No users found for "${searchQuery}"`
                  : 'Start typing to search for users to add'
                }
              </div>
            )}
          </div>
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
              <div className="uk-flex uk-flex-middle" style={{ gap: '12px', flex: 1, minWidth: 0 }}>
                <div style={{ flexShrink: 0, width: '40px', height: '40px' }}>
                  <Picture user={member} />
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ 
                    fontSize: '14px', 
                    fontWeight: '500',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  }}>
                    {member.firstName} {member.lastName}
                    {member._id === user.id && (
                      <span style={{ color: '#666', fontWeight: 'normal' }}> (You)</span>
                    )}
                  </div>
                  <div style={{ 
                    fontSize: '12px', 
                    color: '#666',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  }}>
                    @{member.username}
                  </div>
                </div>
              </div>
              
              {member._id !== user.id && (
                <button
                  className="uk-button uk-button-small uk-button-danger"
                  onClick={() => removeMember(member._id)}
                  disabled={loading[`remove_${member._id}`]}
                  style={{ 
                    fontSize: '11px', 
                    padding: '6px 8px',
                    flexShrink: 0,
                    marginLeft: '8px'
                  }}
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
        background: '#f8f9fa',
        flexShrink: 0
      }}>
        <div style={{ fontSize: '14px', fontWeight: '500', marginBottom: '12px' }}>
          Group Actions
        </div>
        <div className="uk-flex uk-flex-wrap" style={{ gap: '8px' }}>
          <button 
            className="uk-button uk-button-small uk-button-danger"
            onClick={() => {
              if (window.confirm(`Leave "${group.title}"? You can be re-added by other members.`)) {
                removeMember(user.id);
              }
            }}
            disabled={group.people.length === 1}
            title={group.people.length === 1 ? "Cannot leave - you're the only member" : "Leave this group"}
            style={{ whiteSpace: 'nowrap' }}
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