import './TopBar.sass';
import { FiArrowLeft, FiMoreHorizontal, FiExternalLink } from 'react-icons/fi';
import Config from '../../../config';

function TopBar({ back }) {
   return (
    <div className="top-bar uk-flex uk-flex-between uk-flex-middle">
      <div className="nav">
        <div className="button" onClick={back}>
          <FiArrowLeft />
        </div>
      </div>      
    </div>
  );
}

export default TopBar;
