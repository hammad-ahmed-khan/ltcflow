import React, { useState, useEffect, useRef } from 'react';
import { useToasts } from 'react-toast-notifications';
import { FiUpload, FiCheck, FiUser, FiBriefcase, FiUsers, FiEye, FiCreditCard, FiFileText, FiEdit2, FiX, FiPlus, FiTrash2 } from 'react-icons/fi';

const CompanyOnboardingWizard = () => {
  const { addToast } = useToasts();
  
  // Step management
  const [currentStep, setCurrentStep] = useState(1);
  const [completedSteps, setCompletedSteps] = useState(new Set());
  
  // Save progress flag
  const [hasChanges, setHasChanges] = useState(false);
  
  // Form data
  const [formData, setFormData] = useState({
    // Step 1 - Company
    companyName: '',
    companyLogo: null,
    subdomain: '',
    industry: '',
    expectedUsers: '',
    
    // Step 2 - Admin
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    username: '',
    
    // Step 3 - Invite Users
    invitedUsers: [
      { name: '', role: 'user', email: '', phone: '' }
    ],
    
    // Step 6 - Agreements
    acceptTos: false,
    acceptPrivacy: false,
    acceptBilling: false
  });
  
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [subdomainChecking, setSubdomainChecking] = useState(false);
  const [subdomainAvailable, setSubdomainAvailable] = useState(null);
  
  const fileInputRef = useRef(null);
  
  // Industry options
  const industries = [
    'Healthcare',
    'Technology',
    'Finance',
    'Education',
    'Manufacturing',
    'Retail',
    'Construction',
    'Real Estate',
    'Legal Services',
    'Consulting',
    'Non-Profit',
    'Other'
  ];
  
  // User count options
  const userCounts = [
    '1-10 users',
    '11-25 users',
    '26-50 users',
    '51-100 users',
    '101-250 users',
    '251-500 users',
    '500+ users'
  ];
  
  // Role options
  const roleOptions = [
    { value: 'admin', label: 'Administrator' },
    { value: 'manager', label: 'Manager' },
    { value: 'user', label: 'User' }
  ];
  
  // Load saved progress on mount
  useEffect(() => {
    const savedData = localStorage.getItem('onboardingProgress');
    if (savedData) {
      try {
        const parsed = JSON.parse(savedData);
        setFormData(parsed.formData || formData);
        setCurrentStep(parsed.currentStep || 1);
        setCompletedSteps(new Set(parsed.completedSteps || []));
      } catch (e) {
        console.error('Error loading saved progress:', e);
      }
    }
  }, []);
  
  // Save progress when data changes
  useEffect(() => {
    if (hasChanges) {
      const progressData = {
        formData,
        currentStep,
        completedSteps: Array.from(completedSteps),
        savedAt: new Date().toISOString()
      };
      localStorage.setItem('onboardingProgress', JSON.stringify(progressData));
      setHasChanges(false);
    }
  }, [formData, currentStep, completedSteps, hasChanges]);
  
  // Handle input changes
  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setHasChanges(true);
    
    // Clear errors for this field
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };
  
  // Handle logo upload
  const handleLogoUpload = async (file) => {
    if (!file) return;
    
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      setErrors(prev => ({ ...prev, companyLogo: 'Logo file size must be less than 5MB' }));
      return;
    }
    
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      setErrors(prev => ({ ...prev, companyLogo: 'Logo must be a valid image file (JPG, PNG, GIF, WebP)' }));
      return;
    }
    
    // Create preview URL
    const previewUrl = URL.createObjectURL(file);
    handleInputChange('companyLogo', { file, preview: previewUrl });
  };
  
  // Check subdomain availability
  const checkSubdomainAvailability = async (subdomain) => {
    if (!subdomain || subdomain.length < 3) {
      setSubdomainAvailable(null);
      return;
    }
    
    setSubdomainChecking(true);
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 800));
      
      // Simulate some taken subdomains
      const takenSubdomains = ['demo', 'admin', 'test', 'api', 'www', 'app'];
      const isAvailable = !takenSubdomains.includes(subdomain.toLowerCase());
      
      setSubdomainAvailable(isAvailable);
      if (!isAvailable) {
        setErrors(prev => ({ ...prev, subdomain: 'This subdomain is not available' }));
      } else {
        setErrors(prev => ({ ...prev, subdomain: '' }));
      }
    } catch (error) {
      setSubdomainAvailable(null);
      setErrors(prev => ({ ...prev, subdomain: 'Error checking availability' }));
    } finally {
      setSubdomainChecking(false);
    }
  };
  
  // Handle subdomain change with debounce
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (formData.subdomain) {
        checkSubdomainAvailability(formData.subdomain);
      }
    }, 500);
    
    return () => clearTimeout(timeoutId);
  }, [formData.subdomain]);
  
  // Add invited user
  const addInvitedUser = () => {
    setFormData(prev => ({
      ...prev,
      invitedUsers: [...prev.invitedUsers, { name: '', role: 'user', email: '', phone: '' }]
    }));
    setHasChanges(true);
  };
  
  // Remove invited user
  const removeInvitedUser = (index) => {
    setFormData(prev => ({
      ...prev,
      invitedUsers: prev.invitedUsers.filter((_, i) => i !== index)
    }));
    setHasChanges(true);
  };
  
  // Update invited user
  const updateInvitedUser = (index, field, value) => {
    setFormData(prev => ({
      ...prev,
      invitedUsers: prev.invitedUsers.map((user, i) => 
        i === index ? { ...user, [field]: value } : user
      )
    }));
    setHasChanges(true);
  };
  
  // Validation functions
  const validateStep1 = () => {
    const newErrors = {};
    
    if (!formData.companyName.trim()) {
      newErrors.companyName = 'Company name is required';
    }
    
    if (!formData.subdomain.trim()) {
      newErrors.subdomain = 'Instance/Subdomain is required';
    } else if (formData.subdomain.length < 3) {
      newErrors.subdomain = 'Subdomain must be at least 3 characters';
    } else if (!/^[a-z0-9-]+$/.test(formData.subdomain)) {
      newErrors.subdomain = 'Subdomain can only contain lowercase letters, numbers, and hyphens';
    } else if (subdomainAvailable === false) {
      newErrors.subdomain = 'This subdomain is not available';
    }
    
    if (!formData.industry) {
      newErrors.industry = 'Please select an industry';
    }
    
    if (!formData.expectedUsers) {
      newErrors.expectedUsers = 'Please select expected number of users';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };
  
  const validateStep2 = () => {
    const newErrors = {};
    
    if (!formData.firstName.trim()) {
      newErrors.firstName = 'First name is required';
    }
    
    if (!formData.lastName.trim()) {
      newErrors.lastName = 'Last name is required';
    }
    
    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }
    
    if (!formData.username.trim()) {
      newErrors.username = 'Username is required';
    } else if (formData.username.length < 3) {
      newErrors.username = 'Username must be at least 3 characters';
    }
    
    if (formData.phone && !/^[\+]?[1-9][\d\s\-\(\)]{8,}$/.test(formData.phone)) {
      newErrors.phone = 'Please enter a valid phone number';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };
  
  const validateStep3 = () => {
    const newErrors = {};
    const validUsers = formData.invitedUsers.filter(user => 
      user.name.trim() || user.email.trim()
    );
    
    validUsers.forEach((user, index) => {
      if (user.name.trim() && !user.email.trim()) {
        newErrors[`invitedUsers.${index}.email`] = 'Email is required when name is provided';
      }
      if (user.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(user.email)) {
        newErrors[`invitedUsers.${index}.email`] = 'Please enter a valid email address';
      }
    });
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };
  
  const validateStep6 = () => {
    const newErrors = {};
    
    if (!formData.acceptTos) {
      newErrors.acceptTos = 'You must accept the Terms of Service';
    }
    
    if (!formData.acceptPrivacy) {
      newErrors.acceptPrivacy = 'You must accept the Privacy Policy';
    }
    
    if (!formData.acceptBilling) {
      newErrors.acceptBilling = 'You must accept the Billing Terms';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };
  
  // Navigation functions
  const goToStep = (step) => {
    if (step <= currentStep + 1 || completedSteps.has(step)) {
      setCurrentStep(step);
      setHasChanges(true);
    }
  };
  
  const nextStep = () => {
    let isValid = false;
    
    switch (currentStep) {
      case 1:
        isValid = validateStep1();
        break;
      case 2:
        isValid = validateStep2();
        break;
      case 3:
        isValid = validateStep3();
        break;
      case 4:
        isValid = true; // Review step
        break;
      case 5:
        isValid = true; // Payment step (handled by Outseta)
        break;
      case 6:
        isValid = validateStep6();
        break;
      default:
        isValid = true;
    }
    
    if (isValid) {
      setCompletedSteps(prev => new Set([...prev, currentStep]));
      if (currentStep < 6) {
        setCurrentStep(currentStep + 1);
        setHasChanges(true);
      } else {
        handleSubmit();
      }
    }
  };
  
  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
      setHasChanges(true);
    }
  };
  
  // Final submission
  const handleSubmit = async () => {
    setLoading(true);
    try {
      // Simulate API calls
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Clear saved progress
      localStorage.removeItem('onboardingProgress');
      
      addToast('Company onboarding completed successfully! Welcome to LTC Flow!', {
        appearance: 'success',
        autoDismiss: false
      });
      
      // Redirect to login or dashboard
      console.log('Onboarding complete:', formData);
    } catch (error) {
      addToast('Error completing onboarding. Please try again.', {
        appearance: 'error',
        autoDismiss: true
      });
    } finally {
      setLoading(false);
    }
  };
  
  // Step configuration
  const steps = [
    { number: 1, title: 'Company', icon: FiBriefcase },
    { number: 2, title: 'Admin', icon: FiUser },
    { number: 3, title: 'Invite Users', icon: FiUsers },
    { number: 4, title: 'Review', icon: FiEye },
    { number: 5, title: 'Payment', icon: FiCreditCard },
    { number: 6, title: 'Agreements', icon: FiFileText }
  ];
  
  // Logo preview component
  const LogoPreview = () => {
    if (!formData.companyLogo) {
      return (
        <div className="uk-width-small uk-height-small uk-border-rounded uk-flex uk-flex-middle uk-flex-center uk-border uk-border-dashed uk-background-muted">
          <div className="uk-text-center">
            <FiUpload className="uk-margin-auto uk-display-block uk-text-muted" style={{ height: '48px', width: '48px' }} />
            <p className="uk-text-small uk-text-muted uk-margin-small-top">Upload Logo</p>
          </div>
        </div>
      );
    }
    
    return (
      <div className="uk-position-relative uk-width-small uk-height-small">
        <img
          src={formData.companyLogo.preview}
          alt="Company Logo"
          className="uk-width-1-1 uk-height-1-1 uk-object-contain uk-border-rounded uk-border"
        />
        <button
          type="button"
          onClick={() => handleInputChange('companyLogo', null)}
          className="uk-position-absolute uk-position-top-right uk-border-circle uk-background-danger uk-padding-small uk-button uk-button-small"
          style={{ transform: 'translate(50%, -50%)' }}
        >
          <FiX size={14} className="uk-text-white" />
        </button>
      </div>
    );
  };
  
  // Render step content
  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="uk-grid-small" uk-grid="true">
            <div className="uk-width-1-1">
              <label className="uk-form-label">
                Company Name *
              </label>
              <input
                type="text"
                className={`uk-input ${errors.companyName ? 'uk-form-danger' : ''}`}
                placeholder="Enter your company name"
                value={formData.companyName}
                onChange={(e) => handleInputChange('companyName', e.target.value)}
              />
              {errors.companyName && (
                <p className="uk-text-danger uk-margin-small-top">{errors.companyName}</p>
              )}
            </div>
            
            <div className="uk-width-1-1">
              <label className="uk-form-label">
                Company Logo
              </label>
              <div className="uk-flex uk-flex-middle">
                <LogoPreview />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="uk-button uk-button-default uk-margin-left"
                >
                  <FiEdit2 className="uk-margin-small-right" />
                  <span>Choose File</span>
                </button>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="uk-hidden"
                onChange={(e) => handleLogoUpload(e.target.files[0])}
              />
              {errors.companyLogo && (
                <p className="uk-text-danger uk-margin-small-top">{errors.companyLogo}</p>
              )}
            </div>
            
            <div className="uk-width-1-1">
              <label className="uk-form-label">
                Instance/Subdomain *
              </label>
              <div className="uk-flex">
                <input
                  type="text"
                  className={`uk-input uk-border-right-remove ${errors.subdomain ? 'uk-form-danger' : ''}`}
                  placeholder="yourcompany"
                  value={formData.subdomain}
                  onChange={(e) => handleInputChange('subdomain', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                />
                <span className="uk-form-controls-text uk-padding-small uk-background-muted uk-border-left-remove">
                  .ltcflow.com
                </span>
              </div>
              <div className="uk-flex uk-flex-middle uk-margin-small-top">
                {subdomainChecking && (
                  <p className="uk-text-meta">Checking availability...</p>
                )}
                {subdomainAvailable === true && (
                  <p className="uk-text-success uk-flex uk-flex-middle">
                    <FiCheck className="uk-margin-small-right" />
                    Available
                  </p>
                )}
                {errors.subdomain && (
                  <p className="uk-text-danger">{errors.subdomain}</p>
                )}
              </div>
            </div>
            
            <div className="uk-width-1-1">
              <label className="uk-form-label">
                Industry *
              </label>
              <select
                className={`uk-select ${errors.industry ? 'uk-form-danger' : ''}`}
                value={formData.industry}
                onChange={(e) => handleInputChange('industry', e.target.value)}
              >
                <option value="">Select your industry</option>
                {industries.map(industry => (
                  <option key={industry} value={industry}>{industry}</option>
                ))}
              </select>
              {errors.industry && (
                <p className="uk-text-danger uk-margin-small-top">{errors.industry}</p>
              )}
            </div>
            
            <div className="uk-width-1-1">
              <label className="uk-form-label">
                Expected Number of Users *
              </label>
              <select
                className={`uk-select ${errors.expectedUsers ? 'uk-form-danger' : ''}`}
                value={formData.expectedUsers}
                onChange={(e) => handleInputChange('expectedUsers', e.target.value)}
              >
                <option value="">Select expected number of users</option>
                {userCounts.map(count => (
                  <option key={count} value={count}>{count}</option>
                ))}
              </select>
              {errors.expectedUsers && (
                <p className="uk-text-danger uk-margin-small-top">{errors.expectedUsers}</p>
              )}
            </div>
          </div>
        );
        
      case 2:
        return (
          <div className="uk-grid-small" uk-grid="true">
            <div className="uk-width-1-2@s">
              <label className="uk-form-label">
                First Name *
              </label>
              <input
                type="text"
                className={`uk-input ${errors.firstName ? 'uk-form-danger' : ''}`}
                placeholder="Enter first name"
                value={formData.firstName}
                onChange={(e) => handleInputChange('firstName', e.target.value)}
              />
              {errors.firstName && (
                <p className="uk-text-danger uk-margin-small-top">{errors.firstName}</p>
              )}
            </div>
            
            <div className="uk-width-1-2@s">
              <label className="uk-form-label">
                Last Name *
              </label>
              <input
                type="text"
                className={`uk-input ${errors.lastName ? 'uk-form-danger' : ''}`}
                placeholder="Enter last name"
                value={formData.lastName}
                onChange={(e) => handleInputChange('lastName', e.target.value)}
              />
              {errors.lastName && (
                <p className="uk-text-danger uk-margin-small-top">{errors.lastName}</p>
              )}
            </div>
            
            <div className="uk-width-1-1">
              <label className="uk-form-label">
                Email Address *
              </label>
              <input
                type="email"
                className={`uk-input ${errors.email ? 'uk-form-danger' : ''}`}
                placeholder="admin@company.com"
                value={formData.email}
                onChange={(e) => handleInputChange('email', e.target.value)}
              />
              {errors.email && (
                <p className="uk-text-danger uk-margin-small-top">{errors.email}</p>
              )}
            </div>
            
            <div className="uk-width-1-1">
              <label className="uk-form-label">
                Phone Number
              </label>
              <input
                type="tel"
                className={`uk-input ${errors.phone ? 'uk-form-danger' : ''}`}
                placeholder="+1 (555) 123-4567"
                value={formData.phone}
                onChange={(e) => handleInputChange('phone', e.target.value)}
              />
              {errors.phone && (
                <p className="uk-text-danger uk-margin-small-top">{errors.phone}</p>
              )}
            </div>
            
            <div className="uk-width-1-1">
              <label className="uk-form-label">
                Username *
              </label>
              <input
                type="text"
                className={`uk-input ${errors.username ? 'uk-form-danger' : ''}`}
                placeholder="Enter username"
                value={formData.username}
                onChange={(e) => handleInputChange('username', e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
              />
              {errors.username && (
                <p className="uk-text-danger uk-margin-small-top">{errors.username}</p>
              )}
            </div>
          </div>
        );
        
      case 3:
        return (
          <div>
            <div className="uk-flex uk-flex-between uk-flex-middle">
              <h3 className="uk-heading-small">Invite Team Members</h3>
              <button
                type="button"
                onClick={addInvitedUser}
                className="uk-button uk-button-primary"
              >
                <FiPlus className="uk-margin-small-right" />
                <span>Add User</span>
              </button>
            </div>
            
            <div className="uk-margin-top">
              {formData.invitedUsers.map((user, index) => (
                <div key={index} className="uk-grid-small uk-margin-bottom" uk-grid="true">
                  <div className="uk-width-1-4@s">
                    <input
                      type="text"
                      className="uk-input"
                      placeholder="Full Name"
                      value={user.name}
                      onChange={(e) => updateInvitedUser(index, 'name', e.target.value)}
                    />
                  </div>
                  
                  <div className="uk-width-1-6@s">
                    <select
                      className="uk-select"
                      value={user.role}
                      onChange={(e) => updateInvitedUser(index, 'role', e.target.value)}
                    >
                      {roleOptions.map(role => (
                        <option key={role.value} value={role.value}>
                          {role.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  <div className="uk-width-1-4@s">
                    <input
                      type="email"
                      className={`uk-input ${errors[`invitedUsers.${index}.email`] ? 'uk-form-danger' : ''}`}
                      placeholder="Email Address"
                      value={user.email}
                      onChange={(e) => updateInvitedUser(index, 'email', e.target.value)}
                    />
                    {errors[`invitedUsers.${index}.email`] && (
                      <p className="uk-text-danger uk-margin-small-top">{errors[`invitedUsers.${index}.email`]}</p>
                    )}
                  </div>
                  
                  <div className="uk-width-1-4@s">
                    <input
                      type="tel"
                      className="uk-input"
                      placeholder="Phone (Optional)"
                      value={user.phone}
                      onChange={(e) => updateInvitedUser(index, 'phone', e.target.value)}
                    />
                  </div>
                  
                  <div className="uk-width-auto">
                    <button
                      type="button"
                      onClick={() => removeInvitedUser(index)}
                      className="uk-button uk-button-danger"
                      disabled={formData.invitedUsers.length === 1}
                    >
                      <FiTrash2 />
                    </button>
                  </div>
                </div>
              ))}
            </div>
            
            <div className="uk-alert-primary" uk-alert="true">
              <p>
                <strong>Note:</strong> Invited users will receive an email invitation to join your company's LTC Flow instance. 
                They'll be able to set up their accounts using the invitation link.
              </p>
            </div>
          </div>
        );
        
      case 4:
        return (
          <div>
            <h3 className="uk-heading-small">Review Your Information</h3>
            
            {/* Company Information */}
            <div className="uk-card uk-card-default uk-card-body uk-margin-medium-top">
              <div className="uk-flex uk-flex-between uk-flex-middle">
                <h4 className="uk-card-title">Company Information</h4>
                <button
                  type="button"
                  onClick={() => goToStep(1)}
                  className="uk-button uk-button-text"
                >
                  Edit
                </button>
              </div>
              
              <div className="uk-grid-small" uk-grid="true">
                <div className="uk-width-1-2@s">
                  <label className="uk-text-small uk-text-muted">Company Name</label>
                  <p className="uk-text-emphasis">{formData.companyName}</p>
                </div>
                <div className="uk-width-1-2@s">
                  <label className="uk-text-small uk-text-muted">Instance URL</label>
                  <p className="uk-text-emphasis">{formData.subdomain}.ltcflow.com</p>
                </div>
                <div className="uk-width-1-2@s">
                  <label className="uk-text-small uk-text-muted">Industry</label>
                  <p className="uk-text-emphasis">{formData.industry}</p>
                </div>
                <div className="uk-width-1-2@s">
                  <label className="uk-text-small uk-text-muted">Expected Users</label>
                  <p className="uk-text-emphasis">{formData.expectedUsers}</p>
                </div>
              </div>
              
              {formData.companyLogo && (
                <div className="uk-margin-top">
                  <label className="uk-text-small uk-text-muted">Company Logo</label>
                  <img
                    src={formData.companyLogo.preview}
                    alt="Company Logo"
                    className="uk-width-small uk-height-small uk-object-contain uk-border-rounded uk-border"
                  />
                </div>
              )}
            </div>
            
            {/* Admin Information */}
            <div className="uk-card uk-card-default uk-card-body uk-margin-medium-top">
              <div className="uk-flex uk-flex-between uk-flex-middle">
                <h4 className="uk-card-title">Administrator Details</h4>
                <button
                  type="button"
                  onClick={() => goToStep(2)}
                  className="uk-button uk-button-text"
                >
                  Edit
                </button>
              </div>
              
              <div className="uk-grid-small" uk-grid="true">
                <div className="uk-width-1-2@s">
                  <label className="uk-text-small uk-text-muted">Name</label>
                  <p className="uk-text-emphasis">{formData.firstName} {formData.lastName}</p>
                </div>
                <div className="uk-width-1-2@s">
                  <label className="uk-text-small uk-text-muted">Email</label>
                  <p className="uk-text-emphasis">{formData.email}</p>
                </div>
                <div className="uk-width-1-2@s">
                  <label className="uk-text-small uk-text-muted">Username</label>
                  <p className="uk-text-emphasis">{formData.username}</p>
                </div>
                {formData.phone && (
                  <div className="uk-width-1-2@s">
                    <label className="uk-text-small uk-text-muted">Phone</label>
                    <p className="uk-text-emphasis">{formData.phone}</p>
                  </div>
                )}
              </div>
            </div>
            
            {/* Invited Users */}
            <div className="uk-card uk-card-default uk-card-body uk-margin-medium-top">
              <div className="uk-flex uk-flex-between uk-flex-middle">
                <h4 className="uk-card-title">Invited Team Members</h4>
                <button
                  type="button"
                  onClick={() => goToStep(3)}
                  className="uk-button uk-button-text"
                >
                  Edit
                </button>
              </div>
              
              {formData.invitedUsers.filter(user => user.name.trim() || user.email.trim()).length > 0 ? (
                <div>
                  {formData.invitedUsers
                    .filter(user => user.name.trim() || user.email.trim())
                    .map((user, index) => (
                    <div key={index} className="uk-flex uk-flex-between uk-flex-middle uk-padding-small uk-border-bottom">
                      <div>
                        <p className="uk-text-emphasis">
                          {user.name || 'No name provided'}
                        </p>
                        <p className="uk-text-muted">{user.email}</p>
                      </div>
                      <div className="uk-text-right">
                        <p className="uk-text-emphasis">
                          {roleOptions.find(r => r.value === user.role)?.label}
                        </p>
                        {user.phone && (
                          <p className="uk-text-muted">{user.phone}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="uk-text-muted">No team members invited</p>
              )}
            </div>
            
            <div className="uk-alert-primary uk-margin-medium-top" uk-alert="true">
              <p>
                <strong>Ready to proceed?</strong> Click "Continue to Payment" to set up your billing 
                information and complete the onboarding process.
              </p>
            </div>
          </div>
        );
        
      case 5:
        return (
          <div>
            <div className="uk-text-center">
              <FiCreditCard className="uk-margin-auto uk-display-block uk-text-primary" style={{ height: '48px', width: '48px' }} />
              <h3 className="uk-heading-small uk-margin-small-top">Set Up Billing</h3>
              <p className="uk-text-muted">
                Choose your plan and set up payment to complete your onboarding.
              </p>
            </div>
            
            {/* Plan Details */}
            <div className="uk-card uk-card-default uk-card-body uk-margin-medium-top">
              <h4 className="uk-card-title">Your Plan Details</h4>
              
              <div>
                <div className="uk-flex uk-flex-between uk-flex-middle uk-padding-small uk-border-bottom">
                  <span className="uk-text-muted">Base Plan</span>
                  <span className="uk-text-emphasis">Professional</span>
                </div>
                <div className="uk-flex uk-flex-between uk-flex-middle uk-padding-small uk-border-bottom">
                  <span className="uk-text-muted">Expected Users</span>
                  <span className="uk-text-emphasis">{formData.expectedUsers}</span>
                </div>
                <div className="uk-flex uk-flex-between uk-flex-middle uk-padding-small uk-border-bottom">
                  <span className="uk-text-muted">Monthly Rate</span>
                  <span className="uk-text-emphasis">$5.00 per active user</span>
                </div>
                <div className="uk-flex uk-flex-between uk-flex-middle uk-padding-small">
                  <span className="uk-text-lead">Estimated Monthly Cost</span>
                  <span className="uk-text-lead">
                    ${(() => {
                      const userRange = formData.expectedUsers.split('-')[0];
                      const userCount = parseInt(userRange) || 10;
                      return (userCount * 5).toFixed(2);
                    })()}
                  </span>
                </div>
                <p className="uk-text-meta uk-margin-small-top">
                  *Final billing based on actual active users each month
                </p>
              </div>
            </div>
            
            {/* Outseta Payment Form */}
            <div className="uk-card uk-card-secondary uk-card-body uk-margin-medium-top">
              <div className="uk-text-center">
                <div className="uk-spinner" uk-spinner="ratio: 1.5"></div>
                <p className="uk-text-muted uk-margin-small-top">Loading secure payment form...</p>
                <div className="uk-card uk-card-default uk-card-body uk-margin-top uk-text-left">
                  <h5 className="uk-card-title">Payment Information</h5>
                  
                  {/* Simulated Outseta form fields */}
                  <div className="uk-grid-small" uk-grid="true">
                    <div className="uk-width-1-1">
                      <label className="uk-form-label">
                        Card Number
                      </label>
                      <div className="uk-form-controls">
                        <div className="uk-input uk-background-muted uk-text-muted">
                          •••• •••• •••• ••••
                        </div>
                      </div>
                    </div>
                    
                    <div className="uk-width-1-2@s">
                      <label className="uk-form-label">
                        Expiry Date
                      </label>
                      <div className="uk-form-controls">
                        <div className="uk-input uk-background-muted uk-text-muted">
                          MM/YY
                        </div>
                      </div>
                    </div>
                    <div className="uk-width-1-2@s">
                      <label className="uk-form-label">
                        CVV
                      </label>
                      <div className="uk-form-controls">
                        <div className="uk-input uk-background-muted uk-text-muted">
                          •••
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="uk-alert-primary uk-margin-top" uk-alert="true">
                    <p>
                      <strong>Note:</strong> This is a demo. In production, this section will be 
                      replaced with the Outseta payment widget for secure payment processing.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
        
      case 6:
        return (
          <div>
            <div className="uk-text-center">
              <FiFileText className="uk-margin-auto uk-display-block uk-text-primary" style={{ height: '48px', width: '48px' }} />
              <h3 className="uk-heading-small uk-margin-small-top">Terms & Agreements</h3>
              <p className="uk-text-muted">
                Please review and accept our terms to complete your onboarding.
              </p>
            </div>
            
            <div className="uk-margin-medium-top">
              {/* Terms of Service */}
              <div className="uk-card uk-card-default uk-card-body uk-margin-bottom">
                <div className="uk-grid-small" uk-grid="true">
                  <div className="uk-width-auto">
                    <input
                      id="acceptTos"
                      type="checkbox"
                      className="uk-checkbox"
                      checked={formData.acceptTos}
                      onChange={(e) => handleInputChange('acceptTos', e.target.checked)}
                    />
                  </div>
                  <div className="uk-width-expand">
                    <label htmlFor="acceptTos" className="uk-form-label">
                      I agree to the Terms of Service *
                    </label>
                    <p className="uk-text-muted uk-margin-small-top">
                      By checking this box, you agree to our{' '}
                      <a href="#" className="uk-link">
                        Terms of Service
                      </a>{' '}
                      which govern the use of LTC Flow platform.
                    </p>
                  </div>
                </div>
                {errors.acceptTos && (
                  <p className="uk-text-danger uk-margin-small-top">{errors.acceptTos}</p>
                )}
              </div>
              
              {/* Privacy Policy */}
              <div className="uk-card uk-card-default uk-card-body uk-margin-bottom">
                <div className="uk-grid-small" uk-grid="true">
                  <div className="uk-width-auto">
                    <input
                      id="acceptPrivacy"
                      type="checkbox"
                      className="uk-checkbox"
                      checked={formData.acceptPrivacy}
                      onChange={(e) => handleInputChange('acceptPrivacy', e.target.checked)}
                    />
                  </div>
                  <div className="uk-width-expand">
                    <label htmlFor="acceptPrivacy" className="uk-form-label">
                      I agree to the Privacy Policy *
                    </label>
                    <p className="uk-text-muted uk-margin-small-top">
                      By checking this box, you acknowledge that you have read and agree to our{' '}
                      <a href="#" className="uk-link">
                        Privacy Policy
                      </a>{' '}
                      regarding data collection and use.
                    </p>
                  </div>
                </div>
                {errors.acceptPrivacy && (
                  <p className="uk-text-danger uk-margin-small-top">{errors.acceptPrivacy}</p>
                )}
              </div>
              
              {/* Billing Terms */}
              <div className="uk-card uk-card-default uk-card-body">
                <div className="uk-grid-small" uk-grid="true">
                  <div className="uk-width-auto">
                    <input
                      id="acceptBilling"
                      type="checkbox"
                      className="uk-checkbox"
                      checked={formData.acceptBilling}
                      onChange={(e) => handleInputChange('acceptBilling', e.target.checked)}
                    />
                  </div>
                  <div className="uk-width-expand">
                    <label htmlFor="acceptBilling" className="uk-form-label">
                      I agree to the Billing Terms *
                    </label>
                    <p className="uk-text-muted uk-margin-small-top">
                      By checking this box, you agree to our billing terms and authorize us to charge 
                      your payment method monthly based on active user usage. View our{' '}
                      <a href="#" className="uk-link">
                        Billing Terms
                      </a>{' '}
                      for details.
                    </p>
                  </div>
                </div>
                {errors.acceptBilling && (
                  <p className="uk-text-danger uk-margin-small-top">{errors.acceptBilling}</p>
                )}
              </div>
            </div>
            
            <div className="uk-alert-success uk-margin-medium-top" uk-alert="true">
              <p>
                <strong>Almost done!</strong> Once you accept these agreements, we'll create your company 
                instance, set up your administrator account, send invitation emails to your team members, 
                and provide you with access to your new LTC Flow workspace.
              </p>
            </div>
          </div>
        );
        
      default:
        return null;
    }
  };
  
  return (
    <div className="uk-background-muted uk-padding">
      <div className="uk-container uk-container-large">
        <div className="uk-text-center uk-margin-large-bottom">
          <h1 className="uk-heading-large uk-margin-remove">Welcome to LTC Flow</h1>
          <p className="uk-text-lead uk-text-muted uk-margin-remove-top">Let's set up your company's communication platform</p>
        </div>
        
        <div className="uk-grid-large" uk-grid="true">
          {/* Step Navigation */}
          <div className="uk-width-1-4@m">
            <div className="uk-card uk-card-default uk-card-body uk-position-sticky" style={{ top: '20px' }}>
              <h3 className="uk-card-title">Setup Progress</h3>
              
              <ul className="uk-nav uk-nav-default uk-margin-medium-top">
                {steps.map((step) => {
                  const Icon = step.icon;
                  const isCompleted = completedSteps.has(step.number);
                  const isCurrent = currentStep === step.number;
                  const isAccessible = step.number <= currentStep || completedSteps.has(step.number);
                  
                  return (
                    <li key={step.number} className={isCurrent ? 'uk-active' : ''}>
                      <button
                        onClick={() => goToStep(step.number)}
                        disabled={!isAccessible}
                        className={`uk-button uk-button-link uk-width-1-1 uk-text-left uk-padding-remove ${
                          isCompleted ? 'uk-text-success' : isAccessible ? '' : 'uk-text-muted'
                        }`}
                        style={{ cursor: isAccessible ? 'pointer' : 'not-allowed' }}
                      >
                        <div className="uk-grid-small" uk-grid="true">
                          <div className="uk-width-auto">
                            <div className={`uk-border-circle uk-flex uk-flex-middle uk-flex-center ${
                              isCompleted
                                ? 'uk-background-success uk-text-white'
                                : isCurrent
                                ? 'uk-background-primary uk-text-white'
                                : 'uk-background-muted'
                            }`} style={{ width: '24px', height: '24px' }}>
                              {isCompleted ? <FiCheck size={14} /> : step.number}
                            </div>
                          </div>
                          <div className="uk-width-expand">
                            <span className="uk-text-bold">{step.title}</span>
                          </div>
                          <div className="uk-width-auto">
                            <Icon
                              size={16}
                              className={
                                isCurrent ? 'uk-text-primary' : isCompleted ? 'uk-text-success' : 'uk-text-muted'
                              }
                            />
                          </div>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
              
              {/* Progress indicator */}
              <div className="uk-margin-medium-top">
                <div className="uk-flex uk-flex-between uk-text-meta uk-margin-small-bottom">
                  <span>Progress</span>
                  <span>{Math.round((completedSteps.size / steps.length) * 100)}%</span>
                </div>
                <progress 
                  className="uk-progress" 
                  value={completedSteps.size} 
                  max={steps.length}
                ></progress>
              </div>
            </div>
          </div>
          
          {/* Main Content */}
          <div className="uk-width-3-4@m">
            <div className="uk-card uk-card-default">
              {/* Header */}
              <div className="uk-card-header">
                <h2 className="uk-card-title uk-margin-remove">
                  Step {currentStep}: {steps[currentStep - 1].title}
                </h2>
              </div>
              
              {/* Form Content */}
              <div className="uk-card-body">
                {renderStepContent()}
              </div>
              
              {/* Navigation Buttons */}
              <div className="uk-card-footer uk-flex uk-flex-between">
                <button
                  type="button"
                  onClick={prevStep}
                  disabled={currentStep === 1}
                  className="uk-button uk-button-default"
                >
                  Previous
                </button>
                
                <button
                  type="button"
                  onClick={nextStep}
                  disabled={loading}
                  className="uk-button uk-button-primary"
                >
                  {loading && <span uk-spinner="ratio: 0.5"></span>}
                  <span className={loading ? 'uk-margin-small-left' : ''}>
                    {currentStep === 6 ? 'Complete Setup' : 'Continue'}
                  </span>
                </button>
              </div>
            </div>
            
            {/* Auto-save indicator */}
            {hasChanges && (
              <div className="uk-text-center uk-margin-top">
                <p className="uk-text-meta">
                  <span uk-spinner="ratio: 0.5"></span>
                  <span className="uk-margin-small-left">Saving progress...</span>
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CompanyOnboardingWizard;