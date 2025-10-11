import { useEffect, useState, useRef } from 'react';
import './TopBar.sass';
import {
  FiPhone, FiVideo, FiArrowLeft, FiMoreHorizontal, FiExternalLink, FiStar, FiInfo, FiImage,
} from 'react-icons/fi';
import { useGlobal } from 'reactn';
import { useDispatch, useSelector } from 'react-redux';
import { useToasts } from 'react-toast-notifications';
import { useNavigate } from 'react-router-dom';
import moment from 'moment';
import Picture from '../../../components/Picture';
import toggleFavorite from '../../../actions/toggleFavorite';
import getMeetingRoom from '../../../actions/getMeetingRoom';
import postCall from '../../../actions/postCall';
import Actions from '../../../constants/Actions';
import Config from '../../../config';

function TopBar({ back, loading }) {
  const onlineUsers = useSelector((state) => state.io.onlineUsers);
  const room = useSelector((state) => state.io.room) || {};
  const user = useGlobal('user')[0];
  const [favorites, setFavorites] = useGlobal('favorites');
  const setNav = useGlobal('nav')[1];
  const setAudio = useGlobal('audio')[1];
  const setVideo = useGlobal('video')[1];
  const setCallDirection = useGlobal('callDirection')[1];
  const setMeeting = useGlobal('meeting')[1];
  const [showRoomInfo, setShowRoomInfo] = useGlobal('showRoomInfo');

  const { addToast } = useToasts();
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const honeyside = () => window.open('https://www.honeyside.it', '_blank');
  const codeCanyon = () => window.open(
    'https://codecanyon.net/item/clover-realtime-messaging-audio-video-conferencing-web-app-nodejs-react-webrtc-socketio/25737452',
    '_blank',
  );

  // 🆕 NEW: Open Crisp chat for support
  const openSupport = () => {
    if (window.$crisp) {
      window.$crisp.push(['do', 'chat:open']);
    } else {
      errorToast('Support chat is not available at the moment.');
    }
  };

  let other = {};

  if (room.people) {
    room.people.forEach((person) => {
      if (user.id !== person._id) other = person;
    });
  }

  if (!other.firstName) {
    other = { ...other, firstName: 'Deleted', lastName: 'User' };
  }

  const title = (room.isGroup ?
    room.title : `${other.firstName} ${other.lastName}`).substr(0, 22);

  const warningToast = (content) => {
    addToast(content, {
      appearance: 'warning',
      autoDismiss: true,
    });
  };

  const errorToast = (content) => {
    addToast(content, {
      appearance: 'error',
      autoDismiss: true,
    });
  };

  const call = async (isVideo) => {
    if (onlineUsers.filter((u) => u.id === other._id).length === 0 && !room.isGroup) return warningToast("Can't call user because user is offline");
    await setAudio(true);
    await setVideo(isVideo);
    await setCallDirection('outgoing');
    dispatch({ type: Actions.RTC_SET_COUNTERPART, counterpart: other });
    try {
      const res = await getMeetingRoom({
        startedAsCall: true,
        caller: user.id,
        callee: other._id,
        callToGroup: room.isGroup,
        group: room._id,
      });
      await setMeeting(res.data);
      navigate(`/meeting/${res.data._id}`, { replace: true });
      await postCall({ roomID: room._id, meetingID: res.data._id });
    } catch (e) {
      errorToast('Server error. Unable to initiate call.');
    }
  };

  const favorite = async () => {
    const res = await toggleFavorite(room._id);
    setNav('favorites');
    setFavorites(res.data.favorites);
  };

  const isFavorite = () => {
    for (const favorite of favorites) {
      if (favorite._id === room._id) return true;
    }
    return false;
  };

  const roomInfo = () => {
    setShowRoomInfo(true);
  };

  const mediaFiles = () => {
    setShowRoomInfo(true);
  };

  const Online = ({ other }) => {
    const onlineUsers = useSelector((state) => state.io.onlineUsers);
    const prevStatusRef = useRef(false);
    const [lastOnline, setLastOnline] = useState(null);

    useEffect(() => {
      if (prevStatusRef.current && onlineUsers.filter((u) => u.id === other._id).length === 0) setLastOnline(moment().valueOf());
      prevStatusRef.current = onlineUsers.filter((u) => u.id === other._id).length > 0;
    }, [onlineUsers, other]);

    if (onlineUsers.filter((u) => u.id === other._id && u.status === 'busy').length > 0) return 'busy';
    if (onlineUsers.filter((u) => u.id === other._id && u.status === 'online').length > 0) return 'online';
    if (onlineUsers.filter((u) => u.id === other._id && u.status === 'away').length > 0) return 'away';
    if (lastOnline) return `Last online: ${moment(lastOnline).fromNow()}`;
    return `Last online: ${other.lastOnline ? moment(other.lastOnline).fromNow() : 'a while ago'}`;
  };

  return (
    <div className="top-bar uk-flex uk-flex-between uk-flex-middle">
      <div className="uk-flex uk-flex-middle">
        <div className="button mobile" onClick={back}>
          <FiArrowLeft />
        </div>
        <div className="profile conversation" onClick={roomInfo}>
          <Picture user={other} group={room.isGroup} picture={room.picture} title={room.title} />
        </div>
        {!room.isGroup && <div className={`dot ${Online({ other })}`} />}
        <div className="text" onClick={roomInfo}>
          <div className="title">{title}</div>
          <div className="message">
            {room.isGroup ? `${room.people.length} members` : <Online other={other} />}
          </div>
        </div>
      </div>
      <div className="nav">
        {!room.isGroup && (
          <div className="button" onClick={() => call(false)}>
            <FiPhone />
          </div>
        )}
        {!room.isGroup && (
          <div className="button" onClick={() => call(true)}>
            <FiVideo />
          </div>
        )}
        <div className={`button${isFavorite() ? ' active' : ''}`} onClick={favorite}>
          <FiStar />
        </div>
        <div className="uk-inline">
          <div className="button" type="button">
            <FiMoreHorizontal />
          </div>
          <div data-uk-dropdown="mode: click; offset: 5; boundary: .top-bar; pos: bottom-right">
            <div className="link" onClick={roomInfo}>
              {room.isGroup ? 'Group Info' : 'Contact Info'}
              <div className="icon">
                <FiInfo />
              </div>
            </div>
            <div className="link" onClick={mediaFiles}>
              Media, Documents & Links
              <div className="icon">
                <FiImage />
              </div>
            </div>
            {/* 🆕 NEW: Support Link */}
            <div className="divider" />
            <div className="link" onClick={openSupport}>
              Support
            </div>
            {Config.demo && <div className="divider" />}
            {Config.demo && (
              <div className="link" onClick={honeyside}>
                Honeyside
                <div className="icon">
                  <FiExternalLink />
                </div>
              </div>
            )}
            {Config.demo && (
              <div className="link" onClick={codeCanyon}>
                CodeCanyon
                <div className="icon">
                  <FiExternalLink />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default TopBar;