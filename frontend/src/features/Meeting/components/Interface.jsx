// frontend/src/features/Meeting/components/Interface.jsx
//
// A single grid tile. Phase 3 change: never show a black rectangle. The avatar
// placeholder is shown whenever there is no video OR the video hasn't produced
// its first frame yet; the <video> fades in only once it's actually playing.
// A `reconnecting` flag (used in Phase 4) shows "Reconnecting…" on the tile.

import { useEffect, useRef, useState } from 'react';
import './Interface.sass';
import Picture from '../../../components/Picture';
import { useGlobal } from 'reactn';

function Interface({
  audio, video, peer, isMaximized, isScreen, reconnecting,
}) {
  const audioRef = useRef(null);
  const videoRef = useRef(null);
  const [localStream] = useGlobal('localStream');
  const [videoReady, setVideoReady] = useState(false);

  useEffect(() => {
    if (!audio || !audioRef.current) return;
    audioRef.current.srcObject = audio;
    audioRef.current.play().catch((error) => {
      console.warn('Failed to play remote audio:', error);
    });
  }, [audio]);

  useEffect(() => {
    // New stream → not ready until it actually plays a frame.
    setVideoReady(false);
    if (!video || !videoRef.current) return;
    videoRef.current.srcObject = video;
    videoRef.current.play().catch((error) => {
      console.warn('Failed to play remote video:', error);
    });
  }, [video]);

  // Safety check for own stream.
  const isLocalVideo = localStream && video && localStream.id === video.id;

  // Show the avatar until there's a real, playing frame.
  const showPlaceholder = !video || !videoReady;

  const statusText = () => {
    if (reconnecting) return 'Reconnecting…';
    if (video && !videoReady) return 'Connecting…';
    if (!video && !audio) return '';
    return 'Audio Only';
  };

  return (
    <div className="interface uk-flex uk-flex-middle uk-flex-center uk-flex-column uk-height-1-1">
      {audio && (
        <audio
          ref={audioRef}
          className="remote-audio"
          controls={false}
          autoPlay
          hidden
          data-user-id={peer?._id}
        />
      )}

      {video && (
        <video
          ref={videoRef}
          className="remote-video"
          playsInline
          controls={false}
          autoPlay
          muted={isLocalVideo}
          hidden={false}
          data-user-id={peer?._id}
          onLoadedData={() => setVideoReady(true)}
          onPlaying={() => setVideoReady(true)}
          style={{
            objectFit: !isMaximized || isScreen ? 'contain' : 'cover',
            opacity: videoReady ? 1 : 0,
            transition: 'opacity 150ms ease',
          }}
        />
      )}

      {showPlaceholder && (
        <div
          className="remote-peer"
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#1f1f1f',
            zIndex: 1,
          }}
        >
          <div className="name">
            {peer?.firstName || 'Unknown'}
            {' '}
            {peer?.lastName || 'User'}
          </div>
          <Picture user={peer} />
          <div className="status">{statusText()}</div>
        </div>
      )}
    </div>
  );
}

export default Interface;