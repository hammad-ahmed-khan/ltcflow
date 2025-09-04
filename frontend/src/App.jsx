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
import apiClient from './api/apiClient';
import { usePortraitLock, LandscapeWarning } from './hooks/usePortraitLock';

function App() {
  const dispatch = useDispatch();
  const { addToast } = useToasts();
  const io = useSelector((state) => state.io.io);

  const { companyId, error } = useSelector((state) => state.company);
  const token = useGlobal('token')[0];
  const setStartingPoint = useGlobal('entryPath')[1];

  // Portrait lock hook
  const { showWarning } = usePortraitLock();

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

      // Only verify subdomain if it changed or no stored companyId
      if (storedCompanyId && storedSubdomain === subdomain) {
        // Use stored companyId if subdomain hasn't changed
        console.log('✅ Using stored companyId:', storedCompanyId);
        dispatch(setCompanyId(storedCompanyId));
        return;
      }

      // Verify subdomain and store results
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

  // Validate token after companyId is ready
  useEffect(() => {
    const validateExistingToken = async () => {
      if (!companyId) return; // Wait for companyId to be available

      const token = localStorage.getItem('token');
      const userString = localStorage.getItem('user');
      const user = userString ? JSON.parse(userString) : null;

      console.log('🔍 Token validation starting...', { companyId, hasToken: !!token, hasUser: !!user });

      if (token) {
        try {
          const decoded = jwtDecode(token, { complete: true });
          //console.log("TTOKKENN:", decoded);
          const dateNow = new Date();
          const isExpired = decoded.exp * 1000 < dateNow.getTime();

          console.log('🔍 Token details:', { 
            isExpired, 
            userId: decoded.id,
            exp: decoded.exp,
            now: Math.floor(dateNow.getTime() / 1000)
          });

          if (!isExpired) {
            // Use static import since apiClient is imported everywhere
            const res = await apiClient.post('/api/check-user', { 
              id: decoded.id 
            });
            
            console.log('🔍 Check user response:', res.data);
            
            if (res.data && !res.data.error) {
              // Token is valid, set up authentication
              setAuthToken(token);
              await setGlobal({
                token,
                user: user || jwtDecode(token),
              });
              dispatch(initIO(token));
              console.log('✅ Token validation successful');
              return;
            }
          } else {
            console.log('❌ Token expired');
          }
        } catch (e) {
          console.error('❌ Token validation failed:', e);
        }

        // If we get here, token validation failed - clear everything
        console.log('🧹 Clearing invalid token');
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        await setGlobal({
          token: null,
          user: {},
        });
      }
    };

    validateExistingToken();
  }, [companyId, dispatch]);

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

  // Only wait for companyId
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
    <>
      {/* Landscape Warning Overlay */}
      <LandscapeWarning />
      
      {/* Main App Content (Portrait Only) */}
      <div className={`theme ${Config.theme} portrait-only`}>
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
    </>
  );
}

export default App;