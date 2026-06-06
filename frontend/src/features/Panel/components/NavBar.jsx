import { useGlobal } from 'reactn';
import { useSelector } from 'react-redux';
import './NavBar.sass';
import {
  FiMessageCircle, FiStar, FiUsers, FiSearch, FiPhoneOff,
} from 'react-icons/fi';

function NavBar() {
  const [nav, setNav] = useGlobal('nav');
  const roomsWithNewMessages = useSelector((state) => state.messages.roomsWithNewMessages);
  const groupsWithNewMessages = useSelector((state) => state.messages.groupsWithNewMessages); // NEW
  const missedUnseen = useGlobal('missedUnseen')[0] || 0; // NEW: missed-call badge

  // Calculate total unread counts
  const totalUnreadChats = roomsWithNewMessages.length;
  const totalUnreadGroups = groupsWithNewMessages.length; // NEW

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
        onClick={() => {
          setNav('groups');
        }}
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
      {/* NEW: Missed calls tab */}
      <div className={`item${nav === 'missed' ? ' active' : ''}`} onClick={() => setNav('missed')}>
        <div className="icon icon-with-badge">
          <FiPhoneOff />
          {missedUnseen > 0 && (
            <div className="nav-unread-badge">
              {missedUnseen > 99 ? '99+' : missedUnseen}
            </div>
          )}
        </div>
        <div className="text">Missed</div>
      </div>
    </div>
  );
}

export default NavBar;
