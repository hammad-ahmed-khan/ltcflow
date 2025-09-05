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

  // Permission logic
  const isGroupMember = group?.people?.some(member => member._id === user.id);
  const isManagerOrAbove = ['manager', 'admin', 'root'].includes(user.level);
  const canManageMembers = user.level === 'root' || (isManagerOrAbove && isGroupMember);
  
  // NEW: Delete permission - only root and admins can delete groups
  const canDeleteGroup = ['root', 'admin'].includes(user.level);

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
      await apiClient.post('/api/group/update-info', { 
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
      
      // Update group picture using the unified endpoint
      await apiClient.post('/api/group/update-info', {
        groupId: id,
        picture: uploadResult.data.image._id
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
      await apiClient.post('/api/group/update-info', {
        groupId: id,
        picture: null // Set to null to remove picture
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

  // NEW: Delete group functionality
  const deleteGroup = async () => {
    const groupTitle = group.title;
    
    // Double confirmation for destructive action
    const firstConfirm = window.confirm(
      `⚠️ DELETE GROUP: "${groupTitle}"\n\n` +
      `This will permanently delete:\n` +
      `• The group and all its messages\n` +
      `• All conversation history\n` +
      `• All shared files in this group\n\n` +
      `This action CANNOT be undone!\n\n` +
      `Type the group name to confirm deletion.`
    );
    
    if (!firstConfirm) return;
    
    // Ask user to type group name for confirmation
    const typedName = window.prompt(
      `To confirm deletion, please type the group name exactly:\n"${groupTitle}"`
    );
    
    if (typedName !== groupTitle) {
      showToast('Group name does not match. Deletion cancelled.', 'warning');
      return;
    }
    
    setLoading(prev => ({ ...prev, deleteGroup: true }));
    
    try {
      await apiClient.post('/api/group/delete', { 
        groupId: id 
      });
      
      showToast(`Group "${groupTitle}" has been permanently deleted`, 'success');
      
      // Refresh rooms list and navigate away
      await refreshGroup();
      navigate('/', { replace: true });
      
    } catch (err) {
      const message = err.response?.data?.message || 'Failed to delete group';
      showToast(message, 'error');
    } finally {
      setLoading(prev => ({ ...prev, deleteGroup: false }));
    }
  };

  if (!group || !canManageMembers) {
    const accessDeniedMessage = !group ? 
      'Group not found' : 
      user.level === 'user' ?
        'Only managers and administrators can manage group members.' :
        'You must be a member of this group to manage it.';
        
    return (
      <div className="group-manage">
        <div className="group-manage-header uk-flex uk-flex-between uk-flex-middle" style={{ padding: '16px' }}>
          <button 
            className="uk-button uk-button-link uk-flex uk-flex-middle" 
            onClick={() => navigate(-1)}
            style={{ padding: '0', color: '#666' }}
          >
            <FiArrowLeft style={{ marginRight: '8px' }} />
            Back
          </button>
        </div>
        <div className="uk-flex uk-flex-center uk-flex-middle" style={{ 
          height: '60vh', 
          textAlign: 'center',
          color: '#666',
          padding: '20px'
        }}>
          <div>
            <h3>Access Denied</h3>
            <p>{accessDeniedMessage}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="group-manage">
      {/* Header */}
      <div className="group-manage-header uk-flex uk-flex-between uk-flex-middle" style={{ padding: '16px', background: '#fff', borderBottom: '1px solid #eee' }}>
        <button 
          className="uk-button uk-button-link uk-flex uk-flex-middle" 
          onClick={() => navigate(-1)}
          style={{ padding: '0', color: '#666' }}
        >
          <FiArrowLeft style={{ marginRight: '8px' }} />
          Back
        </button>
        <h2 style={{ margin: 0, fontSize: '18px' }}>Manage Group</h2>
        <div style={{ width: '60px' }}></div> {/* Spacer for centering */}
      </div>

      {/* Group Info Section */}
      <div style={{ padding: '20px', background: '#fff', borderBottom: '1px solid #eee' }}>
        <div className="uk-flex uk-flex-middle" style={{ gap: '16px' }}>
          {/* Group Picture */}
          <div className="group-picture-container">
            <div 
              onClick={() => fileInputRef.current?.click()}
              style={{ 
                width: '80px', 
                height: '80px',
                cursor: 'pointer',
                position: 'relative',
                borderRadius: '50%',
                overflow: 'hidden'
              }}
              className="group-picture"
              title="Click to change group picture"
            >
              <Picture 
                group={true} 
                picture={group.picture} 
                title={group.title}
                style={{ width: '100%', height: '100%' }}
              />
              {loading.changePicture && (
                <div className="picture-overlay uk-flex uk-flex-center uk-flex-middle" style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  background: 'rgba(0,0,0,0.7)',
                  color: 'white',
                  fontSize: '12px'
                }}>
                  Updating...
                </div>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={(e) => {
                if (e.target.files?.[0]) {
                  changeGroupPicture(e.target.files[0]);
                }
              }}
              style={{ display: 'none' }}
            />
          </div>

          {/* Group Title */}
          <div style={{ flex: 1 }}>
            {editingTitle ? (
              <div className="uk-flex uk-flex-middle" style={{ gap: '8px' }}>
                <input
                  className="uk-input"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && updateGroupTitle()}
                  placeholder="Group name"
                  autoFocus
                  style={{ fontSize: '18px', fontWeight: '500' }}
                />
                <button
                  className="uk-button uk-button-primary uk-button-small"
                  onClick={updateGroupTitle}
                  disabled={loading.updateTitle}
                >
                  <FiSave />
                </button>
                <button
                  className="uk-button uk-button-default uk-button-small"
                  onClick={() => {
                    setEditingTitle(false);
                    setNewTitle(group.title);
                  }}
                >
                  <FiX />
                </button>
              </div>
            ) : (
              <div className="uk-flex uk-flex-middle" style={{ gap: '8px' }}>
                <h1 style={{ margin: 0, fontSize: '18px', fontWeight: '500' }}>
                  {group.title}
                </h1>
                <button
                  className="uk-button uk-button-link"
                  onClick={() => setEditingTitle(true)}
                  style={{ padding: '4px', color: '#666' }}
                  title="Edit group name"
                >
                  <FiEdit2 size={14} />
                </button>
              </div>
            )}
            <div style={{ fontSize: '14px', color: '#666', marginTop: '4px' }}>
              {group.people.length} member{group.people.length !== 1 ? 's' : ''}
            </div>
            {group.picture && (
              <button
                className="uk-button uk-button-link"
                onClick={removeGroupPicture}
                disabled={loading.removePicture}
                style={{ 
                  fontSize: '12px', 
                  color: '#d61314', 
                  padding: '2px 0',
                  marginTop: '4px'
                }}
              >
                {loading.removePicture ? 'Removing...' : 'Remove Picture'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Add Members Section */}
      {canManageMembers && (
        <div className="add-members-section" style={{ padding: '16px', background: '#f8f9fa', borderBottom: '1px solid #eee' }}>
          <button
            className="uk-button uk-button-primary uk-button-small uk-flex uk-flex-middle"
            onClick={() => setShowAddMembers(!showAddMembers)}
            style={{ marginBottom: showAddMembers ? '12px' : '0' }}
          >
            <FiUserPlus style={{ marginRight: '6px' }} />
            Add Members
          </button>

          {showAddMembers && (
            <div>
              <div className="search-bar" style={{ position: 'relative', marginBottom: '12px' }}>
                <FiSearch className="icon" />
                <input
                  ref={searchInputRef}
                  className="uk-input"
                  placeholder="Search users to add..."
                  value={searchQuery}
                  onChange={handleSearchChange}
                  style={{ paddingLeft: '40px', fontSize: '14px' }}
                />
              </div>

              {searchQuery && (
                <div style={{ maxHeight: '200px', overflowY: 'auto', background: '#fff', border: '1px solid #ddd', borderRadius: '4px' }}>
                  {filteredSearchResults.length > 0 ? (
                    filteredSearchResults.map(searchUser => (
                      <div
                        key={searchUser._id}
                        className="search-result-item uk-flex uk-flex-between uk-flex-middle"
                        style={{ padding: '8px 12px', borderBottom: '1px solid #eee' }}
                      >
                        <div className="uk-flex uk-flex-middle" style={{ gap: '8px' }}>
                          <div className="user-avatar" style={{ width: '32px', height: '32px' }}>
                            <Picture user={searchUser} />
                          </div>
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
                          className="uk-button uk-button-primary uk-button-small"
                          onClick={() => addMember(searchUser._id)}
                          disabled={loading[`add_${searchUser._id}`]}
                        >
                          {loading[`add_${searchUser._id}`] ? '...' : <FiUserPlus />}
                        </button>
                      </div>
                    ))
                  ) : (
                    <div style={{ padding: '16px', textAlign: 'center', color: '#666' }}>
                      No users found matching "{searchQuery}"
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Members List */}
      <div style={{ flex: 1, overflowY: 'auto', background: '#fff' }}>
        <div style={{ padding: '16px 16px 8px', fontSize: '14px', fontWeight: '500', color: '#666' }}>
          Members ({group.people.length})
        </div>
        <div>
          {group.people.map(member => (
            <div
              key={member._id}
              className="member-item uk-flex uk-flex-between uk-flex-middle"
              style={{ padding: '12px 16px', borderBottom: '1px solid #eee' }}
            >
              <div className="uk-flex uk-flex-middle" style={{ gap: '12px' }}>
                <div className="user-avatar" style={{ width: '40px', height: '40px' }}>
                  <Picture user={member} />
                </div>
                <div>
                  <div style={{ fontSize: '14px', fontWeight: '500' }}>
                    {member.firstName} {member.lastName}
                    {member._id === user.id && <span style={{ color: '#666', fontWeight: 'normal' }}> (You)</span>}
                  </div>
                  <div style={{ fontSize: '12px', color: '#666' }}>
                    @{member.username}
                  </div>
                </div>
              </div>
              <div>
                {(canManageMembers || member._id === user.id) && (
                  <button
                    className="uk-button uk-button-danger uk-button-small"
                    onClick={() => {
                      const isLeaving = member._id === user.id;
                      const action = isLeaving ? 'leave' : 'remove';
                      const name = isLeaving ? 'this group' : `${member.firstName} ${member.lastName}`;
                      
                      if (window.confirm(`Are you sure you want to ${action} ${name}?`)) {
                        removeMember(member._id);
                      }
                    }}
                    disabled={loading[`remove_${member._id}`]}
                    title={member._id === user.id ? "Leave group" : "Remove member"}
                  >
                    {loading[`remove_${member._id}`] ? '...' : <FiUserMinus />}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Group Actions - ENHANCED with Delete Group */}
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
          {/* Leave Group Button */}
          <button 
            className="uk-button uk-button-small uk-button-default"
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

          {/* NEW: Delete Group Button - Only for admins/root */}
          {canDeleteGroup && (
            <button 
              className="uk-button uk-button-small uk-button-danger"
              onClick={deleteGroup}
              disabled={loading.deleteGroup}
              title="Permanently delete this group and all its messages"
              style={{ whiteSpace: 'nowrap' }}
            >
              {loading.deleteGroup ? (
                <>
                  <div data-uk-spinner="ratio: 0.6" style={{ marginRight: '4px' }}></div>
                  Deleting...
                </>
              ) : (
                <>
                  <FiTrash2 style={{ marginRight: '4px' }} />
                  Delete Group
                </>
              )}
            </button>
          )}
        </div>
        
        {/* Permission Info */}
        <div style={{ fontSize: '12px', color: '#666', marginTop: '8px' }}>
          {canDeleteGroup ? (
            <>
              <strong>Admin privileges:</strong> You can delete this group permanently.
            </>
          ) : (
            <>
              Only administrators can delete groups. Contact an admin if this group needs to be removed.
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default GroupManage;