import { useGlobal } from 'reactn';
import { useSelector } from 'react-redux';
import './NavBar.sass';
import {
  FiMessageCircle, FiStar, FiUsers, FiSearch,
} from 'react-icons/fi';

function NavBar() {
  const [nav, setNav] = useGlobal('nav');
  const roomsWithNewMessages = useSelector((state) => state.messages.roomsWithNewMessages);
  const groupsWithNewMessages = useSelector((state) => state.messages.groupsWithNewMessages); // NEW
  
  // Calculate total unread counts
  const totalUnreadChats = roomsWithNewMessages.length;
  const totalUnreadGroups = groupsWithNewMessages.length; // NEW

  console.log("NavBar - Unread chats:", roomsWithNewMessages, "Count:", totalUnreadChats);
  console.log("NavBar - Unread groups:", groupsWithNewMessages, "Count:", totalUnreadGroups); // NEW

  return (
    <div className="nav-bar uk-flex">
      <div className={`item${nav === 'rooms' ? ' active' : ''}`} onClick={() => setNav('rooms')}>
        <div className="icon icon-with-badge">
          <FiMessageCircle />
          {/* Show badge for direct messages */}
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
      {/* ENHANCED: Groups with unread badge */}
      <div
        className={`item${nav === 'groups' ? ' active' : ''}`}
        onClick={() => {
          setNav('groups');
        }}
      >
        <div className="icon icon-with-badge">
          <FiUsers />
          {/* NEW: Show badge for group messages */}
          {totalUnreadGroups > 0 && (
            <div className="nav-unread-badge">
              {totalUnreadGroups > 99 ? '99+' : totalUnreadGroups}
            </div>
          )}
        </div>
        <div className="text">Groups</div>
      </div>
    </div>
  );
}

export default NavBar;