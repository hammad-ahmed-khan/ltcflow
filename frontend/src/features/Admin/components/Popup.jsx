import { useState } from 'react';
import { useGlobal } from 'reactn';
import './Popup.sass';
import { FiX } from 'react-icons/fi';
import { useToasts } from 'react-toast-notifications';
import { postCreate, postUpdate, postDelete } from '../../../actions/admin';

function Input({
  icon, placeholder, type, onChange, required, value,
}) {
  return (
    <div className="uk-margin-small-top uk-width-1-1">
      <div className="uk-inline uk-width-1-1">
        <span className="uk-form-icon uk-form-icon-flip" data-uk-icon={`icon: ${icon}`} onChange={onChange} />
        <input
          className="uk-input uk-margin-remove uk-width-1-1"
          required={required}
          placeholder={placeholder}
          value={value}
          type={type}
          onChange={onChange}
        />
      </div>
    </div>
  );
}

function UserTierSelect({ value, onChange, currentUserLevel }) {
  // Define available tiers based on current user's level
  const getAvailableTiers = () => {
    const allTiers = [
      { value: 'user', label: 'Standard User', description: 'Can only chat with assigned groups' },
      { value: 'manager', label: 'Group Manager', description: 'Can create groups and join any group' },
      { value: 'admin', label: 'Administrator', description: 'Can administrate the system' }
    ];

    if (currentUserLevel === 'root') {
      // Super Admin can create all user types
      return allTiers;
    } else if (currentUserLevel === 'admin') {
      // Administrators cannot create other administrators
      return allTiers.slice(0, 2);
    } else {
      // Other users cannot create users (this shouldn't happen in normal flow)
      return [];
    }
  };

  const availableTiers = getAvailableTiers();

  return (
    <div className="uk-margin-small-top uk-width-1-1">
      <div className="uk-inline uk-width-1-1">
        <span className="uk-form-icon uk-form-icon-flip" data-uk-icon="icon: users" />
        <select
          className="uk-select uk-margin-remove uk-width-1-1"
          onChange={onChange}
          required
          style={{ paddingRight: '40px', width: '100%' }}
        >
          <option value="">Select User Role</option>
          {availableTiers.map((tier) => (
            <option key={tier.value} value={tier.value} selected={value === tier.value}>
              {tier.label} - {value}
            </option>
          ))}
        </select>
      </div>
      {value && (
        <div 
          className="uk-text-small uk-margin-small-top uk-flex uk-flex-middle uk-padding-small uk-border-rounded" 
          style={{ 
            color: '#555', 
            paddingRight: '40px',
            backgroundColor: value === 'user' ? '#f0f9ff' : 
                            value === 'manager' ? '#f8fafc' : 
                            '#fffbeb',
            border: `1px solid ${
              value === 'user' ? '#3b82f6' : 
              value === 'manager' ? '#6366f1' : 
              '#f59e0b'
            }`,
            borderRadius: '6px'
          }}
        >
          <span 
            className="uk-margin-small-right" 
            data-uk-icon={`icon: ${
              value === 'user' ? 'user' : 
              value === 'manager' ? 'users' : 
              'star'
            }; ratio: 0.9`}
            style={{ 
              color: value === 'user' ? '#3b82f6' : 
                     value === 'manager' ? '#6366f1' : 
                     '#f59e0b'
            }}
          />
          <span style={{ fontWeight: '500' }}>
            {availableTiers.find(tier => tier.value === value)?.description}
          </span>
        </div>
      )}
    </div>
  );
}

function AddPeers({ onClose, type, user }) {
  const { addToast } = useToasts();
  const [currentUser] = useGlobal('user');
  const currentUserLevel = currentUser?.level || '';

  const [firstName, setFirstName] = useState(user ? user.firstName : '');
  const [lastName, setLastName] = useState(user ? user.lastName : '');
  const [email, setEmail] = useState(user ? user.email : '');
  const [username, setUsername] = useState(user ? user.username : '');
  const [password, setPassword] = useState('');
  const [repeatPassword, setRepeatPassword] = useState('');
  const [userTier, setUserTier] = useState(user ? user.level : '');
  const [errors, setErrors] = useState(null);

  const okToast = (content) => {
    addToast(content, {
      appearance: 'success',
      autoDismiss: true,
    });
  };

  const errorToast = (content) => {
    addToast(content, {
      appearance: 'error',
      autoDismiss: true,
    });
  };

  const getTitle = () => {
    switch (type) {
      case 'create':
        return 'Create user';
      case 'edit':
        return `Edit ${user.username.substr(0, 16)}${user.username.length > 16 ? '...' : ''}`;
      default:
        return `Delete ${user.username.substr(0, 16)}${user.username.length > 16 ? '...' : ''}`;
    }
  };

  const createUser = async (e) => {
    e.preventDefault();
    try {
      await postCreate({
        username,
        email,
        password,
        repeatPassword,
        firstName,
        lastName,
        level: userTier, // Include user tier in creation
      });
      okToast(`User ${username} has been created`);
      onClose(true);
    } catch (e) {
      if (e && e.response) setErrors(e.response.data);
      errorToast(`Failed to create user ${username}`);
    }
  };

  const updateUser = async (e) => {
    e.preventDefault();
    try {
      await postUpdate({
        username,
        email,
        password,
        repeatPassword,
        firstName,
        lastName,
        level: userTier, // Include user tier in update
        user,
      });
      okToast(`User ${username} has been edited`);
      onClose(true);
    } catch (e) {
      if (e && e.response) setErrors(e.response.data);
      errorToast(`Failed to edit user ${username}`);
    }
  };

  const deleteUser = async (email, username) => {
    try {
      await postDelete({ email, username });
      okToast(`User ${username} has been deleted`);
      onClose(true);
    } catch (e) {
      errorToast(`Failed to delete user ${username}`);
    }
  };

  // Check if current user has permission to manage users
  const canManageUsers = ['root', 'admin'].includes(currentUserLevel);

  if (!canManageUsers) {
    return (
      <div className="admin-overlay">
        <div className="box">
          <div className="top-controls">
            <div className="title">Access Denied</div>
            <div className="close" onClick={onClose}>
              <FiX />
            </div>
          </div>
          <div className="uk-flex uk-flex-column uk-flex-center uk-flex-middle" style={{ padding: '20px' }}>
            <div className="uk-text-center">You don't have permission to manage users.</div>
            <button className="uk-button uk-button-secondary uk-margin-top" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-overlay">
      <div className="box">
        <div className="top-controls">
          <div className="title">{getTitle()}</div>
          <div className="close" onClick={onClose}>
            <FiX />
          </div>
        </div>

        <div className="data-editor" hidden={!['create', 'edit'].includes(type)}>
          <div className="uk-flex uk-flex-column uk-flex-center uk-flex-middle admin-delete">
            <form
              className="uk-flex uk-flex-column uk-flex-center uk-flex-middle"
              onSubmit={(e) => (type === 'edit' ? updateUser(e) : createUser(e))}
            >
              <Input
                icon="user"
                placeholder="Username"
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
              {errors && errors.username && <div className="admin-form-error">{errors.username}</div>}
              
              <Input
                icon="mail"
                placeholder="Email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              {errors && errors.email && <div className="admin-form-error">{errors.email}</div>}
              
              <Input
                icon="pencil"
                placeholder="First Name"
                type="text"
                required
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
              />
              {errors && errors.firstName && <div className="admin-form-error">{errors.firstName}</div>}
              
              <Input
                icon="pencil"
                placeholder="Last Name"
                type="text"
                required
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
              />
              {errors && errors.lastName && <div className="admin-form-error">{errors.lastName}</div>}

              <UserTierSelect
                value={userTier}
                onChange={(e) => setUserTier(e.target.value)}
                currentUserLevel={currentUserLevel}
              />
              {errors && errors.level && <div className="admin-form-error">{errors.level}</div>}
              
              <Input
                icon="lock"
                placeholder="Password"
                type="password"
                required={type === 'create'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              {errors && errors.password && <div className="admin-form-error">{errors.password}</div>}
              
              <Input
                icon="lock"
                placeholder="Repeat Password"
                type="password"
                required={type === 'create'}
                value={repeatPassword}
                onChange={(e) => setRepeatPassword(e.target.value)}
              />
              {errors && errors.repeatPassword && <div className="admin-form-error">{errors.repeatPassword}</div>}
              
              <button type="submit" style={{ marginBottom: 4 }} className="uk-button uk-button-honey uk-margin-top">
                {type === 'edit' ? 'Update' : 'Create'}
                {' '}
                User
              </button>
              <button className="uk-button uk-button-secondary" onClick={onClose}>
                Cancel
              </button>
              {type === 'edit' && (
                <div className="uk-text-center notice">Leave password blank if you do not want to change it.</div>
              )}
            </form>
            <div className="padding" />
          </div>
        </div>

        <div className="data-editor" hidden={type !== 'delete'}>
          <div className="uk-flex uk-flex-column uk-flex-center uk-flex-middle admin-delete">
            <div className="uk-text-center">
              Are you sure you want to delete user @
              {user && user.username}
              ?
            </div>
            <button
              className="uk-button uk-button-honey uk-margin-top"
              style={{ marginBottom: 4 }}
              onClick={() => deleteUser(user.email, user.username)}
            >
              Delete User
            </button>
            <button className="uk-button uk-button-secondary" onClick={onClose}>
              Cancel
            </button>
            <div className="uk-text-center notice">
              Messages sent by the user will not be deleted. A deleted user can not be recovered.
            </div>
            <div className="padding" />
          </div>
        </div>
      </div>
    </div>
  );
}

export default AddPeers;