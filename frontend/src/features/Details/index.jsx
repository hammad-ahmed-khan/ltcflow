// Details/index.jsx

import { useNavigate, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { useEffect, useState } from 'react';
import { useGlobal } from 'reactn';
import Info from './components/Info';
import Room from './components/Room';
import BillingDashboard from './components/BillingDashboard';
import './Details.sass';
import TopBar from './components/TopBar';
import search from '../../actions/search';

function Details() {
  const location = useLocation();
  const room = useSelector((state) => state.io.room);
  const [currentUser] = useGlobal('user');
  const [users, setUsers] = useState([]);
  const [userStats, setUserStats] = useState(null);

  const navigate = useNavigate();
  const back = () => navigate(`/room/${room._id}`, { replace: true });

  // Fetch user data function
  const fetchUserData = async () => {
    if (location.pathname.startsWith('/admin')) {
      try {
        const res = await search(null, 10000);
        setUsers(res.data.users);
      } catch (err) {
        console.error('Failed to fetch users for billing dashboard:', err);
      }
    }
  };

  // Initial fetch when component mounts
  useEffect(() => {
    fetchUserData();
  }, [location.pathname]);

  // Set up background refresh every 30 seconds when on admin page
  useEffect(() => {
    if (location.pathname.startsWith('/admin')) {
      const interval = setInterval(() => {
        fetchUserData();
      }, 30000); // Refresh every 30 seconds

      return () => clearInterval(interval);
    }
  }, [location.pathname]);

  // Calculate user statistics when users change
  useEffect(() => {
    if (users.length > 0 && currentUser) {
      const getUserStatistics = () => {
        try {
          const applyAdminPrivilegeFilter = (users) => {
            if (!currentUser || !currentUser.level) return [];
            
            if (currentUser.level === 'root') {
              return users;
            } else if (currentUser.level === 'admin') {
              return users.filter(user => user.level !== 'root');
            }
            return [];
          };

          const privilegeFilteredUsers = applyAdminPrivilegeFilter(users);
          const totalUsers = privilegeFilteredUsers.length;
          const activeUsers = privilegeFilteredUsers.filter(u => u.status === 'active').length;
          const pendingUsers = privilegeFilteredUsers.filter(u => u.status === 'pending').length;
          const expiredUsers = privilegeFilteredUsers.filter(u => u.status === 'expired').length;
          const deactivatedUsers = privilegeFilteredUsers.filter(u => u.status === 'deactivated').length;
          
          return { totalUsers, activeUsers, pendingUsers, expiredUsers, deactivatedUsers };
        } catch (error) {
          console.error('Error calculating user statistics:', error);
          return { totalUsers: 0, activeUsers: 0, pendingUsers: 0, expiredUsers: 0, deactivatedUsers: 0 };
        }
      };

      const stats = getUserStatistics();
      setUserStats(stats);
    }
  }, [users, currentUser]);

  const getComponent = () => {
    if (location.pathname.startsWith('/admin')) {
      return <BillingDashboard userStats={userStats || {}} />;
    }
    
    if (location.pathname.startsWith('/room') && room) return <Room />;
    if (expand && room) return <Room />;
    return <Info />;
  };

  const expand = location.pathname.endsWith('/info');

  return (
    <div className={`details${expand ? ' expand' : ' uk-visible@l'}`}>
      {expand && <TopBar back={back} />}
      {getComponent(expand)}
    </div>
  );
}

export default Details;