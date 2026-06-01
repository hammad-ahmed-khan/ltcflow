import { useGlobal } from 'reactn';
import { useSelector } from 'react-redux';
import './NavBar.sass';
import {
  FiMessageCircle, FiStar, FiUsers, FiSearch, FiPhoneMissed,
} from 'react-icons/fi';

function NavBar() {
  const [nav, setNav] = useGlobal('nav');
  
  // ✅ SERVER-SIDE ONLY: Clean and simple
  const unreadState = useSelector((state) => state.unread);
  
  const totalUnreadChats = unreadState?.unreadRooms?.length || 0;
  const totalUnreadGroups = unreadState?.unreadGroups?.length || 0;
  const totalMissedCalls = unreadState?.unreadMissedCalls || 0;

  console.log("unreadState:", unreadState);
  console.log("Badge counts (server-only):", { 
    chats: totalUnreadChats, 
    groups: totalUnreadGroups, 
    missedCalls: totalMissedCalls 
  });

  return (
    <div className="nav-bar uk-flex">
      <div className={`item${nav === 'rooms' ? ' active' : ''}`} onClick={() => setNav('rooms')}>
        <div className="icon icon-with-badge">
          <FiMessageCircle />
          {totalUnreadChats > 0 && (
            <div className="nav-unread-badge">
              {totalUnreadChats > 99 ? '99+' : totalUnreadChats}
            </div>
          )}
        </div>
        <div className="text">Chats</div>
      </div>
      <div className={`item${nav === 'search' ? ' active' : ''}`} onClick={() => setNav('search')}>
        <div className="icon">
          <FiSearch />
        </div>
        <div className="text">Search</div>
      </div>
      <div className={`item${nav === 'favorites' ? ' active' : ''}`} onClick={() => setNav('favorites')}>
        <div className="icon">
          <FiStar />
        </div>
        <div className="text">Favorites</div>
      </div>
      <div
        className={`item${nav === 'groups' ? ' active' : ''}`}
        onClick={() => setNav('groups')}
      >
        <div className="icon icon-with-badge">
          <FiUsers />
          {totalUnreadGroups > 0 && (
            <div className="nav-unread-badge">
              {totalUnreadGroups > 99 ? '99+' : totalUnreadGroups}
            </div>
          )}
        </div>
        <div className="text">Groups</div>
      </div>
      <div
        className={`item${nav === 'missed-calls' ? ' active' : ''}`}
        onClick={() => setNav('missed-calls')}
      >
        <div className="icon icon-with-badge">
          <FiPhoneMissed />
          {totalMissedCalls > 0 && (
            <div className="nav-unread-badge">
              {totalMissedCalls > 99 ? '99+' : totalMissedCalls}
            </div>
          )}
        </div>
        <div className="text">Missed</div>
      </div>
    </div>
  );
}

export default NavBar;