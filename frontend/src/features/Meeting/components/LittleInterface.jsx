import { useEffect, useRef, useState, useCallback } from 'react';
import './LittleInterface.sass';
import Picture from '../../../components/Picture';
import { useGlobal } from 'reactn';

/**
 * LittleInterface Component
 * 
 * Displays small thumbnail view of remote peer video/audio streams.
 * Used in the top bar during meetings.
 * 
 * ✅ FIXES: Same as Interface.jsx
 * - Track validation to prevent black screens
 * - Proper video element lifecycle management
 * - Graceful handling of track state changes
 */
function LittleInterface({
  audio,
  video,
  peer,
  isMaximized,
}) {
  const audioRef = useRef(null);
  const videoRef = useRef(null);
  const [localStream] = useGlobal('localStream');
  
  // Track video playback state
  const [videoState, setVideoState] = useState('loading');
  
  // Cleanup refs
  const audioCleanupRef = useRef(null);
  const videoCleanupRef = useRef(null);

  /**
   * Validate stream has active tracks
   */
  const validateStream = useCallback((stream, type) => {
    if (!stream) return false;

    const tracks = type === 'video' ? stream.getVideoTracks() : stream.getAudioTracks();
    if (tracks.length === 0) return false;

    const track = tracks[0];
    return track.readyState !== 'ended';
  }, []);

  /**
   * Safe play with error handling
   */
  const safePlay = useCallback(async (element, type) => {
    if (!element) return false;

    try {
      const playPromise = element.play();
      if (playPromise !== undefined) {
        await playPromise;
        return true;
      }
      return true;
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.warn(`Little ${type} play failed:`, error.name);
      }
      return false;
    }
  }, []);

  /**
   * Audio handling
   */
  useEffect(() => {
    if (audioCleanupRef.current) {
      audioCleanupRef.current();
      audioCleanupRef.current = null;
    }

    if (!audio || !audioRef.current) return;
    if (!validateStream(audio, 'audio')) return;

    const audioElement = audioRef.current;
    const track = audio.getAudioTracks()[0];

    audioElement.srcObject = audio;

    const handleTrackEnded = () => {
      audioElement.srcObject = null;
    };

    track.addEventListener('ended', handleTrackEnded);
    safePlay(audioElement, 'audio');

    audioCleanupRef.current = () => {
      track.removeEventListener('ended', handleTrackEnded);
    };

    return () => {
      if (audioCleanupRef.current) {
        audioCleanupRef.current();
        audioCleanupRef.current = null;
      }
    };
  }, [audio, validateStream, safePlay]);

  /**
   * Video handling with black screen prevention
   */
  useEffect(() => {
    if (videoCleanupRef.current) {
      videoCleanupRef.current();
      videoCleanupRef.current = null;
    }

    if (!video || !videoRef.current) {
      setVideoState('loading');
      return;
    }

    const videoElement = videoRef.current;

    if (!validateStream(video, 'video')) {
      setVideoState('error');
      return;
    }

    const tracks = video.getVideoTracks();
    const track = tracks[0];

    if (track.readyState !== 'live') {
      setVideoState('loading');

      const handleUnmute = () => {
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

    setVideoState('loading');
    videoElement.srcObject = null;

    requestAnimationFrame(() => {
      if (!videoRef.current) return;
      
      videoRef.current.srcObject = video;

      const handleCanPlay = () => {
        safePlay(videoRef.current, 'video').then(success => {
          if (success) setVideoState('playing');
        });
      };

      const handlePlaying = () => {
        setVideoState('playing');
      };

      const handleTrackEnded = () => {
        setVideoState('ended');
      };

      videoRef.current.addEventListener('canplay', handleCanPlay);
      videoRef.current.addEventListener('playing', handlePlaying);
      track.addEventListener('ended', handleTrackEnded);

      videoCleanupRef.current = () => {
        if (videoRef.current) {
          videoRef.current.removeEventListener('canplay', handleCanPlay);
          videoRef.current.removeEventListener('playing', handlePlaying);
        }
        track.removeEventListener('ended', handleTrackEnded);
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
   * Cleanup on unmount
   */
  useEffect(() => {
    return () => {
      if (audioCleanupRef.current) audioCleanupRef.current();
      if (videoCleanupRef.current) videoCleanupRef.current();
      if (audioRef.current) audioRef.current.srcObject = null;
      if (videoRef.current) videoRef.current.srcObject = null;
    };
  }, []);

  const isLocalVideo = localStream && video && localStream.id === video.id;
  const showVideo = video && videoState !== 'ended' && videoState !== 'error';

  return (
    <div className="little-interface uk-flex uk-flex-middle uk-flex-center uk-flex-column uk-height-1-1">
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
      
      {showVideo && (
        <video
          ref={videoRef}
          className="remote-video"
          playsInline
          controls={false}
          autoPlay
          muted={isLocalVideo}
          hidden={false}
          data-user-id={peer?._id}
          style={{ 
            objectFit: isMaximized ? 'cover' : 'contain',
            opacity: videoState === 'playing' ? 1 : 0,
            transition: 'opacity 0.2s ease-in-out',
          }}
        />
      )}
      
      {/* Loading state */}
      {video && videoState === 'loading' && (
        <div className="loading-indicator">
          <div className="spinner-small" />
        </div>
      )}
      
      {/* No video fallback */}
      {!showVideo && (
        <div className="remote-peer">
          <div className="name">
            {peer?.firstName || 'Unknown'}
            {' '}
            {peer?.lastName || 'User'}
          </div>
          <Picture user={peer} />
          <div className="status">{!video && !audio ? 'Spectator' : 'Audio Only'}</div>
        </div>
      )}
    </div>
  );
}

export default LittleInterface;
