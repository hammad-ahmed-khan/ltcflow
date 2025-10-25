import { useRef, useState, useEffect, useMemo } from 'react';
import { useGlobal } from 'reactn';
import { FiEdit2, FiUsers, FiSearch, FiX } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import TopBar from './components/TopBar';
import User from './components/User';
import Config from '../../../config';
import upload from '../../../actions/uploadImage';
import createGroup from '../../../actions/createGroup';
import search from '../../../actions/search';
import './CreateGroup.sass'; // Import the main styles

function CreateGroup() {
  const setPanel = useGlobal('panel')[1];
  const [user] = useGlobal('user');
  const [searchResults, setSearchResults] = useGlobal('searchResults');
  const [selectedUsers, setSelectedUsers] = useState([]);
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

  // Filter search results based on search query
  const filteredSearchResults = useMemo(() => {
    if (!searchResults) return [];
    
    const filtered = searchResults.filter(u => u._id !== user.id);
    
    // The SearchBar component handles the search filtering via API calls
    // so we just need to exclude the current user
    return filtered;
  }, [searchResults, user.id]);

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
      setLoading(true);
      const picture = await upload(image, null, () => {}, 'square');
      setGroupPicture(picture.data.image);
      if (errors.picture) {
        setErrors(prev => ({ ...prev, picture: null }));
      }
    } catch (err) {
      setErrors(prev => ({ ...prev, picture: 'Image upload failed. Please try again.' }));
    } finally {
      setLoading(false);
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

  const canCreate = groupTitle.trim() && totalMemberCount > 0 && !loading;

  const handleTitleChange = (e) => {
    setGroupTitle(e.target.value);
    if (errors.title) {
      setErrors(prev => ({ ...prev, title: null }));
    }
  };

  const clearSelection = () => {
    setSelectedUsers([]);
  };

  return (
    <div className="group-create">
      <TopBar />
      
      {/* Group Info Section - Fixed Header */}
      <div className="group-info-section">
        <div className="group-picture-section">
          {/* Group Picture */}
          <div 
            className="group-picture-upload"
            onClick={() => fileInput.current?.click()}
          >
            {groupPicture ? (
              <img 
                src={`${Config.url}/api/images/${groupPicture.shieldedID}/256`} 
                alt="Group"
                className="group-picture-image"
              />
            ) : (
              <div className="group-picture-placeholder">
                <FiUsers size={32} />
              </div>
            )}
            <div className="edit-overlay">
              <FiEdit2 size={12} />
            </div>
          </div>

          {/* Group Title Input */}
          <div className="group-title-section">
            <input
              className={`group-title-input ${errors.title ? 'error' : ''}`}
              type="text"
              placeholder="Enter group name"
              value={groupTitle}
              onChange={handleTitleChange}
              maxLength={50}
            />
            {errors.title && (
              <div className="error-message">
                {errors.title}
              </div>
            )}
          </div>

          <input
            type="file"
            ref={fileInput}
            accept="image/*"
            onChange={(e) => e.target.files[0] && changePicture(e.target.files[0])}
            style={{ display: 'none' }}
          />
        </div>

        {/* Member Selection Summary */}
        <div className={`member-selection-summary ${errors.members ? 'error' : ''}`}>
          <div className="summary-header">
            <div className="summary-info">
              <div className="summary-title">Add Group Members</div>
              {selectedUsers.length > 0 && (
                <div className="summary-count">
                  {selectedUsers.length} selected
                  {includeCreator && (
                    <span> + you = <strong>{totalMemberCount} total</strong></span>
                  )}
                  {!includeCreator && (
                    <span>, you won't be included</span>
                  )}
                </div>
              )}
            </div>
            {selectedUsers.length > 0 && (
              <button
                className="clear-selection-btn"
                onClick={clearSelection}
                title="Clear selection"
              >
                Clear
              </button>
            )}
          </div>

          {errors.members && (
            <div className="error-message">
              {errors.members}
            </div>
          )}

          {/* Creator Inclusion Checkbox */}
          <div className="creator-inclusion">
            <label className="checkbox-label">
              <input 
                className="uk-checkbox" 
                type="checkbox" 
                checked={includeCreator}
                onChange={(e) => setIncludeCreator(e.target.checked)}
              />
              <span>Include me as a group member</span>
            </label>
            <div className="checkbox-description">
              {includeCreator ? 
                "You'll be added to the group and can participate in conversations" : 
                "You'll create the group but won't be a member (you can still manage it)"
              }
            </div>
          </div>

          {/* Member Count Summary */}
          {(selectedUsers.length > 0 || includeCreator) && (
            <div className="member-count-summary">
              <strong>Total Members: {totalMemberCount}</strong>
              {selectedUsers.length === 0 && includeCreator && <span> (just you)</span>}
              {totalMemberCount === 0 && (
                <span className="warning"> - Please select members or include yourself</span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Member Search Section - Scrollable */}
      <div className="member-search-section">
        {/* Search Bar - Fixed */}
        <div className="search-bar-container">
          <div className="search-input-wrapper">
            <FiSearch className="search-icon" />
            <input
              type="text"
              placeholder="Search members..."
              onChange={(e) => {
                const searchText = e.target.value;
                search(searchText)
                  .then((res) => setSearchResults(res.data.users))
                  .catch(console.error);
              }}
              className="search-input"
            />
          </div>
        </div>
        
        {/* Scrollable Search Results */}
        <div className="search-results-container">
          {filteredSearchResults.length > 0 ? (
            filteredSearchResults.map(searchUser => (
              <User
                key={searchUser._id}
                user={searchUser}
                selected={selectedUsers.includes(searchUser._id)}
                onSelect={() => onUserSelect(searchUser._id)}
              />
            ))
          ) : (
            <div className="empty-state">
              <div className="empty-icon">
                <FiSearch size={32} />
              </div>
              <div className="empty-title">
                No users available
              </div>
              <div className="empty-description">
                Search for members to add to your group
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Error Display */}
      {errors.submit && (
        <div className="submit-error">
          {errors.submit}
        </div>
      )}

      {/* Create Button - Fixed Footer */}
      <div className="create-button-footer">
        <button
          className={`create-button ${canCreate ? 'enabled' : 'disabled'}`}
          onClick={createNewGroup}
          disabled={!canCreate}
        >
          {loading ? (
            <div className="loading-content">
              <div className="spinner"></div>
              Creating group...
            </div>
          ) : totalMemberCount === 0 ? (
            'Select members to continue'
          ) : (
            `Create Group (${totalMemberCount} Member${totalMemberCount !== 1 ? 's' : ''})`
          )}
        </button>
      </div>
    </div>
  );
}

export default CreateGroup;