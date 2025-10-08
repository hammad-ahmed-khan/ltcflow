// frontend/src/services/PWABadgeService.js
// NEW FILE - Create this file

class PWABadgeService {
  constructor() {
    this.isSupported = 'setAppBadge' in navigator;
    
    if (this.isSupported) {
      console.log('✅ PWA Badge API supported');
    } else {
      console.log('⚠️ PWA Badge API not supported on this browser');
    }
  }

  /**
   * Set the app icon badge with unread count
   * @param {number} count - Number of unread messages (0 to clear)
   */
  setBadge(count) {
    if (!this.isSupported) {
      console.log('Badge API not supported');
      return false;
    }

    try {
      if (count > 0) {
        // Set badge with number
        navigator.setAppBadge(count);
        console.log(`🔴 PWA badge set to: ${count}`);
      } else {
        // Clear badge
        navigator.clearAppBadge();
        console.log('⚪ PWA badge cleared');
      }
      return true;
    } catch (error) {
      console.error('Failed to set PWA badge:', error);
      return false;
    }
  }

  /**
   * Clear the app icon badge
   */
  clearBadge() {
    return this.setBadge(0);
  }

  /**
   * Update badge based on localStorage unread counts
   */
  updateFromStorage() {
    try {
      const unreadRooms = JSON.parse(localStorage.getItem('unreadRooms') || '[]');
      const unreadGroups = JSON.parse(localStorage.getItem('unreadGroups') || '[]');
      const totalUnread = unreadRooms.length + unreadGroups.length;
      
      this.setBadge(totalUnread);
      return totalUnread;
    } catch (error) {
      console.error('Failed to update badge from storage:', error);
      return 0;
    }
  }

  /**
   * Check if Badge API is supported
   */
  checkSupport() {
    return this.isSupported;
  }
}

// Export singleton instance
const pwaBadgeService = new PWABadgeService();

// Make available globally for debugging
if (typeof window !== 'undefined') {
  window.PWABadgeService = pwaBadgeService;
}

export default pwaBadgeService;