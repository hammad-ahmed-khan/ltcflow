import { useRef, useState } from 'react';
import { useGlobal } from 'reactn';
import './Settings.sass';
import { useToasts } from 'react-toast-notifications';
import { FiEdit2 } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import upload from '../../../actions/uploadImage';
import Config from '../../../config';
import changePicture from '../../../actions/changePicture';
import EditProfilePopup from './EditProfilePopup'; // Import the new component

function Settings() {
  const { addToast } = useToasts();
  const navigate = useNavigate();

  const [user, setUser] = useGlobal('user');
  const setToken = useGlobal('token')[1];
  const setPanel = useGlobal('panel')[1];
  const [showEditProfile, setShowEditProfile] = useState(false);

  const fileInput = useRef(null);

  const change = async (image) => {
    const picture = await upload(image, null, () => {}, 'square');
    await changePicture(picture.data.image._id);
    const newUser = { ...user, picture: picture.data.image };
    localStorage.setItem('user', JSON.stringify(newUser));
    await setUser(newUser);
  };

  const remove = async () => {
    const confirmed = window.confirm("Are you sure you want to remove your picture?");
    if (!confirmed) return; // stop if user cancels

    await changePicture();
    const newUser = { ...user, picture: undefined };
    localStorage.setItem('user', JSON.stringify(newUser));
    await setUser(newUser);
  };

const logout = async () => {
    const { username } = user;
    
    // 🔹 NEW: Clear all authentication-related data including companyId
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('companyId');
    localStorage.removeItem('subdomain');
    
    await setToken(null);
    await setUser({});
    addToast(`User ${username} logged out!`, {
      appearance: 'success',
      autoDismiss: true,
    });
    navigate('/login', { replace: true });
  };

  function Picture() {
    if (user.picture) {
      return (
        <img src={`${Config.url || ''}/api/images/${user.picture.shieldedID}/256`} alt="Picture" className="picture" />
      );
    }
    return (
      <div className="img">
        {user.firstName.substr(0, 1)}
        {user.lastName.substr(0, 1)}
      </div>
    );
  }

  return (
    <div className="settings uk-flex uk-flex-column uk-padding-small">
      <input
        className="file-input"
        type="file"
        ref={fileInput}
        accept="image/*"
        onChange={(e) => change(e.target.files[0])}
      />
      <div
        className="picture uk-margin-small"
        onClick={() => fileInput && fileInput.current && fileInput.current.click()}
      >
        <Picture />
        <div className="overlay">
          <div className="text">
            <FiEdit2 />
          </div>
        </div>
      </div>
      
      {/* Updated: Replace Change Password with Edit Profile */}
      <button 
        className="uk-margin-small-top uk-button uk-button-secondary" 
        onClick={() => setShowEditProfile(true)}
      >
        Edit Profile
      </button>
      
      <button className="uk-margin-small-top uk-button uk-button-secondary" onClick={remove}>
        Remove Picture
      </button>
      <button className="uk-margin-small-top uk-button uk-button-secondary" onClick={logout}>
        Logout
      </button>
      {user.level && ['manager', 'admin', 'root'].includes(user.level) && (
        <button
          className="uk-margin-small uk-button uk-button-honey uk-button-large"
          onClick={() => setPanel('createGroup')}
        >
          Create Group
        </button>
      )}
      
      {/* Updated: Replace old Popup with EditProfilePopup */}
      {showEditProfile && (
        <EditProfilePopup
          onClose={() => {
            setShowEditProfile(false);
          }}
        />
      )}
    </div>
  );
}

export default Settings;