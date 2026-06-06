import { useEffect, useRef, useState } from 'react';
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
import Actions from '../../constants/Actions';
import Join from './components/Join';
import AddPeers from './components/AddPeers';
import Ringing from './components/Ringing';
import Streams from './components/Streams';
import LittleStreams from './components/LittleStreams';
import postClose from '../../actions/postClose';
import { leaveCall, rejoinCall } from '../../actions/callSignaling';
import CallEnded from './components/CallEnded';

function Meeting() {
  const [device, setDevice] = useState(null);
  const transportRef = useRef(null);
  const videoProducerRef = useRef(null);
  const screenProducerRef = useRef(null);
  const audioProducerRef = useRef(null);
  const consumerTransportRef = useRef(null);
  const consumersRef = useRef({});
  const deviceRef = useRef(null);
  const consumerRetryCountRef = useRef(0);
  const producerRetryCountRef = useRef(0);
  const reconnectingRef = useRef(false);
  const callState = useSelector((state) => state.rtc.callState);
  const endReason = useSelector((state) => state.rtc.endReason);
  const endedIncrement = useSelector((state) => state.rtc.endedIncrement);
  const reconnectingPeers = useSelector((state) => state.rtc.reconnectingPeers);
  const [showEnded, setShowEnded] = useState(false);

  const MAX_RETRIES = 5;

// Retry helper
const retry = (fn, counterRef) => {
  if (counterRef.current >= MAX_RETRIES) {
    console.error("Max retries reached, giving up.");
    return;
  }
  const delay = 1000 * Math.pow(2, counterRef.current); // 1s, 2s, 4s...
  counterRef.current++;
  console.log(`Retrying in ${delay}ms...`);
  setTimeout(fn, delay);
};

const hangUp = async () => {
  try {
    await leaveCall(io, roomID);   // lifecycle: server decides if call ends
  } catch (e) {}
  close();                          // existing media teardown + navigate
};

  const io = useSelector((state) => state.io.io);
  const room = useSelector((state) => state.io.room); // Add this line
  const producers = useSelector((state) => state.rtc.producers);
  const lastLeave = useSelector((state) => state.rtc.lastLeave);
  const lastLeaveType = useSelector((state) => state.rtc.lastLeaveType);
  const increment = useSelector((state) => state.rtc.increment);
  const closingState = useSelector((state) => state.rtc.closingState);
  const [streams, setStreams] = useGlobal('streams');
  const [localStream, setLocalStream] = useGlobal('localStream');
  const [video, setVideo] = useGlobal('video');
  const [audio, setAudio] = useGlobal('audio');
  const [isScreen, setScreen] = useGlobal('screen');
  const [audioStream, setAudioStream] = useGlobal('audioStream');
  const [videoStream, setVideoStream] = useGlobal('videoStream');
  const setScreenStream = useGlobal('screenStream')[1];
  const [callStatus, setCallStatus] = useGlobal('callStatus');
  const callDirection = useGlobal('callDirection')[0];
  const [joined, setJoined] = useGlobal('joined');
  const [isMaximized, setMaximized] = useState(true);
  const [isGrid, setGrid] = useState(true);
  const [topBar, setTopBar] = useState(true);
  const [accepted, setAccepted] = useGlobal('accepted');
  const [showPanel, setShowPanel] = useGlobal('showPanel');
  const setOver = useGlobal('over')[1];
  const setMeeting = useGlobal('meetingID')[1];
  const [addPeers, setAddPeers] = useState(false);
  const counterpart = useSelector((state) => state.rtc.counterpart) || {};
const [reconnecting, setReconnecting] = useState(false);
const [reconnected, setReconnected] = useState(false);

  const answerIncrement = useSelector((state) => state.rtc.answerIncrement);
  const answerData = useSelector((state) => state.rtc.answerData);

  const params = useParams();
  const roomID = params.id;

  const dispatch = useDispatch();
  const navigate = useNavigate();

  useEffect(() => {
    if (!answerData) return;
    if (callDirection === 'outgoing' && callStatus !== 'in-call' && answerData.meetingID === roomID) {
      setJoined(true);
      init();
    }
  }, [answerIncrement, answerData]);

  useEffect(() => {
    if (accepted) {
      setAccepted(false).then(() => {
        setJoined(true);
        init();
      });
    }
  }, [accepted]);

  useEffect(() => {
    setMeeting(roomID);
    return () => {
      if (getGlobal().callStatus !== 'in-call') {
        try {
          if (getGlobal().audioStream) {
            getGlobal()
              .audioStream.getTracks()
              .forEach((track) => track.stop());
          }
        } catch (e) {}
        try {
          if (getGlobal().videoStream) {
            getGlobal()
              .videoStream.getTracks()
              .forEach((track) => track.stop());
          }
        } catch (e) {}
      }
    };
  }, []);
useEffect(() => {
  if (callState !== 'ended') return;
  setShowEnded(true);
  const t = setTimeout(() => {
    setShowEnded(false);
    close();
  }, 1500);
  return () => clearTimeout(t);
}, [endedIncrement]); // bump-based so repeat calls re-trigger cleanly

// Reconnection: when the signaling socket drops and comes back (new socket.id),
// re-attach to the call within the server's grace window (call:rejoin) and
// rebuild media. The grace timer on the server holds the participant's seat as
// 'reconnecting' until this fires (or the window expires).
useEffect(() => {
  if (!io) return undefined;
  const onDisconnect = () => {
    if (getGlobal().callStatus === 'in-call') setReconnecting(true);
  };
  const onReconnect = async () => {
    if (getGlobal().callStatus !== 'in-call') return;
    try { await rejoinCall(io, roomID); } catch (e) {}
    await fullReconnect();
  };
  io.on('disconnect', onDisconnect);
  io.on('reconnect', onReconnect);
  // socket.io v4 surfaces manager-level reconnect on io.io
  if (io.io && io.io.on) io.io.on('reconnect', onReconnect);
  return () => {
    try { io.off('disconnect', onDisconnect); } catch (e) {}
    try { io.off('reconnect', onReconnect); } catch (e) {}
    try { if (io.io && io.io.off) io.io.off('reconnect', onReconnect); } catch (e) {}
  };
}, [io, roomID]);
const getAudio = async () => {

  const constraints = {
      audio: {
        echoCancellation: { exact: true },        // Force AEC
        noiseSuppression: { exact: true },         // Force NS  
        autoGainControl: { exact: true },          // Force AGC
        sampleRate: { ideal: 48000 },             // Higher quality
        channelCount: { ideal: 1 },               // Mono reduces processing
        sampleSize: 16,
        googEchoCancellation: true,               // Chrome-specific
        googTypingNoiseDetection: true,           // Chrome-specific
        googHighpassFilter: true,                 // Chrome-specific
        googNoiseSuppression: 2,                  // Chrome-specific (0-2)
      }
    };
    
  const stream = await navigator.mediaDevices.getUserMedia(constraints);
  setAudioStream(stream);
  return stream;
};

const getVideo = async () => {
  const stream = await navigator.mediaDevices.getUserMedia({ video: true });
  setVideoStream(stream);
  return stream;
};
  const getScreen = async () => {
    const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
    setScreenStream(stream);
    return stream;
  };

  const produceVideo = async (stream) => {
      let useStream = stream || videoStream;

  try {
    const track = useStream.getVideoTracks()[0];
    const params = { track, appData: { isScreen: false } };
    await setLocalStream(useStream);
    videoProducerRef.current = await transportRef.current.produce(params);
    
    // FIX: Sync UI state when track ends
    track.addEventListener('ended', () => {
      console.log('Video track ended, syncing UI state');
 
    });
    
    // Also handle producer events
    videoProducerRef.current.on('trackended', () => {
      console.log('Video producer track ended');
    
    });

    videoProducerRef.current.on('transportclose', () => {
    console.log('Video transport closed');
  
  });
    
  } catch (err) {
    console.log('getusermedia produce failed', err);
    setVideo(false);
  }
};

const produceAudio = async (stream) => {
  const useStream = stream || audioStream;

  try {
    const track = useStream?.getAudioTracks?.()[0];
    if (!track) {
      console.warn("No audio track available");
      return;
    }
    const params = { track };
    audioProducerRef.current = await transportRef.current.produce(params);
    
    // FIX: Sync UI state when audio track ends
    track.addEventListener('ended', () => {
      console.log('Audio track ended, syncing UI state');
      //setAudio(false);
      //audioProducerRef.current = null;
    });
    
    audioProducerRef.current.on('trackended', () => {
      console.log('Audio producer track ended');
      //setAudio(false);
      //audioProducerRef.current = null;
    });
    
  } catch (err) {
    console.log('getusermedia produce failed', err);
    //setAudio(false);
  }
};

const produceScreen = async (stream) => {
  try {
    const track = stream.getVideoTracks()[0];
    const params = { track, appData: { isScreen: true } };
    await setLocalStream(stream);
    screenProducerRef.current = await transportRef.current.produce(params);
    await setScreen(true);
  } catch (err) {
    console.log('getusermedia produce failed', err);
  }
};

const stopVideo = async () => {
  try {
    if (localStream) localStream.getVideoTracks()[0].stop();
    await io.request('remove', { producerID: videoProducerRef.current.id, roomID });
    videoProducerRef.current.close();
    videoProducerRef.current = null;
    await setVideo(false);
  } catch (e) {
    console.log(e);
  }
};

const stopAudio = async () => {
  try {
    await io.request('remove', { producerID: audioProducerRef.current.id, roomID });
    audioProducerRef.current.close();
    audioProducerRef.current = null;
    await setAudio(false);
  } catch (e) {
    console.log(e);
  }
};

const stopScreen = async () => {
  try {
    //if (localStream) localStream.getVideoTracks()[0].stop();
    if (screenProducerRef.current) {
       const track = screenProducerRef.current?.track || screenProducerRef.current?.stream?.getVideoTracks?.()[0];
       if (track) track.stop();
    }
    await io.request('remove', { producerID: screenProducerRef.current.id, roomID });
    screenProducerRef.current.close();
    screenProducerRef.current = null;
    await setScreen(false);
  } catch (e) {
    console.log(e);
  }
};

// ── Camera toggle (Phase 5) ──
// CRITICAL: never call transport.produce() more than once per kind per call.
// A second produce() renegotiates (createOffer) and collides with the stale
// m-section's RTP header-extension IDs ("RTP extension ID reassignment not
// supported"), which is why turning the camera back on failed. So we create the
// producer once, then pause + replaceTrack to turn it off/on with no
// renegotiation. replaceTrack swaps the outgoing track without an offer.
const toggleVideo = async () => {
  try {
    if (video) {
      // OFF: pause the producer and release the camera (light off).
      if (videoProducerRef.current) {
        try { videoProducerRef.current.pause(); } catch (e) {}
        try {
          io.emit('producer-paused', {
            producerID: videoProducerRef.current.id, roomID, kind: 'video',
          });
        } catch (e) {}
      }
      if (videoStream) videoStream.getVideoTracks().forEach((t) => t.stop());
      await setVideo(false);
    } else {
      // ON
      const stream = await getVideo();
      await setVideo(true);
      if (!videoProducerRef.current) {
        // First time this call: create the single video producer.
        await produceVideo(stream);
      } else {
        // Reuse the existing producer: swap in the fresh track, no renegotiation.
        const track = stream.getVideoTracks()[0];
        await videoProducerRef.current.replaceTrack({ track });
        try { videoProducerRef.current.resume(); } catch (e) {}
        await setLocalStream(stream);
        try {
          io.emit('producer-resumed', {
            producerID: videoProducerRef.current.id, roomID, kind: 'video',
          });
        } catch (e) {}
      }
    }
  } catch (e) {
    console.error('toggleVideo failed:', e);
    setVideo(false);
  }
};

// ── Mic toggle (Phase 5) ──
// Same principle: produce once, then pause/resume. We keep the mic track warm
// (just disable it) so unmute is instant.
const toggleAudio = async () => {
  try {
    if (audio) {
      // MUTE
      if (audioProducerRef.current) {
        try { audioProducerRef.current.pause(); } catch (e) {}
        try {
          io.emit('producer-paused', {
            producerID: audioProducerRef.current.id, roomID, kind: 'audio',
          });
        } catch (e) {}
      }
      if (audioStream) audioStream.getAudioTracks().forEach((t) => { t.enabled = false; });
      await setAudio(false);
    } else {
      // UNMUTE
      if (!audioProducerRef.current) {
        const stream = await getAudio();
        await setAudio(true);
        await produceAudio(stream);
      } else {
        if (audioStream) audioStream.getAudioTracks().forEach((t) => { t.enabled = true; });
        try { audioProducerRef.current.resume(); } catch (e) {}
        await setAudio(true);
        try {
          io.emit('producer-resumed', {
            producerID: audioProducerRef.current.id, roomID, kind: 'audio',
          });
        } catch (e) {}
      }
    }
  } catch (e) {
    console.error('toggleAudio failed:', e);
  }
};

  // Updated init function to create default transport
const init = async () => {
  await setCallStatus('in-call');
  await setShowPanel(false);
  await setOver(true);
 
  await setStreams([]);

  dispatch({ type: Actions.RTC_ROOM_ID, roomID });

  const { producers, consumers, peers } = await io.request('join', { roomID });

  dispatch({ type: Actions.RTC_CONSUMERS, consumers, peers });

  const routerRtpCapabilities = await io.request('getRouterRtpCapabilities');
  const device = new mediasoup.Device();
  await device.load({ routerRtpCapabilities });
deviceRef.current = device;

  setDevice(device);

  // Create default consumer transport
  await subscribe(device);

  dispatch({ type: Actions.RTC_PRODUCERS, producers: producers || [] });

  const data = await io.request('createProducerTransport', {
    forceTcp: false,
    rtpCapabilities: device.rtpCapabilities,
    roomID,
  });

  if (data.error) {
    console.error(data.error);
    return;
  }

  const transport = device.createSendTransport(data);
  transportRef.current = transport;

  transport.on('connect', async ({ dtlsParameters }, callback, errback) => {
    io.request('connectProducerTransport', { dtlsParameters }).then(callback).catch(errback);
  });

  transport.on('produce', async ({ kind, rtpParameters, appData }, callback, errback) => {
    try {
      const { id } = await io.request('produce', {
        transportId: transport.id,
        kind,
        rtpParameters,
        roomID,
        isScreen: appData && appData.isScreen,
      });
      callback({ id });
    } catch (err) {
      errback(err);
    }
  });

transport.on('connectionstatechange', async (state) => {
  switch (state) {
    case 'connected':
      console.log('Producer transport connected');
      producerRetryCountRef.current = 0; // reset retries
      setReconnecting(false);
      setReconnected(true);
      setTimeout(() => setReconnected(false), 2000); // hide after 2s
      break;
    case 'failed':
    case 'disconnected':
      console.warn('Producer transport', state, '- attempting recovery');
      setReconnecting(true);
      // If the socket is still alive, this is an ICE / network-path failure
      // (e.g. Wi-Fi -> cellular). An ICE restart recovers it cheaply, keeping
      // producers and consumers intact.
      if (io && io.connected) {
        try {
          const res = await io.request('restartIce', { type: 'producer', roomID });
          if (res && res.iceParameters) {
            await transport.restartIce({ iceParameters: res.iceParameters });
          }
        } catch (e) {
          console.warn('Producer ICE restart failed:', e && e.message);
        }
      }
      // If the socket itself dropped, the full rebuild + lifecycle rejoin runs
      // on the socket 'reconnect' event (see the io-listener effect below).
      break;
    case 'closed':
    default:
      break;
  }
});

  await produceAudio();
  await produceVideo();
};

// Full media rebuild after the signaling socket reconnects with a NEW socket.id.
// The server destroyed all of this socket's mediasoup state on disconnect, so we
// reset the dead transport refs, clear the stale producer list, and re-run init()
// (which re-joins, recreates the device + transports, re-consumes peers via the
// [producers] effect, and re-produces our active tracks). Guarded so the
// transport-failure handlers and the socket 'reconnect' event can't rebuild twice.
const fullReconnect = async () => {
  if (reconnectingRef.current) return;
  reconnectingRef.current = true;
  setReconnecting(true);
  try {
    try { transportRef.current && transportRef.current.close(); } catch (e) {}
    try { consumerTransportRef.current && consumerTransportRef.current.close(); } catch (e) {}
    transportRef.current = null;
    consumerTransportRef.current = null;
    consumersRef.current = {};
    dispatch({ type: Actions.RTC_RESET_PRODUCERS, producers: [], lastLeaveType: 'leave' });
    await setStreams([]);
    await init();
  } catch (e) {
    console.error('Full reconnect failed:', e);
  } finally {
    reconnectingRef.current = false;
  }
};

  useEffect(() => {
    if (lastLeaveType === 'leave') setStreams(getGlobal().streams.filter((s) => s.socketID !== lastLeave));
    else setStreams(getGlobal().streams.filter((s) => s.producerID !== lastLeave));
  }, [lastLeave, lastLeaveType, setStreams, increment]);

  useEffect(() => {
  const init = async () => {
    const newStreams = [];
    for (const producer of producers) {
      
      if (!consumersRef.current[producer.producerID] && producer.roomID === roomID) {
        console.log('Creating consumer for producer:', producer.producerID);

        const stream = await consume(producer);

        if (stream) {
          stream.producerID = producer.producerID;
          stream.socketID = producer.socketID;
          stream.userID = producer.userID;
          newStreams.push(stream);

          io.request('resume', { producerID: producer.producerID, meetingID: roomID });
        }
      }
    }
    setStreams([...getGlobal().streams, ...newStreams]);
  };
  init();
}, [producers]);

const consume = async (producer) => {
    if (!deviceRef.current || !consumerTransportRef.current) {
      console.error('Device or consumer transport not available');
      return null;
    }

    try {
      const { rtpCapabilities } = device;

      const data = await io.request('consume', {
        rtpCapabilities,
        socketID: producer.socketID,
        roomID,
        producerID: producer.producerID,
      });

      if (!data || !data.id) {
        console.error('No consume response or missing id for producer:', producer.producerID, data);
        return null;
      }

      const { producerId, id, kind, rtpParameters } = data;

      // If we already have a consumer for this producer, close it first (defensive)
      /*
      if (consumersRef.current[producer.producerID]) {
        try { consumersRef.current[producer.producerID].close(); } catch (e) {}
        delete consumersRef.current[producer.producerID];
      }
      */

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
        //console.log('Producer closed, cleaning up consumer for:', producer.producerID);
        //setStreams(prev => prev.filter(s => s.producerID !== producer.producerID));
        //try { consumer.close(); } catch (e) {}
        //delete consumersRef.current[producer.producerID];
        console.log('associated producer closed so consumer closed');
      });

      consumer.on('close', () => {
        console.log('consumer closed');
        //console.log('Consumer closed for producer:', producer.producerID);
        //delete consumersRef.current[producer.producerID];
      });

      // Create MediaStream
      const stream = new MediaStream();
      stream.addTrack(consumer.track);
      stream.isVideo = kind === 'video';

      return stream;

    } catch (error) {
      console.error('Consume failed for producer:', producer.producerID, error);
      return null;
    }
  };

 const subscribe = async (device) => {
  if (consumerTransportRef.current) {
    console.log("Consumer transport already exists");
    return consumerTransportRef.current;
  }

  const data = await io.request('createConsumerTransport', {
    forceTcp: false,
    roomID,
  });

  if (data.error) {
    console.error(data.error);
    return;
  }

  const transport = device.createRecvTransport(data);

  transport.on('connect', ({ dtlsParameters }, callback, errback) => {
    io.request('connectConsumerTransport', {
      transportId: transport.id,
      dtlsParameters,
    })
      .then(callback)
      .catch(errback);
  });

  
transport.on('connectionstatechange', async (state) => {
  switch (state) {
    case 'connected':
      console.log('Consumer transport connected');
      consumerRetryCountRef.current = 0;
      break;
    case 'failed':
    case 'disconnected':
      console.warn('Consumer transport', state, '- attempting recovery');
      setReconnecting(true);
      if (io && io.connected) {
        try {
          const res = await io.request('restartIce', { type: 'consumer', roomID });
          if (res && res.iceParameters) {
            await transport.restartIce({ iceParameters: res.iceParameters });
          }
        } catch (e) {
          console.warn('Consumer ICE restart failed:', e && e.message);
        }
      }
      // Full rebuild on socket 'reconnect' (see io-listener effect below).
      break;
    case 'closed':
    default:
      break;
  }
});

  consumerTransportRef.current = transport;
  return transport;
};

// Updated close function to handle all consumer transports
const close = async () => {
    try {
      // Stop all producers
      await Promise.allSettled([
        stopVideo(),
        stopAudio(),
        stopScreen()
      ]);

      
      // Close local consumers
      try {
        Object.values(consumersRef.current).forEach((consumer) => {
          try { consumer.close(); } catch (e) {}
        });
        consumersRef.current = {};
      } catch (e) {
        console.error('Error closing consumers:', e);
      }

      // Stop all tracks from global streams
  try {
    if (videoStream) {
      videoStream.getTracks().forEach((track) => {
        track.stop();
        console.log('Stopped video track:', track);
      });
      setVideoStream(null);
    }
  } catch (e) {
    console.log('Error stopping video stream:', e);
  }

  try {
    if (audioStream) {
      audioStream.getTracks().forEach((track) => {
        track.stop();
        console.log('Stopped audio track:', track);
      });
      setAudioStream(null);
    }
  } catch (e) {
    console.log('Error stopping audio stream:', e);
  }

  try {
    if (localStream) {
      localStream.getTracks().forEach((track) => {
        track.stop();
        console.log('Stopped local stream track:', track);
      });
      setLocalStream(null);
    }
  } catch (e) {
    console.log('Error stopping local stream:', e);
  }

      // Clear streams and reset states
      await setStreams([]);
      await setVideo(false);
      await setAudio(false);
      await setScreen(false);
 
      // Close producer transport
      if (transportRef.current) {
        transportRef.current.close();
        transportRef.current = null;
      }

      // Close consumer transport
      if (consumerTransportRef.current) {
        consumerTransportRef.current.close();
        consumerTransportRef.current = null;
      }
 

      // Leave room
      try {
        await io.request('leave', { roomID });
      } catch (error) {
        console.error('Error leaving room:', error);
      }

      // Navigation and state reset
      navigate('/', { replace: true });

      await setJoined(false);
      await setShowPanel(true);
      await setCallStatus(null);

      dispatch({ type: Actions.RTC_LEAVE });
      console.log('Meeting closed - all resources cleaned up');

    } catch (error) {
      console.error('Error during close:', error);
    }
  };

  useEffect(() => {
    if (closingState && joined) close();
  }, [closingState]);

  if (callDirection === 'incoming' && !joined) {
    return (
      <div className="content uk-flex uk-flex-column uk-flex-center uk-flex-middle" style={{ background: 'black' }}>
        <Ringing
          incoming
          meetingID={roomID}
          onJoin={() => {
            setJoined(true);
            init();
          }}
        />
      </div>
    );
  }

  if (callDirection === 'outgoing' && !joined) {
    return (
      <div className="content uk-flex uk-flex-column uk-flex-center uk-flex-middle" style={{ background: 'black' }}>
        <Ringing incoming={false} meetingID={roomID} />
      </div>
    );
  }

  if (!joined) {
    return (
      <div className="content uk-flex uk-flex-column uk-flex-center uk-flex-middle" style={{ background: 'black' }}>
        <Join
          onJoin={() => {
            setJoined(true);
            init();
          }}
        />
      </div>
    );
  }

  function TopBar({ localStream }) {
    const localVideoRef = useRef(null);

    useEffect(() => {
      if (!localStream) return;
      localVideoRef.current.srcObject = localStream;
    }, [localStream]);

    return (
      <div className="meeting-top-controls">
        <div
          className="panel-control"
          onClick={() => {
            setShowPanel(!showPanel);
            setOver(showPanel);
          }}
        >
          {showPanel ? <FiChevronLeft /> : <FiMenu />}
        </div>
        <LittleStreams streams={streams} />
        <div className="videos" style={{ flexGrow: 0 }}>
          <video
            hidden={!video && !isScreen}
            className="video"
            onLoadedMetadata={() => localVideoRef.current.play()}
            ref={localVideoRef}
            style={{ objectFit: 'cover', background: 'black', zIndex: 1000 }}
             muted={true}  // ADD THIS LINE
            playsInline
          />
        </div>
        <div className="panel-control" onClick={() => setTopBar(!topBar)}>
          {topBar ? <FiChevronDown /> : <FiChevronUp />}
        </div>
      </div>
    );
  }

  function TopBarTransparent({ localStream }) {
    const localVideoRef = useRef(null);

    useEffect(() => {
  if (!localStream) return;
  localVideoRef.current.srcObject = localStream;
}, [localStream]);

    return (
      <div className="meeting-top-controls-transparent">
        <div
          className="panel-control"
          onClick={() => {
            setShowPanel(!showPanel);
            setOver(showPanel);
          }}
        >
          {showPanel ? <FiChevronLeft /> : <FiMenu />}
        </div>
        <div className="videos" style={{ flexGrow: 0, minWidth: video || isScreen ? 137 : 0 }}>
          <video
            hidden={!video && !isScreen}
            className="video"
            onLoadedMetadata={() => localVideoRef.current.play()}
            ref={localVideoRef}
            style={{ objectFit: 'cover', background: 'black', zIndex: 1000 }}
             muted={true}  // ADD THIS LINE
            playsInline
          />
        </div>
      </div>
    );
  }

  return (
    <div className="meeting-main uk-flex uk-flex-column">
      {isGrid && <TopBarTransparent localStream={localStream} />}
      {!isGrid && topBar && <TopBar localStream={localStream} />}
      <Streams
        isGrid={isGrid}
        streams={streams}
        localStream={localStream}
        isVideo={video}
        isScreen={isScreen}
        isMaximized={isMaximized}
      >
        <div className="meeting-controls" style={{ bottom: topBar || isGrid ? 0 : 95 }}>
          <div
    className="control"
    onClick={toggleVideo}
  >
    {video ? <FiVideo /> : <FiVideoOff />}
  </div>
  
  <div
    className="control"
    onClick={toggleAudio}
  >
    {audio ? <FiMic /> : <FiMicOff />}
  </div>
  
  <div
    className="control"
    onClick={async () => {
      if (isScreen && screenProducerRef.current) {
        stopScreen();
      } else {
        try {
          setScreen(true); // Set state immediately for UI feedback
          const stream = await getScreen();
          await produceScreen(stream);
        } catch (error) {
          console.error('Failed to start screen sharing:', error);
          setScreen(false);
        }
      }
    }}
  >
    {isScreen ? <FiXOctagon /> : <FiMonitor />}
  </div>
          
<div className="close" onClick={hangUp}>
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
      {!isGrid && !topBar && <TopBar localStream={localStream} />}
      {addPeers && <AddPeers onClose={() => setAddPeers(false)} />}
      {(reconnecting || reconnectingPeers.length > 0) && (
        <div className="reconnect-banner reconnecting">
          Reconnecting…
        </div>
      )}
      {reconnected && (
        <div className="reconnect-banner reconnected">
          Reconnected
        </div>
      )} 
      {showEnded && <CallEnded reason={endReason} />}
       
    </div>
  );
}

export default Meeting;