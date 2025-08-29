// frontend/src/pages/ForgotPassword/index.jsx (Updated for configurable OTP)
import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useToasts } from 'react-toast-notifications';
import Div100vh from 'react-div-100vh';
import apiClient from '../../api/apiClient';
import getInfo from '../../actions/getInfo';
import Credits from '../Login/components/Credits';
import Logo from '../Login/components/Logo';
import '../Login/Login.sass';

// 🆕 Helper function to mask email
const maskEmail = (email) => {
  if (!email) return 'your email';
  const [localPart, domain] = email.split('@');
  if (localPart.length <= 2) return email;
  const maskedLocal = localPart.charAt(0) + '*'.repeat(localPart.length - 2) + localPart.charAt(localPart.length - 1);
  return `${maskedLocal}@${domain}`;
};

// Helper function to mask phone number for security
const maskPhoneNumber = (phoneNumber) => {
  if (!phoneNumber) return 'your phone';
  
  // For international numbers like +1234567890
  if (phoneNumber.startsWith('+')) {
    const countryCode = phoneNumber.slice(0, phoneNumber.length - 10);
    const lastFour = phoneNumber.slice(-4);
    const maskedMiddle = '*'.repeat(phoneNumber.length - countryCode.length - 4);
    return `${countryCode}${maskedMiddle}${lastFour}`;
  }
  
  // For other formats, show first 3 and last 4 with stars in between
  if (phoneNumber.length >= 7) {
    const first = phoneNumber.slice(0, 3);
    const last = phoneNumber.slice(-4);
    const maskedMiddle = '*'.repeat(phoneNumber.length - 7);
    return `${first}${maskedMiddle}${last}`;
  }
  
  // Fallback for short numbers
  return phoneNumber.slice(0, 2) + '*'.repeat(phoneNumber.length - 2);
};

function ForgotPassword() {
  const [step, setStep] = useState(1); // 1: email, 2: code & password
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [info, setInfo] = useState({});
  const [resendLoading, setResendLoading] = useState(false);
  const [resendCountdown, setResendCountdown] = useState(0);
  
  // 🆕 OTP delivery method tracking
  const [otpDeliveryInfo, setOtpDeliveryInfo] = useState({
    email: false,
    sms: false,
    method: 'sms', // default
    userEmail: '',
    userPhone: ''
  });
  
  const { addToast } = useToasts();
  const navigate = useNavigate();

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

  const handleSendCode = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrors({});

    try {
      const response = await apiClient.post('/api/auth/forgot-password', {
        email: email.trim().toLowerCase(),
      });

      if (response.data.status === 'success') {
        // 🆕 Handle new OTP delivery info from backend
        if (response.data.otpSent) {
          setOtpDeliveryInfo({
            email: response.data.otpSent.email || false,
            sms: response.data.otpSent.sms || false,
            method: response.data.otpSent.method || 'sms',
            userEmail: response.data.user?.email || email.trim().toLowerCase(),
            userPhone: response.data.user?.phone || ''
          });
        } else {
          // Fallback for backward compatibility
          setOtpDeliveryInfo(prev => ({
            ...prev,
            userEmail: email.trim().toLowerCase(),
            userPhone: response.data.user?.phone || response.data.maskedPhone || ''
          }));
        }
        
        setStep(2);
        setResendCountdown(60);
        
        // 🆕 Dynamic toast message based on delivery method
        let toastMessage = 'Password reset code sent';
        if (response.data.otpSent?.email && response.data.otpSent?.sms) {
          toastMessage += ' to your email and phone!';
        } else if (response.data.otpSent?.email) {
          toastMessage += ' to your email address!';
        } else if (response.data.otpSent?.sms) {
          const phoneDisplay = response.data.maskedPhone || maskPhoneNumber(response.data.user?.phone) || 'your phone';
          toastMessage += ` to ${phoneDisplay}!`;
        } else {
          // Fallback message
          const phoneDisplay = response.data.maskedPhone || maskPhoneNumber(response.data.user?.phone) || 'your registered contact';
          toastMessage += ` to ${phoneDisplay}!`;
        }
        
        addToast(toastMessage, {
          appearance: 'success',
          autoDismiss: true,
        });
      }
    } catch (error) {
      console.error('Forgot password error:', error);
      
      if (error.response?.data?.errors) {
        setErrors(error.response.data.errors);
      } else if (error.response?.data?.email) {
        setErrors({ email: error.response.data.email });
      } else if (error.response?.data?.message) {
        setErrors({ email: error.response.data.message });
      } else {
        setErrors({ 
          email: 'Unable to send reset code. Please try again.' 
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResendCode = async () => {
    if (resendCountdown > 0) return;
    
    setResendLoading(true);
    try {
      const response = await apiClient.post('/api/auth/forgot-password', {
        email: email.trim().toLowerCase(),
      });
      
      // 🆕 Update delivery info from response
      if (response.data.otpSent) {
        setOtpDeliveryInfo(prev => ({
          ...prev,
          email: response.data.otpSent.email || false,
          sms: response.data.otpSent.sms || false
        }));
      }
      
      setResendCountdown(60);
      
      // 🆕 Dynamic success message
      let successMessage = 'Reset code sent again';
      if (response.data.otpSent?.email && response.data.otpSent?.sms) {
        successMessage += ' to your email and phone!';
      } else if (response.data.otpSent?.email) {
        successMessage += ' to your email!';
      } else if (response.data.otpSent?.sms) {
        const phoneDisplay = response.data.maskedPhone || maskPhoneNumber(response.data.user?.phone) || otpDeliveryInfo.userPhone || 'your phone';
        successMessage += ` to ${phoneDisplay}!`;
      } else {
        // Fallback
        const phoneDisplay = response.data.maskedPhone || maskPhoneNumber(response.data.user?.phone) || otpDeliveryInfo.userPhone || 'your registered contact';
        successMessage += ` to ${phoneDisplay}!`;
      }
      
      addToast(successMessage, {
        appearance: 'success',
        autoDismiss: true,
      });
    } catch (error) {
      addToast('Failed to resend code. Please try again.', {
        appearance: 'error',
        autoDismiss: true,
      });
    } finally {
      setResendLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrors({});

    // Client-side validation
    const newErrors = {};
    if (!code.trim()) newErrors.code = 'Verification code is required';
    if (!/^\d{6}$/.test(code.trim())) newErrors.code = 'Code must be 6 digits';
    if (!password) newErrors.password = 'New password is required';
    if (password.length < 6) newErrors.password = 'Password must be at least 6 characters';
    if (!confirmPassword) newErrors.confirmPassword = 'Please confirm your password';
    if (password !== confirmPassword) {
      newErrors.password = 'Passwords do not match';
      newErrors.confirmPassword = 'Passwords do not match';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      setLoading(false);
      return;
    }

    try {
      const response = await apiClient.post('/api/auth/reset-password', {
        email: email.trim().toLowerCase(),
        code: code.trim(),
        password,
        confirmPassword,
      });

      if (response.data.status === 'success') {
        addToast('Password reset successfully! You can now log in with your new password.', {
          appearance: 'success',
          autoDismiss: true,
        });
        navigate('/login');
      }
    } catch (error) {
      console.error('Reset password error:', error);
      
      if (error.response?.data?.errors) {
        setErrors(error.response.data.errors);
      } else if (error.response?.data?.message) {
        setErrors({ 
          general: error.response.data.message 
        });
      } else {
        setErrors({ 
          general: 'Failed to reset password. Please try again.' 
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleBackToEmail = () => {
    setStep(1);
    setCode('');
    setPassword('');
    setConfirmPassword('');
    setErrors({});
    setOtpDeliveryInfo({
      email: false,
      sms: false,
      method: 'sms',
      userEmail: '',
      userPhone: ''
    });
  };

  return (
    <Div100vh>
      <div
        className="login uk-cover-container uk-flex uk-flex-center uk-flex-middle uk-overflow-hidden uk-dark">
        <div className="uk-position-cover" />
        <div className="login-scrollable uk-flex uk-flex-center uk-flex-middle uk-position-z-index">
          <Credits />
          <div className="login-inner uk-width-medium uk-padding-small" data-uk-scrollspy="cls: uk-animation-fade">
            <Logo />
            <div className="uk-text-center uk-margin-bottom">
              <h1 className="uk-heading-primary uk-margin-remove-bottom uk-text-bold">
                {step === 1 ? 'Forgot Password' : 'Reset Password'}
              </h1>
              <p className="uk-text-lead uk-margin-small-top">
                {step === 1 
                  ? 'Enter your email address to identify your account'
                  : 'Enter the code and your new password'
                }
              </p>
            </div>

            {/* Step 1: Request Reset Code */}
            {step === 1 && (
              <form onSubmit={handleSendCode}>
                {errors.general && (
                  <div className="uk-alert-danger uk-margin-bottom" uk-alert="true">
                    <p className="uk-margin-remove">{errors.general}</p>
                  </div>
                )}

                <div className="uk-margin-bottom">
                  <input
                    className={`uk-input uk-border-pill ${errors.email ? 'uk-form-danger' : ''}`}
                    placeholder="Email Address"
                    type="email"
                    onChange={(e) => setEmail(e.target.value)}
                    value={email}
                    disabled={loading}
                    autoFocus
                  />
                  {errors.email && (
                    <div className="uk-text-danger uk-text-small uk-margin-small-top">
                      {errors.email}
                    </div>
                  )}
                </div>

                <div className="uk-margin-bottom">
                  <button 
                    type="submit" 
                    className="uk-button uk-button-primary uk-border-pill uk-width-1-1"
                    disabled={loading || !email.trim()}
                  >
                    {loading ? (
                      <>
                        <span uk-spinner="ratio: 0.7" className="uk-margin-small-right"></span>
                        Sending code...
                      </>
                    ) : (
                      'Send Reset Code'
                    )}
                  </button>
                </div>
              </form>
            )}

            {/* Step 2: Enter Code and New Password */}
            {step === 2 && (
              <form onSubmit={handleResetPassword}>
                {errors.general && (
                  <div className="uk-alert-danger uk-margin-bottom" uk-alert="true">
                    <p className="uk-margin-remove">{errors.general}</p>
                  </div>
                )}

                {/* 🆕 Dynamic delivery info display */}
                <div className="uk-text-center uk-margin-bottom">
                  <p className="uk-text-muted uk-margin-small-bottom">
                    We've sent a 6-digit code to:
                  </p>
                  
                  <div className="uk-margin-small-top">
                    {otpDeliveryInfo.email && otpDeliveryInfo.sms && (
                      <div className="uk-margin-small-bottom">
                        <div className="uk-text-emphasis" style={{ 
                          fontSize: '14px', 
                          fontWeight: 'bold',
                          backgroundColor: '#f8f9fa',
                          color: '#333',
                          padding: '6px 12px',
                          borderRadius: '15px',
                          border: '1px solid #e9ecef',
                          marginBottom: '6px',
                          display: 'inline-block'
                        }}>
                          📧 {maskEmail(otpDeliveryInfo.userEmail)}
                        </div>
                        <div style={{ margin: '6px 0', color: '#999', fontSize: '12px' }}>and</div>
                        <div className="uk-text-emphasis" style={{ 
                          fontSize: '14px', 
                          fontWeight: 'bold',
                          backgroundColor: '#f8f9fa',
                          color: '#333',
                          padding: '6px 12px',
                          borderRadius: '15px',
                          border: '1px solid #e9ecef',
                          display: 'inline-block'
                        }}>
                          📱 {maskPhoneNumber(otpDeliveryInfo.userPhone)}
                        </div>
                      </div>
                    )}
                    
                    {otpDeliveryInfo.email && !otpDeliveryInfo.sms && (
                      <span className="uk-text-emphasis" style={{ 
                        fontSize: '16px', 
                        fontWeight: 'bold',
                        backgroundColor: '#f8f9fa',
                        color: '#333',
                        padding: '8px 16px',
                        borderRadius: '20px',
                        border: '1px solid #e9ecef'
                      }}>
                        📧 {maskEmail(otpDeliveryInfo.userEmail)}
                      </span>
                    )}
                    
                    {!otpDeliveryInfo.email && otpDeliveryInfo.sms && (
                      <span className="uk-text-emphasis" style={{ 
                        fontSize: '16px', 
                        fontWeight: 'bold',
                        backgroundColor: '#f8f9fa',
                        color: '#333',
                        padding: '8px 16px',
                        borderRadius: '20px',
                        border: '1px solid #e9ecef'
                      }}>
                        📱 {maskPhoneNumber(otpDeliveryInfo.userPhone)}
                      </span>
                    )}

                    {/* Fallback display for backward compatibility */}
                    {!otpDeliveryInfo.email && !otpDeliveryInfo.sms && otpDeliveryInfo.userPhone && (
                      <span className="uk-text-emphasis" style={{ 
                        fontSize: '16px', 
                        fontWeight: 'bold',
                        backgroundColor: '#f8f9fa',
                        color: '#333',
                        padding: '8px 16px',
                        borderRadius: '20px',
                        border: '1px solid #e9ecef'
                      }}>
                        📱 {maskPhoneNumber(otpDeliveryInfo.userPhone)}
                      </span>
                    )}
                  </div>
                </div>

                {/* Verification Code Input */}
                <div className="uk-margin-bottom">
                  <input
                    className={`uk-input uk-border-pill uk-text-center ${errors.code ? 'uk-form-danger' : ''}`}
                    placeholder="Enter 6-digit code"
                    type="text"
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    value={code}
                    maxLength={6}
                    style={{ 
                      fontSize: '20px', 
                      letterSpacing: '2px', 
                      fontWeight: 'bold'
                    }}
                    disabled={loading}
                    autoComplete="one-time-code"
                    inputMode="numeric"
                    pattern="[0-9]*"
                  />
                  {errors.code && (
                    <div className="uk-text-danger uk-text-small uk-margin-small-top uk-text-center">
                      {errors.code}
                    </div>
                  )}
                </div>

                {/* New Password Input */}
                <div className="uk-margin-bottom">
                  <input
                    className={`uk-input uk-border-pill ${errors.password ? 'uk-form-danger' : ''}`}
                    placeholder="New Password"
                    type="password"
                    onChange={(e) => setPassword(e.target.value)}
                    value={password}
                    disabled={loading}
                  />
                  {errors.password && (
                    <div className="uk-text-danger uk-text-small uk-margin-small-top">
                      {errors.password}
                    </div>
                  )}
                </div>

                {/* Confirm Password Input */}
                <div className="uk-margin-bottom">
                  <input
                    className={`uk-input uk-border-pill ${errors.confirmPassword ? 'uk-form-danger' : ''}`}
                    placeholder="Confirm New Password"
                    type="password"
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    value={confirmPassword}
                    disabled={loading}
                  />
                  {errors.confirmPassword && (
                    <div className="uk-text-danger uk-text-small uk-margin-small-top">
                      {errors.confirmPassword}
                    </div>
                  )}
                </div>

                {/* Submit Button */}
                <div className="uk-margin-bottom">
                  <button 
                    type="submit" 
                    className="uk-button uk-button-primary uk-border-pill uk-width-1-1"
                    disabled={loading || !code.trim() || !password || !confirmPassword}
                  >
                    {loading ? (
                      <>
                        <span uk-spinner="ratio: 0.7" className="uk-margin-small-right"></span>
                        Resetting password...
                      </>
                    ) : (
                      'Reset Password'
                    )}
                  </button>
                </div>

                {/* Resend Code Section */}
                <div className="uk-text-center uk-margin-bottom">
                  <p className="uk-text-small uk-margin-remove-bottom uk-text-muted">
                    Didn't receive the code?
                  </p>
                  <button
                    type="button"
                    className="uk-button uk-button-text uk-text-primary"
                    onClick={handleResendCode}
                    disabled={resendLoading || resendCountdown > 0}
                    style={{ fontSize: '14px', textDecoration: 'underline' }}
                  >
                    {resendLoading ? (
                      <>
                        <span uk-spinner="ratio: 0.6" className="uk-margin-small-right"></span>
                        Sending...
                      </>
                    ) : resendCountdown > 0 ? (
                      `Resend code in ${resendCountdown}s`
                    ) : (
                      'Resend code'
                    )}
                  </button>
                </div>

                {/* Back to Email Step */}
                <div className="uk-text-center">
                  <button
                    type="button"
                    className="uk-button uk-button-text uk-text-small"
                    onClick={handleBackToEmail}
                    disabled={loading}
                  >
                    ← Use different email
                  </button>
                </div>
              </form>
            )}

            {/* Back to Login Link */}
            <div className="uk-text-center uk-margin-top">
              <Link to="/login" className="uk-link-reset uk-text-small">
                ← Back to Login
              </Link>
            </div>

            {/* 🆕 Updated Credits Footer */}
            <form className="toggle-credits uk-text-center uk-margin-top">
              <p className="uk-text-small uk-text-muted">
                Reset codes expire after 15 minutes for security.
                <br />
                {otpDeliveryInfo.email && otpDeliveryInfo.sms ? 
                  'Check both your email and phone for the code.' :
                  otpDeliveryInfo.email ? 
                    'Check your email for the code.' :
                    'Check your phone for the SMS code.'
                }
              </p>
            </form>

            <div>
              
            </div>
          </div>
        </div>
      </div>
    </Div100vh>
  );
}

export default ForgotPassword;