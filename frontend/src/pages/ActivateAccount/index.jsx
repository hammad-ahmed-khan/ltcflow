// frontend/src/pages/ActivateAccount/index.jsx (Updated with OTP verification)
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useGlobal } from 'reactn';
import { useToasts } from 'react-toast-notifications';
import Div100vh from 'react-div-100vh';
import apiClient from '../../api/apiClient';
import getInfo from '../../actions/getInfo';
import Credits from '../Login/components/Credits';
import Logo from '../Login/components/Logo';
import '../Login/Login.sass';

function ActivateAccount() {
  const { token } = useParams();
  const navigate = useNavigate();
  const { addToast } = useToasts();
  const setEntryPath = useGlobal('entryPath')[1]; // Use ReactN global state

  // States for different steps
  const [step, setStep] = useState('validating'); // 'validating', 'otp', 'password', 'success'
  const [user, setUser] = useState(null);
  const [info, setInfo] = useState({});
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  // OTP states
  const [otp, setOtp] = useState('');
  const [otpLoading, setOtpLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendCountdown, setResendCountdown] = useState(0);

  // Password states
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

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

  // Validate token and send OTP on component mount
  useEffect(() => {
    if (token) {
      validateTokenAndSendOTP();
    }
  }, [token]);

  const validateTokenAndSendOTP = async () => {
    try {
      setStep('validating');
      const response = await apiClient.get(`/api/activate/${token}`);

      if (response.data.status === 'success') {
        setUser(response.data.user);
        if (response.data.nextStep === 'verify_otp') {
          setStep('otp');
          setResendCountdown(60); // 60 second countdown
          addToast('Verification code sent to your email!', {
            appearance: 'success',
            autoDismiss: true,
          });
        } else {
          // Fallback to password step if OTP not required
          setStep('password');
        }
      }
    } catch (error) {
      console.error('Token validation error:', error);
      setStep('error');
      
      if (error.response?.data?.message) {
        addToast(error.response.data.message, {
          appearance: 'error',
          autoDismiss: true,
        });
      } else {
        addToast('Invalid or expired activation link.', {
          appearance: 'error',
          autoDismiss: true,
        });
      }
    }
  };

  const handleOtpSubmit = async (e) => {
    e.preventDefault();
    
    // Validation
    const newErrors = {};
    if (!otp.trim()) newErrors.otp = 'Verification code is required';
    if (!/^\d{6}$/.test(otp.trim())) newErrors.otp = 'Code must be 6 digits';
    
    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) return;

    setOtpLoading(true);
    
    try {
      const response = await apiClient.post('/api/verify-activation-otp', {
        token,
        otp: otp.trim()
      });

      if (response.data.status === 'success') {
        setStep('password');
        addToast('Code verified! Now set your password.', {
          appearance: 'success',
          autoDismiss: true,
        });
      }
    } catch (error) {
      console.error('OTP verification error:', error);
      
      if (error.response?.data?.errors) {
        setErrors(error.response.data.errors);
      } else if (error.response?.data?.message) {
        setErrors({ otp: error.response.data.message });
      } else {
        setErrors({ otp: 'Failed to verify code. Please try again.' });
      }
    } finally {
      setOtpLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (resendCountdown > 0) return;
    
    setResendLoading(true);
    try {
      await apiClient.post('/api/resend-activation-otp', { token });
      
      setResendCountdown(60);
      addToast('New verification code sent!', {
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

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    
    // Validation
    const newErrors = {};
    if (!password) newErrors.password = 'Password is required';
    if (password.length < 6) newErrors.password = 'Password must be at least 6 characters';
    if (!confirmPassword) newErrors.confirmPassword = 'Please confirm your password';
    if (password !== confirmPassword) newErrors.confirmPassword = 'Passwords do not match';
    
    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) return;

    setLoading(true);
    
    try {
      const response = await apiClient.post('/api/complete-activation', {
        token,
        password,
        confirmPassword
      });

      if (response.data.status === 'success') {
        setStep('success');
        addToast('Account activated successfully!', {
          appearance: 'success',
          autoDismiss: true,
        });
        
        // Clear entryPath before redirecting to login
        setEntryPath(null);
        
        // Redirect to login after 3 seconds
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

  const handleNavigateToLogin = () => {
    // Clear entryPath before navigating to login
    setEntryPath(null);
    navigate('/login', { replace: true });
  };

  const renderValidatingStep = () => (
    <div className="uk-text-center uk-margin-top">
      <div className="uk-margin-bottom">
        <div data-uk-spinner="ratio: 2" className="uk-text-primary"></div>
      </div>
      <h1 className="uk-heading uk-margin-remove-bottom">
        Validating Token
      </h1>
      <p className="uk-text-lead uk-margin-small-top uk-text-muted">
        Please wait while we verify your activation link...
      </p>
    </div>
  );

  const renderOtpStep = () => (
    <div>
      <div className="uk-text-center uk-margin-top">
        <div className="uk-margin-bottom">
          <span data-uk-icon="icon: mail; ratio: 3" className="uk-text-primary"></span>
        </div>
        <h1 className="uk-heading uk-margin-remove-bottom">
          Verify Your Email
        </h1>
        <p className="uk-text-lead uk-margin-small-top uk-text-muted">
          We've sent a verification code to {user?.email}
        </p>
      </div>

      <form onSubmit={handleOtpSubmit}>
        {errors.general && (
          <div className="uk-alert-danger uk-margin-bottom" uk-alert="true">
            <p className="uk-margin-remove">{errors.general}</p>
          </div>
        )}

        <div className="uk-margin-bottom">
          <input
            className={`uk-input uk-border-pill uk-text-center ${
              errors.otp ? 'uk-form-danger' : ''
            }`}
            type="text"
            placeholder="Enter 6-digit code"
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
            maxLength={6}
            style={{ 
              fontSize: '24px', 
              letterSpacing: '8px',
              fontWeight: 'bold'
            }}
            autoComplete="one-time-code"
            inputMode="numeric"
            pattern="[0-9]*"
          />
          {errors.otp && (
            <div className="uk-text-danger uk-text-small uk-margin-small-top uk-text-center">
              {errors.otp}
            </div>
          )}
        </div>

        <div className="uk-margin-bottom">
          <button
            type="submit"
            className="uk-button uk-button-primary uk-border-pill uk-width-1-1"
            disabled={otpLoading || otp.length !== 6}
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

        <div className="uk-text-center uk-margin-bottom">
          <p className="uk-text-small uk-text-muted uk-margin-small-bottom">
            Didn't receive the code?
          </p>
          <button
            type="button"
            onClick={handleResendOtp}
            disabled={resendCountdown > 0 || resendLoading}
            className="uk-button uk-button-link uk-text-small"
            style={{ padding: '0', minHeight: 'auto' }}
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
      </form>
    </div>
  );

  const renderPasswordStep = () => (
    <div>
      <div className="uk-text-center uk-margin-top">
        <div className="uk-margin-bottom">
          <span data-uk-icon="icon: user; ratio: 3" className="uk-text-primary"></span>
        </div>
        <h1 className="uk-heading uk-margin-remove-bottom">
          Set Your Password
        </h1>
        <p className="uk-text-lead uk-margin-small-top uk-text-muted">
          Welcome, {user?.firstName}! Create a password to complete activation.
        </p>
      </div>

      <form onSubmit={handlePasswordSubmit}>
        {errors.general && (
          <div className="uk-alert-danger uk-margin-bottom" uk-alert="true">
            <p className="uk-margin-remove">{errors.general}</p>
          </div>
        )}

        <div className="uk-margin-bottom">
          <input
            className={`uk-input uk-border-pill ${
              errors.password ? 'uk-form-danger' : ''
            }`}
            type="password"
            placeholder="Password (min. 6 characters)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
          />
          {errors.password && (
            <div className="uk-text-danger uk-text-small uk-margin-small-top">
              {errors.password}
            </div>
          )}
        </div>

        <div className="uk-margin-bottom">
          <input
            className={`uk-input uk-border-pill ${
              errors.confirmPassword ? 'uk-form-danger' : ''
            }`}
            type="password"
            placeholder="Confirm Password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            autoComplete="new-password"
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
            disabled={loading}
          >
            {loading ? (
              <>
                <div data-uk-spinner="ratio: 0.8" className="uk-margin-small-right" />
                ACTIVATING...
              </>
            ) : (
              'ACTIVATE ACCOUNT'
            )}
          </button>
        </div>
      </form>
    </div>
  );

  const renderSuccessStep = () => (
    <div className="uk-text-center uk-margin-top">
      <div className="uk-margin-bottom">
        <span data-uk-icon="icon: check; ratio: 4" className="uk-text-success"></span>
      </div>
      <h1 className="uk-heading uk-margin-remove-bottom">
        Account Activated!
      </h1>
      <p className="uk-text-lead uk-margin-small-top uk-text-muted">
        Your account has been successfully activated.
      </p>
      <p className="uk-text-small uk-text-muted uk-margin-medium-top">
        Redirecting to login page in a few seconds...
      </p>
      <button
        onClick={handleNavigateToLogin}
        className="uk-button uk-button-primary uk-border-pill uk-margin-top"
      >
        Go to Login
      </button>
    </div>
  );

  const renderErrorStep = () => (
    <div className="uk-text-center uk-margin-top">
      <div className="uk-margin-bottom">
        <span data-uk-icon="icon: close; ratio: 4" className="uk-text-danger"></span>
      </div>
      <h1 className="uk-heading uk-margin-remove-bottom">
        Activation Failed
      </h1>
      <p className="uk-text-lead uk-margin-small-top uk-text-muted">
        The activation link is invalid or has expired.
      </p>
      <button
        onClick={handleNavigateToLogin}
        className="uk-button uk-button-primary uk-border-pill uk-margin-top"
      >
        Back to Login
      </button>
    </div>
  );

  return (
    <Div100vh>
      <div className="login uk-cover-container uk-flex uk-flex-center uk-flex-middle uk-overflow-hidden uk-dark">
        <div className="uk-position-cover" />
        <div className="login-scrollable uk-flex uk-flex-center uk-flex-middle uk-position-z-index">
          <Credits />
          <div className="login-inner uk-width-medium uk-padding-small" data-uk-scrollspy="cls: uk-animation-fade">
            <Logo />
            
            {step === 'validating' && renderValidatingStep()}
            {step === 'otp' && renderOtpStep()}
            {step === 'password' && renderPasswordStep()}
            {step === 'success' && renderSuccessStep()}
            {step === 'error' && renderErrorStep()}
          </div>
        </div>
      </div>
    </Div100vh>
  );
}

export default ActivateAccount;