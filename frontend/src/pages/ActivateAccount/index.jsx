// frontend/src/pages/ActivateAccount/index.jsx
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useGlobal } from 'reactn';
import { useToasts } from 'react-toast-notifications';
import { FiLock, FiEye, FiEyeOff, FiCheck, FiAlertCircle } from 'react-icons/fi';
import Div100vh from 'react-div-100vh';
import apiClient from '../../api/apiClient';
import Credits from '../Login/components/Credits';
import Logo from '../Login/components/Logo';
import Input from '../Login/components/Input';
import '../Login/Login.sass';
import backgroundImage from '../../assets/background.jpg';

function ActivateAccount() {
  const { token } = useParams();
  const navigate = useNavigate();
  const { addToast } = useToasts();
  const setEntryPath = useGlobal('entryPath')[1];
  
  const [step, setStep] = useState('validating'); // 'validating', 'setPassword', 'success', 'error'
  const [user, setUser] = useState(null);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  const pageStyle = {
    backgroundImage: `url('${backgroundImage}')`,
  };

  useEffect(() => {
    // Clear entryPath when entering activation page to prevent redirect loops
    setEntryPath(null);
    
    if (token) {
      validateActivationToken();
    } else {
      setStep('error');
    }
  }, [token, setEntryPath]);

  const validateActivationToken = async () => {
    try {
      const response = await apiClient.get(`/api/activate/${token}`);
      
      if (response.data.status === 'success') {
        setUser(response.data.user);
        setStep('setPassword');
      } else {
        setStep('error');
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
        await setEntryPath(null);
        
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

  const handleNavigateToLogin = async () => {
    // Clear entryPath before navigating to login
    await setEntryPath(null);
    navigate('/login', { replace: true });
  };

  const renderValidatingStep = () => (
    <div className="uk-text-center uk-margin-large-top">
      <div className="uk-margin-bottom">
        <div data-uk-spinner="ratio: 2" className="uk-text-primary"></div>
      </div>
      <h1 className="uk-heading-small uk-margin-remove-bottom">
        Validating Token
      </h1>
      <p className="uk-text-lead uk-margin-small-top uk-text-muted">
        Please wait while we verify your activation link...
      </p>
    </div>
  );

  const renderPasswordStep = () => (
    <div>
      <div className="uk-text-center uk-margin-large-top">
        <div className="uk-margin-bottom">
          <span data-uk-icon="icon: user; ratio: 3" className="uk-text-primary"></span>
        </div>
        <h1 className="uk-heading-small uk-margin-remove-bottom">
          Activate Your Account
        </h1>
        <p className="uk-text-lead uk-margin-small-top uk-text-muted">
          Welcome, {user?.firstName}! Set your password to complete activation.
        </p>
      </div>

      <form onSubmit={handlePasswordSubmit}>
        <fieldset className="uk-fieldset">
            <div className="uk-inline uk-width-1-1">
              <Input
                icon="lock"
                placeholder="Password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button
                type="button"
                className="uk-form-icon uk-form-icon-flip"
                onClick={() => setShowPassword(!showPassword)}
                style={{ background: 'none', border: 'none', cursor: 'pointer' }}
              >
                {showPassword ? <FiEyeOff /> : <FiEye />}
              </button>
            </div>
            {errors.password && (
              <div className="uk-text-danger uk-text-small uk-margin-small-top">
                {errors.password}
              </div>
            )}

            <div className="uk-inline uk-width-1-1">
              <Input
                icon="lock"
                placeholder="Confirm Password"
                type={showConfirmPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
              <button
                type="button"
                className="uk-form-icon uk-form-icon-flip"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                style={{ background: 'none', border: 'none', cursor: 'pointer' }}
              >
                {showConfirmPassword ? <FiEyeOff /> : <FiEye />}
              </button>

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

          <div className="uk-text-center">
            <p className="uk-text-small uk-text-muted">
              By activating your account, you agree to our terms of service.
            </p>
          </div>
        </fieldset>
      </form>
    </div>
  );

  const renderSuccessStep = () => (
    <div className="uk-text-center uk-margin-large-top">
      <div className="uk-margin-bottom">
        <span data-uk-icon="icon: check; ratio: 3" className="uk-text-success"></span>
      </div>
      <h1 className="uk-heading-small uk-margin-remove-bottom uk-text-success">
        Account Activated!
      </h1>
      <p className="uk-text-lead uk-margin-small-top uk-text-muted">
        Your account has been successfully activated.
      </p>
      <p className="uk-text-muted">
        You will be redirected to the login page in a few seconds...
      </p>
      
      <div className="uk-margin-top">
        <button
          onClick={handleNavigateToLogin}
          className="uk-button uk-button-primary uk-border-pill"
        >
          Go to Login Now
        </button>
      </div>
    </div>
  );

  const renderErrorStep = () => (
    <div className="uk-text-center uk-margin-large-top">
      <div className="uk-margin-bottom">
        <span data-uk-icon="icon: warning; ratio: 3" className="uk-text-danger"></span>
      </div>
      <h1 className="uk-heading-small uk-margin-remove-bottom uk-text-danger">
        Activation Failed
      </h1>
      <p className="uk-text-lead uk-margin-small-top uk-text-muted">
        This activation link is invalid or has expired.
      </p>
      <p className="uk-text-muted">
        Please contact your administrator for a new invitation.
      </p>
      
      <div className="uk-margin-top">
        <button
          onClick={handleNavigateToLogin}
          className="uk-button uk-button-default uk-border-pill"
        >
          Back to Login
        </button>
      </div>
    </div>
  );

  return (
    <Div100vh>
      <div className="login uk-cover-container uk-flex uk-flex-center uk-flex-middle uk-overflow-hidden uk-light" style={pageStyle}>
        <div className="uk-position-cover" />
        <div className="login-scrollable uk-flex uk-flex-center uk-flex-middle uk-position-z-index">
          <Credits />
          <div className="login-inner uk-width-medium uk-padding-small" data-uk-scrollspy="cls: uk-animation-fade">
            <Logo />
            
            {step === 'validating' && renderValidatingStep()}
            {step === 'setPassword' && renderPasswordStep()}
            {step === 'success' && renderSuccessStep()}
            {step === 'error' && renderErrorStep()}
          </div>
        </div>
      </div>
    </Div100vh>
  );
}

export default ActivateAccount;