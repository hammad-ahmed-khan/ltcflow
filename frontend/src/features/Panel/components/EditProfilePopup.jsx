import { useState } from 'react';
import './Popup.sass';
import { FiX, FiUser, FiMail, FiPhone, FiLock } from 'react-icons/fi';
import { useToasts } from 'react-toast-notifications';
import { useGlobal } from 'reactn';
import editUserProfile from '../../../actions/editUserProfile';

function Input({
  icon, placeholder, type, onChange, required, value, disabled
}) {
  return ( 
    <div className="uk-margin-small-top">
      <div className="uk-inline uk-width-1-1">
        <span className="uk-form-icon uk-form-icon-flip" data-uk-icon={`icon: ${icon}`} />
        <input
          className="uk-input uk-margin-remove"
          required={required}
          placeholder={placeholder}
          value={value}
          type={type}
          onChange={onChange}
          disabled={disabled}
        />
      </div>
    </div>
  );
}

function EditProfilePopup({ onClose }) {
  const { addToast } = useToasts();
  const [user, setUser] = useGlobal('user');

  const [formData, setFormData] = useState({
    firstName: user.firstName || '',
    lastName: user.lastName || '',
    email: user.email || '',
    phone: user.phone || '',
    currentPassword: '',
    password: '',
    confirmPassword: ''
  });

  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [showPasswordSection, setShowPasswordSection] = useState(false);

  const handleInputChange = (field) => (e) => {
    setFormData(prev => ({
      ...prev,
      [field]: e.target.value
    }));

    // Clear error for this field when user starts typing
    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: ''
      }));
    }
  };

  const validateForm = () => {
    const newErrors = {};

    // Required fields
    if (!formData.firstName.trim()) {
      newErrors.firstName = 'First name is required';
    }
    if (!formData.lastName.trim()) {
      newErrors.lastName = 'Last name is required';
    }
    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Invalid email format';
    }

    // Phone validation (optional)
    if (formData.phone && !/^[\+]?[\d\s\-\(\)]+$/.test(formData.phone)) {
      newErrors.phone = 'Invalid phone number format';
    }

    // Password validation if changing password
    if (showPasswordSection) {
      if (!formData.currentPassword) {
        newErrors.currentPassword = 'Current password is required';
      }
      if (!formData.password) {
        newErrors.password = 'New password is required';
      } else if (formData.password.length < 6) {
        newErrors.password = 'Password must be at least 6 characters long';
      }
      if (formData.password !== formData.confirmPassword) {
        newErrors.confirmPassword = 'Passwords do not match';
      }
    }

    return newErrors;
  };

  const onUpdateProfile = async (e) => {
    e.preventDefault();
    setLoading(true);

    const validationErrors = validateForm();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      setLoading(false);
      return;
    }

    try {
      // Prepare data for API call - only include changed fields
      const updateData = {};
      
      if (formData.firstName !== user.firstName) {
        updateData.firstName = formData.firstName;
      }
      if (formData.lastName !== user.lastName) {
        updateData.lastName = formData.lastName;
      }
      if (formData.email !== user.email) {
        updateData.email = formData.email;
      }
      if (formData.phone !== (user.phone || '')) {
        updateData.phone = formData.phone;
      }

      // Include password if changing
      if (showPasswordSection && formData.password) {
        updateData.password = formData.password;
        updateData.currentPassword = formData.currentPassword;
      }

      // Only proceed if there are changes
      if (Object.keys(updateData).length === 0) {
        addToast('No changes detected.', {
          appearance: 'info',
          autoDismiss: true,
        });
        setLoading(false);
        return;
      }

      const response = await editUserProfile(updateData);
      
      if (response.data && response.data.user) {
        // Update global user state
        const updatedUser = response.data.user;
        localStorage.setItem('user', JSON.stringify(updatedUser));
        await setUser(updatedUser);

        onClose();
        addToast('Profile updated successfully!', {
          appearance: 'success',
          autoDismiss: true,
        });
      }

    } catch (e) {
      let errors = {};
      if (!e.response || typeof e.response.data !== 'object') {
        errors.generic = 'Could not connect to server.';
      } else {
        errors = e.response.data;
      }
      setErrors(errors);
    } finally {
      setLoading(false);
    }
  };

  const togglePasswordSection = () => {
    setShowPasswordSection(!showPasswordSection);
    if (showPasswordSection) {
      // Clear password fields when hiding
      setFormData(prev => ({
        ...prev,
        currentPassword: '',
        password: '',
        confirmPassword: ''
      }));
      // Clear password-related errors
      const { currentPassword, password, confirmPassword, ...otherErrors } = errors;
      setErrors(otherErrors);
    }
  };

  return (
    <div className="admin-overlay">
      <div className="box" style={{ maxWidth: '500px', width: '90vw' }}>
        <div className="top-controls">
          <div className="title">Edit Profile</div>
          <div className="close" onClick={onClose}>
            <FiX />
          </div>
        </div>

        <div className="data-editor">
          <div className="uk-flex uk-flex-column uk-flex-center uk-flex-middle admin-delete">
            <form className="uk-flex uk-flex-column uk-flex-center uk-flex-middle" onSubmit={onUpdateProfile}>
              
              {/* Personal Information */}
              <div className="uk-width-1-1 uk-text-left">
                <h4 className="uk-margin-small-bottom">Personal Information</h4>
              </div>
              
              <Input
                icon="user"
                placeholder="First Name"
                type="text"
                required
                value={formData.firstName}
                onChange={handleInputChange('firstName')}
                disabled={loading}
              />
              {errors.firstName && <div className="admin-form-error">{errors.firstName}</div>}
              
              <Input
                icon="user"
                placeholder="Last Name"
                type="text"
                required
                value={formData.lastName}
                onChange={handleInputChange('lastName')}
                disabled={loading}
              />
              {errors.lastName && <div className="admin-form-error">{errors.lastName}</div>}
             
              <Input
                icon="mail"
                placeholder="Email Address"
                type="email"
                required
                value={formData.email}
                onChange={handleInputChange('email')}
                disabled={loading}
              />
              {errors.email && <div className="admin-form-error">{errors.email}</div>}
              
              <Input
                icon="phone"
                placeholder="Phone Number (optional)"
                type="tel"
                value={formData.phone}
                onChange={handleInputChange('phone')}
                disabled={loading}
              />
              {errors.phone && <div className="admin-form-error">{errors.phone}</div>}

              {/* Password Section Toggle */}
              <div className="uk-width-1-1 uk-text-left uk-margin-top">
                <button
                  type="button"
                  className="uk-button uk-button-text uk-text-primary"
                  onClick={togglePasswordSection}
                  disabled={loading}
                >
                  {showPasswordSection ? '× Cancel Password Change' : '🔒 Change Password'}
                </button>
              </div>

              {/* Password Fields */}
              {showPasswordSection && (
                <>
                  <div className="uk-width-1-1 uk-text-left">
                    <h4 className="uk-margin-small-bottom">Change Password</h4>
                  </div>
                  
                  <Input
                    icon="lock"
                    placeholder="Current Password"
                    type="password"
                    required={showPasswordSection}
                    value={formData.currentPassword}
                    onChange={handleInputChange('currentPassword')}
                    disabled={loading}
                  />
                  {errors.currentPassword && <div className="admin-form-error">{errors.currentPassword}</div>}
                  
                  <Input
                    icon="lock"
                    placeholder="New Password"
                    type="password"
                    required={showPasswordSection}
                    value={formData.password}
                    onChange={handleInputChange('password')}
                    disabled={loading}
                  />
                  {errors.password && <div className="admin-form-error">{errors.password}</div>}
                  
                  <Input
                    icon="lock"
                    placeholder="Confirm New Password"
                    type="password"
                    required={showPasswordSection}
                    value={formData.confirmPassword}
                    onChange={handleInputChange('confirmPassword')}
                    disabled={loading}
                  />
                  {errors.confirmPassword && <div className="admin-form-error">{errors.confirmPassword}</div>}
                </>
              )}

              {/* Generic Error */}
              {errors.generic && <div className="admin-form-error">{errors.generic}</div>}

              {/* Action Buttons */}
              <button 
                type="submit" 
                style={{ marginBottom: 4, marginTop: 16 }} 
                className="uk-button uk-button-honey uk-margin-top"
                disabled={loading}
              >
                {loading ? 'Updating Profile...' : 'Update Profile'}
              </button>
              
              <button 
                type="button" 
                className="uk-button uk-button-secondary" 
                onClick={onClose}
                disabled={loading}
              >
                Cancel
              </button>
              
            </form>
            <div className="padding" />
          </div>
        </div>
      </div>
    </div>
  );
}

export default EditProfilePopup;