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
    }

    getInfo().then((res) => {
      setInfo(res.data);
    });
  }, [location]);

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
      navigate(['/login', '/'].includes(entryPath) ? '/' : entryPath, { replace: true });
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
      const response = await apiClient.post('/api/activate-user', {
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
        
        // Switch back to login form
        setIsActivationMode(false);
        setActivationToken('');
        setActivationEmail('');
        setActivationPassword('');
        setActivationRepeatPassword('');
        
        // Pre-fill email for login
        if (response.data.user && response.data.user.email) {
          setEmail(response.data.user.email);
        }
      }
    } catch (error) {
      let errors = {};
      if (!error.response || typeof error.response.data !== 'object') {
        errors.generic = 'Could not connect to server.';
      } else if (error.response.data.error) {
        errors.generic = error.response.data.error;
      } else {
        errors = error.response.data;
      }
      setActivationErrors(errors);
    } finally {
      setActivationLoading(false);
    }
  };

  const toggleToActivation = () => {
    setIsActivationMode(true);
    setLoginErrors({});
    setActivationErrors({});
  };

  const toggleToLogin = () => {
    setIsActivationMode(false);
    setLoginErrors({});
    setActivationErrors({});
  };

  const loginInfo = Object.keys(loginErrors).map((key) => (
    <div className="uk-text-center" key={key}>
      <span className="uk-text-danger">{loginErrors[key]}</span>
    </div>
  ));

  const activationInfo = Object.keys(activationErrors).map((key) => (
    <div className="uk-text-center" key={key}>
      <span className="uk-text-danger">{activationErrors[key]}</span>
    </div>
  ));

  const loginStyle = {
    backgroundImage: `url('${backgroundImage}')`,
  };

  return (
    <Div100vh>
      <div className="login uk-cover-container uk-flex uk-flex-center uk-flex-middle uk-overflow-hidden uk-dark">
        <div className="uk-position-cover" />
        <div className="login-scrollable uk-flex uk-flex-center uk-flex-middle uk-position-z-index">
          <Credits />

          <div className="login-inner uk-width-medium uk-padding-small" data-uk-scrollspy="cls: uk-animation-fade">
            <Logo />

            <div className="toggle-credits">
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
                  <Input
                    icon="lock"
                    placeholder="Password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                 
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
                  <Input
                    icon="mail"
                    placeholder="Your Email Address"
                    type="email"
                    value={activationEmail}
                    onChange={(e) => setActivationEmail(e.target.value)}
                    required
                  />
                  <Input
                    icon="lock"
                    placeholder="Password"
                    type="password"
                    value={activationPassword}
                    onChange={(e) => setActivationPassword(e.target.value)}
                    required
                  />
                  <Input
                    icon="lock"
                    placeholder="Confirm Password"
                    type="password"
                    value={activationRepeatPassword}
                    onChange={(e) => setActivationRepeatPassword(e.target.value)}
                    required
                  />
                  
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
                    <a
                      className="uk-link-reset uk-text-small"
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        toggleToActivation();
                      }}
                    >
                      Have an activation token? Activate account!
                    </a>
                  ) : (
                    <a
                      className="uk-link-reset uk-text-small"
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        toggleToLogin();
                      }}
                    >
                      <span data-uk-icon="arrow-left" />
                      {' '}
                      Back to Login
                    </a>
                  )}
                </div>

                {info.nodemailerEnabled && !isActivationMode && (
                  <div className="uk-text-center" style={{ marginTop: 12 }}>
                    <a className="uk-link-reset uk-text-small" href="#">
                      <Link to="/forgot-password">Forgot your password?</Link>
                    </a>
                  </div>
                )}
              </div>
            </div>

            <form className="toggle-credits uk-text-center" hidden>
              <span>
                Everyone has a sweet side
                <br />
                Everything can taste like honey
                <br />
              </span>
              <br />
              Special thanks to all of the people who believed that Clover was possible and who made it possible.
              <br />
              <br />
              This Login / Register page uses
              {' '}
              <a href="https://github.com/zzseba78/Kick-Off" target="_blank" rel="noopener noreferrer">
                Kick-Off
              </a>
              {' '}
              by zzseba78
              <br />
              <br />
              The default background image is from
              {' '}
              <a href="https://picsum.photos/" target="_blank" rel="noopener noreferrer">
                Picsum Photos
              </a>
              <br />
              <br />
              A big thank you to all contributors to React, Redux, Socket.IO, Emoji Mart, Axios, SASS and Moment
            </form>

            <div>
              <div className="uk-margin-top uk-text-center">
                <a
                  className="uk-link-reset uk-text-small toggle-credits"
                  data-uk-toggle="target: .toggle-credits ;animation: uk-animation-fade"
                  hidden
                >
                  <span data-uk-icon="arrow-left" />
                  {' '}
                  Close Credits
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Div100vh>
  );
}

export default Login;