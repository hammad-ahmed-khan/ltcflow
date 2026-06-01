
import { FiPhone, FiVideo } from 'react-icons/fi';
import './CallRecord.sass';

function CallRecord({ call, isMine }) {
  const formatDuration = (seconds) => {
    if (seconds < 60) {
      return `${seconds} sec`;
    }
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const getCallStatusText = () => {
    if (call.status === 'missed') {
      return isMine ? 'Missed call' : 'Missed call';
    }
    if (call.status === 'cancelled') {
      return 'Cancelled call';
    }
    if (call.status === 'ended') {
      const duration = formatDuration(call.duration);
      return call.callType === 'video' ? `Video Call ${duration}` : `Voice Call ${duration}`;
    }
    return 'Call';
  };

  return (
    <div className={`call-record ${call.status} ${isMine ? 'outgoing' : 'incoming'}`}>
      <div className="call-record-icon">
        {call.callType === 'video' ? (
          <FiVideo className={`call-icon ${call.status}`} />
        ) : (
          <FiPhone className={`call-icon ${call.status}`} />
        )}
      </div>
      <div className="call-record-text">
        {getCallStatusText()}
      </div>
    </div>
  );
}

export default CallRecord;