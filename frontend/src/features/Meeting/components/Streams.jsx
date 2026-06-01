import './Streams.sass';
import { useSelector } from 'react-redux';
import { useGlobal } from 'reactn';
import { useEffect, useMemo, useCallback } from 'react';
import Interface from './Interface';

/**
 * Streams Component
 * 
 * Renders the grid/focused view of remote peer video streams.
 * 
 * ✅ FIXES:
 * - Stream validation to prevent black screens from stale/ended streams
 * - Proper deduplication of streams
 * - Safe handling of missing peer data
 * - Optimized re-renders with useMemo
 * - Defensive array handling to prevent filter errors
 */
function Streams({
  streams,
  children,
  isMaximized,
  isGrid,
}) {
  // ✅ FIX: Safely get consumers with defensive checks
  const consumersRaw = useSelector((state) => state.rtc.consumers);
  const producersRaw = useSelector((state) => state.rtc.producers);
  const peers = useSelector((state) => state.rtc.peers) || {};
  const socketID = useSelector((state) => state.io.id);
  const [mainStream, setMainStream] = useGlobal('mainStream');

  // ✅ FIX: Ensure consumers is always an array
  const consumers = useMemo(() => {
    if (Array.isArray(consumersRaw)) return consumersRaw;
    if (consumersRaw && Array.isArray(consumersRaw.content)) return consumersRaw.content;
    return [];
  }, [consumersRaw]);

  // ✅ FIX: Ensure producers is always an array
  const producers = useMemo(() => {
    if (Array.isArray(producersRaw)) return producersRaw;
    return [];
  }, [producersRaw]);

  /**
   * ✅ FIX: Validate that a stream is still active and usable
   * Returns true if stream has at least one live track
   */
  const isStreamValid = useCallback((stream) => {
    if (!stream) return false;
    
    try {
      const tracks = stream.getTracks();
      if (!tracks || tracks.length === 0) return false;
      
      // Check if at least one track is live
      const hasLiveTrack = tracks.some(track => 
        track && track.readyState === 'live'
      );
      
      return hasLiveTrack;
    } catch (e) {
      // Stream might be in an invalid state
      console.warn('Error validating stream:', e);
      return false;
    }
  }, []);

  /**
   * ✅ FIX: Filter and validate streams, removing stale entries
   */
  const validStreams = useMemo(() => {
    if (!streams || !Array.isArray(streams)) return [];
    
    return streams.filter(stream => {
      if (!stream) return false;
      
      // Must have required identifiers
      if (!stream.socketID || !stream.producerID) {
        console.warn('Stream missing identifiers:', stream);
        return false;
      }
      
      // Validate stream is still active
      if (!isStreamValid(stream)) {
        console.log('Filtering out invalid/ended stream:', stream.producerID);
        return false;
      }
      
      return true;
    });
  }, [streams, isStreamValid]);

  /**
   * ✅ FIX: Filter out self from consumers and deduplicate
   * consumers is already guaranteed to be an array from the useMemo above
   */
  const actualConsumers = useMemo(() => {
    // consumers is already safe from the useMemo above
    const seen = new Set();
    return consumers.filter(consumerId => {
      if (consumerId === socketID) return false;
      if (seen.has(consumerId)) return false;
      seen.add(consumerId);
      return true;
    });
  }, [consumers, socketID]);

  /**
   * ✅ FIX: Build peer data with validated streams
   * Uses efficient indexing to avoid O(n²) lookups
   */
  const actualPeers = useMemo(() => {
    // Create stream index by socketID for O(1) lookups
    const streamsBySocket = {};
    validStreams.forEach(stream => {
      if (!stream.socketID) return;
      if (!streamsBySocket[stream.socketID]) {
        streamsBySocket[stream.socketID] = [];
      }
      // ✅ FIX: Prevent duplicate streams for same producer
      const exists = streamsBySocket[stream.socketID].some(
        s => s.producerID === stream.producerID
      );
      if (!exists) {
        streamsBySocket[stream.socketID].push(stream);
      }
    });

    // Create producer index for screen detection
    const screenProducerIds = new Set(
      producers
        .filter(p => p && p.isScreen)
        .map(p => p.producerID)
    );

    // Build peer objects
    return actualConsumers.map(consumerID => {
      const peerData = peers[consumerID] || {};
      const peerStreams = streamsBySocket[consumerID] || [];
      
      const actualPeer = {
        socketID: consumerID,
        user: peerData.user || null,
        video: null,
        audio: null,
        isScreen: false,
        streams: peerStreams,
      };

      // Assign video and audio streams
      peerStreams.forEach(stream => {
        if (!stream) return;
        
        if (stream.isVideo) {
          actualPeer.video = stream;
          // Check if this is a screen share
          if (screenProducerIds.has(stream.producerID)) {
            actualPeer.isScreen = true;
          }
        } else {
          actualPeer.audio = stream;
        }
      });

      return actualPeer;
    }).filter(peer => {
      // ✅ FIX: Only include peers that have at least audio or video
      return peer.video || peer.audio;
    });
  }, [actualConsumers, validStreams, producers, peers]);

  /**
   * ✅ FIX: Handle main stream selection in useEffect (not during render)
   */
  useEffect(() => {
    if (!isGrid && !mainStream && actualPeers.length > 0) {
      // Select the last peer as main stream
      setMainStream(actualPeers[actualPeers.length - 1]);
    }
  }, [isGrid, mainStream, actualPeers, setMainStream]);

  /**
   * ✅ FIX: Clear main stream if it's no longer valid
   */
  useEffect(() => {
    if (mainStream && !isGrid) {
      const stillExists = actualPeers.some(
        peer => peer.socketID === mainStream.socketID
      );
      if (!stillExists) {
        // Main stream peer left, select new one or clear
        if (actualPeers.length > 0) {
          setMainStream(actualPeers[actualPeers.length - 1]);
        } else {
          setMainStream(null);
        }
      }
    }
  }, [actualPeers, mainStream, isGrid, setMainStream]);

  /**
   * Render focused/speaker view (non-grid)
   */
  if (!isGrid && mainStream && actualPeers.length > 0) {
    // Find the main peer
    let mainPeer = actualPeers.find(
      peer => peer.socketID === mainStream.socketID
    );
    
    // Fallback to first peer if main peer not found
    if (!mainPeer && actualPeers.length > 0) {
      mainPeer = actualPeers[0];
    }

    if (!mainPeer) {
      return (
        <div className="streams uk-flex uk-flex-middle uk-flex-center uk-flex-column">
          <p className="waiting">Waiting for others to join...</p>
          {children}
        </div>
      );
    }

    return (
      <div className="streams uk-flex uk-flex-middle uk-flex-center uk-flex-column">
        <div className="video-container">
          <div className="video-row">
            <div className="video-wrapper main-video">
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

  /**
   * Render grid view
   */
  
  // Calculate grid layout
  const side = Math.ceil(Math.sqrt(actualPeers.length));
  const rows = [];
  let currentRow = [];

  actualPeers.forEach((peer, index) => {
    if (currentRow.length === side) {
      rows.push(
        <div className="video-row" key={`row-${rows.length}`}>
          {currentRow}
        </div>
      );
      currentRow = [];
    }

    currentRow.push(
      <div 
        className="video-wrapper" 
        key={`peer-${peer.socketID}-${index}`}
        onClick={() => {
          // Allow clicking to select main stream in grid mode
          if (isGrid) {
            setMainStream(peer);
          }
        }}
      >
        <Interface
          isMaximized={isMaximized}
          video={peer.video}
          audio={peer.audio}
          peer={peer.user}
          isScreen={peer.isScreen}
        />
      </div>
    );
  });

  // Add remaining items in last row
  if (currentRow.length > 0) {
    rows.push(
      <div className="video-row" key={`row-${rows.length}`}>
        {currentRow}
      </div>
    );
  }

  return (
    <div className="streams uk-flex uk-flex-middle uk-flex-center uk-flex-column">
      {actualPeers.length === 0 && (
        <p className="waiting">Waiting for others to join...</p>
      )}
      {actualPeers.length > 0 && (
        <div className="video-container">
          {rows}
        </div>
      )}
      {children}
    </div>
  );
}

export default Streams;
