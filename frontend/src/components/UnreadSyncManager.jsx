// frontend/src/components/UnreadSyncManager.jsx
import { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import syncUnreadFromServer from '../actions/syncUnreadFromServer';

const UnreadSyncManager = () => {
  const dispatch = useDispatch();

  useEffect(() => {
    // Sync unread state every 30 seconds
    const syncInterval = setInterval(() => {
      console.log('🔄 Background sync: Checking for new messages');
      dispatch(syncUnreadFromServer());
    }, 30000); // 30 seconds

    // Sync when app regains focus (user returns to tab)
    const handleFocus = () => {
      console.log('👀 App regained focus - syncing unread state');
      dispatch(syncUnreadFromServer());
    };
    
    // Sync when page becomes visible (mobile/tab switching)
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        console.log('👀 Page became visible - syncing unread state');
        dispatch(syncUnreadFromServer());
      }
    };
    
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(syncInterval);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [dispatch]);

  return null; // This component doesn't render anything
};

export default UnreadSyncManager;