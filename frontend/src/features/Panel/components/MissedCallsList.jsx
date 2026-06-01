import { useEffect, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useGlobal } from 'reactn';
import { useNavigate } from 'react-router-dom';
import { FiPhone, FiVideo, FiMessageCircle, FiUsers } from 'react-icons/fi';
import moment from 'moment';
import Picture from '../../../components/Picture';
import Actions from '../../../constants/Actions';
import { getMissedCalls, clearAllMissedCalls } from '../../../actions/missedCalls';
import { useToasts } from 'react-toast-notifications';
import apiClient from '../../../api/apiClient'; // ✅ ADD THIS IMPORT
import './MissedCallsList.sass';
import syncUnreadFromServer from "../../../actions/syncUnreadFromServer"; // ✅ ADD THIS IMPORT

function MissedCallsList() {
  const [user] = useGlobal('user');
  const [nav, setNav] = useGlobal('nav'); 
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { addToast } = useToasts();
  const [loading, setLoading] = useState(false);
  
  const missedCalls = useSelector((state) => state.rtc?.missedCalls) || [];
  const rooms = useSelector((state) => state.io.rooms);

  // ✅ SINGLE useEffect for marking as retrieved
  useEffect(() => {
    if (missedCalls.length > 0) {
      markMissedCallsAsRetrieved();
      //dispatch({ type: Actions.CLEAR_MISSED_CALLS_BADGE });

      setTimeout(() => {
              dispatch(syncUnreadFromServer());
              console.log('✅ CONVERSATION: Synced unread state with server');
            }, 500);
    }
  }, [missedCalls.length, dispatch]);

  const markMissedCallsAsRetrieved = async () => {
    try {
      await apiClient.post("/api/missed-calls/mark-retrieved");
      console.log('📞 ✅ Marked missed calls as retrieved');
    } catch (error) {
      console.error('📞 Error marking as retrieved:', error);
    }
  };

  // Load missed calls when component mounts
  /*
  useEffect(() => {
    const loadMissedCalls = async () => {
      if (!user?.id) return;

       if (missedCalls.length > 0) {
          console.log('Using existing Redux state:', missedCalls.length, 'calls');
          return;
        }
      
      setLoading(true);
      try {
        console.log('📞 Loading missed calls in MissedCallsList component...');
        const response = await getMissedCalls({ limit: 100 });
        
        if (response.data.success) {
          const missedCalls = response.data.missedCalls || [];
          console.log(`📞 ✅ Loaded ${missedCalls.length} missed calls`);
          
          dispatch({
            type: Actions.SET_MISSED_CALLS,
            calls: missedCalls,
          });
          
        }
      } catch (error) {
        console.error('📞 Error loading missed calls:', error);
        addToast('Failed to load missed calls', {
          appearance: 'error',
          autoDismiss: true,
        });
      } finally {
        setLoading(false);
      }
    };

    loadMissedCalls();
  }, [user?.id, dispatch, addToast]);
  */

  // Clear missed calls count when viewing
  useEffect(() => {
    if (missedCalls.length > 0) {
      // Mark missed calls as viewed
      
    }
  }, [missedCalls.length, dispatch]);

  const handleChatUser = async (call) => {
  try {
    // ✅ STEP 1: Switch to Chats tab in NavBar
    setNav('rooms');
    
    // ✅ STEP 2: Find existing room with the caller
    let targetRoom = null;

    if (call.isGroup) {
      targetRoom = rooms.find(room => room._id === call.groupId);
    } else {
      targetRoom = rooms.find(room => 
        !room.isGroup && 
        room.people.some(person => person._id === call.callerId._id)
      );
    }

    if (targetRoom) {
      // ✅ STEP 3: Navigate to the room/chat (this will also set the room in Redux)
      navigate(`/room/${targetRoom._id}`);
      
      // ✅ STEP 4: Success feedback
      /*
      addToast('Navigated to chat', {
        appearance: 'success',
        autoDismiss: true,
      });
      */
    } else {
      console.warn('Could not find room for missed call');
      addToast('Could not find chat room', {
        appearance: 'warning',
        autoDismiss: true,
      });
    }

  } catch (error) {
    console.error('Error navigating to chat:', error);
    addToast('Error opening chat', {
      appearance: 'error',
      autoDismiss: true,
    });
  }
};

  // ✅ ADD: Clear all missed calls handler
  const handleClearAll = async () => {
    try {
      console.log('📞 Clearing all missed calls...');
      // Clear from database
      await clearAllMissedCalls();
      
      // Clear from Redux
      dispatch({ type: Actions.CLEAR_MISSED_CALLS });
      
      addToast('All missed calls cleared', {
        appearance: 'success',
        autoDismiss: true,
      });
    } catch (error) {
      console.error('📞 Error clearing all missed calls:', error);
      addToast('Failed to clear missed calls', {
        appearance: 'error',
        autoDismiss: true,
      });
    }
  };

  const formatCallTime = (timestamp) => {
    const callTime = moment(timestamp);
    const now = moment();
    
    if (now.diff(callTime, 'hours') < 24) {
      return callTime.format('h:mm A');
    } else if (now.diff(callTime, 'days') < 7) {
      return callTime.format('ddd h:mm A');
    } else {
      return callTime.format('MMM DD h:mm A');
    }
  };

  // ✅ ADD: Loading state
  if (loading) {
    return (
      <div className="missed-calls-loading">
        <div className="loading-spinner"></div>
        <p>Loading missed calls...</p>
      </div>
    );
  }

  if (missedCalls.length === 0) {
    return (
      <div className="missed-calls-empty">
        <div className="empty-icon">
          <FiPhone />
        </div>
        <h3>No missed calls</h3>
        <p>When someone calls you and you don't answer, you'll see them here.</p>
      </div>
    );
  }

  return (
    <div className="missed-calls-list">
      <div className="missed-calls-header">
        <h2>Missed Calls</h2>
        <div className="header-actions">
          {/* <span className="missed-count">{missedCalls.length}</span> */}
          {/* ✅ ADD: Clear all button */}
          <button 
            className="clear-all-btn"
            onClick={handleClearAll}
            title="Clear all missed calls"
          >
            Clear All
          </button>
        </div>
      </div>
      
      <div className="calls-list">
        {missedCalls.map((call) => (
          <div key={call._id} className="missed-call-item">
            <div className="call-avatar">
              {call.isGroup ? (
                <div className="group-avatar">
                  <FiUsers />
                </div>
              ) : (
                <Picture user={call.callerId || { firstName: 'Unknown', lastName: 'User' }} />
              )}
            </div>            
            <div className="call-info">
              <div className="call-name">
                {call.isGroup 
                  ? call.groupName 
                  : call.callerId  // ✅ CHANGE FROM call.caller
                    ? `${call.callerId.firstName || 'Unknown'} ${call.callerId.lastName || 'User'}`
                    : 'Unknown User'
                }
              </div>
              <div className="call-details">
                <span className="call-type">
                  {call.callType === 'video' ? (
                    <>
                      <FiVideo className="call-icon" />
                      Video call
                    </>
                  ) : (
                    <>
                      <FiPhone className="call-icon" />
                      Voice call
                    </>
                  )}
                </span>
                <span className="call-time">
                  {formatCallTime(call.timestamp)}
                </span>
              </div>
            </div>
            
            <div className="call-actions">
              <button 
                className="chat-button"
                onClick={() => handleChatUser(call)}
                title="Chat with user"
              >
                <FiMessageCircle />
                Chat User
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default MissedCallsList;