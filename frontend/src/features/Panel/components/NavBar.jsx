import { useGlobal } from 'reactn';
import './NavBar.sass';
import {
  FiMessageCircle, FiStar, FiUsers, FiSearch,
} from 'react-icons/fi';

function NavBar() {
  const [nav, setNav] = useGlobal('nav');

  return (
    <div className="nav-bar uk-flex">
      <div className={`item${nav === 'rooms' ? ' active' : ''}`} onClick={() => setNav('rooms')}>
        <div className="icon">
          <FiMessageCircle />
        </div>
        <div className="text">Chat</div>
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
      {/* UPDATED: Changed from 'meetings' to 'groups' */}
      <div
        className={`item${nav === 'groups' ? ' active' : ''}`}
        onClick={() => {
          setNav('groups');
        }}
      >
        <div className="icon">
          <FiUsers />
        </div>
        <div className="text">Groups</div>
      </div>
    </div>
  );
}

export default NavBar;