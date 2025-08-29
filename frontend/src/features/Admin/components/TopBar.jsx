import './TopBar.sass';
import { FiArrowLeft, FiMoreHorizontal, FiMenu, FiX, FiBarChart2 } from 'react-icons/fi';
import { useState, useEffect } from 'react';

function TopBar({ back }) {
  const [isMobile, setIsMobile] = useState(false);

  // Check if we're on mobile (below 700px, matching UIKit's @l breakpoint)
  useEffect(() => {
    const checkIfMobile = () => {
      setIsMobile(window.innerWidth < 700);
    };

    checkIfMobile();
    window.addEventListener('resize', checkIfMobile);
    return () => window.removeEventListener('resize', checkIfMobile);
  }, []);

  return (
    <div className="top-bar uk-flex uk-flex-between uk-flex-middle">
      <div className="nav uk-flex uk-flex-middle">
        <div className="button mobile" onClick={back}>
          <FiArrowLeft />
        </div>
       
      </div>

      <div className="nav">
        <div className="uk-inline">
            {/* Mobile Button to open BillingDashboard modal */}
        {isMobile && (
          <div
            className="button hamburger-menu"
            uk-toggle="target: #billing-dashboard-modal"
            title="Open Billing Dashboard"
          >
        <FiBarChart2  /> {/* stats icon instead of menu */}
          </div>
        )}
        </div>
      </div>
 
    </div>
  );
}

export default TopBar;
