import { useEffect, useState, useMemo } from 'react';
import './Ringing.sass';
import { FiVideo, FiPhone, FiPhoneOff } from 'react-icons/fi';
import { useGlobal } from 'reactn';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { useToasts } from 'react-toast-notifications';
import logo from '../../../assets/flowico.svg';
import postClose from '../../../actions/postClose';
import postAnswer from '../../../actions/postAnswer';
import Config from '../../../config';
import ringSound from '../../../assets/ring.mp3';
import Actions from '../../../constants/Actions';

/**
 * Ringing Component
 * 
 * Displays incoming/outgoing call UI with caller information.
 * 
 * ✅ FIXES:
 * - Uses callData.counterpart as fallback when Redux counterpart is empty
 * - Properly handles both phone-to-desktop and desktop-to-phone calls
 * - Defensive checks for all data access
 */
function Ringing({ incoming, meetingID }) {
  // Redux state
  const counterpartFromRedux = useSelector((state) => state.rtc.counterpart);
  const callData = useSelector((state) => state.rtc.callData) || {};
  const room = useSelector((state) => state.io.room) || {};
  const closingState = useSelector((state) => state.rtc.closingState);
  const closed = useSelector((state) => state.rtc.closed);
  const io = useSelector((state) => state.io.io);

  // Global state
  const [isAudio, setAudio] = useGlobal('audio');
  const [isVideo, setVideo] = useGlobal('video');
  const [audioStream, setAudioStream] = useGlobal('audioStream');
  const [videoStream, setVideoStream] = useGlobal('videoStream');
  const setAccepted = useGlobal('accepted')[1];
  const [user] = useGlobal('user');

  // Local state
  const [acquireError, setAcquireError] = useState(false);

  // Hooks
  const navigate = useNavigate();
  const { addToast } = useToasts();
  const dispatch = useDispatch();

  /**
   * ✅ FIX: Merge counterpart data from multiple sources
   * Priority: Redux counterpart > callData.counterpart > empty object
   */
  const counterpart = useMemo(() => {
    // Check if Redux counterpart has valid data
    const reduxHasData = counterpartFromRedux && 
      (counterpartFromRedux.firstName || counterpartFromRedux._id);
    
    if (reduxHasData) {
      console.log('📞 Using counterpart from Redux state:', counterpartFromRedux);
      return counterpartFromRedux;
    }
    
    // Fallback to callData.counterpart (sent with 'call' event)
    if (callData.counterpart && (callData.counterpart.firstName || callData.counterpart._id)) {
      console.log('📞 Using counterpart from callData:', callData.counterpart);
      return callData.counterpart;
    }
    
    console.log('📞 No counterpart data available, using empty object');
    return {};
  }, [counterpartFromRedux, callData.counterpart]);

  // Debug logging
  useEffect(() => {
    console.log('📞 🔍 RINGING COMPONENT DEBUG:');
    console.log('📞 🔍 meetingID:', meetingID);
    console.log('📞 🔍 incoming:', incoming);
    console.log('📞 🔍 counterpartFromRedux:', counterpartFromRedux);
    console.log('📞 🔍 callData:', callData);
    console.log('📞 🔍 callData.counterpart:', callData.counterpart);
    console.log('📞 🔍 merged counterpart:', counterpart);
    console.log('📞 🔍 room:', room);
  }, [meetingID, incoming, counterpartFromRedux, callData, counterpart, room]);

  /**
   * Check if this is a group call
   */
  const isGroupCall = () => {
    return !!(
      counterpart.isGroup || 
      callData.isGroup || 
      callData.groupId ||
      callData.callToGroup
    );
  };

  /**
   * ✅ FIX: Get display name with proper fallbacks
   */
  const getDisplayName = () => {
    console.log('📞 🔍 getDisplayName called:', {
      isGroup: isGroupCall(),
      counterpartFirstName: counterpart.firstName,
      counterpartLastName: counterpart.lastName,
      callDataGroupName: callData.groupName,
    });

    if (isGroupCall()) {
      const groupName = counterpart.firstName || 
                       callData.groupName || 
                       room.title || 
                       'Group Call';
      console.log('📞 ✅ Using group name:', groupName);
      return groupName;
    }

    // For individual calls, use counterpart name
    const firstName = counterpart.firstName || 'Unknown';
    const lastName = counterpart.lastName || 'User';
    const individualName = `${firstName} ${lastName}`;
    console.log('📞 ✅ Using individual name:', individualName);
    return individualName;
  };

  /**
   * Get title based on call type and direction
   */
  const getTitle = () => {
    if (incoming) {
      if (callData.added) return 'Adding you to a meeting';
      return isGroupCall() ? 'Incoming Group Call' : 'Incoming Call';
    }
    return isGroupCall() ? 'Calling Group' : 'Outgoing Call';
  };

  /**
   * Picture component for caller display
   */
  function Picture() {
    if (isGroupCall()) {
      return (
        <div className="img-wrapper">
          <div className="img group-call" style={{ 
            fontSize: '24px', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            background: '#6c5ce7'
          }}>
            👥
          </div>
        </div>
      );
    }

    // Individual call picture
    const displayFirstName = counterpart.firstName || 'A';
    const displayLastName = counterpart.lastName || 'U';
    
    if (counterpart.picture?.shieldedID) {
      return (
        <img
          src={`${Config.url || ''}/api/images/${counterpart.picture.shieldedID}/256`}
          alt="Picture"
          className="picture"
        />
      );
    }

    return (
      <div className="img-wrapper">
        <div className="img">
          {displayFirstName.charAt(0).toUpperCase()}
          {displayLastName.charAt(0).toUpperCase()}
        </div>
      </div>
    );
  }

  // Media acquisition functions
  const errorToast = (content) => {
    addToast(content, {
      appearance: 'error',
      autoDismiss: true,
    });
  };

  const getAudio = async () => {
    setAcquireError(false);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      await setAudioStream(stream);
    } catch (e) {
      setAcquireError(true);
      errorToast('Failed to acquire audio!');
    }
  };

  const getVideo = async () => {
    setAcquireError(false);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      await setVideoStream(stream);
    } catch (e) {
      setAcquireError(true);
      errorToast('Failed to acquire video!');
    }
  };

  /**
   * Join call with audio only
   */
  const join = async () => {
    if (incoming && io && meetingID && user) {
      console.log(`📞 Emitting call-answered for meeting ${meetingID}`);
      io.emit('call-answered', {
        meetingId: meetingID,
        calleeId: user.id 
      });
    }
    
    await setAudio(true);
    await setVideo(false);
    await getAudio();
    if (acquireError) return;
    setAccepted(true);
    
    // Use caller from callData or counterpart
    const callerId = callData.caller || counterpart._id;
    if (callerId) {
      postAnswer({ userID: callerId, meetingID });
    }
  };

  /**
   * Join call with video
   */
  const joinWithVideo = async () => {
    if (incoming && io && meetingID && user) {
      console.log(`📞 Emitting call-answered for meeting ${meetingID}`);
      io.emit('call-answered', {
        meetingId: meetingID,
        calleeId: user.id
      });
    }
    
    await setAudio(true);
    await setVideo(true);
    await getVideo();
    if (acquireError) return;
    await getAudio();
    if (acquireError) return;
    setAccepted(true);
    
    // Use caller from callData or counterpart
    const callerId = callData.caller || counterpart._id;
    if (callerId) {
      postAnswer({ userID: callerId, meetingID });
    }
  };

  /**
   * Cancel outgoing call
   */
  const close = () => {
    if (!incoming && io && meetingID && user) {
      console.log(`📞 Emitting call-cancelled for meeting ${meetingID}`);
      io.emit('call-cancelled', {
        meetingId: meetingID,
        callerId: user.id
      });
    }
    
    // Dispatch close action
    dispatch({ type: Actions.RTC_CLOSE });
  };

  /**
   * Reject incoming call
   */
  const rejectCall = () => {
    if (incoming && io && meetingID && user) {
      console.log(`📞 Emitting call-rejected for meeting ${meetingID}`);
      io.emit('call-rejected', {
        meetingId: meetingID,
        calleeId: user.id
      });
    }
    
    // Dispatch close action
    dispatch({ type: Actions.RTC_CLOSE });
  };

  // Initialize media and ring sound on mount
  useEffect(() => {
    if (isAudio) getAudio();
    if (isVideo) getVideo();

    const audio = document.createElement('audio');
    audio.style.display = 'none';
    audio.src = ringSound;
    audio.autoplay = true;
    audio.loop = true;

    return () => {
      if (audio) {
        audio.pause();
        audio.remove();
      }
    };
  }, []);

  // Handle closing state changes
  useEffect(() => {
    if (closingState && !closed) {
      close();
    }
  }, [closingState, closed]);

  return (
    <div className="join uk-flex uk-flex-middle uk-flex-center uk-flex-column">
      <img className="logo-little" src={logo} alt="Logo" />
      <p className="title">{getTitle()}</p>
      <p className="name">{getDisplayName()}</p>
      <div className="picture uk-margin-small">
        <Picture />
      </div>
      
      {/* Incoming call buttons */}
      <div className="uk-flex" hidden={!incoming}>
        <div className="rounded-button close" onClick={rejectCall}>
          <FiPhoneOff className="button-icon" />
        </div>
        <div className="rounded-button" onClick={join}>
          <FiPhone className="button-icon" />
        </div>
        <div className="rounded-button" onClick={joinWithVideo}>
          <FiVideo className="button-icon" />
        </div>
      </div>
      
      {/* Outgoing call buttons */}
      <div className="uk-flex" hidden={incoming}>
        <div className="rounded-button close" onClick={close}>
          <FiPhoneOff className="button-icon" />
        </div>
      </div>
    </div>
  );
}

export default Ringing;
