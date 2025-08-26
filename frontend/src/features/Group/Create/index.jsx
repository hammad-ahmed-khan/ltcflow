import { useRef, useState, useEffect } from 'react';
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
  const [selectedUsers, setSelectedUsers] = useState([user.id]);
  const [groupTitle, setGroupTitle] = useState('');
  const [groupPicture, setGroupPicture] = useState(null);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  
  const fileInput = useRef(null);
  const navigate = useNavigate();

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
    
    const selectedCount = selectedUsers.length - 1; // Exclude self
    if (selectedCount === 0) {
      newErrors.members = 'Select at least one member to create a group.';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const createNewGroup = async () => {
    if (!validateForm()) return;

    setLoading(true);
    
    try {
      const res = await createGroup({ 
        people: selectedUsers, 
        picture: groupPicture, 
        title: groupTitle.trim() 
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

  const selectedCount = selectedUsers.length - 1;
  const canCreate = groupTitle.trim() && selectedCount > 0;

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
          background: '#f8f9fa',
          borderBottom: errors.members ? '2px solid #c62828' : '1px solid #eee'
        }}>
          <div className="uk-flex uk-flex-between uk-flex-middle">
            <span style={{ fontSize: '14px', fontWeight: '500' }}>
              Add Group Members {selectedCount > 0 ? `(${selectedCount} selected)` : ''}
            </span>
            {selectedCount > 0 && (
              <button
                className="uk-button uk-button-small uk-button-default"
                onClick={() => setSelectedUsers([user.id])}
                style={{ fontSize: '11px', padding: '4px 8px' }}
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
          ) : selectedCount === 0 ? (
            'Select members to continue'
          ) : (
            `Create Group (${selectedCount} Members)`
          )}
        </button>
        
        <div style={{ 
          textAlign: 'center', 
          fontSize: '12px', 
          color: '#666',
          marginTop: '8px'
        }}>
          {!groupTitle.trim() && selectedCount === 0 ? (
            'Enter a group name and select members to get started.'
          ) : !groupTitle.trim() ? (
            'Please enter a group name to continue.'
          ) : selectedCount === 0 ? (
            'Please select at least one member to continue.'
          ) : (
            `Ready to create a group with ${selectedCount} members.`
          )}
        </div>
      </div>
    </div>
  );
}

export default CreateGroup;
