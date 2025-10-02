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
      console.log("Producer transport connected");
      producerRetryCountRef.current = 0; // reset retries
       //setReconnecting(false);
      //setReconnected(true);
      //setTimeout(() => setReconnected(false), 2000); // hide after 2s
      break;
    case 'failed':
    case 'disconnected':
    case 'closed':
      /*
     console.warn("Producer transport failed, reconnecting...");
     
      setReconnecting(true);
      try { transport.close(); } catch (e) {}
      transportRef.current = null;

      retry(async () => {
        if (!deviceRef.current) {
          console.warn("Device not ready, skipping reconnect");
          return;
        }

        console.log("Recreating producer transport...");

        const data = await io.request('createProducerTransport', {
          forceTcp: false,
          rtpCapabilities: deviceRef.current.rtpCapabilities,
          roomID,
        });
        if (data.error) {
          console.error("Failed to recreate producer transport:", data.error);
          return;
        }

        const newTransport = deviceRef.current.createSendTransport(data);
        transportRef.current = newTransport;

        // rebind handlers
        newTransport.on("connect", ({ dtlsParameters }, callback, errback) => {
          io.request("connectProducerTransport", { dtlsParameters })
            .then(callback)
            .catch(errback);
        });

        newTransport.on("produce", async ({ kind, rtpParameters, appData }, callback, errback) => {
          try {
            const { id } = await io.request("produce", {
              transportId: newTransport.id,
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

        // 🔄 re-produce tracks (video/audio/screen if active)
        if (getGlobal().videoStream) await produceVideo(getGlobal().videoStream);
        if (getGlobal().audioStream) await produceAudio(getGlobal().audioStream);
        if (getGlobal().screenStream) await produceScreen(getGlobal().screenStream);

      }, producerRetryCountRef);
      */
      break;
    default:
      break;
  }
});

  await produceAudio();
  await produceVideo();
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

  
transport.on('connectionstatechange', (state) => {
  switch (state) {
    case 'connected':
      console.log("Consumer transport connected");
      consumerRetryCountRef.current = 0;
      //setReconnecting(false);
      //setReconnected(true);
      //setTimeout(() => setReconnected(false), 2000); // hide after 2s      

      // 🔄 Re-subscribe to existing producers inside async IIFE
      /*
      (async () => {
        if (producers && producers.length > 0) {
          for (const producer of producers) {
            if (!consumersRef.current[producer.producerID]) {
              try {
                const stream = await consume(producer);
                if (stream) {
                  stream.producerID = producer.producerID;
                  stream.socketID = producer.socketID;
                  stream.userID = producer.userID;
                  setStreams(prev => [...prev, stream]);
                }
              } catch (err) {
                console.error("Failed to consume producer:", err);
              }
            }
          }
        }
      })();
      */
      break;
    case 'failed':
    case 'disconnected':
    case "closed":
      /*
      console.warn("Consumer transport failed, reconnecting...");
      setReconnecting(true);
      try { transport.close(); } catch (e) {}
      consumerTransportRef.current = null;

      retry(async () => {
        if (!deviceRef.current) {
          console.warn("Device not ready, skipping reconnect");
          return;
        }
        console.log("Retrying subscribe after consumer failure...");
        await subscribe(deviceRef.current);
      }, consumerRetryCountRef);
      */
      break;
  
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
    onClick={async () => {
      if (video && videoProducerRef.current) {
        stopVideo();
      } else {
        try {
          setVideo(true); // Set state immediately for UI feedback
          const stream = await getVideo();
          await produceVideo(stream);
        } catch (error) {
          console.error('Failed to start video:', error);
          setVideo(false);
        }
      }
    }}
  >
    {video ? <FiVideo /> : <FiVideoOff />}
  </div>
  
  <div
    className="control"
    onClick={async () => {
      if (audio && audioProducerRef.current) {
        stopAudio();
      } else {
        try {
          setAudio(true); // Set state immediately for UI feedback
          const stream = await getAudio();
          await produceAudio(stream);
        } catch (error) {
          console.error('Failed to start audio:', error);
          setAudio(false);
        }
      }
    }}
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
      {!isGrid && !topBar && <TopBar localStream={localStream} />}
      {addPeers && <AddPeers onClose={() => setAddPeers(false)} />}
      {reconnecting && (
        <div className="reconnect-banner reconnecting">
          Reconnecting…
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
