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

  const { companyId, error } = useSelector((state) => state.company);
  const token = useGlobal('token')[0];
  const setStartingPoint = useGlobal('entryPath')[1];

  if (!['dark', 'light'].includes(Config.theme)) Config.theme = 'light';
 
  useEffect(() => {
    const initializeCompanyId = async () => {
      const subdomain = getSubdomain();
      const storedCompanyId = localStorage.getItem('companyId');
      const storedSubdomain = localStorage.getItem('subdomain');

      if (!subdomain) {
        dispatch(setCompanyError('No subdomain detected'));
        return;
      }

      // 🔹 NEW: Only verify subdomain if it changed or no stored companyId
      if (storedCompanyId && storedSubdomain === subdomain) {
        // Use stored companyId if subdomain hasn't changed
        console.log('✅ Using stored companyId:', storedCompanyId);
        dispatch(setCompanyId(storedCompanyId));
        return;
      }

      // 🔹 NEW: Verify subdomain and store results
      console.log('🔍 Verifying subdomain:', subdomain);
      try {
        const data = await verifySubdomain(subdomain);
        if (data.valid) {
          // Store both companyId and subdomain in localStorage
          localStorage.setItem('companyId', data.companyId);
          localStorage.setItem('subdomain', subdomain);
          dispatch(setCompanyId(data.companyId));
          console.log('✅ CompanyId verified and stored:', data.companyId);
        } else {
          // Clear stored data if subdomain is invalid
          localStorage.removeItem('companyId');
          localStorage.removeItem('subdomain');
          dispatch(setCompanyError('Subdomain not valid'));
        }
      } catch (err) {
        console.error('❌ Subdomain verification error:', err);
        // Clear stored data on error
        localStorage.removeItem('companyId');
        localStorage.removeItem('subdomain');
        dispatch(setCompanyError(`Error verifying subdomain: ${err.message}`));
      }
    };

    initializeCompanyId();
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

  // Handle URL token parsing (keep existing logic)
  if (!window.loaded) {
    setStartingPoint(window.location.pathname);
    const splitPath = window.location.pathname.split('/');
    const route = splitPath[1];
    const urlToken = splitPath[2];
    if (route === 'login' && urlToken && urlToken.length > 20) {
      let decoded;
      try {
        decoded = jwtDecode(urlToken);
        if (typeof decoded !== 'object' || typeof decoded.id !== 'string') return;
        setAuthToken(urlToken);
        localStorage.setItem('token', urlToken);
        localStorage.setItem('user', JSON.stringify(decoded));
        setGlobal({
          user: decoded,
          token: urlToken,
        }).then(() => {
          dispatch(initIO(urlToken));
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

  // Show error page if subdomain validation failed
  if (error) {
    return <NotFound />;
  }

  // 🔹 UPDATED: Only wait for companyId (no more authInitialized)
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