import { useEffect } from 'react';
import { getGlobal, useGlobal, setGlobal } from 'reactn';
import './App.sass';
import {
  BrowserRouter as Router, Routes, Route, Navigate,
} from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import jwtDecode from 'jwt-decode';
import { useToasts } from 'react-toast-notifications';
import Home from './pages/Home';
import Login from './pages/Login';
import ActivateAccount from './pages/ActivateAccount';
import ForgotPassword from './pages/ForgotPassword';
import NotFound from './pages/NotFound';
import Loading from './components/Loading';
import Config from './config';
import setAuthToken from './actions/setAuthToken';
import initIO from './actions/initIO';
import { setCompanyId, setCompanyError } from './actions/companyActions';
import { getSubdomain, verifySubdomain } from './utils/domainUtils';

function App() {
  const dispatch = useDispatch();
  const { addToast } = useToasts();
  const io = useSelector((state) => state.io.io);

  const { companyId, error } = useSelector((state) => state.company); // ⬅ Here
  const token = useGlobal('token')[0];
  const setStartingPoint = useGlobal('entryPath')[1];

  if (!['dark', 'light'].includes(Config.theme)) Config.theme = 'light';
 
  useEffect(() => {
    const subdomain = getSubdomain();

    if (!subdomain) {
      dispatch(setCompanyError('No subdomain detected'));
      return;
    }

    verifySubdomain(subdomain)
      .then(data => {
        if (data.valid) {
          dispatch(setCompanyId(data.companyId));
        } else {
          dispatch(setCompanyError('Subdomain not valid'));
        }
      })
      .catch(err => {
        dispatch(setCompanyError(`Error verifying subdomain: ${err.message}`));
      });
  }, [dispatch]);

  useEffect(() => {
    if (!io || !getGlobal().user || !token) return;
    let focusCount = 0;
    const interval = setInterval(() => {
      if (!document.hasFocus()) {
        focusCount++;
        if (focusCount === 10) {
          io.emit('status', { status: 'away' });
        }
      } else if (focusCount !== 0) {
        focusCount = 0;
        io.emit('status', { status: 'online' });
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [io, token]);

  useEffect(() => {
    return () => {
      try {
        if (getGlobal().audioStream) {
          getGlobal()
            .audioStream.getTracks()
            .forEach((track) => track.stop());
        }
      } catch (e) {}
      try {
        if (getGlobal().videoStream) {
          getGlobal()
            .videoStream.getTracks()
            .forEach((track) => track.stop());
        }
      } catch (e) {}
    };
  }, []);

  if (!window.loaded) {
    setStartingPoint(window.location.pathname);
    const splitPath = window.location.pathname.split('/');
    const route = splitPath[1];
    const token = splitPath[2];
    if (route === 'login' && token && token.length > 20) {
      let decoded;
      try {
        decoded = jwtDecode(token);
        if (typeof decoded !== 'object' || typeof decoded.id !== 'string') return;
        setAuthToken(token);
        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify(decoded));
        setGlobal({
          user: decoded,
          token,
        }).then(() => {
          dispatch(initIO(token));
        });
      } catch (e) {
        addToast('Invalid token provided in URL. You can still login manually.', {
          appearance: 'error',
          autoDismiss: true,
        });
      }
    }
    window.loaded = true;
  }

  // 🛑 Show early return before app loads
  if (error) {
    return <NotFound />;
  }

  if (!companyId) {
    return (
      <div className="login uk-cover-container uk-background-secondary uk-flex uk-flex-center uk-flex-middle uk-overflow-hidden uk-light">
        <div className="uk-position-cover uk-overlay-primary" />
        <div className="login-scrollable uk-flex uk-flex-center uk-flex-middle uk-position-z-index">
          <div className="login-inner uk-width-medium uk-padding-small">
            <Loading 
              message="Verifying workspace..." 
              size="large"
              variant="spinner"
            />
          </div>
        </div>
      </div>
    );
  }

return (
  <div className={`theme ${Config.theme}`}>
    <Router>
      <Routes>
        <Route path="/activate/:token" element={<ActivateAccount />} />
        {/* 🔹 NEW: Add forgot password route */}
        <Route 
          path="/forgot-password" 
          element={token ? <Navigate to="/" /> : <ForgotPassword />} 
        />
        <Route 
          path="/login" 
          element={token ? <Navigate to="/" /> : <Login />} 
        />
        <Route 
          path="/*" 
          element={!token ? <Navigate to="/login" /> : <Home />} 
        />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Router>
  </div>
);
}

export default App;
