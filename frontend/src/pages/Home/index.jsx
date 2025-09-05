import { useEffect } from 'react';
import { useGlobal, setGlobal } from 'reactn';
import Div100vh from 'react-div-100vh';
import {
  Route, Routes, useLocation, useNavigate,
} from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import CreateGroup from '../../features/Group/Create';
import CreateGroup2 from '../../features/Group/Create2';
import Panel from '../../features/Panel';
import Details from '../../features/Details';
import './Home.sass';
import Conversation from '../../features/Conversation';
import Meeting from '../../features/Meeting';
import Welcome from '../../features/Welcome';
import NotFound from '../../features/NotFound';
import Admin from '../../features/Admin';
import GroupManage from '../../features/Group/Manage';
import Actions from '../../constants/Actions';

function Home() {
  const location = useLocation();
  const dispatch = useDispatch();

  const [over, setOver] = useGlobal('over');
  const showPanel = useGlobal('showPanel')[0];
  const showDetails = useGlobal('showDetails')[0];
  const panel = useGlobal('panel')[0];
  const callIncrement = useSelector((state) => state.rtc.callIncrement);
  const callData = useSelector((state) => state.rtc.callData);
  const currentRoom = useSelector((state) => state.io.room);

  const navigate = useNavigate();

  useEffect(() => {
    if (!callData) return;
    setGlobal({
      audio: true,
      video: false,
      callDirection: 'incoming',
      meeting: { _id: callData.meetingID },
    }).then(() => {
      navigate(`/meeting/${callData.meetingID}`, { replace: true });
    });
  }, [callIncrement, callData]);

  useEffect(() => {
    console.log(location.pathname);
    if (location.pathname !== '/') setOver(true);
  }, [location]);

  // FIXED: Clear current room when navigating away from conversations
  useEffect(() => {
    const isConversationRoute = location.pathname.startsWith('/room/') && !location.pathname.endsWith('/info') && !location.pathname.endsWith('/manage');
    
    // If we have a current room set but we're not on a conversation route, clear it
    if (currentRoom && !isConversationRoute) {
      console.log('🧹 Clearing current room - navigated away from conversation:', currentRoom._id);
      dispatch({ type: Actions.SET_ROOM, room: null });
      dispatch({ type: Actions.SET_MESSAGES, messages: [] });
    }
  }, [location.pathname, currentRoom, dispatch]);

  const getPanel = () => {
    switch (panel) {
      case 'createGroup':
        return <CreateGroup />;
      case 'createGroup2':
        return <CreateGroup2 />;
      default:
        return <Panel />;
    }
  };

  return (
    <Div100vh>
      <div className="app">
        {showPanel && getPanel()}
        <div className={`main uk-flex uk-flex-column${over ? ' over' : ''}${over === false ? ' exit' : ''}`}>
          <Routes>
            <Route path="/" element={<Welcome />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="/meeting/:id" element={<Meeting />} />
            <Route path="/room/:id" element={<Conversation />} />
            <Route path="/room/:id/info" element={<Details />} />
            <Route path="/room/:id/manage" element={<GroupManage />} />
            <Route path="/*" element={<NotFound />} />
            {' '}
            {/* Comment this line when Electron build */}
            {/* <Route path="/" element={Welcome} />  Uncomment this line when Electron build */}
          </Routes>
        </div>
        {!location.pathname.endsWith('/info') && (showDetails || !location.pathname.startsWith('/meeting')) && (
          <Details />
        )}
      </div>
    </Div100vh>
  );
}

export default Home;