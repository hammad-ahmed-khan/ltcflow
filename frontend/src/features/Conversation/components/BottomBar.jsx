import { useRef, useState, useEffect } from 'react';
import './BottomBar.sass';
import {
  FiSend, FiImage, FiSmile, FiPaperclip, FiUserPlus, FiSettings,
} from 'react-icons/fi';
import { useGlobal } from 'reactn';
import { useNavigate } from 'react-router-dom';
import moment from 'moment';
import 'emoji-mart/css/emoji-mart.css';
import { Picker } from 'emoji-mart';
import { useDispatch, useSelector } from 'react-redux';
import message from '../../../actions/message';
import uploadImage from '../../../actions/uploadImage';
import uploadFile from '../../../actions/uploadFile';
import Actions from '../../../constants/Actions';
import getRooms from '../../../actions/getRooms';
import typing from '../../../actions/typing';
import apiClient from '../../../api/apiClient';
import { useToasts } from 'react-toast-notifications';

function BottomBar() {
  const imageInput = useRef(null);
  const fileInput = useRef(null);
  const navigate = useNavigate();
  const { addToast } = useToasts();

  const ref = useGlobal('ref')[0];
  const room = useSelector((state) => state.io.room);
  const user = useGlobal('user')[0];

  const [text, setText] = useState('');
  const [isPicker, showPicker] = useGlobal('isPicker');
  const [pictureRefs, addPictureRef] = useState([]);

  const dispatch = useDispatch();

  // Check user's relationship to the room
  const isGroupMember = room?.people?.some(member => member._id === user.id);
  const isCreator = room?.creator?._id === user.id;
  const isCreatorNonMember = room?.isGroup && isCreator && !isGroupMember;

  useEffect(() => {
    // FIX: Don't send typing if no valid room or during video calls or if creator non-member
    if (!room || !room._id || window.location.pathname.includes('/meeting/') || isCreatorNonMember) {
      return;
    }
    
    if (text === '') {
      dispatch(typing(room, false));
    } else {
      dispatch(typing(room, true));
    }
  }, [text, room, isCreatorNonMember]); // Add isCreatorNonMember to dependencies

  const addSelfToGroup = async () => {
    try {
      await apiClient.post('/api/group/add-member', { 
        groupId: room._id, 
        userId: user.id 
      });
      
      addToast('You joined the group successfully');
      // Refresh the page to show the chat interface
      window.location.reload();
    } catch (err) {
      const message = err.response?.data?.message || 'Failed to join group';
      addToast(message, 'error');
    }
  };

  const sendMessage = () => {
    if (text.length === 0 || isCreatorNonMember) return;
    message({
      roomID: room._id,
      authorID: user.id,
      content: text,
      contentType: 'text',
    }).then(() => {
      getRooms()
        .then((res) => dispatch({ type: Actions.SET_ROOMS, rooms: res.data.rooms }))
        .catch((err) => console.log(err));
    });
    const newMessage = {
      _id: Math.random(),
      author: { ...user, _id: user.id },
      content: text,
      type: 'text',
      date: moment(),
    };
    dispatch({ type: Actions.MESSAGE, message: newMessage });
    setText('');
    showPicker(false);
  };

  const handleKeyPress = (event) => {
    showPicker(false);
    if (event.key === 'Enter' && !isCreatorNonMember) sendMessage();
  };

  const sendImages = async (images) => {
    if (isCreatorNonMember) return;
    
    const tmpRefs = [];
    for (let i = 0; i < images.length; i++) {
      const image = images[i];
      tmpRefs.push(ref + i);
      const res = await uploadImage(image, ref + i);
      message({
        roomID: room._id,
        authorID: user.id,
        content: res.data.image.shieldedID,
        type: 'image',
      });
      const newMessage = {
        _id: Math.random(),
        author: { ...user, _id: user.id },
        content: res.data.image.shieldedID,
        type: 'image',
        date: moment(),
      };
      dispatch({ type: Actions.MESSAGE, message: newMessage });
    }
    addPictureRef([...pictureRefs, ...tmpRefs]);
    showPicker(false);
    getRooms()
      .then((res) => dispatch({ type: Actions.SET_ROOMS, rooms: res.data.rooms }))
      .catch((err) => console.log(err));
  };

  const sendFiles = async (files) => {
    if (isCreatorNonMember) return;
    
    for (let i = 0; i < files.length; i++) {
      if (files[i].size / (1024 * 1024) > 10) return alert('File exceeds 10MB limit!');
    }
    const tmpRefs = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      tmpRefs.push(ref + i);
      const res = await uploadFile(file, ref + i);
      message({
        roomID: room._id,
        authorID: user.id,
        content: res.data.file.shieldedID,
        type: 'file',
        fileID: res.data.file._id,
      });
      const newMessage = {
        _id: Math.random(),
        author: { ...user, _id: user.id },
        content: res.data.file.shieldedID,
        type: 'file',
        date: moment(),
        file: res.data.file,
      };
      dispatch({ type: Actions.MESSAGE, message: newMessage });
    }
    addPictureRef([...pictureRefs, ...tmpRefs]);
    showPicker(false);
    getRooms()
      .then((res) => dispatch({ type: Actions.SET_ROOMS, rooms: res.data.rooms }))
      .catch((err) => console.log(err));
  };

  // If creator but not member, show disabled state with join options
  if (isCreatorNonMember) {
    return (
      <div className="bottom-bar-conversation uk-flex uk-flex-middle" style={{ 
        background: '#f8f9fa', 
        borderTop: '2px solid #e3f2fd',
        padding: '0px' 
      }}>
        <div style={{ 
          flex: 1, 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          padding: '8px 16px',
          background: '#e3f2fd',
          borderRadius: '8px',
          gap: '12px'
        }}>
          <div style={{ 
            fontSize: '14px', 
            color: '#1976d2',
            fontWeight: '500'
          }}>
            You're viewing as group creator. Join to participate in conversations.
          </div>
          <button
            onClick={addSelfToGroup}
            style={{
              background: '#2196f3',
              color: 'white',
              border: 'none',
              padding: '6px 12px',
              borderRadius: '4px',
              fontSize: '12px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontWeight: '500'
            }}
          >
            <FiUserPlus size={12} />
            Join Group
          </button>
          <button
            onClick={() => navigate(`/room/${room._id}/manage`)}
            style={{
              background: '#666',
              color: 'white',
              border: 'none',
              padding: '6px 12px',
              borderRadius: '4px',
              fontSize: '12px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontWeight: '500'
            }}
          >
            <FiSettings size={12} />
            Manage
          </button>
        </div>
      </div>
    );
  }

  // Regular chat interface for members
  return (
    <div className="bottom-bar-conversation uk-flex uk-flex-middle">
      <div className="picker" hidden={!isPicker}>
        <Picker
          onSelect={(emoji) => setText(text + emoji.native)}
          darkMode={false}
          title="Emoji"
          native
          set="facebook"
        />
      </div>
      <div className="button smile" onClick={() => showPicker(!isPicker)}>
        <FiSmile />
      </div>
      <input
        className="file-input"
        type="file"
        ref={imageInput}
        accept="image/*"
        multiple
        onChange={(e) => sendImages(e.target.files)}
      />
      <div
        className="button image-attach"
        onClick={() => imageInput && imageInput.current && imageInput.current.click()}
      >
        <FiImage />
      </div>
      <input className="file-input" type="file" ref={fileInput} multiple onChange={(e) => sendFiles(e.target.files)} />
      <div className="button attach" onClick={() => fileInput && fileInput.current && fileInput.current.click()}>
        <FiPaperclip />
      </div>
      <input
        className="search-input"
        type="text"
        placeholder="Type something to send..."
        value={text}
        onChange={(e) => setText(e.target.value)}
        data-emoji-input="unicode"
        onKeyPress={handleKeyPress}
        onFocus={() => showPicker(false)}
      />
      <div className="button" onClick={sendMessage}>
        <FiSend />
      </div>
    </div>
  );
}

export default BottomBar;