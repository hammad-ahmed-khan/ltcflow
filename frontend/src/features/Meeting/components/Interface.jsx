import { useEffect, useRef, useState, useCallback } from 'react';
import './Interface.sass';
import Picture from '../../../components/Picture';
import { useGlobal } from 'reactn';

/**
 * Interface Component
 * 
 * Displays remote peer video/audio streams with proper handling for:
 * - Track validation to prevent black screens
 * - Proper video element lifecycle management
 * - Graceful handling of track state changes
 * - Browser autoplay policy compliance
 */
function Interface({
  audio,
  video,
  peer,
  isMaximized,
  isScreen,
}) {
  const audioRef = useRef(null);
  const videoRef = useRef(null);
  const [localStream] = useGlobal('localStream');
  
  // ✅ FIX: Track video playback state for UI feedback
  const [videoState, setVideoState] = useState('loading'); // 'loading' | 'playing' | 'error' | 'ended'
  const [needsUserGesture, setNeedsUserGesture] = useState(false);
  
  // Track cleanup refs
  const audioCleanupRef = useRef(null);
  const videoCleanupRef = useRef(null);

  /**
   * ✅ FIX: Validate that a media stream has active tracks
   */
  const validateStream = useCallback((stream, type) => {
    if (!stream) {
      console.warn(`${type} stream is null/undefined`);
      return false;
    }

    const tracks = type === 'video' ? stream.getVideoTracks() : stream.getAudioTracks();
    
    if (tracks.length === 0) {
      console.warn(`No ${type} tracks in stream`);
      return false;
    }

    const track = tracks[0];
    
    if (track.readyState === 'ended') {
      console.warn(`${type} track has ended`);
      return false;
    }

    return true;
  }, []);

  /**
   * ✅ FIX: Safe play with error handling and autoplay policy compliance
   */
  const safePlay = useCallback(async (element, type) => {
    if (!element) return false;

    try {
      // Reset any previous error states
      element.muted = type === 'video' ? (element.muted || false) : false;
      
      const playPromise = element.play();
      
      if (playPromise !== undefined) {
        await playPromise;
        return true;
      }
      return true;
    } catch (error) {
      if (error.name === 'NotAllowedError') {
        // Browser requires user interaction to play
        console.warn(`${type} autoplay blocked, requires user gesture`);
        if (type === 'video') {
          setNeedsUserGesture(true);
        }
        return false;
      } else if (error.name === 'AbortError') {
        // Play was interrupted - usually by a new play() call
        console.log(`${type} play was interrupted`);
        return false;
      } else {
        console.error(`Failed to play ${type}:`, error);
        return false;
      }
    }
  }, []);

  /**
   * Handle manual play button click (for autoplay policy)
   */
  const handleManualPlay = useCallback(async () => {
    if (videoRef.current) {
      const success = await safePlay(videoRef.current, 'video');
      if (success) {
        setNeedsUserGesture(false);
        setVideoState('playing');
      }
    }
  }, [safePlay]);

  /**
   * ✅ FIX: Audio stream handling with proper cleanup
   */
  useEffect(() => {
    // Cleanup previous listeners
    if (audioCleanupRef.current) {
      audioCleanupRef.current();
      audioCleanupRef.current = null;
    }

    if (!audio || !audioRef.current) {
      return;
    }

    // Validate stream
    if (!validateStream(audio, 'audio')) {
      return;
    }

    const audioElement = audioRef.current;
    const track = audio.getAudioTracks()[0];

    // Set up stream
    audioElement.srcObject = audio;
    
    // Handle track events
    const handleTrackEnded = () => {
      console.log('Remote audio track ended');
      audioElement.srcObject = null;
    };

    const handleTrackMute = () => {
      console.log('Remote audio track muted');
    };

    const handleTrackUnmute = () => {
      console.log('Remote audio track unmuted');
      safePlay(audioElement, 'audio');
    };

    track.addEventListener('ended', handleTrackEnded);
    track.addEventListener('mute', handleTrackMute);
    track.addEventListener('unmute', handleTrackUnmute);

    // Play audio
    safePlay(audioElement, 'audio');

    // Store cleanup function
    audioCleanupRef.current = () => {
      track.removeEventListener('ended', handleTrackEnded);
      track.removeEventListener('mute', handleTrackMute);
      track.removeEventListener('unmute', handleTrackUnmute);
    };

    return () => {
      if (audioCleanupRef.current) {
        audioCleanupRef.current();
        audioCleanupRef.current = null;
      }
    };
  }, [audio, validateStream, safePlay]);

  /**
   * ✅ FIX: Video stream handling with comprehensive black screen prevention
   */
  useEffect(() => {
    // Cleanup previous listeners
    if (videoCleanupRef.current) {
      videoCleanupRef.current();
      videoCleanupRef.current = null;
    }

    if (!video || !videoRef.current) {
      setVideoState('loading');
      return;
    }

    const videoElement = videoRef.current;

    // ✅ FIX: Validate stream before attaching
    if (!validateStream(video, 'video')) {
      setVideoState('error');
      return;
    }

    const tracks = video.getVideoTracks();
    const track = tracks[0];

    // ✅ FIX: Check track state before attaching
    if (track.readyState !== 'live') {
      console.log('Video track not live yet, waiting...', track.readyState);
      setVideoState('loading');

      // Wait for track to become live
      const handleUnmute = () => {
        console.log('Video track became live (unmuted)');
        if (videoRef.current && track.readyState === 'live') {
          videoRef.current.srcObject = video;
          safePlay(videoRef.current, 'video').then(success => {
            setVideoState(success ? 'playing' : 'error');
          });
        }
      };

      track.addEventListener('unmute', handleUnmute, { once: true });
      
      videoCleanupRef.current = () => {
        track.removeEventListener('unmute', handleUnmute);
      };
      
      return;
    }

    // Track is live - attach and play
    console.log('Attaching video stream, track state:', track.readyState);
    setVideoState('loading');

    // ✅ FIX: Reset video element state before attaching new stream
    videoElement.srcObject = null;
    
    // Small delay to ensure clean state
    requestAnimationFrame(() => {
      if (!videoRef.current) return;
      
      videoRef.current.srcObject = video;

      // Set up video element event handlers
      const handleLoadedMetadata = () => {
        console.log('Video metadata loaded');
      };

      const handleCanPlay = () => {
        console.log('Video can play');
        safePlay(videoRef.current, 'video').then(success => {
          if (success) {
            setVideoState('playing');
            setNeedsUserGesture(false);
          }
        });
      };

      const handlePlaying = () => {
        console.log('Video is playing');
        setVideoState('playing');
        setNeedsUserGesture(false);
      };

      const handleWaiting = () => {
        console.log('Video is buffering');
      };

      const handleStalled = () => {
        console.log('Video stalled');
      };

      const handleError = (e) => {
        console.error('Video element error:', e);
        setVideoState('error');
      };

      // Track event handlers
      const handleTrackEnded = () => {
        console.log('Remote video track ended');
        setVideoState('ended');
      };

      const handleTrackMute = () => {
        console.log('Remote video track muted (paused by sender)');
      };

      const handleTrackUnmute = () => {
        console.log('Remote video track unmuted (resumed by sender)');
        if (videoRef.current) {
          safePlay(videoRef.current, 'video');
        }
      };

      // Add event listeners
      videoRef.current.addEventListener('loadedmetadata', handleLoadedMetadata);
      videoRef.current.addEventListener('canplay', handleCanPlay);
      videoRef.current.addEventListener('playing', handlePlaying);
      videoRef.current.addEventListener('waiting', handleWaiting);
      videoRef.current.addEventListener('stalled', handleStalled);
      videoRef.current.addEventListener('error', handleError);
      track.addEventListener('ended', handleTrackEnded);
      track.addEventListener('mute', handleTrackMute);
      track.addEventListener('unmute', handleTrackUnmute);

      // Store cleanup function
      videoCleanupRef.current = () => {
        if (videoRef.current) {
          videoRef.current.removeEventListener('loadedmetadata', handleLoadedMetadata);
          videoRef.current.removeEventListener('canplay', handleCanPlay);
          videoRef.current.removeEventListener('playing', handlePlaying);
          videoRef.current.removeEventListener('waiting', handleWaiting);
          videoRef.current.removeEventListener('stalled', handleStalled);
          videoRef.current.removeEventListener('error', handleError);
        }
        track.removeEventListener('ended', handleTrackEnded);
        track.removeEventListener('mute', handleTrackMute);
        track.removeEventListener('unmute', handleTrackUnmute);
      };
    });

    return () => {
      if (videoCleanupRef.current) {
        videoCleanupRef.current();
        videoCleanupRef.current = null;
      }
    };
  }, [video, validateStream, safePlay]);

  /**
   * ✅ FIX: Cleanup on unmount
   */
  useEffect(() => {
    return () => {
      if (audioCleanupRef.current) {
        audioCleanupRef.current();
      }
      if (videoCleanupRef.current) {
        videoCleanupRef.current();
      }
      
      // Clear srcObject to release resources
      if (audioRef.current) {
        audioRef.current.srcObject = null;
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    };
  }, []);

  // Check if this is showing the local user's own stream (edge case)
  const isLocalVideo = localStream && video && localStream.id === video.id;

  // Determine what to show
  const showVideo = video && videoState !== 'ended' && videoState !== 'error';
  const showLoadingOverlay = video && videoState === 'loading';
  const showErrorOverlay = video && videoState === 'error';
  const showAudioOnly = !video || videoState === 'ended' || videoState === 'error';

  return (
    <div className="interface uk-flex uk-flex-middle uk-flex-center uk-flex-column uk-height-1-1">
      {/* Audio element - always hidden */}
      {audio && (
        <audio
          ref={audioRef}
          className="remote-audio"
          controls={false}
          autoPlay
          playsInline
          hidden
          data-user-id={peer?._id}
        />
      )}

      {/* Video element */}
      {showVideo && (
        <video
          ref={videoRef}
          className="remote-video"
          playsInline
          controls={false}
          autoPlay
          muted={isLocalVideo}
          data-user-id={peer?._id}
          style={{ 
            objectFit: !isMaximized || isScreen ? 'contain' : 'cover',
            // ✅ FIX: Hide video element until actually playing to prevent black flash
            opacity: videoState === 'playing' ? 1 : 0,
            transition: 'opacity 0.2s ease-in-out',
          }}
        />
      )}

      {/* ✅ FIX: Loading overlay while video is loading */}
      {showLoadingOverlay && (
        <div className="video-loading-overlay">
          <div className="loading-spinner" />
          <span>Connecting video...</span>
        </div>
      )}

      {/* ✅ FIX: User gesture required overlay */}
      {needsUserGesture && (
        <div className="video-gesture-overlay" onClick={handleManualPlay}>
          <div className="play-button">▶</div>
          <span>Click to play</span>
        </div>
      )}

      {/* ✅ FIX: Error state overlay */}
      {showErrorOverlay && (
        <div className="video-error-overlay">
          <span>Video unavailable</span>
        </div>
      )}

      {/* Fallback UI when no video */}
      {showAudioOnly && (
        <div className="remote-peer">
          <div className="name">
            {peer?.firstName || 'Unknown'}
            {' '}
            {peer?.lastName || 'User'}
          </div>
          <Picture user={peer} />
          <div className="status">
            {!video && !audio ? '' : 'Audio Only'}
          </div>
        </div>
      )}
    </div>
  );
}

export default Interface;
