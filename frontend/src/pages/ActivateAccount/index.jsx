// frontend/src/pages/ActivateAccount/index.js (Updated for root user activation with Admin Username - No Div100vh)
import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useGlobal } from 'reactn';
import { useToasts } from 'react-toast-notifications';
import { FiX, FiUpload, FiEdit2 } from 'react-icons/fi';
import apiClient from '../../api/apiClient';
import uploadActivationImage from '../../actions/uploadActivationImage';
import getInfo from '../../actions/getInfo';
import Credits from '../Login/components/Credits';
import Logo from '../Login/components/Logo';
import '../Login/Login.sass';

function ActivateAccount() {
  const { token } = useParams();
  const navigate = useNavigate();
  const { addToast } = useToasts();
  const setEntryPath = useGlobal('entryPath')[1];
  const fileInputRef = useRef(null);

  // States for different steps
  const [step, setStep] = useState('validating'); // 'validating', 'otp', 'password', 'success', 'error'
  const [user, setUser] = useState(null);
  const [info, setInfo] = useState({});
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  // Check if this is root user activation
  const [isRootActivation, setIsRootActivation] = useState(false);

  // OTP delivery method tracking
  const [otpDeliveryInfo, setOtpDeliveryInfo] = useState({
    email: false,
    sms: false,
    method: 'email' // default
  });

  // OTP states
  const [otp, setOtp] = useState('');
  const [otpLoading, setOtpLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendCountdown, setResendCountdown] = useState(0);

  // Password states
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Root user specific states
  const [companyName, setCompanyName] = useState('');
  const [companyLogo, setCompanyLogo] = useState(null);
  const [adminUsername, setAdminUsername] = useState('');
  const [logoUploading, setLogoUploading] = useState(false);

  // Helper function to mask email
  const maskEmail = (email) => {
    if (!email) return 'your email';
    const [localPart, domain] = email.split('@');
    if (localPart.length <= 2) return email;
    const maskedLocal = localPart.charAt(0) + '*'.repeat(localPart.length - 2) + localPart.charAt(localPart.length - 1);
    return `${maskedLocal}@${domain}`;
  };

  // Helper function to mask phone number
  const maskPhoneNumber = (phone) => {
    if (!phone) return 'your phone';
    if (phone.length <= 4) return phone;
    return phone.slice(0, -4).replace(/\d/g, '*') + phone.slice(-4);
  };

  // Handle company logo upload
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
    
    setLogoUploading(true);
    setErrors(prev => ({ ...prev, companyLogo: '' }));
    
    try {
      // 🆕 Use activation-specific upload that doesn't require authentication
      const result = await uploadActivationImage(file, token, () => {}, 'square');
      const previewUrl = URL.createObjectURL(file);
      setCompanyLogo({ 
        file, 
        preview: previewUrl,
        imageId: result.data.image._id,
        imageData: result.data.image
      });
      addToast('Company logo uploaded successfully', {
        appearance: 'success',
        autoDismiss: true,
      });
    } catch (error) {
      console.error('Logo upload error:', error);
      let errorMessage = 'Failed to upload logo. Please try again.';
      
      // Handle specific error cases
      if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.response?.status === 401) {
        errorMessage = 'Invalid activation token. Please refresh the page and try again.';
      } else if (error.response?.status === 403) {
        errorMessage = 'Only root users can upload company logos.';
      }
      
      setErrors(prev => ({ ...prev, companyLogo: errorMessage }));
      addToast(errorMessage, {
        appearance: 'error',
        autoDismiss: true,
      });
    } finally {
      setLogoUploading(false);
    }
  };

  // Logo preview component (following the existing circle pattern)
  const LogoPreview = () => {
    if (!companyLogo) {
      return (
        <div 
          className="uk-flex uk-flex-middle uk-flex-center uk-border uk-border-dashed uk-background-muted"
          style={{
            width: '80px',
            height: '80px',
            borderRadius: '50%',
            cursor: 'pointer',
            transition: 'all 0.2s ease'
          }}
          onClick={() => fileInputRef.current?.click()}
        >
          <div className="uk-text-center">
            <FiUpload 
              className="uk-margin-auto uk-display-block uk-text-muted" 
              style={{ height: '24px', width: '24px' }} 
            />
            <p className="uk-text-small uk-text-muted uk-margin-remove">Logo</p>
          </div>
        </div>
      );
    }
    
    return (
      <div className="uk-position-relative" style={{ width: '80px', height: '80px' }}>
        <img
          src={companyLogo.preview}
          alt="Company Logo"
          className="uk-border-rounded"
          style={{
            width: '80px',
            height: '80px',
            objectFit: 'cover',
            borderRadius: '50%',
            border: '2px solid #e0e0e0',
            cursor: 'pointer'
          }}
          onClick={() => fileInputRef.current?.click()}
        />
        <button
          type="button"
          onClick={() => {
            setCompanyLogo(null);
            setErrors(prev => ({ ...prev, companyLogo: '' }));
          }}
          className="uk-position-absolute uk-border-circle uk-background-danger uk-padding-small uk-button uk-button-small"
          style={{ 
            top: '-5px', 
            right: '-5px',
            width: '24px',
            height: '24px',
            padding: '0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <FiX size={12} className="uk-text-white" />
        </button>
      </div>
    );
  };

  useEffect(() => {
    getInfo().then((res) => {
      setInfo(res.data);
    });
  }, []);

  // Countdown timer for resend button
  useEffect(() => {
    let timer;
    if (resendCountdown > 0) {
      timer = setTimeout(() => setResendCountdown(resendCountdown - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [resendCountdown]);

  // Initial validation when component loads
  useEffect(() => {
    if (token) {
      validateToken();
    }
  }, [token]);

  const validateToken = async () => {
    setLoading(true);
    try {
      const response = await apiClient.get(`/api/activate/${token}`);
      
      if (response.data.status === 'success') {
        setUser(response.data.user);
        setIsRootActivation(response.data.user.level === 'root');
        
        // Pre-populate company name and admin username from database for root users
        if (response.data.user.level === 'root') {
          if (response.data.company?.name) {
            setCompanyName(response.data.company.name);
          }
          if (response.data.user?.username) {
            setAdminUsername(response.data.user.username);
          }
        }
        
        setOtpDeliveryInfo(response.data.otpDelivery);
        setStep('otp');
      }
    } catch (error) {
      console.error('Token validation error:', error);
      setStep('error');
      if (error.response?.data?.message) {
        addToast(error.response.data.message, {
          appearance: 'error',
          autoDismiss: true,
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async () => {
    setOtpLoading(true);
    setErrors({});
    
    try {
      const response = await apiClient.post('/api/verify-activation-otp', {
        token,
        otp: otp.trim()
      });
      
      if (response.data.status === 'success') {
        setStep('password');
        addToast('OTP verified successfully', {
          appearance: 'success',
          autoDismiss: true,
        });
      }
    } catch (error) {
      console.error('OTP verification error:', error);
      if (error.response?.data?.message) {
        setErrors({ otp: error.response.data.message });
      } else {
        setErrors({ otp: 'Invalid OTP. Please try again.' });
      }
    } finally {
      setOtpLoading(false);
    }
  };

  const resendOtp = async () => {
    setResendLoading(true);
    
    try {
      await apiClient.post('/api/resend-activation-otp', { token });
      addToast('New OTP sent successfully', {
        appearance: 'success',
        autoDismiss: true,
      });
      setResendCountdown(60);
    } catch (error) {
      console.error('Resend OTP error:', error);
      addToast('Failed to resend OTP. Please try again.', {
        appearance: 'error',
        autoDismiss: true,
      });
    } finally {
      setResendLoading(false);
    }
  };

  const completeActivation = async () => {
    setLoading(true);
    setErrors({});

    // Client-side validation
    const newErrors = {};
    if (!password) newErrors.password = 'Password is required';
    if (!confirmPassword) newErrors.confirmPassword = 'Please confirm your password';
    if (password !== confirmPassword) {
      newErrors.password = 'Passwords do not match';
      newErrors.confirmPassword = 'Passwords do not match';
    }
    if (password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters long';
    }

    // Root user specific validation
    if (isRootActivation) {
      if (!companyName.trim()) {
        newErrors.companyName = 'Company name is required';
      }
      if (!adminUsername.trim()) {
        newErrors.adminUsername = 'Admin username is required';
      }
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      setLoading(false);
      return;
    }

    try {
      const requestData = {
        token,
        password,
        confirmPassword
      };

      // Add root user specific data
      if (isRootActivation) {
        requestData.companyName = companyName.trim();
        requestData.adminUsername = adminUsername.trim();
        if (companyLogo && companyLogo.imageId) {
          requestData.companyLogo = companyLogo.imageId;
        }
      }

      const response = await apiClient.post('/api/complete-activation', requestData);

      if (response.data.status === 'success') {
        setStep('success');
        addToast('Account activated successfully! You can now log in.', {
          appearance: 'success',
          autoDismiss: true,
        });
        
        setEntryPath(null);
        
        setTimeout(() => {
          navigate('/login', { replace: true });
        }, 3000);
      }
    } catch (error) {
      console.error('Activation error:', error);
      setLoading(false);
      
      if (error.response?.data?.message) {
        addToast(error.response.data.message, {
          appearance: 'error',
          autoDismiss: true,
        });
      } else {
        addToast('Failed to activate account. Please try again.', {
          appearance: 'error',
          autoDismiss: true,
        });
      }
    }
  };

  // Render different steps
  const renderValidatingStep = () => (
    <div className="uk-text-center">
      <div data-uk-spinner="ratio: 1.5" className="uk-margin-bottom"></div>
      <h3 className="uk-heading-small">Validating activation link...</h3>
      <p className="uk-text-muted">Please wait while we verify your activation token.</p>
    </div>
  );

  const renderOtpStep = () => (
    <div>
      <div className="uk-text-center uk-margin-bottom">
        <h2 className="uk-margin-remove-bottom">
          {otpDeliveryInfo.email && otpDeliveryInfo.sms ? 'Verify Your Code' : 
           otpDeliveryInfo.email ? 'Check Your Email' : 'Check Your Phone'}
        </h2>
        <p className="uk-text-muted uk-margin-small-top">
          {otpDeliveryInfo.email && otpDeliveryInfo.sms ? (
            <>We've sent verification codes to {maskEmail(user?.email)} and {maskPhoneNumber(user?.phone)}</>
          ) : otpDeliveryInfo.email ? (
            <>We've sent a verification code to {maskEmail(user?.email)}</>
          ) : (
            <>We've sent a verification code to {maskPhoneNumber(user?.phone)}</>
          )}
        </p>
      </div>

      <div className="uk-margin-bottom">
        <input
          type="text"
          className={`uk-input uk-text-center ${errors.otp ? 'uk-form-danger' : ''}`}
          placeholder="Enter verification code"
          value={otp}
          onChange={(e) => {
            setOtp(e.target.value);
            if (errors.otp) setErrors(prev => ({ ...prev, otp: '' }));
          }}
          maxLength="6"
          style={{ letterSpacing: '2px', fontSize: '18px' }}
        />
        {errors.otp && (
          <div className="uk-text-danger uk-text-small uk-margin-small-top">{errors.otp}</div>
        )}
      </div>

      <div className="uk-margin-bottom">
        <button
          className="uk-button uk-button-primary uk-border-pill uk-width-1-1"
          onClick={verifyOtp}
          disabled={otpLoading || !otp.trim()}
        >
          {otpLoading ? (
            <>
              <div data-uk-spinner="ratio: 0.8" className="uk-margin-small-right" />
              VERIFYING...
            </>
          ) : (
            'VERIFY CODE'
          )}
        </button>
      </div>

      <div className="uk-text-center">
        <p className="uk-text-small uk-text-muted">
          Didn't receive the code?
        </p>
        <button
          type="button"
          className="uk-button uk-button-text uk-text-small"
          onClick={resendOtp}
          disabled={resendLoading || resendCountdown > 0}
        >
          {resendLoading ? (
            'Sending...'
          ) : resendCountdown > 0 ? (
            `Resend in ${resendCountdown}s`
          ) : (
            'Resend Code'
          )}
        </button>
      </div>
    </div>
  );

  const renderPasswordStep = () => (
    <div>
      <div className="uk-text-center uk-margin-bottom">
        <h2 className="uk-margin-remove-bottom">
          {isRootActivation ? 'Complete Company Setup' : 'Set Your Password'}
        </h2>
        <p className="uk-text-muted uk-margin-small-top">
          {isRootActivation ? 
            'Set your password and configure your company details' :
            'Create a secure password for your account'
          }
        </p>
      </div>

      {/* Root user specific fields - Grouped by category */}
      {isRootActivation && (
        <>
          {/* Company Information Section */}
          <div className="uk-margin-bottom">
            <h3 className="uk-text-bold uk-margin-small-bottom" style={{ color: '#333', fontSize: '16px', borderBottom: '2px solid #e5e5e5', paddingBottom: '8px' }}>
              Company Information
            </h3>
            
            <div className="uk-margin-bottom">
              <label className="uk-form-label uk-text-bold">Company Name *</label>
              <input
                type="text"
                className={`uk-input ${errors.companyName ? 'uk-form-danger' : ''}`}
                placeholder="Enter your company name"
                value={companyName}
                onChange={(e) => {
                  setCompanyName(e.target.value);
                  if (errors.companyName) setErrors(prev => ({ ...prev, companyName: '' }));
                }}
              />
              {errors.companyName && (
                <div className="uk-text-danger uk-text-small uk-margin-small-top">{errors.companyName}</div>
              )}
            </div>

            <div className="uk-margin-bottom">
              <label className="uk-form-label uk-text-bold">Company Logo</label>
              <div className="uk-flex uk-flex-middle" style={{ gap: '16px' }}>
                <LogoPreview />
                <div className="uk-flex-1">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="uk-button uk-button-default uk-button-small"
                    disabled={logoUploading}
                  >
                    {logoUploading ? (
                      <>
                        <div data-uk-spinner="ratio: 0.6" className="uk-margin-small-right" />
                        Uploading...
                      </>
                    ) : (
                      <>
                        <FiEdit2 className="uk-margin-small-right" />
                        {companyLogo ? 'Change Logo' : 'Upload Logo'}
                      </>
                    )}
                  </button>
                  <p className="uk-text-small uk-text-muted uk-margin-small-top">
                    Upload a company logo (optional). Max 5MB, JPG/PNG/GIF/WebP formats.
                  </p>
                </div>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="uk-hidden"
                onChange={(e) => handleLogoUpload(e.target.files[0])}
              />
              {errors.companyLogo && (
                <div className="uk-text-danger uk-text-small uk-margin-small-top">{errors.companyLogo}</div>
              )}
            </div>
          </div>

          {/* Administrator Account Section */}
          <div className="uk-margin-bottom">
            <h3 className="uk-text-bold uk-margin-small-bottom" style={{ color: '#333', fontSize: '16px', borderBottom: '2px solid #e5e5e5', paddingBottom: '8px' }}>
              Administrator Account
            </h3>
            
            <div className="uk-margin-bottom">
              <label className="uk-form-label uk-text-bold">Admin Username *</label>
              <input
                type="text"
                className={`uk-input ${errors.adminUsername ? 'uk-form-danger' : ''}`}
                placeholder="Enter admin username"
                value={adminUsername}
                onChange={(e) => {
                  setAdminUsername(e.target.value);
                  if (errors.adminUsername) setErrors(prev => ({ ...prev, adminUsername: '' }));
                }}
              />
              {errors.adminUsername && (
                <div className="uk-text-danger uk-text-small uk-margin-small-top">{errors.adminUsername}</div>
              )}
              <p className="uk-text-small uk-text-muted uk-margin-small-top">
                This will be your username for logging into the system.
              </p>
            </div>
          </div>
        </>
      )}

      {/* Password fields - Grouped separately */}
      <div className="uk-margin-bottom">
        <h3 className="uk-text-bold uk-margin-small-bottom" style={{ color: '#333', fontSize: '16px', borderBottom: '2px solid #e5e5e5', paddingBottom: '8px' }}>
          {isRootActivation ? 'Account Security' : 'Set Your Password'}
        </h3>
        
        <div className="uk-margin-bottom">
          <label className="uk-form-label uk-text-bold">Password *</label>
          <input
            type="password"
            className={`uk-input ${errors.password ? 'uk-form-danger' : ''}`}
            placeholder="Enter your password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              if (errors.password) setErrors(prev => ({ ...prev, password: '' }));
            }}
          />
          {errors.password && (
            <div className="uk-text-danger uk-text-small uk-margin-small-top">{errors.password}</div>
          )}
        </div>

        <div className="uk-margin-bottom">
          <label className="uk-form-label uk-text-bold">Confirm Password *</label>
          <input
            type="password"
            className={`uk-input ${errors.confirmPassword ? 'uk-form-danger' : ''}`}
            placeholder="Confirm your password"
            value={confirmPassword}
            onChange={(e) => {
              setConfirmPassword(e.target.value);
              if (errors.confirmPassword) setErrors(prev => ({ ...prev, confirmPassword: '' }));
            }}
          />
          {errors.confirmPassword && (
            <div className="uk-text-danger uk-text-small uk-margin-small-top">{errors.confirmPassword}</div>
          )}
        </div>
        
        <div className="uk-text-center">
          <p className="uk-text-small uk-text-muted">
            Password must be at least 6 characters long
          </p>
        </div>
      </div>

      <div className="uk-margin-bottom">
        <button
          className="uk-button uk-button-primary uk-border-pill uk-width-1-1"
          onClick={completeActivation}
          disabled={loading}
        >
          {loading ? (
            <>
              <div data-uk-spinner="ratio: 0.8" className="uk-margin-small-right" />
              {isRootActivation ? 'SETTING UP COMPANY...' : 'ACTIVATING...'}
            </>
          ) : (
            isRootActivation ? 'COMPLETE SETUP' : 'ACTIVATE ACCOUNT'
          )}
        </button>
      </div>

      <div className="uk-text-center">
        <p className="uk-text-small uk-text-muted">
          {isRootActivation ? 
            'Complete the setup to activate your company account and administrator privileges.' :
            'By activating your account, you agree to our terms of service.'
          }
        </p>
      </div>
    </div>
  );

  const renderSuccessStep = () => (
    <div className="uk-text-center">
      <div className="uk-margin-bottom">
        <span className="uk-text-success" style={{ fontSize: '48px' }}>✓</span>
      </div>
      <h2 className="uk-heading-small uk-margin-remove-bottom uk-text-success">
        {isRootActivation ? 'Company Setup Complete!' : 'Account Activated!'}
      </h2>
      <p className="uk-text-muted uk-margin-small-top">
        {isRootActivation ? 
          'Your company has been set up successfully. You can now log in and start using the platform.' :
          'Your account has been activated successfully. You can now log in.'
        }
      </p>
      <p className="uk-text-small uk-text-muted">
        Redirecting to login page in a few seconds...
      </p>
    </div>
  );

  const renderErrorStep = () => (
    <div className="uk-text-center">
      <div className="uk-margin-bottom">
        <span className="uk-text-danger" style={{ fontSize: '48px' }}>✗</span>
      </div>
      <h2 className="uk-heading-small uk-margin-remove-bottom uk-text-danger">
        Activation Failed
      </h2>
      <p className="uk-text-muted uk-margin-small-top">
        There was a problem activating your account.
      </p>
      <div className="uk-margin-top">
        <button
          className="uk-button uk-button-primary uk-border-pill"
          onClick={() => navigate('/login')}
        >
          Go to Login
        </button>
      </div>
    </div>
  );

  const getCurrentStep = () => {
    switch (step) {
      case 'validating':
        return renderValidatingStep();
      case 'otp':
        return renderOtpStep();
      case 'password':
        return renderPasswordStep();
      case 'success':
        return renderSuccessStep();
      case 'error':
        return renderErrorStep();
      default:
        return renderValidatingStep();
    }
  };

  return (
    <div className="uk-background-muted" style={{ minHeight: '100vh', padding: '20px 0' }}>
      <div className="uk-flex uk-flex-middle uk-flex-center">
        <div className="uk-width-1-1 uk-width-medium@s">
          <div className="">
            <div className="uk-text-center uk-margin-bottom">
              <Logo info={info} />
              <h1 className="uk-heading-small uk-margin-remove-top">
                {isRootActivation ? 'Company Setup' : 'Account Activation'}
              </h1>
            </div>

            {getCurrentStep()}

            <div className="uk-margin-top uk-text-center">
              <Credits />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ActivateAccount;