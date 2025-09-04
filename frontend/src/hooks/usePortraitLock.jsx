import { useEffect, useState } from "react";

/**
 * Custom hook to handle portrait lock functionality
 * @returns {Object} - { isLandscape, showWarning }
 */
export const usePortraitLock = () => {
  const [isLandscape, setIsLandscape] = useState(false);
  const [showWarning, setShowWarning] = useState(false);

  useEffect(() => {
    const checkOrientation = () => {
      const landscape = window.innerWidth > window.innerHeight;
      const mobile = window.innerWidth <= 1024;

      setIsLandscape(landscape);
      setShowWarning(landscape && mobile);

      return { landscape, mobile };
    };

    const lockToPortrait = async () => {
      try {
        // Try to lock screen orientation to portrait
        if (screen.orientation && screen.orientation.lock) {
          await screen.orientation.lock("portrait");
          console.log("✅ Screen locked to portrait mode");
        }
      } catch (error) {
        console.log("❌ Could not lock screen orientation:", error);
        // Fallback handled by CSS
      }
    };

    const handleOrientationChange = () => {
      setTimeout(() => {
        const { landscape, mobile } = checkOrientation();

        if (!landscape && mobile) {
          lockToPortrait();
        }
      }, 100);
    };

    // Initial setup
    checkOrientation();
    lockToPortrait();

    // Event listeners
    window.addEventListener("orientationchange", handleOrientationChange);
    window.addEventListener("resize", handleOrientationChange);

    // Cleanup
    return () => {
      window.removeEventListener("orientationchange", handleOrientationChange);
      window.removeEventListener("resize", handleOrientationChange);
    };
  }, []);

  return { isLandscape, showWarning };
};

/**
 * Landscape Warning Component
 */
export const LandscapeWarning = () => (
  <div className="landscape-warning">
    <div className="landscape-icon">📱</div>
    <h2 className="landscape-title">Portrait Mode Required</h2>
    <p className="landscape-message">
      Please rotate your device to portrait mode to use LTC Flow. Video calling
      and messaging work best in portrait orientation.
    </p>
  </div>
);
