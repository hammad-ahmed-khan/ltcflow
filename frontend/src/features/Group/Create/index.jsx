import { useRef, useState, useEffect, useMemo } from 'react';
import { useGlobal } from 'reactn';
import { FiEdit2 } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import TopBar from './components/TopBar';
import SearchBar from './components/SearchBar';
import User from './components/User';
import Config from '../../../config';
import upload from '../../../actions/uploadImage';
import createGroup from '../../../actions/createGroup';
import search from '../../../actions/search';

function CreateGroup() {
  const setPanel = useGlobal('panel')[1];
  const [user] = useGlobal('user');
  const [searchResults] = useGlobal('searchResults');
  const [selectedUsers, setSelectedUsers] = useState([]); // Changed: Don't include user by default
  const [groupTitle, setGroupTitle] = useState('');
  const [groupPicture, setGroupPicture] = useState(null);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [includeCreator, setIncludeCreator] = useState(true);

  const fileInput = useRef(null);
  const navigate = useNavigate();

  // Calculate total member count dynamically
  const totalMemberCount = useMemo(() => {
    const selectedCount = selectedUsers.length;
    return includeCreator ? selectedCount + 1 : selectedCount;
  }, [selectedUsers.length, includeCreator]);

  // Load initial search results
  useEffect(() => {
    search().catch((err) => console.log(err));
  }, []);

  const onUserSelect = (userId) => {
    if (errors.members) {
      setErrors(prev => ({ ...prev, members: null }));
    }
    
    if (selectedUsers.includes(userId)) {
      setSelectedUsers(selectedUsers.filter(id => id !== userId));
    } else {
      setSelectedUsers([...selectedUsers, userId]);
    }
  };

  const changePicture = async (image) => {
    try {
      const picture = await upload(image, null, () => {}, 'square');
      setGroupPicture(picture.data.image);
    } catch (err) {
      setErrors(prev => ({ ...prev, picture: 'Image upload failed. Please try again.' }));
    }
  };

  const validateForm = () => {
    const newErrors = {};
    
    if (!groupTitle.trim()) {
      newErrors.title = 'Please enter a group name.';
    } else if (groupTitle.trim().length < 2) {
      newErrors.title = 'Group name must be at least 2 characters long.';
    } else if (groupTitle.trim().length > 50) {
      newErrors.title = 'Group name cannot exceed 50 characters.';
    }
    
    // Updated validation: Check if total member count is 0
    if (totalMemberCount === 0) {
      newErrors.members = 'Select at least one member or include yourself in the group.';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const createNewGroup = async () => {
    if (!validateForm()) return;

    setLoading(true);
    
    try {
      // Prepare the final people array based on includeCreator
      let finalPeople = [...selectedUsers];
      if (includeCreator && !finalPeople.includes(user.id)) {
        finalPeople.push(user.id);
      }

      const res = await createGroup({ 
        people: finalPeople, 
        picture: groupPicture, 
        title: groupTitle.trim(),
        includeCreator: includeCreator
      });
      
      setPanel('standard');
      navigate(`/room/${res.data._id}`, { replace: true });
    } catch (err) {
      setErrors(prev => ({ 
        ...prev, 
        submit: 'Unable to create the group at this time. Please try again later.' 
      }));
    } finally {
      setLoading(false);
    }
  };

  const canCreate = groupTitle.trim() && totalMemberCount > 0;

  const handleTitleChange = (e) => {
    setGroupTitle(e.target.value);
    if (errors.title) {
      setErrors(prev => ({ ...prev, title: null }));
    }
  };

  return (
    <div className="group-create uk-flex uk-flex-column" style={{ height: '100%' }}>
      <TopBar />
      
      {/* Group Info Section */}
      <div style={{ padding: '16px', borderBottom: '1px solid #eee' }}>
        <div className="uk-flex uk-flex-column uk-flex-center" style={{ gap: '16px', alignItems: 'center' }}>
          {/* Group Picture */}
          <div 
            className="group-picture"
            onClick={() => fileInput.current?.click()}
            style={{ 
              width: '80px', 
              height: '80px', 
              borderRadius: '40px',
              background: groupPicture ? 'none' : '#666',
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              position: 'relative',
              fontSize: '24px',
              flexShrink: 0
            }}
          >
            {groupPicture ? (
              <img 
                src={`${Config.url}/api/images/${groupPicture.shieldedID}/256`} 
                alt="Group"
                style={{ width: '100%', height: '100%', borderRadius: '40px', objectFit: 'cover' }}
              />
            ) : (
              groupTitle ? groupTitle.charAt(0).toUpperCase() : 'G'
            )}
            <div style={{
              position: 'absolute',
              bottom: '-2px',
              right: '-2px',
              background: '#007bff',
              color: 'white',
              borderRadius: '50%',
              width: '24px',
              height: '24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <FiEdit2 size={12} />
            </div>
          </div>
          
          {/* Group Name Input */}
          <div style={{ width: '100%' }}>
            <input
              type="text"
              placeholder="Enter a group name"
              value={groupTitle}
              onChange={handleTitleChange}
              style={{
                width: '100%',
                padding: '12px 0px',
                border: `1px solid ${errors.title ? '#c62828' : '#ddd'}`,
                borderRadius: '8px',
                fontSize: '16px',
                outline: 'none',
                transition: 'border-color 0.2s ease'
              }}
              onFocus={(e) => {
                if (!errors.title) e.target.style.borderColor = '#007bff';
              }}
              onBlur={(e) => {
                if (!errors.title) e.target.style.borderColor = '#ddd';
              }}
            />
            {errors.title && (
              <div style={{ 
                color: '#c62828', 
                fontSize: '12px', 
                marginTop: '4px',
                textAlign: 'left'
              }}>
                {errors.title}
              </div>
            )}
          </div>
        </div>
        
        {errors.picture && (
          <div style={{ 
            color: '#c62828', 
            fontSize: '12px', 
            marginTop: '8px',
            textAlign: 'center'
          }}>
            {errors.picture}
          </div>
        )}
        
        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          onChange={(e) => changePicture(e.target.files[0])}
          style={{ display: 'none' }}
        />
      </div>

      {/* Member Selection */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div style={{ 
          padding: '12px 16px', 
          background: '#ffffff',
          borderBottom: errors.members ? '2px solid #c62828' : '1px solid #eee'
        }}>
          <div className="uk-flex uk-flex-between uk-flex-middle" style={{ marginBottom: '8px' }}>
            <div>
              <div style={{ fontSize: '14px', fontWeight: '500', marginBottom: '4px' }}>
                Add Group Members
              </div>
              {/* Updated count display with better spacing */}
              {selectedUsers.length > 0 && (
                <div style={{ fontSize: '12px', color: '#666', lineHeight: '1.4' }}>
                  {selectedUsers.length} selected
                  {includeCreator && (
                    <span> + you = <strong style={{ color: '#007bff' }}>{totalMemberCount} total</strong></span>
                  )}
                  {!includeCreator && (
                    <span>, you won't be included</span>
                  )}
                </div>
              )}
            </div>
            {selectedUsers.length > 0 && (
              <button
                className="uk-button uk-button-small uk-button-default"
                onClick={() => setSelectedUsers([])}
                style={{ 
                  fontSize: '11px', 
                  padding: '6px 12px',
                  height: 'auto',
                  lineHeight: '1.2'
                }}
              >
                Clear Selection
              </button>
            )}
          </div>

          {errors.members && (
            <div style={{ 
              color: '#c62828', 
              fontSize: '12px', 
              marginTop: '4px'
            }}>
              {errors.members}
            </div>
          )}

          {/* Creator Inclusion Checkbox */}
          <div className="uk-margin" style={{ marginTop: '12px' }}>
            <label>
              <input 
                className="uk-checkbox uk-margin-small-right" 
                type="checkbox" 
                checked={includeCreator}
                onChange={(e) => setIncludeCreator(e.target.checked)}
              />
              Include me as a group member
            </label>
            <div className="uk-text-small uk-text-muted uk-margin-small-top">
              {includeCreator ? 
                "You'll be added to the group and can participate in conversations" : 
                "You'll create the group but won't be a member (you can still manage it)"
              }
            </div>
          </div>

          {/* Member Count Summary */}
          {(selectedUsers.length > 0 || includeCreator) && (
            <div style={{ 
              background: '#f8f9fa', 
              padding: '8px', 
              borderRadius: '4px', 
              fontSize: '12px',
              marginTop: '8px'
            }}>
              <strong>Total Members: {totalMemberCount}</strong>
              {selectedUsers.length === 0 && includeCreator && <span> (just you)</span>}
              {totalMemberCount === 0 && (
                <span style={{ color: '#c62828' }}> - Please select members or include yourself</span>
              )}
            </div>
          )}
        </div>

        <SearchBar />
        
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
          {searchResults && searchResults.length > 0 ? (
            searchResults
              .filter(u => u._id !== user.id)
              .map(searchUser => (
                <User
                  key={searchUser._id}
                  user={searchUser}
                  selected={selectedUsers.includes(searchUser._id)}
                  onSelect={() => onUserSelect(searchUser._id)}
                />
              ))
          ) : (
            <div style={{ 
              textAlign: 'center', 
              color: '#666', 
              padding: '24px',
              fontSize: '14px'
            }}>
              No results found. Try searching for members to add.
            </div>
          )}
        </div>
      </div>

      {errors.submit && (
        <div style={{ 
          padding: '12px 16px', 
          background: '#ffebee', 
          color: '#c62828', 
          fontSize: '14px',
          textAlign: 'center',
          borderTop: '1px solid #ffcdd2'
        }}>
          {errors.submit}
        </div>
      )}

      {/* Create Button */}
      <div style={{ padding: '16px', background: '#fff', borderTop: '1px solid #eee' }}>
        <button
          className="uk-button uk-button-primary uk-width-1-1"
          onClick={createNewGroup}
          disabled={loading || !canCreate}
          style={{ 
            height: '48px',
            fontSize: '16px',
            opacity: (loading || !canCreate) ? 0.6 : 1,
            cursor: (loading || !canCreate) ? 'not-allowed' : 'pointer',
            transition: 'opacity 0.2s ease'
          }}
        >
          {loading ? (
            'Creating group...'
          ) : totalMemberCount === 0 ? (
            'Select members to continue'
          ) : (
            `Create Group (${totalMemberCount} Member${totalMemberCount !== 1 ? 's' : ''})`
          )}
        </button>
        
        <div style={{ 
          textAlign: 'center', 
          fontSize: '12px', 
          color: '#666',
          marginTop: '8px'
        }}>
          {!groupTitle.trim() && totalMemberCount === 0 ? (
            'Enter a group name and select members to get started.'
          ) : !groupTitle.trim() ? (
            'Please enter a group name to continue.'
          ) : totalMemberCount === 0 ? (
            'Please select at least one member or include yourself.'
          ) : (
            `Ready to create a group with ${totalMemberCount} member${totalMemberCount !== 1 ? 's' : ''}.`
          )}
        </div>
      </div>
    </div>
  );
}

export default CreateGroup;