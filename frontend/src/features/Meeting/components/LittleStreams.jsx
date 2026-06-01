import { useEffect, useRef, useMemo } from 'react';
import './LittleStreams.sass';
import { useSelector } from 'react-redux';
import { useGlobal } from 'reactn';
import Interface from './LittleInterface';

/**
 * LittleStreams Component
 * 
 * Displays small thumbnails of remote peer video streams in the top bar.
 * 
 * ✅ FIXES:
 * - Defensive array checks to prevent filter errors
 * - Safe handling of consumers data structure
 */
function LittleStreams({ streams }) {
  // ✅ FIX: Safely get consumers with defensive checks
  const consumersRaw = useSelector((state) => state.rtc.consumers);
  const peers = useSelector((state) => state.rtc.peers) || {};
  const socketID = useSelector((state) => state.io.id);
  const [mainStream, setMainStream] = useGlobal('mainStream');
  const el = useRef(null);

  // ✅ FIX: Ensure consumers is always an array
  const consumers = useMemo(() => {
    if (Array.isArray(consumersRaw)) return consumersRaw;
    if (consumersRaw && Array.isArray(consumersRaw.content)) return consumersRaw.content;
    return [];
  }, [consumersRaw]);

  // ✅ FIX: Ensure streams is always an array
  const validStreams = useMemo(() => {
    if (!Array.isArray(streams)) return [];
    return streams.filter(s => s && s.socketID);
  }, [streams]);

  // Horizontal scroll handler
  useEffect(() => {
    if (!el.current) return;
    
    const scrollHorizontally = (e) => {
      e = window.event || e;
      const delta = Math.max(-1, Math.min(1, e.wheelDelta || -e.detail));
      el.current.scrollLeft -= delta * 40;
      e.preventDefault();
    };
    
    const currentEl = el.current;
    
    if (currentEl.addEventListener) {
      currentEl.addEventListener('mousewheel', scrollHorizontally, false);
      currentEl.addEventListener('DOMMouseScroll', scrollHorizontally, false);
    }
    
    return () => {
      if (currentEl && currentEl.removeEventListener) {
        currentEl.removeEventListener('mousewheel', scrollHorizontally, false);
        currentEl.removeEventListener('DOMMouseScroll', scrollHorizontally, false);
      }
    };
  }, []);

  // Filter out self from consumers
  const actualConsumers = useMemo(() => {
    return consumers.filter((c) => c !== socketID);
  }, [consumers, socketID]);

  // Build peer objects with their streams
  const actualPeers = useMemo(() => {
    return actualConsumers.map((consumerID) => {
      const peerData = peers[consumerID] || {};
      const actualPeer = {
        ...peerData,
        socketID: consumerID,
        video: null,
        audio: null,
        screen: null,
        streams: [],
      };
      
      const peerStreams = validStreams.filter((s) => s.socketID === consumerID);
      peerStreams.forEach((stream) => {
        actualPeer.streams.push(stream);
        if (stream.isVideo) {
          actualPeer.video = stream;
        } else {
          actualPeer.audio = stream;
        }
      });
      
      return actualPeer;
    }).filter(peer => peer.video || peer.audio); // Only include peers with media
  }, [actualConsumers, peers, validStreams]);

  // Build video elements
  const videos = actualPeers.map((peer, key) => (
    <div
      className={`video${mainStream && mainStream.socketID === peer.socketID ? ' main-peer' : ''}`}
      key={peer.socketID || key}
      onClick={() => setMainStream(peer)}
    >
      <Interface 
        isMaximized 
        video={peer.video} 
        audio={peer.audio} 
        peer={peer.user} 
      />
    </div>
  ));

  return (
    <div className="videos" ref={el}>
      {actualPeers.length > 0 && videos}
    </div>
  );
}

export default LittleStreams;
