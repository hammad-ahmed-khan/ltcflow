// frontend/src/pages/ForgotPassword/index.jsx (Updated for SMS messaging)
import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useToasts } from 'react-toast-notifications';
import Div100vh from 'react-div-100vh';
import apiClient from '../../api/apiClient';
import getInfo from '../../actions/getInfo';
import Credits from '../Login/components/Credits';
import Logo from '../Login/components/Logo';
import '../Login/Login.sass';

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
        setStep(2);
        setResendCountdown(60); // 60 second countdown
        addToast('Password reset code sent! Please check your phone.', {
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
      await apiClient.post('/api/auth/forgot-password', {
        email: email.trim().toLowerCase(),
      });
      
      setResendCountdown(60);
      addToast('Reset code sent again! Please check your phone.', {
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
                  ? 'Enter your email to receive a reset code'
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
                        <span uk-spinner="ratio: 0.8" className="uk-margin-small-right"></span>
                        Sending Code...
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

                <div className="uk-alert-primary uk-margin-bottom">
                  <p className="uk-margin-remove-bottom uk-text-small">
                    We've sent a 6-digit code to your phone number
                  </p>
                  <p className="uk-margin-remove-top uk-text-small">
                    Please check your phone for the SMS code.
                  </p>
                </div>

                <div className="uk-margin-bottom">
                  <input
                    className={`uk-input uk-border-pill uk-text-center ${errors.code ? 'uk-form-danger' : ''}`}
                    placeholder="6-Digit Code"
                    type="text"
                    maxLength="6"
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                    value={code}
                    disabled={loading}
                    autoFocus
                    style={{ letterSpacing: '3px', fontSize: '18px' }}
                  />
                  {errors.code && (
                    <div className="uk-text-danger uk-text-small uk-margin-small-top">
                      {errors.code}
                    </div>
                  )}
                </div>

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

                <div className="uk-margin-bottom">
                  <button 
                    type="submit" 
                    className="uk-button uk-button-primary uk-border-pill uk-width-1-1"
                    disabled={loading || !code.trim() || !password || !confirmPassword}
                  >
                    {loading ? (
                      <>
                        <span uk-spinner="ratio: 0.8" className="uk-margin-small-right"></span>
                        Resetting Password...
                      </>
                    ) : (
                      'Reset Password'
                    )}
                  </button>
                </div>

                {/* Resend Code Button */}
                <div className="uk-margin-bottom uk-text-center">
                  <button
                    type="button"
                    className="uk-button uk-button-text uk-text-small"
                    onClick={handleResendCode}
                    disabled={resendLoading || resendCountdown > 0 || loading}
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

            {/* Credits Footer (Updated for SMS) */}
            <form className="toggle-credits uk-text-center uk-margin-top">
              <p className="uk-text-small uk-text-muted">
                Reset codes expire after 15 minutes for security.
                <br />
                If you don't receive an SMS, please try again or contact support.
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