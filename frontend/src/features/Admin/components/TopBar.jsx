import './TopBar.sass';
import { FiArrowLeft, FiMoreHorizontal } from 'react-icons/fi';

function TopBar({ back }) {
  return (
    <div className="top-bar uk-flex uk-flex-between uk-flex-middle">
      <div className="nav">
        <div className="button mobile" onClick={back}>
          <FiArrowLeft />
        </div>
      </div>
      <div className="nav">
        <div className="uk-inline">
          <div className="button" type="button">
            <FiMoreHorizontal />
          </div>
          <div data-uk-dropdown="mode: click; offset: 5; boundary: .top-bar">
            {/* Dropdown menu is now empty - you can add custom menu items here */}
          </div>
        </div>
      </div>
    </div>
  );
}

export default TopBar;