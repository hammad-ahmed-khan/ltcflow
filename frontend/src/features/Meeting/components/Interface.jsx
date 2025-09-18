import { useEffect, useRef } from 'react';
import './Interface.sass';
import Picture from '../../../components/Picture';
import { useGlobal } from 'reactn';

function Interface({
  audio, video, peer, isMaximized, isScreen,
}) {
  const audioRef = useRef(null);
  const videoRef = useRef(null);
  const [localStream] = useGlobal('localStream');

  useEffect(() => {
    if (!audio || !audioRef.current) return;
    
    audioRef.current.srcObject = audio;
    audioRef.current.play().catch(error => {
      console.warn('Failed to play remote audio:', error);
    });
  }, [audio]);

  useEffect(() => {
    if (!video || !videoRef.current) return;
    
    videoRef.current.srcObject = video;
    videoRef.current.play().catch(error => {
      console.warn('Failed to play remote video:', error);
    });
  }, [video]);

  // Check if this is the user's own stream (shouldn't happen but safety check)
  const isLocalVideo = localStream && video && 
    localStream.id === video.id;

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
          muted={isLocalVideo} // Mute if somehow showing local video
          hidden={false}
          data-user-id={peer?._id}
          style={{ objectFit: !isMaximized || isScreen ? 'contain' : 'cover' }}
        />
      )}
      {!video && (
        <div className="remote-peer">
          <div className="name">
            {peer?.firstName || 'Unknown'}
            {' '}
            {peer?.lastName || 'User'}
          </div>
          <Picture user={peer} />
          <div className="status">{!video && !audio ? '' : 'Audio Only'}</div>
        </div>
      )}
    </div>
  );
}

export default Interface;