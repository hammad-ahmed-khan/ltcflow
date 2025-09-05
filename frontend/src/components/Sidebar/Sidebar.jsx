// 1. New Sidebar Navigation Component
// frontend/src/components/Sidebar/Sidebar.jsx

import { useState, useEffect } from 'react';
import { useGlobal } from 'reactn';
import { useNavigate, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';
import {
  FiMessageCircle, FiStar, FiUsers, FiSearch, FiSettings, FiPhone,
  FiMenu, FiX, FiMoreVertical, FiLogOut, FiUser
} from 'react-icons/fi';
import Picture from '../Picture';
import './Sidebar.sass';

function Sidebar() {
  const [nav, setNav] = useGlobal('nav');
  const [user] = useGlobal('user');
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const onlineUsers = useSelector((state) => state.io.onlineUsers);

  useEffect(() => {
    const checkIfMobile = () => {
      const mobile = window.innerWidth < 1024;
      setIsMobile(mobile);
      // Auto-collapse on mobile when in conversation
      if (mobile && location.pathname.startsWith('/room/') && !location.pathname.includes('/info')) {
        setIsCollapsed(true);
      }
    };

    checkIfMobile();
    window.addEventListener('resize', checkIfMobile);
    return () => window.removeEventListener('resize', checkIfMobile);
  }, [location]);

  const navItems = [
    { id: 'rooms', icon: FiMessageCircle, label: 'Chats', path: '/' },
    { id: 'search', icon: FiSearch, label: 'Search', path: '/' },
    { id: 'favorites', icon: FiStar, label: 'Favorites', path: '/' },
    { id: 'groups', icon: FiUsers, label: 'Groups', path: '/' },
  ];

  const handleNavClick = (navId, path) => {
    setNav(navId);
    if (location.pathname !== path) {
      navigate(path);
    }
    // Auto-collapse on mobile after selection
    if (isMobile) {
      setIsCollapsed(true);
    }
  };

  const handleSettingsClick = () => {
    setNav('settings');
    navigate('/');
    if (isMobile) setIsCollapsed(true);
  };

  const handleAdminClick = () => {
    navigate('/admin');
    if (isMobile) setIsCollapsed(true);
  };

  const toggleSidebar = () => {
    setIsCollapsed(!isCollapsed);
  };

  const getUnreadCount = (section) => {
    // You can implement unread count logic here
    // For now, returning mock data
    switch (section) {
      case 'rooms': return 3;
      case 'favorites': return 1;
      default: return 0;
    }
  };

  return (
    <>
      {/* Mobile overlay */}
      {isMobile && !isCollapsed && (
        <div className="sidebar-overlay" onClick={() => setIsCollapsed(true)} />
      )}
      
      {/* Sidebar */}
      <div className={`sidebar ${isCollapsed ? 'collapsed' : 'expanded'}`}>
        {/* Header */}
        <div className="sidebar-header">
          <div className="user-profile" onClick={() => setShowUserMenu(!showUserMenu)}>
            <Picture user={user} />
            {!isCollapsed && (
              <div className="user-info">
                <div className="user-name">{user.firstName} {user.lastName}</div>
                <div className="user-status">Online</div>
              </div>
            )}
            {!isCollapsed && <FiMoreVertical className="more-icon" />}
          </div>
          
          {/* User Menu Dropdown */}
          {showUserMenu && !isCollapsed && (
            <div className="user-menu-dropdown">
              <div className="menu-item" onClick={() => navigate('/profile')}>
                <FiUser />
                <span>Profile</span>
              </div>
              <div className="menu-item" onClick={handleSettingsClick}>
                <FiSettings />
                <span>Settings</span>
              </div>
              {user.level === 'admin' && (
                <div className="menu-item" onClick={handleAdminClick}>
                  <FiSettings />
                  <span>Admin Panel</span>
                </div>
              )}
              <div className="menu-divider" />
              <div className="menu-item logout">
                <FiLogOut />
                <span>Logout</span>
              </div>
            </div>
          )}
        </div>

        {/* Navigation Items */}
        <nav className="sidebar-nav">
          {navItems.map((item) => {
            const unreadCount = getUnreadCount(item.id);
            return (
              <div
                key={item.id}
                className={`nav-item ${nav === item.id ? 'active' : ''}`}
                onClick={() => handleNavClick(item.id, item.path)}
              >
                <div className="nav-icon">
                  <item.icon />
                  {unreadCount > 0 && (
                    <span className="unread-badge">{unreadCount}</span>
                  )}
                </div>
                {!isCollapsed && (
                  <span className="nav-label">{item.label}</span>
                )}
              </div>
            );
          })}
        </nav>

        {/* Bottom Actions */}
        <div className="sidebar-footer">
          <div className="footer-item" onClick={handleSettingsClick}>
            <FiSettings />
            {!isCollapsed && <span>Settings</span>}
          </div>
        </div>

        {/* Toggle Button */}
        <button className="sidebar-toggle" onClick={toggleSidebar}>
          {isCollapsed ? <FiMenu /> : <FiX />}
        </button>
      </div>
    </>
  );
}

export default Sidebar;