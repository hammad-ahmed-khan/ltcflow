// frontend/src/pages/ActivateAccount/index.jsx
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useToasts } from 'react-toast-notifications';
import { FiUser, FiMail, FiLock, FiEye, FiEyeOff, FiCheck } from 'react-icons/fi';
import apiClient from '../../api/apiClient';
import './ActivateAccount.sass';

function ActivateAccount() {
  const { token } = useParams();
  const navigate = useNavigate();
  const { addToast } = useToasts();
  
  const [step, setStep] = useState('validating'); // 'validating', 'setPassword', 'success', 'error'
  const [user, setUser] = useState(null);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    validateActivationToken();
  }, [token]);

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
    if (password !== confirmPassword) newErrors.confirmPassword = 'Passwords do not match';
    
    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) return;

    setLoading(true);
    
    try {
      const response = await apiClient.post('/api/complete-activation', {
        token,
        password
      });

      if (response.data.status === 'success') {
        setStep('success');
        addToast('Account activated successfully!', {
          appearance: 'success',
          autoDismiss: true,
        });
        
        // Redirect to login after 3 seconds
        setTimeout(() => {
          navigate('/login');
        }, 3000);
      }
    } catch (error) {
      console.error('Activation error:', error);
      
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
    } finally {
      setLoading(false);
    }
  };

  const renderValidatingStep = () => (
    <div className="activation-step">
      <div className="activation-icon">
        <div className="spinner" />
      </div>
      <h2>Validating Activation Link</h2>
      <p>Please wait while we verify your activation link...</p>
    </div>
  );

  const renderPasswordStep = () => (
    <div className="activation-step">
      <div className="activation-icon">
        <FiUser size={48} />
      </div>
      
      <h2>Welcome, {user?.firstName}!</h2>
      <p>Set your password to complete account activation</p>
      
      <div className="user-info">
        <div className="info-item">
          <FiMail size={16} />
          <span>{user?.email}</span>
        </div>
        <div className="info-item">
          <FiUser size={16} />
          <span>@{user?.username}</span>
        </div>
      </div>

      <form onSubmit={handlePasswordSubmit} className="activation-form">
        <div className="form-group">
          <label htmlFor="password">New Password</label>
          <div className="password-input">
            <FiLock className="input-icon" />
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              className={errors.password ? 'error' : ''}
            />
            <button
              type="button"
              className="password-toggle"
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? <FiEyeOff size={20} /> : <FiEye size={20} />}
            </button>
          </div>
          {errors.password && <span className="error-text">{errors.password}</span>}
        </div>

        <div className="form-group">
          <label htmlFor="confirmPassword">Confirm Password</label>
          <div className="password-input">
            <FiLock className="input-icon" />
            <input
              id="confirmPassword"
              type={showPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm your password"
              className={errors.confirmPassword ? 'error' : ''}
            />
          </div>
          {errors.confirmPassword && <span className="error-text">{errors.confirmPassword}</span>}
        </div>

        <button
          type="submit"
          className="activation-button"
          disabled={loading}
        >
          {loading ? (
            <>
              <div className="button-spinner" />
              Activating Account...
            </>
          ) : (
            'Activate Account'
          )}
        </button>
      </form>
    </div>
  );

  const renderSuccessStep = () => (
    <div className="activation-step">
      <div className="activation-icon success">
        <FiCheck size={48} />
      </div>
      
      <h2>Account Activated!</h2>
      <p>Your account has been successfully activated.</p>
      <p>You will be redirected to the login page in a few seconds...</p>
      
      <button
        onClick={() => navigate('/login')}
        className="activation-button"
      >
        Go to Login
      </button>
    </div>
  );

  const renderErrorStep = () => (
    <div className="activation-step">
      <div className="activation-icon error">
        ❌
      </div>
      
      <h2>Activation Failed</h2>
      <p>This activation link is invalid or has expired.</p>
      <p>Please contact your administrator for a new invitation.</p>
      
      <button
        onClick={() => navigate('/login')}
        className="activation-button secondary"
      >
        Back to Login
      </button>
    </div>
  );

  return (
    <div className="activate-account">
      <div className="activation-container">
        <div className="activation-card">
          {step === 'validating' && renderValidatingStep()}
          {step === 'setPassword' && renderPasswordStep()}
          {step === 'success' && renderSuccessStep()}
          {step === 'error' && renderErrorStep()}
        </div>
      </div>
    </div>
  );
}

export default ActivateAccount;