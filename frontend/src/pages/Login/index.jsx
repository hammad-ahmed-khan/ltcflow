import { useEffect, useState } from 'react';
import { useGlobal } from 'reactn';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import jwtDecode from 'jwt-decode';
import { useDispatch } from 'react-redux';
import { useToasts } from 'react-toast-notifications';
import Div100vh from 'react-div-100vh';
import Credits from './components/Credits';
import Logo from './components/Logo';
import Input from './components/Input';
import './Login.sass';
import Config from '../../config';
import login from '../../actions/login';
import setAuthToken from '../../actions/setAuthToken';
import initIO from '../../actions/initIO';
import getInfo from '../../actions/getInfo';
import apiClient from '../../api/apiClient';
import backgroundImage from '../../assets/background.jpg';

function Login() {
  const dispatch = useDispatch();
  const { addToast } = useToasts();
  const location = useLocation();
  const [info, setInfo] = useState({});

  // Login form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [keep, setKeep] = useState(true);
  const [loginErrors, setLoginErrors] = useState({});

  // Activation form state
  const [activationToken, setActivationToken] = useState('');
  const [activationEmail, setActivationEmail] = useState('');
  const [activationPassword, setActivationPassword] = useState('');
  const [activationRepeatPassword, setActivationRepeatPassword] = useState('');
  const [activationErrors, setActivationErrors] = useState({});
  const [activationLoading, setActivationLoading] = useState(false);
  const [isActivationMode, setIsActivationMode] = useState(false);

  const setToken = useGlobal('token')[1];
  const setUser = useGlobal('user')[1];
  const [entryPath, setEntryPath] = useGlobal('entryPath');

  const navigate = useNavigate();

  useEffect(() => {
    if (window.self !== window.top) {
      addToast(
        <a
          href="#"
          onClick={(e) => {
            e.preventDefault();
            window.top.location.href = Config.url;
          }}
        >
          <b>Click here to remove the Envato frame or meetings will not work properly.</b>
        </a>,
        {
          appearance: 'warning',
          autoDismiss: false,
        },
      );
    }

    // Check if we're coming from an activation link
    const urlParams = new URLSearchParams(location.search);
    const tokenFromUrl = urlParams.get('token');
    if (tokenFromUrl) {
      setActivationToken(tokenFromUrl);
      setIsActivationMode(true);
      // Clear entryPath when coming from activation link to prevent redirect back to activation
      setEntryPath(null);
    }

    getInfo().then((res) => {
      setInfo(res.data);
    });
  }, [location, setEntryPath]);

  const onLogin = async (e) => {
    e.preventDefault();
    try {
      const res = await login(email, password);
      if (keep) localStorage.setItem('token', res.data.token);
      if (keep) localStorage.setItem('user', JSON.stringify(jwtDecode(res.data.token)));
      setLoginErrors({});
      setAuthToken(res.data.token);
      setUser(jwtDecode(res.data.token));
      setToken(res.data.token);
      dispatch(initIO(res.data.token));
      
      // For users coming from activation, always go to home page
      // For normal login, use entryPath if it exists, otherwise go to home
      const redirectPath = isActivationMode || ['/login', '/'].includes(entryPath) ? '/' : entryPath;
      navigate(redirectPath, { replace: true });
      await setEntryPath(null);
    } catch (e) {
      let errors = {};
      if (!e.response || typeof e.response.data !== 'object') {
        errors.generic = 'Could not connect to server.';
      } else {
        errors = e.response.data;
      }
      setLoginErrors(errors);
    }
  };

  const onActivation = async (e) => {
    e.preventDefault();
    setActivationLoading(true);
    setActivationErrors({});

    // Client-side validation
    const newErrors = {};
    if (!activationToken) newErrors.token = 'Activation token is required';
    if (!activationEmail) newErrors.email = 'Email address is required';
    if (!activationPassword) newErrors.password = 'Password is required';
    if (!activationRepeatPassword) newErrors.repeatPassword = 'Please confirm your password';
    if (activationPassword !== activationRepeatPassword) {
      newErrors.password = 'Passwords do not match';
      newErrors.repeatPassword = 'Passwords do not match';
    }
    if (activationPassword.length < 6) {
      newErrors.password = 'Password must be at least 6 characters long';
    }

    if (Object.keys(newErrors).length > 0) {
      setActivationErrors(newErrors);
      setActivationLoading(false);
      return;
    }

    try {
      const response = await apiClient.post('/api/complete-activation', {
        token: activationToken,
        email: activationEmail,
        password: activationPassword,
        repeatPassword: activationRepeatPassword
      });

      if (response.data.status === 'success') {
        addToast('Account activated successfully! You can now log in.', {
          appearance: 'success',
          autoDismiss: true,
        });
        
        // Clear activation form and switch to login mode
        setIsActivationMode(false);
        setActivationToken('');
        setActivationEmail('');
        setActivationPassword('');
        setActivationRepeatPassword('');
        setActivationErrors({});
        setActivationLoading(false);
        
        // Pre-fill login email with the activation email
        setEmail(activationEmail);
        
        // Clear any stored entryPath to ensure we go to home after login
        await setEntryPath(null);
      }
    } catch (e) {
      setActivationLoading(false);
      if (e && e.response) {
        setActivationErrors(e.response.data);
      } else {
        setActivationErrors({ generic: 'Activation failed. Please try again.' });
      }
      addToast('Activation failed. Please check your details and try again.', {
        appearance: 'error',
        autoDismiss: true,
      });
    }
  };

  const pageStyle = {
    backgroundImage: `url('${backgroundImage}')`,
  };

  const loginInfo = loginErrors.generic ? (
    <div className="uk-alert-danger" data-uk-alert>
      <p>{loginErrors.generic}</p>
    </div>
  ) : null;

  const activationInfo = activationErrors.generic ? (
    <div className="uk-alert-danger" data-uk-alert>
      <p>{activationErrors.generic}</p>
    </div>
  ) : null;

  return (
    <Div100vh>
      <div className="login uk-cover-container uk-background-secondary uk-flex uk-flex-center uk-flex-middle uk-overflow-hidden uk-light" style={pageStyle}>
        <div className="uk-position-cover uk-overlay-primary" />
        <div className="login-scrollable uk-flex uk-flex-center uk-flex-middle uk-position-z-index">
          <Credits />
          <div className="login-inner uk-width-medium uk-padding-small" data-uk-scrollspy="cls: uk-animation-fade">
            <Logo />
            <div className="uk-text-center">
              <div className="uk-margin-bottom">
                <h2 className="uk-text-bold uk-margin-remove-bottom">{info.appTitle || Config.appTitle || Config.appName || 'Clover'}</h2>
                <span className="uk-text-small uk-text-muted">v{info.version}</span>
              </div>
            </div>

            <div>
              {/* Login Form */}
              <form className="toggle-class" onSubmit={onLogin} hidden={isActivationMode}>
                <fieldset className="uk-fieldset">
                  {loginInfo}
                  <Input
                    icon="user"
                    placeholder="Username (or email)"
                    type="text"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                  {loginErrors.email && <div className="uk-text-danger uk-text-small">{loginErrors.email}</div>}
                  
                  <Input
                    icon="lock"
                    placeholder="Password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  {loginErrors.password && <div className="uk-text-danger uk-text-small">{loginErrors.password}</div>}
                 
                  <div className="uk-margin-bottom">
                    <button type="submit" className="uk-button uk-button-primary uk-border-pill uk-width-1-1">
                      LOG IN
                    </button>
                  </div>
                </fieldset>
              </form>

              {/* Activation Form (replaces registration) */}
              <form className="toggle-class" onSubmit={onActivation} hidden={!isActivationMode}>
                <fieldset className="uk-fieldset">
                  <div className="uk-text-center uk-margin-bottom">
                    <h3 className="uk-text-bold">Activate Your Account</h3>
                    <p className="uk-text-small uk-text-muted">
                      Enter your activation token, email address, and set your password
                    </p>
                  </div>
                  
                  {activationInfo}
                  
                  <Input
                    icon="key"
                    placeholder="Activation Token"
                    type="text"
                    value={activationToken}
                    onChange={(e) => setActivationToken(e.target.value)}
                    required
                  />
                  {activationErrors.token && <div className="uk-text-danger uk-text-small">{activationErrors.token}</div>}
                  
                  <Input
                    icon="mail"
                    placeholder="Your Email Address"
                    type="email"
                    value={activationEmail}
                    onChange={(e) => setActivationEmail(e.target.value)}
                    required
                  />
                  {activationErrors.email && <div className="uk-text-danger uk-text-small">{activationErrors.email}</div>}
                  
                  <Input
                    icon="lock"
                    placeholder="Password"
                    type="password"
                    value={activationPassword}
                    onChange={(e) => setActivationPassword(e.target.value)}
                    required
                  />
                  {activationErrors.password && <div className="uk-text-danger uk-text-small">{activationErrors.password}</div>}
                  
                  <Input
                    icon="lock"
                    placeholder="Confirm Password"
                    type="password"
                    value={activationRepeatPassword}
                    onChange={(e) => setActivationRepeatPassword(e.target.value)}
                    required
                  />
                  {activationErrors.repeatPassword && <div className="uk-text-danger uk-text-small">{activationErrors.repeatPassword}</div>}
                  
                  <div className="uk-margin-bottom">
                    <button 
                      type="submit" 
                      className="uk-button uk-button-primary uk-border-pill uk-width-1-1"
                      disabled={activationLoading}
                    >
                      {activationLoading ? (
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

              <form className="toggle-password" hidden>
                <Input icon="mail" placeholder="Email" type="email" />
                <div className="uk-margin-bottom">
                  <button type="submit" className="uk-button uk-button-primary uk-border-pill uk-width-1-1">
                    SEND CODE
                  </button>
                </div>
              </form>

              <div>
                <div className="uk-text-center">
                  {!isActivationMode ? (
                    <>
                      <a className="uk-button uk-button-text uk-text-small" href="#" onClick={(e) => { e.preventDefault(); setIsActivationMode(true); }}>
                        Have an activation token? Click here
                      </a>
                    </>
                  ) : (
                    <>
                      <a className="uk-button uk-button-text uk-text-small" href="#" onClick={(e) => { e.preventDefault(); setIsActivationMode(false); }}>
                        Already have an account? Login here
                      </a>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Div100vh>
  );
}

export default Login;