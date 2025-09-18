import './Streams.sass';
import { useSelector } from 'react-redux';
import { useGlobal } from 'reactn';
import { useEffect } from 'react';
import Interface from './Interface';

function Streams({
  streams, children, isMaximized, isGrid,
}) {
  const consumers = useSelector((state) => state.rtc.consumers);
  const producers = useSelector((state) => state.rtc.producers);
  const peers = useSelector((state) => state.rtc.peers);
  const socketID = useSelector((state) => state.io.id);
  const [mainStream, setMainStream] = useGlobal('mainStream');

  const actualConsumers = consumers.filter((c) => c !== socketID);
  const actualPeers = [];
  
  actualConsumers.forEach((consumerID) => {
    const actualPeer = {
      ...peers[consumerID],
      video: null,
      audio: null,
      screen: null,
    };
    
    const peerStreams = streams.filter((s) => s && s.socketID === consumerID);
    peerStreams.forEach((stream) => {
      if (!stream) return; // Safety check
      
      actualPeer.streams = [...(actualPeer.streams || []), stream];
      if (stream.isVideo) {
        actualPeer.video = stream;
      } else {
        actualPeer.audio = stream;
      }
    });
    
    const isScreen = (actualPeer.video || actualPeer.screen) &&
      producers.filter((p) => p && p.producerID === (actualPeer.video?.producerID) && p.isScreen).length > 0;
    
    actualPeers.push({ ...actualPeer, isScreen });
  });

  // FIX: Move setMainStream to useEffect to avoid render-time side effects
  useEffect(() => {
    if (!isGrid && !mainStream && actualPeers.length > 0) {
      setMainStream(actualPeers[actualPeers.length - 1]);
    }
  }, [isGrid, mainStream, actualPeers.length, setMainStream]);

  if (!isGrid && mainStream && actualPeers.length > 0) {
    // FIX: Proper comparison - find peer by socketID
    let mainPeer = actualPeers.find(peer => peer.socketID === mainStream.socketID);
    
    // Fallback to first peer if mainPeer not found
    if (!mainPeer) {
      mainPeer = actualPeers[0];
    }

    return (
      <div className="streams uk-flex uk-flex-middle uk-flex-center uk-flex-column">
        <div className="video-container">
          <div className="video-row">
            <div className="video-wrapper">
              <Interface
                isMaximized={isMaximized}
                video={mainPeer.video}
                audio={mainPeer.audio}
                peer={mainPeer.user}
                isScreen={mainPeer.isScreen}
              />
            </div>
          </div>
        </div>
        {children}
      </div>
    );
  }

  const side = Math.ceil(Math.sqrt(actualPeers.length));
  const rows = [];
  let row = [];

  actualPeers.forEach((peer, key) => {
    if (row.length === side) {
      rows.push(
        <div className="video-row" key={`row-${key}`}>
          {row}
        </div>,
      );
      row = [];
    }
    
    // FIX: Add safety checks for debugging
    if (peer.video && peer.video.getTracks) {
      const videoTracks = peer.video.getVideoTracks();
      if (videoTracks.length > 0) {
        console.log('video track state:', videoTracks[0].readyState);
      }
    }
    
    row.push(
      <div className="video-wrapper" key={`peer-${peer.socketID || key}`}>
        <Interface
          isMaximized={isMaximized}
          video={peer.video}
          audio={peer.audio}
          peer={peer.user}
          isScreen={peer.isScreen}
        />
      </div>,
    );
  });

  if (row.length > 0) {
    rows.push(
      <div className="video-row" key="last-row">
        {row}
      </div>,
    );
  }

  return (
    <div className="streams uk-flex uk-flex-middle uk-flex-center uk-flex-column">
      {actualPeers.length === 0 && <p className="waiting">Waiting for others to join...</p>}
      {actualPeers.length > 0 && <div className="video-container">{rows}</div>}
      {children}
    </div>
  );
}

export default Streams;