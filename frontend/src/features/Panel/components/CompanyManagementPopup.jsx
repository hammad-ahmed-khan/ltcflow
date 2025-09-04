// frontend/src/features/Panel/components/CompanyManagementPopup.jsx
import React, { useState, useEffect, useRef } from 'react';
import { useGlobal } from 'reactn';
import { useSelector } from 'react-redux';
import { useToasts } from 'react-toast-notifications';
import { FiX, FiUpload, FiTrash2, FiHome } from 'react-icons/fi';
import apiClient from '../../../api/apiClient';
import upload from '../../../actions/uploadImage';
import './Popup.sass'; // Reuse existing styles

function Input({ icon, placeholder, type, onChange, required, value, disabled }) {
  return (
    <div className="uk-margin-small-top uk-width-1-1">
      <div className="uk-inline uk-width-1-1">
        <span className="uk-form-icon uk-form-icon-flip" data-uk-icon={`icon: ${icon}`} />
        <input
          className="uk-input uk-margin-remove uk-width-1-1"
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

function CompanyManagementPopup({ onClose }) {
  const { addToast } = useToasts();
  const [user] = useGlobal('user');
  const companyId = useSelector((state) => state.company?.companyId);
  const fileInput = useRef(null);
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    email: '',
  });
  
  // UI state
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [errors, setErrors] = useState({});
  const [companyLogo, setCompanyLogo] = useState(null);
  const [logoUploading, setLogoUploading] = useState(false);

  // Check if user is root
  const isRoot = user?.level === 'root';

  // Load company data on mount
  useEffect(() => {
    const loadCompanyData = async () => {
      if (!companyId || !isRoot) {
        setInitialLoading(false);
        return;
      }

      try {
        const response = await apiClient.get(`/api/company/${companyId}`);
        const company = response.data.company;
        
        setFormData({
          name: company.name || '',
          email: company.email || '',
        });
        
        // Set logo info if available
        if (company.logoInfo?.shieldedID) {
          setCompanyLogo({
            shieldedID: company.logoInfo.shieldedID,
            url: `/api/images/${company.logoInfo.shieldedID}/256`
          });
        }
        
      } catch (error) {
        console.error('Error loading company data:', error);
        addToast('Failed to load company information', {
          appearance: 'error',
          autoDismiss: true,
        });
      } finally {
        setInitialLoading(false);
      }
    };

    loadCompanyData();
  }, [companyId, isRoot, addToast]);

  const handleInputChange = (field) => (e) => {
    setFormData(prev => ({
      ...prev,
      [field]: e.target.value
    }));
    // Clear errors for this field
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  // Logo upload handler
  const handleLogoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      addToast('Logo file size must be less than 5MB', {
        appearance: 'error',
        autoDismiss: true,
      });
      return;
    }

    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      addToast('Logo must be a valid image file (JPG, PNG, GIF, WebP)', {
        appearance: 'error',
        autoDismiss: true,
      });
      return;
    }

    setLogoUploading(true);
    try {
      // Upload image using existing upload action
      const result = await upload(file, null, () => {}, 'square');
      
      setCompanyLogo({
        shieldedID: result.data.image.shieldedID,
        url: `/api/images/${result.data.image.shieldedID}/256`,
        imageId: result.data.image._id
      });
      
      addToast('Logo uploaded successfully', {
        appearance: 'success',
        autoDismiss: true,
      });
    } catch (error) {
      console.error('Logo upload error:', error);
      addToast('Failed to upload logo. Please try again.', {
        appearance: 'error',
        autoDismiss: true,
      });
    } finally {
      setLogoUploading(false);
    }
  };

  // Remove logo handler
  const handleRemoveLogo = async () => {
    if (!window.confirm('Are you sure you want to remove the company logo?')) {
      return;
    }

    try {
      await apiClient.post('/api/company/logo/remove', {});
      setCompanyLogo(null);
      addToast('Logo removed successfully', {
        appearance: 'success',
        autoDismiss: true,
      });
    } catch (error) {
      console.error('Error removing logo:', error);
      addToast('Failed to remove logo', {
        appearance: 'error',
        autoDismiss: true,
      });
    }
  };

  // Form validation
  const validateForm = () => {
    const newErrors = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Company name is required';
    } else if (formData.name.trim().length < 2) {
      newErrors.name = 'Company name must be at least 2 characters';
    }

    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Invalid email format';
    }

    return newErrors;
  };

  // Form submission handler
  const onUpdateCompany = async (e) => {
    e.preventDefault();
    setLoading(true);

    const validationErrors = validateForm();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      setLoading(false);
      return;
    }

    try {
      const updateData = {
        name: formData.name.trim(),
        email: formData.email.trim(),
      };

      // Include logo if uploaded
      if (companyLogo?.imageId) {
        updateData.logo = companyLogo.imageId;
      }

      const response = await apiClient.post('/api/company/update', updateData);
      
      if (response.data?.success) {
        onClose();
        addToast('Company information updated successfully!', {
          appearance: 'success',
          autoDismiss: true,
        });
        
        // Refresh page to update branding
        setTimeout(() => {
          window.location.reload();
        }, 1000);
      }

    } catch (error) {
      console.error('Error updating company:', error);
      let errorMessage = 'Failed to update company information';
      
      if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.response?.data?.error) {
        errorMessage = error.response.data.error;
      }
      
      setErrors({ generic: errorMessage });
    } finally {
      setLoading(false);
    }
  };

  // Don't render if not root user
  if (!isRoot) {
    return null;
  }

  if (initialLoading) {
    return (
      <div className="admin-overlay">
        <div className="box" style={{ maxWidth: '500px', width: '90vw' }}>
          <div className="uk-flex uk-flex-center uk-flex-middle" style={{ padding: '40px' }}>
            <div data-uk-spinner="ratio: 1.5"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-overlay">
      <div className="box" style={{ maxWidth: '500px', width: '90vw' }}>
        <div className="top-controls">
          <div className="title">Company Management</div>
          <div className="close" onClick={onClose}>
            <FiX />
          </div>
        </div>

        <div className="data-editor">
          <div className="uk-flex uk-flex-column uk-flex-center uk-flex-middle admin-delete">
            <form className="uk-flex uk-flex-column uk-flex-center uk-flex-middle" onSubmit={onUpdateCompany}>
              
              {/* Company Information */}
              <div className="uk-width-1-1 uk-text-left">
                <h4 className="uk-margin-small-bottom">
                  Company Name
                </h4>
              </div>
              
              <Input
                icon="home"
                placeholder="Company Name"
                type="text"
                required
                value={formData.name}
                onChange={handleInputChange('name')}
                disabled={loading}
              />
              {errors.name && <div className="admin-form-error">{errors.name}</div>}
              
              {/* Company Logo Section */}
              <div className="uk-width-1-1 uk-text-left uk-margin-top">
                <h4 className="uk-margin-small-bottom">Company Logo</h4>
              </div>

              {/* Current Logo Display */}
              <div className="uk-width-1-1 uk-text-center uk-margin-small-top">
                {companyLogo ? (
                  <div style={{ position: 'relative', display: 'inline-block' }}>
                    <img
                      src={companyLogo.url}
                      alt="Company Logo"
                      style={{
                        maxWidth: '120px',
                        maxHeight: '120px',
                        objectFit: 'contain',
                        border: '1px solid #ddd',
                        borderRadius: '8px',
                        padding: '8px',
                        backgroundColor: '#f9f9f9'
                      }}
                    />
                    <button
                      type="button"
                      onClick={handleRemoveLogo}
                      className="uk-button uk-button-danger uk-button-small"
                      style={{ 
                        position: 'absolute', 
                        top: '-8px', 
                        right: '-8px',
                        borderRadius: '50%',
                        width: '24px',
                        height: '24px',
                        padding: '0',
                        minHeight: 'auto'
                      }}
                      disabled={loading}
                      title="Remove logo"
                    >
                      <FiX size={12} />
                    </button>
                  </div>
                ) : (
                  <div
                    style={{
                      width: '120px',
                      height: '120px',
                      border: '2px dashed #ddd',
                      borderRadius: '8px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      margin: '0 auto',
                      backgroundColor: '#f9f9f9',
                      color: '#666'
                    }}
                  >
                    <div style={{ textAlign: 'center' }}>
                      <FiUpload size={24} />
                      <div style={{ fontSize: '12px', marginTop: '4px' }}>
                        No Logo
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Logo Upload Button */}
              <input
                type="file"
                ref={fileInput}
                onChange={handleLogoUpload}
                accept="image/*"
                style={{ display: 'none' }}
                disabled={loading || logoUploading}
              />
              
              <button
                type="button"
                onClick={() => fileInput.current?.click()}
                className="uk-button uk-button-secondary uk-margin-small-top"
                disabled={loading || logoUploading}
              >
                {logoUploading ? (
                  <>
                    <div data-uk-spinner="ratio: 0.5" className="uk-margin-small-right"></div>
                    Uploading...
                  </>
                ) : (
                  <>
                    <FiUpload className="uk-margin-small-right" />
                    {companyLogo ? 'Change Logo' : 'Upload Logo'}
                  </>
                )}
              </button>

              <div className="uk-text-small uk-text-muted uk-margin-small-top">
                Recommended: Square image, max 5MB (JPG, PNG, GIF, WebP)
              </div>

              {/* Generic Error */}
              {errors.generic && <div className="admin-form-error">{errors.generic}</div>}

              {/* Action Buttons */}
              <button 
                type="submit" 
                style={{ marginBottom: 4, marginTop: 16 }} 
                className="uk-button uk-button-honey uk-margin-top"
                disabled={loading || logoUploading}
              >
                {loading ? 'Updating Company...' : 'Update Company'}
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

export default CompanyManagementPopup;