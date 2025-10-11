import './TopBar.sass';
import {
  FiMoreHorizontal, FiSettings, FiHome, FiPlusCircle, FiCpu,
} from 'react-icons/fi';
import { useGlobal } from 'reactn';
import { useNavigate, useLocation } from 'react-router-dom';
import { useToasts } from 'react-toast-notifications';
import { useSelector } from 'react-redux';
import getMeetingRoom from '../../../actions/getMeetingRoom';
import Picture from '../../../components/Picture';

function TopBar() {
  const onlineUsers = useSelector((state) => state.io.onlineUsers);
  const io = useSelector((state) => state.io.io);
  const [nav, setNav] = useGlobal('nav');
  const setToken = useGlobal('token')[1];
  const setPanel = useGlobal('panel')[1];
  const setOver = useGlobal('over')[1];
  const [user, setUser] = useGlobal('user');
  const setAudio = useGlobal('audio')[1];
  const setVideo = useGlobal('video')[1];
  const setCallDirection = useGlobal('callDirection')[1];

  const navigate = useNavigate();
  const location = useLocation();
  const { addToast } = useToasts();

  const logout = async () => {
    io.disconnect();
    const { username } = user;
    
    // Clear all authentication-related data including companyId
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('companyId');
    localStorage.removeItem('subdomain');
    
    await setToken(null);
    await setUser({});
    addToast(`User ${username} logged out!`, {
      appearance: 'success',
      autoDismiss: true,
    });
    navigate('/login', { replace: true });
  };

  const errorToast = (content) => {
    addToast(content, {
      appearance: 'error',
      autoDismiss: true,
    });
  };

  const newMeeting = async () => {
    await setAudio(true);
    await setVideo(true);
    await setCallDirection('meeting');
    try {
      const res = await getMeetingRoom();
      navigate(`/meeting/${res.data._id}`, { replace: true });
    } catch (e) {
      errorToast('Server error. Unable to initiate call.');
    }
  };

  // 🆕 NEW: Open Crisp chat for support
  const openSupport = () => {
    if (window.$crisp) {
      window.$crisp.push(['do', 'chat:open']);
    } else {
      errorToast('Support chat is not available at the moment.');
    }
  };

  const getStatus = () => {
    if (onlineUsers.filter((u) => u.id === user.id && u.status === 'busy').length > 0) return 'busy';
    if (onlineUsers.filter((u) => u.id === user.id && u.status === 'online').length > 0) return 'online';
    if (onlineUsers.filter((u) => u.id === user.id && u.status === 'away').length > 0) return 'away';
    return null;
  };

  // Role-based permission checks
  const canAccessAdmin = ['root', 'admin'].includes(user.level);
  const canCreateGroups = ['root', 'admin', 'manager'].includes(user.level);
  const canCreateMeetings = ['root', 'admin', 'manager'].includes(user.level);

  return (
    <div className="top-bar uk-flex uk-flex-between uk-flex-middle">
      <div className="uk-flex uk-flex-middle">
        <div
          className="profile"
          onClick={() => {
            setOver(true);
            setNav('rooms');
            navigate('/', { replace: true });
          }}
        >
          <Picture user={user || {}} />
        </div>
        {getStatus() && <div className={`dot ${getStatus()}`} />}
      </div>
      <div className="nav">
        {canAccessAdmin && (
          <div
            className={`button${location.pathname.startsWith('/admin') ? ' active' : ''}`}
            onClick={() => {
              setOver(true);
              navigate('/admin', { replace: true });
            }}
          >
            <FiCpu />
          </div>
        )}
        <div
          className="button mobile"
          onClick={() => {
            setOver(true);
            navigate('/', { replace: true });
          }}
        >
          <FiHome />
        </div>
        {canCreateGroups && (
          <div className="button" onClick={() => setPanel('createGroup')}>
            <FiPlusCircle />
          </div>
        )}
        <div
          className={`button${nav === 'settings' ? ' active' : ''}`}
          onClick={() => {
            setNav('settings');
          }}
        >
          <FiSettings />
        </div>
        <div className="uk-inline">
          <div className="button" type="button">
            <FiMoreHorizontal />
          </div>
          <div data-uk-dropdown="mode: click; offset: 5; boundary: .top-bar">
            {canCreateGroups && (
              <div className="link" onClick={() => setPanel('createGroup')}>
                New Group
              </div>
            )}
            {canAccessAdmin && <div className="divider" />}
            {canAccessAdmin && (
              <div
                className="link"
                onClick={() => {
                  setOver(true);
                  navigate('/admin', { replace: true });
                }}
              >
                Admin Panel
              </div>
            )}
            {/* 🆕 NEW: Support Link - Opens Crisp Chat */}
            <div className="divider" />
            <div className="link" onClick={openSupport}>
              Support
            </div>
            <div className="divider" />
            <div className="link" onClick={logout}>
              Logout
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default TopBar;