import { useEffect, useState } from 'react';
import { useGlobal } from 'reactn';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, useParams } from 'react-router-dom';
import ClipLoader from 'react-spinners/ClipLoader';
import TopBar from './components/TopBar';
import BottomBar from './components/BottomBar';
import RoomInfo from '../Details/components/RoomInfo';
import './Conversation.sass';
import getRoom from '../../actions/getRoom';
import Messages from './components/Messages';
import Actions from '../../constants/Actions';
import apiClient from '../../api/apiClient';
import syncUnreadFromServer from '../../actions/syncUnreadFromServer'; // ✅ ADD THIS IMPORT

function Conversation() {
  const room = useSelector((state) => state.io.room);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState(null);
  const setOver = useGlobal('over')[1];
  const [showRoomInfo, setShowRoomInfo] = useGlobal('showRoomInfo');
  const { id } = useParams();

  const navigate = useNavigate();
  const dispatch = useDispatch();

  const back = () => {
    setOver(false);
    navigate('/', { replace: true });
  };

  useEffect(() => {
    console.log('🏠 CONVERSATION: Starting to load room');
    console.log('🆔 CONVERSATION: Room ID from URL:', id);
    console.log('🌐 CONVERSATION: Current URL:', window.location.href);
    
    if (!id) {
      console.error('❌ CONVERSATION: No room ID in URL params');
      setLoading(false);
      setError(true);
      return;
    }

    setLoading(true);
    setError(false);
    setApiError(null);
    
    console.log('📡 CONVERSATION: Calling getRoom API...');
    
    getRoom(id)
      .then((res) => {
        console.log('✅ CONVERSATION: API SUCCESS');
        console.log('📦 CONVERSATION: Response data:', res.data);
        console.log('🏠 CONVERSATION: Room object:', res.data.room);
        
        if (!res.data.room) {
          console.error('❌ CONVERSATION: API returned null room');
          setApiError('API returned null room');
          dispatch({ type: Actions.SET_ROOM, room: null });
          dispatch({ type: Actions.SET_MESSAGES, messages: [] });
          setLoading(false);
          setError(true);
          return;
        }

        const roomData = res.data.room;
        
        dispatch({ type: Actions.SET_ROOM, room: roomData });
        dispatch({ type: Actions.SET_MESSAGES, messages: roomData.messages || [] });
        setLoading(false);
        setError(false);
        
        // ✅ SERVER-SIDE ONLY: Mark room as read and sync with server
        const isGroup = roomData.isGroup;
        console.log(`📖 CONVERSATION: Marking room as read on server (${isGroup ? 'group' : 'room'}):`, id);
        
        apiClient.post('/api/mark-room-read', { roomId: id })
          .then(() => {
            console.log('✅ CONVERSATION: Server confirmed room marked as read');
            
            // ✅ SYNC with server to get updated unread counts
            setTimeout(() => {
              dispatch(syncUnreadFromServer());
              console.log('✅ CONVERSATION: Synced unread state with server');
            }, 500);
          })
          .catch(err => {
            console.error('❌ CONVERSATION: Failed to mark room as read on server:', err);
            console.error('❌ CONVERSATION: Error response:', err.response?.data);
            
            // ✅ STILL SYNC even if mark-as-read failed (for current state)
            setTimeout(() => {
              dispatch(syncUnreadFromServer());
              console.log('✅ CONVERSATION: Synced unread state with server (after error)');
            }, 500);
          });
        
        console.log('✅ CONVERSATION: Room loaded successfully!');
      })
      .catch((err) => {
        console.error('❌ CONVERSATION: API FAILED');
        console.error('❌ CONVERSATION: Error object:', err);
        console.error('❌ CONVERSATION: Error response:', err.response);
        console.error('❌ CONVERSATION: Error status:', err.response?.status);
        console.error('❌ CONVERSATION: Error data:', err.response?.data);
        console.error('❌ CONVERSATION: Error message:', err.message);
        
        setApiError({
          status: err.response?.status,
          message: err.message,
          data: err.response?.data
        });
        
        dispatch({ type: Actions.SET_ROOM, room: null });
        dispatch({ type: Actions.SET_MESSAGES, messages: [] });
        setLoading(false);
        
        if (!err.response || err.response.status !== 404) {
          setError(true);
        }
      });
  }, [id, dispatch]);

  // Close room info when room changes
  useEffect(() => {
    setShowRoomInfo(false);
  }, [id, setShowRoomInfo]);

  // Enhanced error logging when room state changes
  useEffect(() => {
    console.log('🔄 CONVERSATION: Room state changed:', room);
    if (room) {
      console.log('✅ CONVERSATION: Room is now loaded:', room._id);
    } else {
      console.log('❌ CONVERSATION: Room is now null');
    }
  }, [room]);

  function Loading() {
    return (
      <div className="content uk-flex uk-flex-center uk-flex-middle uk-flex-column">
        <ClipLoader size={60} color="#666" loading={loading} />
        <div style={{ marginTop: '20px', color: '#666' }}>
          Loading room {id?.slice(-6)}...
        </div>
      </div>
    );
  }

  function NotFound() {
    return (
      <div className="content uk-flex uk-flex-center uk-flex-middle uk-flex-column">
        <div className="notfound">Room Not Found</div>
        <div className="notfound-extended">
          This room does not exist.
          <br />
          This is probably a broken URL.
        </div>
        {apiError && (
          <div style={{ 
            marginTop: '20px', 
            padding: '10px', 
            background: '#f5f5f5', 
            borderRadius: '5px',
            fontSize: '12px',
            maxWidth: '400px'
          }}>
            <strong>Debug Info:</strong><br/>
            Status: {apiError.status}<br/>
            Message: {apiError.message}<br/>
            Data: {JSON.stringify(apiError.data)}
          </div>
        )}
      </div>
    );
  }

  function Error() {
    return (
      <div className="content uk-flex uk-flex-center uk-flex-middle uk-flex-column">
        <div className="notfound">Network Error</div>
        <div className="notfound-extended">Could not reach server.</div>
        {apiError && (
          <div style={{ 
            marginTop: '20px', 
            padding: '10px', 
            background: '#f5f5f5', 
            borderRadius: '5px',
            fontSize: '12px',
            maxWidth: '400px'
          }}>
            <strong>Debug Info:</strong><br/>
            Status: {apiError.status}<br/>
            Message: {apiError.message}<br/>
            Data: {JSON.stringify(apiError.data)}
          </div>
        )}
      </div>
    );
  }

  function Content() {
    return <Messages />;
  }

  return (
    <div className="content uk-flex uk-flex-column uk-flex-between">
      {showRoomInfo ? (
        <RoomInfo onBack={() => setShowRoomInfo(false)} />
      ) : (
        <>
          <TopBar back={back} loading={loading} />
          {loading && <Loading />}
          {error && <Error />}
          {!room && !loading && !error && <NotFound />}
          {room && !loading && <Content />}
          <BottomBar />
        </>
      )}
    </div>
  );
}

export default Conversation;