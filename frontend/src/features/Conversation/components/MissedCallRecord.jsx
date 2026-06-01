import React from 'react';
import moment from 'moment';
import { FiPhoneMissed, FiVideo, FiUsers } from 'react-icons/fi';
import './MissedCallRecord.sass';

const MissedCallRecord = ({ call, isMine }) => {
  const {
    callType,
    status,
    startTime,
    missedTime,
    callee,
    isGroup,
    groupId,
    reason
  } = call;

  const formatTime = (time) => {
    return moment(time).format('h:mm A');
  };

  const getIcon = () => {
    if (callType === 'video') {
      return <FiVideo className="call-icon video" />;
    }
    return <FiPhoneMissed className="call-icon missed" />;
  };

  const getCallText = () => {
    if (isGroup) {
      return `${callType === 'video' ? 'Video' : 'Voice'} group call`;
    }
    return `${callType === 'video' ? 'Video' : 'Voice'} call`;
  };

  const getStatusText = () => {
    switch (status) {
      case 'missed-offline':
        return 'Recipient was offline';
      case 'missed':
      default:
        return 'No answer';
    }
  };

  return (
    <div className={`missed-call-record ${isMine ? 'outgoing' : 'incoming'}`}>
      <div className="call-header">
        <div className="call-info">
          {getIcon()}
          <div className="call-details">
            <div className="call-type">
              {isGroup && <FiUsers className="group-icon" />}
              {getCallText()}
            </div>
            <div className="call-status missed">
              {getStatusText()}
            </div>
          </div>
        </div>
        <div className="call-time">
          {formatTime(missedTime || startTime)}
        </div>
      </div>
      
      {reason && (
        <div className="call-reason">
          {reason}
        </div>
      )}
    </div>
  );
};

export default MissedCallRecord;