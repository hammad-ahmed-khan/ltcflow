import { useEffect, useRef, useState, useCallback } from 'react';
import './Meeting.sass';
import {
  FiMaximize,
  FiMic,
  FiMicOff,
  FiMinimize,
  FiPhoneOff,
  FiVideo,
  FiVideoOff,
  FiUserPlus,
  FiMonitor,
  FiXOctagon,
  FiGrid,
  FiColumns,
  FiMenu,
  FiChevronLeft,
  FiChevronUp,
  FiChevronDown,
} from 'react-icons/fi';
import { useDispatch, useSelector } from 'react-redux';
import * as mediasoup from 'mediasoup-client';
import { useNavigate, useParams } from 'react-router-dom';
import { useGlobal, getGlobal } from 'reactn';
import { useToasts } from 'react-toast-notifications';
import Actions from '../../constants/Actions';
import Join from './components/Join';
import AddPeers from './components/AddPeers';
import Ringing from './components/Ringing';
import Streams from './components/Streams';
import LittleStreams from './components/LittleStreams';
import postClose from '../../actions/postClose';
import syncUnreadFromServer from '../../actions/syncUnreadFromServer';
import store from '../../store';

// ============================================================================
// CONSTANTS
// ============================================================================
const MAX_RETRIES = 5;
const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_BASE_DELAY = 1000;
const RECONNECT_MAX_DELAY = 10000;
const RESUME_RETRY_ATTEMPTS = 3;
const RESUME_RETRY_DELAY = 500;

function Meeting() {
  // ============================================================================
  // REFS - Using refs for mutable values that shouldn't trigger re-renders
  // ============================================================================
  const transportRef = useRef(null);
  const videoProducerRef = useRef(null);
  const screenProducerRef = useRef(null);
  const audioProducerRef = useRef(null);
  const consumerTransportRef = useRef(null);
  const consumersRef = useRef({});
  const deviceRef = useRef(null);
  const callStartTimeRef = useRef(null);
  const isClosingRef = useRef(false);
  const isMountedRef = useRef(true);
  
  // ✅ FIX: Mutex locks to prevent race conditions
  const videoToggleLockRef = useRef(false);
  const audioToggleLockRef = useRef(false);
  const screenToggleLockRef = useRef(false);
  const reconnectLockRef = useRef(false);
  
  // Retry counters
  const consumerRetryCountRef = useRef(0);
  const producerRetryCountRef = useRef(0);
  const reconnectAttemptRef = useRef(0);

  // ============================================================================
  // STATE
  // ============================================================================
  const [device, setDevice] = useState(null);
  const [isMaximized, setMaximized] = useState(true);
  const [isGrid, setGrid] = useState(true);
  const [topBar, setTopBar] = useState(true);
  const [addPeers, setAddPeers] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const [reconnected, setReconnected] = useState(false);
  const [connectionState, setConnectionState] = useState('new');

  // ============================================================================
  // REDUX STATE
  // ============================================================================
  const io = useSelector((state) => state.io.io);
  const room = useSelector((state) => state.io.room);
  const producers = useSelector((state) => state.rtc.producers);
  const lastLeave = useSelector((state) => state.rtc.lastLeave);
  const lastLeaveType = useSelector((state) => state.rtc.lastLeaveType);
  const increment = useSelector((state) => state.rtc.increment);
  const closingState = useSelector((state) => state.rtc.closingState);
  const counterpart = useSelector((state) => state.rtc.counterpart) || {};
  const answerIncrement = useSelector((state) => state.rtc.answerIncrement);
  const answerData = useSelector((state) => state.rtc.answerData);

  // ============================================================================
  // GLOBAL STATE
  // ============================================================================
  const [streams, setStreams] = useGlobal('streams');
  const [localStream, setLocalStream] = useGlobal('localStream');
  const [video, setVideo] = useGlobal('video');
  const [audio, setAudio] = useGlobal('audio');
  const [isScreen, setScreen] = useGlobal('screen');
  const [audioStream, setAudioStream] = useGlobal('audioStream');
  const [videoStream, setVideoStream] = useGlobal('videoStream');
  const [screenStream, setScreenStream] = useGlobal('screenStream');
  const [callStatus, setCallStatus] = useGlobal('callStatus');
  const [callDirection] = useGlobal('callDirection');
  const [joined, setJoined] = useGlobal('joined');
  const [accepted, setAccepted] = useGlobal('accepted');
  const [showPanel, setShowPanel] = useGlobal('showPanel');
  const [over, setOver] = useGlobal('over');
  const [meetingID, setMeeting] = useGlobal('meetingID');
  const [user] = useGlobal('user');

  // ============================================================================
  // HOOKS
  // ============================================================================
  const params = useParams();
  const roomID = params.id;
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { addToast } = useToasts();

  // ============================================================================
  // UTILITY FUNCTIONS
  // ============================================================================
  
  /**
   * Safe state check - ensures component is still mounted
   */
  const safeSetState = useCallback((setter, value) => {
    if (isMountedRef.current) {
      return setter(value);
    }
    return Promise.resolve();
  }, []);

  /**
   * Calculate exponential backoff delay
   */
  const getBackoffDelay = useCallback((attempt) => {
    return Math.min(RECONNECT_BASE_DELAY * Math.pow(2, attempt), RECONNECT_MAX_DELAY);
  }, []);

  // ============================================================================
  // MEDIA ACQUISITION FUNCTIONS
  // ============================================================================

  const getAudio = useCallback(async () => {
    const constraints = {
      audio: {
        echoCancellation: { exact: true },
        noiseSuppression: { exact: true },
        autoGainControl: { exact: true },
        sampleRate: { ideal: 48000 },
        channelCount: { ideal: 1 },
        sampleSize: 16,
      }
    };

    try {
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      await safeSetState(setAudioStream, stream);
      return stream;
    } catch (error) {
      console.error('Failed to acquire audio:', error);
      addToast('Failed to access microphone', { appearance: 'error', autoDismiss: true });
      throw error;
    }
  }, [safeSetState, addToast]);

  const getVideo = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      await safeSetState(setVideoStream, stream);
      return stream;
    } catch (error) {
      console.error('Failed to acquire video:', error);
      addToast('Failed to access camera', { appearance: 'error', autoDismiss: true });
      throw error;
    }
  }, [safeSetState, addToast]);

  const getScreen = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      await safeSetState(setScreenStream, stream);
      return stream;
    } catch (error) {
      console.error('Failed to acquire screen:', error);
      addToast('Failed to share screen', { appearance: 'error', autoDismiss: true });
      throw error;
    }
  }, [safeSetState, addToast]);

  // ============================================================================
  // PRODUCER FUNCTIONS
  // ============================================================================

  const produceVideo = useCallback(async (stream) => {
    const useStream = stream || videoStream;
    if (!useStream || !transportRef.current) {
      console.warn('Cannot produce video: missing stream or transport');
      return false;
    }

    try {
      const track = useStream.getVideoTracks()[0];
      if (!track || track.readyState !== 'live') {
        console.warn('Video track not available or not live');
        return false;
      }

      const params = { track, appData: { isScreen: false } };
      await safeSetState(setLocalStream, useStream);
      
      videoProducerRef.current = await transportRef.current.produce(params);

      // Handle track ending
      track.addEventListener('ended', () => {
        console.log('Video track ended externally');
        if (isMountedRef.current && !videoToggleLockRef.current) {
          safeSetState(setVideo, false);
          videoProducerRef.current = null;
        }
      });

      videoProducerRef.current.on('transportclose', () => {
        console.log('Video producer transport closed');
        videoProducerRef.current = null;
      });

      return true;
    } catch (err) {
      console.error('Video produce failed:', err);
      await safeSetState(setVideo, false);
      return false;
    }
  }, [videoStream, safeSetState]);

  const produceAudio = useCallback(async (stream) => {
    const useStream = stream || audioStream;
    if (!useStream || !transportRef.current) {
      console.warn('Cannot produce audio: missing stream or transport');
      return false;
    }

    try {
      const track = useStream.getAudioTracks()[0];
      if (!track || track.readyState !== 'live') {
        console.warn('Audio track not available or not live');
        return false;
      }

      const params = { track };
      audioProducerRef.current = await transportRef.current.produce(params);

      // Handle track ending
      track.addEventListener('ended', () => {
        console.log('Audio track ended externally');
        if (isMountedRef.current && !audioToggleLockRef.current) {
          safeSetState(setAudio, false);
          audioProducerRef.current = null;
        }
      });

      audioProducerRef.current.on('transportclose', () => {
        console.log('Audio producer transport closed');
        audioProducerRef.current = null;
      });

      return true;
    } catch (err) {
      console.error('Audio produce failed:', err);
      await safeSetState(setAudio, false);
      return false;
    }
  }, [audioStream, safeSetState]);

  const produceScreen = useCallback(async (stream) => {
    if (!stream || !transportRef.current) {
      console.warn('Cannot produce screen: missing stream or transport');
      return false;
    }

    try {
      const track = stream.getVideoTracks()[0];
      if (!track || track.readyState !== 'live') {
        console.warn('Screen track not available or not live');
        return false;
      }

      const params = { track, appData: { isScreen: true } };
      await safeSetState(setLocalStream, stream);
      
      screenProducerRef.current = await transportRef.current.produce(params);
      await safeSetState(setScreen, true);

      // Handle screen share ending (user clicks browser stop button)
      track.addEventListener('ended', () => {
        console.log('Screen share ended by user');
        if (isMountedRef.current && !screenToggleLockRef.current) {
          stopScreen();
        }
      });

      screenProducerRef.current.on('transportclose', () => {
        console.log('Screen producer transport closed');
        screenProducerRef.current = null;
      });

      return true;
    } catch (err) {
      console.error('Screen produce failed:', err);
      await safeSetState(setScreen, false);
      return false;
    }
  }, [safeSetState]);

  // ============================================================================
  // STOP MEDIA FUNCTIONS - With Mutex Locks
  // ============================================================================

  const stopVideo = useCallback(async () => {
    // ✅ FIX: Mutex lock to prevent race conditions
    if (videoToggleLockRef.current) {
      console.log('Video toggle already in progress, skipping');
      return;
    }
    videoToggleLockRef.current = true;

    try {
      // Update UI state first for responsiveness
      await safeSetState(setVideo, false);

      // Stop the track
      if (localStream) {
        const videoTracks = localStream.getVideoTracks();
        videoTracks.forEach(track => {
          track.stop();
          console.log('Stopped video track:', track.id);
        });
      }

      // Remove producer from server and close
      if (videoProducerRef.current?.id && io) {
        try {
          await io.request('remove', { 
            producerID: videoProducerRef.current.id, 
            roomID 
          });
        } catch (e) {
          console.warn('Error removing video producer from server:', e);
        }
        
        try {
          videoProducerRef.current.close();
        } catch (e) {
          console.warn('Error closing video producer:', e);
        }
      }

      videoProducerRef.current = null;
      console.log('Video stopped successfully');
    } catch (e) {
      console.error('Error stopping video:', e);
    } finally {
      videoToggleLockRef.current = false;
    }
  }, [localStream, io, roomID, safeSetState]);

  const stopAudio = useCallback(async () => {
    // ✅ FIX: Mutex lock to prevent race conditions
    if (audioToggleLockRef.current) {
      console.log('Audio toggle already in progress, skipping');
      return;
    }
    audioToggleLockRef.current = true;

    try {
      // Update UI state first for responsiveness
      await safeSetState(setAudio, false);

      // ✅ FIX: Stop audio stream tracks (was missing in original code)
      if (audioStream) {
        audioStream.getTracks().forEach(track => {
          track.stop();
          console.log('Stopped audio track:', track.id);
        });
        await safeSetState(setAudioStream, null);
      }

      // Remove producer from server and close
      if (audioProducerRef.current?.id && io) {
        try {
          await io.request('remove', { 
            producerID: audioProducerRef.current.id, 
            roomID 
          });
        } catch (e) {
          console.warn('Error removing audio producer from server:', e);
        }
        
        try {
          audioProducerRef.current.close();
        } catch (e) {
          console.warn('Error closing audio producer:', e);
        }
      }

      audioProducerRef.current = null;
      console.log('Audio stopped successfully');
    } catch (e) {
      console.error('Error stopping audio:', e);
    } finally {
      audioToggleLockRef.current = false;
    }
  }, [audioStream, io, roomID, safeSetState]);

  const stopScreen = useCallback(async () => {
    // ✅ FIX: Mutex lock to prevent race conditions
    if (screenToggleLockRef.current) {
      console.log('Screen toggle already in progress, skipping');
      return;
    }
    screenToggleLockRef.current = true;

    try {
      // Update UI state first
      await safeSetState(setScreen, false);

      // Stop screen tracks
      if (screenProducerRef.current?.track) {
        try {
          screenProducerRef.current.track.stop();
        } catch (e) {
          console.warn('Error stopping screen track:', e);
        }
      }

      // Also stop from screenStream if available
      if (screenStream) {
        screenStream.getTracks().forEach(track => track.stop());
        await safeSetState(setScreenStream, null);
      }

      // Remove producer from server and close
      if (screenProducerRef.current?.id && io) {
        try {
          await io.request('remove', { 
            producerID: screenProducerRef.current.id, 
            roomID 
          });
        } catch (e) {
          console.warn('Error removing screen producer from server:', e);
        }
        
        try {
          screenProducerRef.current.close();
        } catch (e) {
          console.warn('Error closing screen producer:', e);
        }
      }

      screenProducerRef.current = null;
      console.log('Screen share stopped successfully');
    } catch (e) {
      console.error('Error stopping screen:', e);
    } finally {
      screenToggleLockRef.current = false;
    }
  }, [screenStream, io, roomID, safeSetState]);

  // ============================================================================
  // TOGGLE FUNCTIONS - With Mutex Protection
  // ============================================================================

  const toggleVideo = useCallback(async () => {
    if (videoToggleLockRef.current) {
      console.log('Video toggle in progress, ignoring click');
      return;
    }

    if (video && videoProducerRef.current) {
      await stopVideo();
    } else {
      videoToggleLockRef.current = true;
      try {
        const stream = await getVideo();
        await safeSetState(setVideo, true);
        const success = await produceVideo(stream);
        if (!success) {
          await safeSetState(setVideo, false);
          stream?.getTracks().forEach(t => t.stop());
        }
      } catch (e) {
        console.error('Error starting video:', e);
        await safeSetState(setVideo, false);
      } finally {
        videoToggleLockRef.current = false;
      }
    }
  }, [video, stopVideo, getVideo, produceVideo, safeSetState]);

  const toggleAudio = useCallback(async () => {
    if (audioToggleLockRef.current) {
      console.log('Audio toggle in progress, ignoring click');
      return;
    }

    if (audio && audioProducerRef.current) {
      await stopAudio();
    } else {
      audioToggleLockRef.current = true;
      try {
        const stream = await getAudio();
        await safeSetState(setAudio, true);
        const success = await produceAudio(stream);
        if (!success) {
          await safeSetState(setAudio, false);
          stream?.getTracks().forEach(t => t.stop());
        }
      } catch (e) {
        console.error('Error starting audio:', e);
        await safeSetState(setAudio, false);
      } finally {
        audioToggleLockRef.current = false;
      }
    }
  }, [audio, stopAudio, getAudio, produceAudio, safeSetState]);

  const toggleScreen = useCallback(async () => {
    if (screenToggleLockRef.current) {
      console.log('Screen toggle in progress, ignoring click');
      return;
    }

    if (isScreen && screenProducerRef.current) {
      await stopScreen();
    } else {
      screenToggleLockRef.current = true;
      try {
        const stream = await getScreen();
        const success = await produceScreen(stream);
        if (!success) {
          stream?.getTracks().forEach(t => t.stop());
        }
      } catch (e) {
        console.error('Error starting screen share:', e);
        await safeSetState(setScreen, false);
      } finally {
        screenToggleLockRef.current = false;
      }
    }
  }, [isScreen, stopScreen, getScreen, produceScreen, safeSetState]);

  // ============================================================================
  // CONSUMER FUNCTIONS - With Resume Retry Logic
  // ============================================================================

  /**
   * ✅ FIX: Consume with retry logic for resume
   */
  const consume = useCallback(async (producer) => {
    if (!deviceRef.current || !consumerTransportRef.current) {
      console.error('Device or consumer transport not available');
      return null;
    }

    // Check if we already have this consumer
    if (consumersRef.current[producer.producerID]) {
      console.log('Consumer already exists for producer:', producer.producerID);
      return null;
    }

    try {
      const { rtpCapabilities } = deviceRef.current;

      const data = await io.request('consume', {
        rtpCapabilities,
        socketID: producer.socketID,
        roomID,
        producerID: producer.producerID,
      });

      if (!data || data.error) {
        console.error('Consume request failed:', data?.error || 'No response');
        return null;
      }

      const { producerId, id, kind, rtpParameters } = data;

      const consumer = await consumerTransportRef.current.consume({
        id,
        producerId,
        kind,
        rtpParameters,
        codecOptions: {},
      });

      // Save the consumer
      consumersRef.current[producer.producerID] = consumer;

      // Handle consumer events
      consumer.on('producerclose', () => {
        console.log('Producer closed, cleaning up consumer:', producer.producerID);
        cleanupConsumer(producer.producerID);
      });

      consumer.on('transportclose', () => {
        console.log('Consumer transport closed:', producer.producerID);
        cleanupConsumer(producer.producerID);
      });

      // Create MediaStream
      const stream = new MediaStream();
      stream.addTrack(consumer.track);
      stream.isVideo = kind === 'video';

      // ✅ FIX: Resume with retry logic (critical for preventing black screens)
      if (kind === 'video') {
        const resumed = await resumeWithRetry(producer.producerID);
        if (!resumed) {
          console.error('Failed to resume consumer after retries:', producer.producerID);
          // Don't return null - still return stream, let UI handle it
        }
      }

      return stream;
    } catch (error) {
      console.error('Consume failed for producer:', producer.producerID, error);
      return null;
    }
  }, [io, roomID]);

  /**
   * ✅ FIX: Resume consumer with retry logic
   */
  const resumeWithRetry = useCallback(async (producerID) => {
    for (let attempt = 0; attempt < RESUME_RETRY_ATTEMPTS; attempt++) {
      try {
        await io.request('resume', { 
          producerID, 
          meetingID: roomID 
        });
        console.log(`Consumer resumed successfully on attempt ${attempt + 1}:`, producerID);
        return true;
      } catch (error) {
        console.warn(`Resume attempt ${attempt + 1} failed for ${producerID}:`, error);
        if (attempt < RESUME_RETRY_ATTEMPTS - 1) {
          await new Promise(r => setTimeout(r, RESUME_RETRY_DELAY));
        }
      }
    }
    return false;
  }, [io, roomID]);

  /**
   * Clean up a specific consumer
   */
  const cleanupConsumer = useCallback((producerID) => {
    if (consumersRef.current[producerID]) {
      try {
        consumersRef.current[producerID].close();
      } catch (e) {
        // Ignore close errors
      }
      delete consumersRef.current[producerID];
    }
    
    // Remove stream from state
    if (isMountedRef.current) {
      setStreams(prev => prev.filter(s => s.producerID !== producerID));
    }
  }, [setStreams]);

  // ============================================================================
  // TRANSPORT SETUP
  // ============================================================================

  const setupProducerTransport = useCallback((transport) => {
    transport.on('connect', async ({ dtlsParameters }, callback, errback) => {
      try {
        await io.request('connectProducerTransport', { dtlsParameters });
        callback();
      } catch (error) {
        errback(error);
      }
    });

    transport.on('produce', async ({ kind, rtpParameters, appData }, callback, errback) => {
      try {
        const { id } = await io.request('produce', {
          transportId: transport.id,
          kind,
          rtpParameters,
          roomID,
          isScreen: appData?.isScreen,
        });
        callback({ id });
      } catch (error) {
        errback(error);
      }
    });

    transport.on('connectionstatechange', async (state) => {
      console.log('Producer transport state:', state);
      setConnectionState(state);

      switch (state) {
        case 'connected':
          producerRetryCountRef.current = 0;
          if (reconnecting) {
            setReconnecting(false);
            setReconnected(true);
            setTimeout(() => setReconnected(false), 3000);
          }
          break;

        case 'disconnected':
          // Wait briefly - WebRTC may recover automatically
          console.log('Producer transport disconnected, waiting for recovery...');
          setTimeout(() => {
            if (transportRef.current?.connectionState === 'disconnected' && !isClosingRef.current) {
              handleTransportFailure('producer');
            }
          }, 3000);
          break;

        case 'failed':
          if (!isClosingRef.current) {
            handleTransportFailure('producer');
          }
          break;

        case 'closed':
          console.log('Producer transport closed');
          break;

        default:
          break;
      }
    });
  }, [io, roomID, reconnecting]);

  const setupConsumerTransport = useCallback((transport) => {
    transport.on('connect', ({ dtlsParameters }, callback, errback) => {
      io.request('connectConsumerTransport', {
        transportId: transport.id,
        dtlsParameters,
      })
        .then(callback)
        .catch(errback);
    });

    transport.on('connectionstatechange', (state) => {
      console.log('Consumer transport state:', state);

      switch (state) {
        case 'connected':
          consumerRetryCountRef.current = 0;
          break;

        case 'disconnected':
          setTimeout(() => {
            if (consumerTransportRef.current?.connectionState === 'disconnected' && !isClosingRef.current) {
              handleTransportFailure('consumer');
            }
          }, 3000);
          break;

        case 'failed':
          if (!isClosingRef.current) {
            handleTransportFailure('consumer');
          }
          break;

        default:
          break;
      }
    });
  }, [io]);

  // ============================================================================
  // RECONNECTION LOGIC
  // ============================================================================

  /**
   * ✅ FIX: Proper reconnection handling
   */
  const handleTransportFailure = useCallback(async (transportType) => {
    // Prevent multiple simultaneous reconnection attempts
    if (reconnectLockRef.current || isClosingRef.current) {
      console.log('Reconnection already in progress or closing, skipping');
      return;
    }

    reconnectLockRef.current = true;
    setReconnecting(true);

    console.log(`Transport failure detected: ${transportType}`);

    try {
      await attemptReconnection();
    } finally {
      reconnectLockRef.current = false;
    }
  }, []);

  const attemptReconnection = useCallback(async () => {
    if (reconnectAttemptRef.current >= MAX_RECONNECT_ATTEMPTS) {
      console.error('Max reconnection attempts reached');
      addToast('Connection lost. Please rejoin the call.', { 
        appearance: 'error', 
        autoDismiss: false 
      });
      setReconnecting(false);
      close();
      return;
    }

    reconnectAttemptRef.current++;
    const attempt = reconnectAttemptRef.current;
    console.log(`Reconnection attempt ${attempt}/${MAX_RECONNECT_ATTEMPTS}`);

    try {
      // Close existing transports safely
      try { transportRef.current?.close(); } catch (e) {}
      try { consumerTransportRef.current?.close(); } catch (e) {}
      transportRef.current = null;
      consumerTransportRef.current = null;

      // Recreate producer transport
      const producerData = await io.request('createProducerTransport', {
        forceTcp: false,
        rtpCapabilities: deviceRef.current.rtpCapabilities,
        roomID,
      });

      if (producerData.error) {
        throw new Error(producerData.error);
      }

      const newProducerTransport = deviceRef.current.createSendTransport(producerData);
      setupProducerTransport(newProducerTransport);
      transportRef.current = newProducerTransport;

      // Recreate consumer transport
      const consumerData = await io.request('createConsumerTransport', {
        forceTcp: false,
        roomID,
      });

      if (consumerData.error) {
        throw new Error(consumerData.error);
      }

      const newConsumerTransport = deviceRef.current.createRecvTransport(consumerData);
      setupConsumerTransport(newConsumerTransport);
      consumerTransportRef.current = newConsumerTransport;

      // Re-produce active media tracks
      await reProduceAllTracks();

      // Re-consume existing producers
      await reConsumeAllProducers();

      // Success!
      reconnectAttemptRef.current = 0;
      setReconnecting(false);
      setReconnected(true);
      setTimeout(() => setReconnected(false), 3000);
      
      addToast('Reconnected successfully', { appearance: 'success', autoDismiss: true });
      console.log('Reconnection successful');

    } catch (error) {
      console.error(`Reconnection attempt ${attempt} failed:`, error);
      
      const delay = getBackoffDelay(attempt);
      console.log(`Retrying in ${delay}ms...`);
      
      setTimeout(() => {
        if (isMountedRef.current && !isClosingRef.current) {
          attemptReconnection();
        }
      }, delay);
    }
  }, [io, roomID, setupProducerTransport, setupConsumerTransport, getBackoffDelay, addToast]);

  /**
   * Re-produce all active media tracks after reconnection
   */
  const reProduceAllTracks = useCallback(async () => {
    console.log('Re-producing active tracks...');
    
    // Re-produce audio if it was active
    if (audio && audioStream) {
      try {
        await produceAudio(audioStream);
        console.log('Audio re-produced successfully');
      } catch (e) {
        console.error('Failed to re-produce audio:', e);
      }
    }

    // Re-produce video if it was active
    if (video && videoStream) {
      try {
        await produceVideo(videoStream);
        console.log('Video re-produced successfully');
      } catch (e) {
        console.error('Failed to re-produce video:', e);
      }
    }

    // Re-produce screen if it was active
    if (isScreen && screenStream) {
      try {
        await produceScreen(screenStream);
        console.log('Screen re-produced successfully');
      } catch (e) {
        console.error('Failed to re-produce screen:', e);
      }
    }
  }, [audio, audioStream, video, videoStream, isScreen, screenStream, produceAudio, produceVideo, produceScreen]);

  /**
   * Re-consume all producers after reconnection
   */
  const reConsumeAllProducers = useCallback(async () => {
    console.log('Re-consuming producers...');
    
    // Clear old consumers
    Object.keys(consumersRef.current).forEach(key => {
      try { consumersRef.current[key]?.close(); } catch (e) {}
    });
    consumersRef.current = {};
    
    // Clear streams
    await safeSetState(setStreams, []);

    // Re-fetch and consume all producers
    try {
      const { producers: currentProducers } = await io.request('join', { roomID });
      dispatch({ type: Actions.RTC_PRODUCERS, producers: currentProducers || [] });
    } catch (error) {
      console.error('Failed to re-fetch producers:', error);
    }
  }, [io, roomID, safeSetState, dispatch]);

  // ============================================================================
  // SUBSCRIPTION (Consumer Transport Creation)
  // ============================================================================

  const subscribe = useCallback(async (device) => {
    if (consumerTransportRef.current) {
      console.log('Consumer transport already exists');
      return consumerTransportRef.current;
    }

    const data = await io.request('createConsumerTransport', {
      forceTcp: false,
      roomID,
    });

    if (data.error) {
      console.error('Failed to create consumer transport:', data.error);
      return null;
    }

    const transport = device.createRecvTransport(data);
    setupConsumerTransport(transport);
    consumerTransportRef.current = transport;
    
    return transport;
  }, [io, roomID, setupConsumerTransport]);

  // ============================================================================
  // INITIALIZATION
  // ============================================================================

  const init = useCallback(async () => {
    console.log('📞 Initializing meeting...');
    callStartTimeRef.current = Date.now();

    await safeSetState(setCallStatus, 'in-call');
    await safeSetState(setShowPanel, false);
    await safeSetState(setOver, true);
    await safeSetState(setStreams, []);

    dispatch({ type: Actions.RTC_ROOM_ID, roomID });

    try {
      const { producers: existingProducers, consumers, peers } = await io.request('join', { roomID });
      dispatch({ type: Actions.RTC_CONSUMERS, consumers, peers });

      const routerRtpCapabilities = await io.request('getRouterRtpCapabilities');
      const newDevice = new mediasoup.Device();
      await newDevice.load({ routerRtpCapabilities });
      deviceRef.current = newDevice;
      setDevice(newDevice);

      // Create consumer transport
      await subscribe(newDevice);

      dispatch({ type: Actions.RTC_PRODUCERS, producers: existingProducers || [] });

      // Create producer transport
      const producerData = await io.request('createProducerTransport', {
        forceTcp: false,
        rtpCapabilities: newDevice.rtpCapabilities,
        roomID,
      });

      if (producerData.error) {
        console.error('Failed to create producer transport:', producerData.error);
        return;
      }

      const transport = newDevice.createSendTransport(producerData);
      setupProducerTransport(transport);
      transportRef.current = transport;

      // Produce initial media
      await produceAudio();
      await produceVideo();

      console.log('📞 Meeting initialized successfully');
    } catch (error) {
      console.error('Failed to initialize meeting:', error);
      addToast('Failed to join meeting', { appearance: 'error', autoDismiss: true });
    }
  }, [io, roomID, dispatch, subscribe, setupProducerTransport, produceAudio, produceVideo, safeSetState, addToast]);

  // ============================================================================
  // CLOSE / CLEANUP
  // ============================================================================

  const close = useCallback(async () => {
    if (isClosingRef.current) {
      console.log('Close already in progress, skipping');
      return;
    }
    isClosingRef.current = true;
    console.log('📞 Closing meeting...');

    try {
      // Calculate and emit call duration
      if (callStartTimeRef.current && io && roomID && roomID !== 'undefined') {
        const callDuration = Math.floor((Date.now() - callStartTimeRef.current) / 1000);
        
        if (callDuration > 0) {
          io.emit('call-ended', {
            meetingId: roomID,
            endedBy: user?.id,
            duration: callDuration
          });
        }
      }

      // Stop all producers
      await Promise.allSettled([
        stopVideo(),
        stopAudio(),
        stopScreen()
      ]);

      // Close all consumers
      Object.values(consumersRef.current).forEach(consumer => {
        try { consumer.close(); } catch (e) {}
      });
      consumersRef.current = {};

      // Stop all tracks from streams
      [videoStream, audioStream, localStream].forEach(stream => {
        if (stream) {
          stream.getTracks().forEach(track => track.stop());
        }
      });

      // Clear global stream states
      await Promise.allSettled([
        safeSetState(setVideoStream, null),
        safeSetState(setAudioStream, null),
        safeSetState(setLocalStream, null),
        safeSetState(setStreams, []),
        safeSetState(setVideo, false),
        safeSetState(setAudio, false),
        safeSetState(setScreen, false),
      ]);

      // Close transports
      try { transportRef.current?.close(); } catch (e) {}
      try { consumerTransportRef.current?.close(); } catch (e) {}
      transportRef.current = null;
      consumerTransportRef.current = null;

      // Leave room on server
      if (io && roomID && roomID !== 'undefined') {
        try {
          await io.request('leave', { roomID });
        } catch (e) {
          console.warn('Error leaving room:', e);
        }
      }

      // Reset state
      callStartTimeRef.current = null;
      await safeSetState(setJoined, false);
      await safeSetState(setShowPanel, true);
      await safeSetState(setCallStatus, null);

      dispatch({ type: Actions.RTC_LEAVE });

      // Notify counterpart for 1:1 calls
      if (!counterpart?.isGroup && counterpart?._id) {
        postClose({ meetingID: roomID, userID: counterpart._id });
      }

      navigate('/', { replace: true });
      console.log('📞 Meeting closed successfully');

    } catch (error) {
      console.error('Error during close:', error);
    } finally {
      // Reset closing flag after delay to prevent rapid re-calls
      setTimeout(() => {
        isClosingRef.current = false;
      }, 2000);
    }
  }, [
    io, roomID, user, counterpart, dispatch, navigate,
    stopVideo, stopAudio, stopScreen,
    videoStream, audioStream, localStream,
    safeSetState
  ]);

  // ============================================================================
  // EFFECTS
  // ============================================================================

  // Track component mount state
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Set meeting ID
  useEffect(() => {
    setMeeting(roomID);
    return () => {
      // Cleanup media if not in call
      if (getGlobal().callStatus !== 'in-call') {
        try {
          getGlobal().audioStream?.getTracks().forEach(track => track.stop());
        } catch (e) {}
        try {
          getGlobal().videoStream?.getTracks().forEach(track => track.stop());
        } catch (e) {}
      }
    };
  }, [roomID, setMeeting]);

  // Handle socket events
  useEffect(() => {
    if (!io) return;

    const handleCallEnded = (data) => {
      console.log('📞 Call ended event:', data);
      if (data.reason === 'cancelled') {
        addToast('Call was cancelled', { appearance: 'info', autoDismiss: true });
      } else if (data.reason === 'disconnected') {
        addToast('Call ended - participant disconnected', { appearance: 'warning', autoDismiss: true });
      }
      close();
    };

    const handleCallNotAnswered = (data) => {
      console.log('📞 Call not answered:', data);
      addToast('Call not answered', { appearance: 'info', autoDismiss: true });
      close();
    };

    const handleCallRejected = (data) => {
      console.log('📞 Call rejected:', data);
      addToast('Call was declined', { appearance: 'info', autoDismiss: true });
      close();
    };

    const handleMissedCall = (missedCallData) => {
      const callerName = missedCallData.callerId 
        ? `${missedCallData.callerId.firstName || 'Unknown'} ${missedCallData.callerId.lastName || 'User'}`
        : 'Unknown User';
      
      dispatch({ type: Actions.ADD_MISSED_CALL, call: missedCallData });
      addToast(`Missed call from ${callerName}`, { appearance: 'info', autoDismiss: true });
      
      setTimeout(() => {
        store.dispatch(syncUnreadFromServer());
      }, 500);
    };

    const handleIncomingCall = (data) => {
      console.log('📞 Incoming call:', data);
      dispatch({ type: Actions.RTC_SET_CALL_DATA, callData: data });
    };

    io.on('call-ended', handleCallEnded);
    io.on('call-not-answered', handleCallNotAnswered);
    io.on('call-rejected', handleCallRejected);
    io.on('call-missed', handleMissedCall);
    io.on('incoming-call', handleIncomingCall);

    return () => {
      io.off('call-ended', handleCallEnded);
      io.off('call-not-answered', handleCallNotAnswered);
      io.off('call-rejected', handleCallRejected);
      io.off('call-missed', handleMissedCall);
      io.off('incoming-call', handleIncomingCall);
    };
  }, [io, dispatch, addToast, close]);

  // Handle answer data
  useEffect(() => {
    if (!answerData) return;
    if (callDirection === 'outgoing' && callStatus !== 'in-call' && answerData.meetingID === roomID) {
      setJoined(true);
      init();
    }
  }, [answerIncrement, answerData, callDirection, callStatus, roomID, init]);

  // Handle accepted state
  useEffect(() => {
    if (accepted) {
      setAccepted(false).then(() => {
        setJoined(true);
        init();
      });
    }
  }, [accepted, setAccepted, init]);

  // Handle stream cleanup on leave
  useEffect(() => {
    if (lastLeaveType === 'leave') {
      setStreams(getGlobal().streams.filter(s => s.socketID !== lastLeave));
    } else {
      setStreams(getGlobal().streams.filter(s => s.producerID !== lastLeave));
    }
  }, [lastLeave, lastLeaveType, increment, setStreams]);

  // Consume new producers
  useEffect(() => {
    const consumeProducers = async () => {
      const newStreams = [];
      
      for (const producer of producers) {
        // Skip if already consuming or not in this room
        if (consumersRef.current[producer.producerID] || producer.roomID !== roomID) {
          continue;
        }

        console.log('Creating consumer for producer:', producer.producerID);
        const stream = await consume(producer);

        if (stream) {
          stream.producerID = producer.producerID;
          stream.socketID = producer.socketID;
          stream.userID = producer.userID;
          newStreams.push(stream);
        }
      }

      if (newStreams.length > 0) {
        setStreams(prev => {
          // ✅ FIX: Deduplicate streams to prevent duplicates
          const existingIds = new Set(prev.map(s => s.producerID));
          const uniqueNewStreams = newStreams.filter(s => !existingIds.has(s.producerID));
          return [...prev, ...uniqueNewStreams];
        });
      }
    };

    if (producers.length > 0 && deviceRef.current && consumerTransportRef.current) {
      consumeProducers();
    }
  }, [producers, roomID, consume, setStreams]);

  // Handle closing state from Redux
  useEffect(() => {
    if (closingState && !isClosingRef.current) {
      close();
    }
  }, [closingState, close]);

  // ============================================================================
  // RENDER
  // ============================================================================

  // Not joined yet - show appropriate UI
  if (!joined) {
    if (callDirection === 'outgoing') {
      return <Ringing incoming={false} meetingID={roomID} />;
    }
    if (callDirection === 'incoming') {
      return <Ringing incoming={true} meetingID={roomID} />;
    }
    return <Join onJoin={() => { setJoined(true); init(); }} />;
  }

  // Main meeting UI
  return (
    <div className="meeting uk-flex uk-flex-column uk-flex-between uk-flex-middle">
      {topBar && (
        <div className="meeting-top-controls">
          <div className="panel-control" onClick={() => setTopBar(!topBar)}>
            {topBar ? <FiChevronUp /> : <FiChevronDown />}
          </div>
          <LittleStreams
            streams={streams}
            localStream={localStream}
            isMaximized={isMaximized}
          />
          <div className="panel-control" onClick={() => setShowPanel(!showPanel)}>
            <FiMenu />
          </div>
        </div>
      )}

      {!topBar && (
        <div className="meeting-top-controls-transparent">
          <div className="panel-control" onClick={() => setTopBar(!topBar)}>
            <FiChevronDown />
          </div>
          <div className="videos" />
          <div className="panel-control" onClick={() => setShowPanel(!showPanel)}>
            <FiMenu />
          </div>
        </div>
      )}

      <Streams
        streams={streams}
        isMaximized={isMaximized}
        isGrid={isGrid}
      >
        <div className="meeting-controls">
          <div className="control" onClick={toggleVideo}>
            {video ? <FiVideo /> : <FiVideoOff />}
          </div>
          
          <div className="control" onClick={toggleAudio}>
            {audio ? <FiMic /> : <FiMicOff />}
          </div>
          
          <div className="control" onClick={toggleScreen}>
            {isScreen ? <FiXOctagon /> : <FiMonitor />}
          </div>
          
          <div className="close" onClick={close}>
            <FiPhoneOff />
          </div>
          
          <div className="control" onClick={() => setAddPeers(true)}>
            <FiUserPlus />
          </div>
          
          <div className="control" onClick={() => setMaximized(!isMaximized)}>
            {isMaximized ? <FiMaximize /> : <FiMinimize />}
          </div>
          
          <div className="control" onClick={() => setGrid(!isGrid)}>
            {isGrid ? <FiGrid /> : <FiColumns />}
          </div>
        </div>
      </Streams>

      {!isGrid && !topBar && <div className="top-bar-placeholder" />}
      
      {addPeers && <AddPeers onClose={() => setAddPeers(false)} />}
      
      {reconnecting && (
        <div className="reconnect-banner reconnecting">
          Reconnecting... (Attempt {reconnectAttemptRef.current}/{MAX_RECONNECT_ATTEMPTS})
        </div>
      )}
      
      {reconnected && (
        <div className="reconnect-banner reconnected">
          Reconnected
        </div>
      )}
    </div>
  );
}

export default Meeting;
