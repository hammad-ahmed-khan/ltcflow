// 5. Mobile Navigation Toggle Hook
// frontend/src/hooks/useMobileNavigation.js

import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";

export const useMobileNavigation = () => {
  const [showPanel, setShowPanel] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 1024;
      setIsMobile(mobile);

      if (mobile) {
        // Hide panel when in conversation on mobile
        const inConversation =
          location.pathname.startsWith("/room/") &&
          !location.pathname.includes("/info") &&
          !location.pathname.includes("/manage");
        setShowPanel(!inConversation);
      } else {
        setShowPanel(true);
      }
    };

    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, [location]);

  return { showPanel, isMobile };
};
