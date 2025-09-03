import { useState, useEffect } from 'react';
import { useGlobal } from 'reactn';
import './Popup.sass';
import { FiX, FiCopy, FiCheck, FiMail, FiInfo, FiClock, FiUserCheck, FiRefreshCw } from 'react-icons/fi';
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
  const getAvailableTiers = () => {
    const allTiers = [
      { value: 'user', label: 'Standard User', description: 'Can only chat with assigned groups' },
      { value: 'manager', label: 'Group Manager', description: 'Can create groups and join any group' },
      { value: 'admin', label: 'Administrator', description: 'Can administrate the system' }
    ];

    if (currentUserLevel === 'root') {
      return allTiers;
    } else if (currentUserLevel === 'admin') {
      return allTiers.slice(0, 2);
    } else {
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
          value={value || ""}
          onChange={onChange}
          required
          style={{ paddingRight: '40px', width: '100%' }}
        >
          <option value="">Select User Role</option>
          {availableTiers.map((tier) => (
            <option key={tier.value} value={tier.value} selected={value === tier.value}>
              {tier.label}
            </option>
          ))}
        </select>
      </div>
      {value && (
        <div 
          className="uk-text-small uk-margin-small-top uk-flex uk-flex-middle uk-padding-small uk-border-rounded" 
          style={{ 
            color: '#555', 
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
              'cog'
            }`}
          />
          {availableTiers.find(tier => tier.value === value)?.description}
        </div>
      )}
    </div>
  );
}

function ActivationLinkDisplay({ activationLink, userEmail, onClose }) {
  const [copied, setCopied] = useState(false);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(activationLink).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="uk-flex uk-flex-column uk-flex-center uk-text-center" style={{ padding: '20px' }}>
      <div style={{ marginBottom: '30px' }}>
        <div 
          className="uk-flex uk-flex-center uk-flex-middle uk-margin-bottom" 
          style={{
            width: '60px',
            height: '60px',
            borderRadius: '50%',
            backgroundColor: '#e8f5e8',
            margin: '0 auto 20px auto'
          }}
        >
          <FiCheck size={28} style={{ color: '#2e7d32' }} />
        </div>
        
        <h4 className="uk-text-bold uk-margin-remove" style={{ color: '#2e7d32', fontSize: '18px' }}>
          🎉 Invitation Sent Successfully!
        </h4>
      </div>
      
      <p className="uk-text-small uk-margin-small-top uk-text-muted">
        An invitation email has been sent to <strong style={{ color: '#1976d2' }}>{userEmail}</strong>
      </p>
      
      {/* What happens next section */}
      <div className="uk-margin-medium-top">
        <h5 className="uk-text-bold uk-margin-small-bottom uk-text-emphasis">What happens next?</h5>
        <ul className="uk-list uk-list-divider uk-text-small">
          <li className="uk-flex uk-flex-middle" style={{ padding: '8px 0' }}>
            <FiMail className="uk-margin-small-right" style={{ color: '#1976d2', minWidth: '16px' }} /> 
            The user receives an email with activation instructions
          </li>
          <li className="uk-flex uk-flex-middle" style={{ padding: '8px 0' }}>
            <FiClock className="uk-margin-small-right" style={{ color: '#f57c00', minWidth: '16px' }} /> 
            The activation link expires in 7 days
          </li>
          <li className="uk-flex uk-flex-middle" style={{ padding: '8px 0' }}>
            <FiUserCheck className="uk-margin-small-right" style={{ color: '#2e7d32', minWidth: '16px' }} /> 
            The user will appear as "Active" after completing activation
          </li>
        </ul>
      </div>
      
      {/* Copy link button */}
      <div className="uk-flex uk-flex-left uk-margin-medium-top">
        <button
          className={`uk-button uk-button-small ${copied ? "uk-button-success" : "uk-button-primary"}`}
          onClick={copyToClipboard}
          style={{ 
            transition: 'all 0.2s ease',
            fontWeight: '500'
          }}
          onMouseEnter={(e) => {
            if (!copied) {
              e.target.style.transform = 'translateY(-1px)';
              e.target.style.boxShadow = '0 4px 8px rgba(25, 118, 210, 0.3)';
            }
          }}
          onMouseLeave={(e) => {
            if (!copied) {
              e.target.style.transform = 'translateY(0)';
              e.target.style.boxShadow = 'none';
            }
          }}
        >
          {copied ? (
            <>
              <FiCheck className="uk-margin-small-right" /> 
              Link Copied!
            </>
          ) : (
            <>
              <FiCopy className="uk-margin-small-right" /> 
              Copy Activation Link
            </>
          )}
        </button>
      </div>
    </div>
  );
}
 

function AddPeers({ onClose, type, user }) {
  const { addToast } = useToasts();
  const [currentUser] = useGlobal('user');
  const currentUserLevel = currentUser?.level || '';

  // Initialize state with empty values
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [username, setUsername] = useState('');
  const [userTier, setUserTier] = useState('');
  const [activationLink, setActivationLink] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [errors, setErrors] = useState(null);

  // Reset form fields when user prop or type changes
  useEffect(() => {
    if (type === 'edit' && user) {
      // Populate fields for editing
      setFirstName(user.firstName || '');
      setLastName(user.lastName || '');
      setEmail(user.email || '');
      setPhone(user.phone || '');
      setUsername(user.username || '');
      setUserTier(user.level || '');
    } else if (type === 'create') {
      // Clear fields for creating new user
      setFirstName('');
      setLastName('');
      setEmail('');
      setPhone('');
      setUsername('');
      setUserTier('');
    }
    
    // Always reset these when popup opens/changes
    setActivationLink('');
    setUserEmail('');
    setErrors(null);
  }, [type, user]);

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
        return 'Invite New User';
      case 'edit':
        return `Edit ${user?.username?.substr(0, 16)}${user?.username?.length > 16 ? '...' : ''}`;
      case 'delete':
        return `Delete ${user?.username?.substr(0, 16)}${user?.username?.length > 16 ? '...' : ''}`;
      default:
        return 'User Management';
    }
  };

// USA phone validation (10-digit numbers only)
const isValidPhone = (number) => {
  // Remove all non-digits
  const digitsOnly = number.replace(/\D/g, '');
  
  // Check if it's exactly 10 digits (USA format)
  return digitsOnly.length === 10;
};

  const createUser = async (e) => {
    e.preventDefault();

    // Validate phone for USA format
    if (!isValidPhone(phone)) {
      setErrors({ phone: 'Invalid phone number. Please enter a 10-digit USA phone number (e.g., 2345678901)' });
      errorToast('Invalid phone number. Please check and try again.');
      return;
    }

    // Format phone number - ensure it has USA country code prefix for backend
    let formattedPhone = phone.replace(/\D/g, '');

    try {
      const response = await postCreate({
        username,
        email,
        firstName,
        lastName,
        phone: formattedPhone,        // Send formatted phone for Twilio
        level: userTier,
      });
      
      if (response.data.activationLink) {
        setActivationLink(response.data.activationLink);
        setUserEmail(email);
        okToast(`Invitation created for ${username}`);
      } else {
        okToast(`User ${username} has been created`);
        onClose(true);
      }
    } catch (e) {
      if (e && e.response) setErrors(e.response.data);
      errorToast(`Failed to create invitation for ${username}`);
    }
  };

  const updateUser = async (e) => {
  e.preventDefault();
  
  // Validate phone number for USA format
  if (!isValidPhone(phone)) {
    setErrors({ phone: 'Invalid phone number. Please enter a 10-digit USA phone number (e.g., 2345678901)' });
    errorToast('Invalid phone number. Please check and try again.');
    return;
  }

  // Format phone number - ensure it has USA country code prefix for backend
  let formattedPhone = phone.replace(/\D/g, ''); // Remove non-digits
  /*
  if (formattedPhone.length === 10) {
    formattedPhone = '+1' + formattedPhone; // Add USA country code
  } else if (formattedPhone.length === 11 && formattedPhone.startsWith('1')) {
    formattedPhone = '+' + formattedPhone; // Add + prefix
  }
  */
 
  try {
    await postUpdate({
      username,
      email,
      firstName,
      lastName,
      phone: formattedPhone,        // Send formatted phone
      level: userTier,
      user,
    });
    okToast(`User ${username} has been updated`);
    onClose(true);
  } catch (e) {
    if (e && e.response) setErrors(e.response.data);
    errorToast(`Failed to update user ${username}`);
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
          <div className="close" onClick={() => onClose(true)}>
            <FiX />
          </div>
        </div>

        <div className="data-editor" hidden={!['create', 'edit'].includes(type)}>
          <div className="uk-flex uk-flex-column uk-flex-center uk-flex-middle admin-delete">
            {activationLink ? (
              <ActivationLinkDisplay 
                activationLink={activationLink}
                userEmail={userEmail}
                onClose={() => onClose(true)} 
              />
            ) : (
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

                <Input
                  icon="phone"
                  placeholder="Phone (e.g. 2345678901)"
                  type="text"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
                <div className="uk-text-small uk-text-muted uk-margin-small-top uk-text-center">
                  Required only for MFA account verification
                </div>
                {errors && errors.phone && <div className="admin-form-error">{errors.phone}</div>}

                <UserTierSelect
                  value={userTier}
                  onChange={(e) => setUserTier(e.target.value)}
                  currentUserLevel={currentUserLevel}
                />
                {errors && errors.level && <div className="admin-form-error">{errors.level}</div>}
                
                <button type="submit" style={{ marginBottom: 4 }} className="uk-button uk-button-honey uk-margin-top">
                  {type === 'edit' ? 'Update User' : 'Send Invitation'}
                </button>
                <button className="uk-button uk-button-secondary" onClick={() => onClose(false)}>
                  Cancel
                </button>
                
                {type === 'create' && (
                  <div className="uk-text-center notice uk-margin-top">
                    An activation link will be generated that is bound to the user's email address. Only the specified user can use this link to activate their account.
                  </div>
                )}
              </form>
            )}
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