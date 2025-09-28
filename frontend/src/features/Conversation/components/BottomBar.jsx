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

const [uploadProgress, setUploadProgress] = useState({});
const [isUploading, setIsUploading] = useState(false);
const [uploadControllers, setUploadControllers] = useState({});

const [imageUploadProgress, setImageUploadProgress] = useState({});
const [isImageUploading, setIsImageUploading] = useState(false);
const [imageUploadControllers, setImageUploadControllers] = useState({});

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

// useEffect to handle state cleanup when all uploads are cancelled
useEffect(() => {
  // If no progress bars remain and we're still marked as uploading, reset state
  if (Object.keys(uploadProgress).length === 0 && isUploading) {
    setIsUploading(false);
    setUploadControllers({}); // Clear any remaining controllers
  }
}, [uploadProgress, isUploading]);

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
  
  const imageArray = Array.from(images);
  
  // Check file size limits (25MB for images is reasonable)
  for (let i = 0; i < imageArray.length; i++) {
    if (imageArray[i].size / (1024 * 1024) > 25) {
      return alert('Image exceeds 25MB limit!');
    }
  }
  
  setIsImageUploading(true);
  
  const tmpRefs = [];
  const currentRef = Date.now(); // Unique reference for this upload batch
  
  // Initialize progress bars and abort controllers for ALL images
  const initialProgress = {};
  const controllers = {};
  
  for (let i = 0; i < imageArray.length; i++) {
    const imageId = `img-${currentRef}-${i}`;
    tmpRefs.push(imageId);
    
    initialProgress[imageId] = {
      progress: 0,
      fileName: imageArray[i].name
    };
    
    controllers[imageId] = new AbortController();
  }
  
  // Set all progress bars at once
  setImageUploadProgress(initialProgress);
  setImageUploadControllers(controllers);
  
  // Track active uploads to manage isImageUploading state
  let activeUploads = imageArray.length;
  
  const decrementActiveUploads = () => {
    activeUploads--;
    if (activeUploads <= 0) {
      setIsImageUploading(false);
    }
  };
  
  // Start all uploads simultaneously
  imageArray.forEach(async (image, i) => {
    const imageId = `img-${currentRef}-${i}`;
    const controller = controllers[imageId];
    
    try {
      const res = await uploadImage(
        image, 
        imageId, 
        (progressEvent) => {
          // Only update progress if upload hasn't been cancelled
          if (controller.signal.aborted) return;
          
          const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          
          setImageUploadProgress(prev => {
            // Don't update if this image was cancelled (removed from state)
            if (!prev[imageId]) return prev;
            
            return {
              ...prev,
              [imageId]: {
                progress: progress,
                fileName: image.name
              }
            };
          });
        },
        'square', // crop parameter for images
        controller.signal // abort signal
      );
      
      // If cancelled during upload, don't process the response
      if (controller.signal.aborted) {
        decrementActiveUploads();
        return;
      }
      
      // Send message for successful upload
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
      
      // Remove progress bar after successful upload
      setTimeout(() => {
        setImageUploadProgress(prev => {
          const updated = { ...prev };
          delete updated[imageId];
          return updated;
        });
        setImageUploadControllers(prev => {
          const updated = { ...prev };
          delete updated[imageId];
          return updated;
        });
      }, 1000);
      
      decrementActiveUploads();
      
    } catch (error) {
      decrementActiveUploads();
      
      if (error.name === 'CanceledError' || error.code === 'ERR_CANCELED') {
        console.log(`Image upload cancelled for ${image.name}`);
        // Don't show error for cancelled uploads
      } else {
        console.error(`Image upload error for ${image.name}:`, error);
        alert(`Failed to upload ${image.name}`);
        
        // Remove progress bar on error
        setImageUploadProgress(prev => {
          const updated = { ...prev };
          delete updated[imageId];
          return updated;
        });
        setImageUploadControllers(prev => {
          const updated = { ...prev };
          delete updated[imageId];
          return updated;
        });
      }
    }
  });
  
  // Clean up and refresh rooms list
  addPictureRef([...pictureRefs, ...tmpRefs]);
  showPicker(false);
  
  // Clear image input to allow same files to be selected again
  if (imageInput.current) {
    imageInput.current.value = '';
  }
  
  getRooms()
    .then((res) => dispatch({ type: Actions.SET_ROOMS, rooms: res.data.rooms }))
    .catch((err) => console.log(err));
};

// Cancel function for images
const cancelImageUpload = (imageId) => {
  // Abort the upload request
  const controller = imageUploadControllers[imageId];
  if (controller) {
    controller.abort();
  }
  
  // Immediately remove progress bar from UI
  setImageUploadProgress(prev => {
    const updated = { ...prev };
    delete updated[imageId];
    return updated;
  });
  
  // Remove controller from state
  setImageUploadControllers(prev => {
    const updated = { ...prev };
    delete updated[imageId];
    return updated;
  });
};

// Progress display component for images
const renderImageUploadProgress = () => {
  const activeUploads = Object.entries(imageUploadProgress);
  if (activeUploads.length === 0) return null;
  
  return (
    <div style={{
      position: 'fixed',
      bottom: '130px', // Position above file upload progress
      left: '20px',
      right: '20px',
      background: 'white',
      border: '1px solid #ddd',
      borderRadius: '8px',
      padding: '12px',
      boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
      zIndex: 9999,
      maxHeight: '200px',
      overflowY: 'auto'
    }}>
      <div style={{ fontSize: '13px', fontWeight: 'bold', marginBottom: '8px', color: '#333' }}>
        Uploading {activeUploads.length} image{activeUploads.length > 1 ? 's' : ''}...
      </div>
      {activeUploads.map(([imageId, data]) => (
        <div key={imageId} style={{ marginBottom: '10px', position: 'relative' }}>
          {/* X cancel button */}
          <button
            onClick={() => cancelImageUpload(imageId)}
            style={{
              position: 'absolute',
              top: '-5px',
              right: '-5px',
              background: '#dc3545',
              color: 'white',
              border: 'none',
              borderRadius: '50%',
              width: '20px',
              height: '20px',
              fontSize: '12px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 10,
              fontWeight: 'bold'
            }}
          >
            ×
          </button>
          
          {/* Image name and progress percentage */}
          <div style={{ 
            fontSize: '12px', 
            color: '#666', 
            marginBottom: '4px',
            display: 'flex',
            justifyContent: 'space-between',
            paddingRight: '15px' // Space for X button
          }}>
            <span style={{ 
              maxWidth: '200px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}>
              {data.fileName}
            </span>
            <span>{data.progress}%</span>
          </div>
          
          {/* Progress bar */}
          <div style={{
            width: '100%',
            height: '4px',
            background: '#f0f0f0',
            borderRadius: '2px',
            overflow: 'hidden'
          }}>
            <div style={{
              width: `${data.progress}%`,
              height: '100%',
              background: '#007bff', // Blue for images vs green for files
              transition: 'width 0.3s ease'
            }} />
          </div>
        </div>
      ))}
    </div>
  );
};

// useEffect to handle image upload state cleanup
useEffect(() => {
  // If no image progress bars remain and we're still marked as uploading, reset state
  if (Object.keys(imageUploadProgress).length === 0 && isImageUploading) {
    setIsImageUploading(false);
    setImageUploadControllers({}); // Clear any remaining controllers
  }
}, [imageUploadProgress, isImageUploading]);

// Update the image button to show disabled state during upload
const imageButtonStyle = {
  opacity: isImageUploading ? 0.5 : 1
};

// Update the image input onChange handler
const handleImageInputChange = (e) => {
  if (!isImageUploading) {
    sendImages(e.target.files);
  }
};

const sendFiles = async (files) => {
  if (isCreatorNonMember) return;
  
  const fileArray = Array.from(files);
  
  // Check file size limits
  for (let i = 0; i < fileArray.length; i++) {
    if (fileArray[i].size / (1024 * 1024) > 500) {
      return alert('File exceeds 500MB limit!');
    }
  }
  
  setIsUploading(true);
  
  const tmpRefs = [];
  const currentRef = Date.now(); // Unique reference for this upload batch
  
  // Initialize progress bars and abort controllers for ALL files
  const initialProgress = {};
  const controllers = {};
  
  for (let i = 0; i < fileArray.length; i++) {
    const fileId = `${currentRef}-${i}`;
    tmpRefs.push(fileId);
    
    initialProgress[fileId] = {
      progress: 0,
      fileName: fileArray[i].name
    };
    
    controllers[fileId] = new AbortController();
  }
  
  // Set all progress bars at once
  setUploadProgress(initialProgress);
  setUploadControllers(controllers);
  
  // Track active uploads to manage isUploading state
  let activeUploads = fileArray.length;
  
  const decrementActiveUploads = () => {
    activeUploads--;
    if (activeUploads <= 0) {
      setIsUploading(false);
    }
  };
  
  // Start all uploads simultaneously
  fileArray.forEach(async (file, i) => {
    const fileId = `${currentRef}-${i}`;
    const controller = controllers[fileId];
    
    try {
      const res = await uploadFile(
        file, 
        fileId, 
        (progressEvent) => {
          // Only update progress if upload hasn't been cancelled
          if (controller.signal.aborted) return;
          
          const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          
          setUploadProgress(prev => {
            // Don't update if this file was cancelled (removed from state)
            if (!prev[fileId]) return prev;
            
            return {
              ...prev,
              [fileId]: {
                progress: progress,
                fileName: file.name
              }
            };
          });
        },
        controller.signal
      );
      
      // If cancelled during upload, don't process the response
      if (controller.signal.aborted) {
        decrementActiveUploads();
        return;
      }
      
      // Send message for successful upload
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
      
      // Remove progress bar after successful upload
      setTimeout(() => {
        setUploadProgress(prev => {
          const updated = { ...prev };
          delete updated[fileId];
          return updated;
        });
        setUploadControllers(prev => {
          const updated = { ...prev };
          delete updated[fileId];
          return updated;
        });
      }, 1000);
      
      decrementActiveUploads();
      
    } catch (error) {
      decrementActiveUploads();
      
      if (error.name === 'CanceledError' || error.code === 'ERR_CANCELED') {
        console.log(`Upload cancelled for ${file.name}`);
        // Don't show error for cancelled uploads
      } else {
        console.error(`Upload error for ${file.name}:`, error);
        alert(`Failed to upload ${file.name}`);
        
        // Remove progress bar on error
        setUploadProgress(prev => {
          const updated = { ...prev };
          delete updated[fileId];
          return updated;
        });
        setUploadControllers(prev => {
          const updated = { ...prev };
          delete updated[fileId];
          return updated;
        });
      }
    }
  });
  
  // Clean up and refresh rooms list
  addPictureRef([...pictureRefs, ...tmpRefs]);
  showPicker(false);
  
  // Clear file input to allow same files to be selected again
  if (fileInput.current) {
    fileInput.current.value = '';
  }
  
  getRooms()
    .then((res) => dispatch({ type: Actions.SET_ROOMS, rooms: res.data.rooms }))
    .catch((err) => console.log(err));
};

// Cancel function - removes progress bar and stops upload
const cancelUpload = (fileId) => {
  // Abort the upload request
  const controller = uploadControllers[fileId];
  if (controller) {
    controller.abort();
  }
  
  // Immediately remove progress bar from UI
  setUploadProgress(prev => {
    const updated = { ...prev };
    delete updated[fileId];
    return updated;
  });
  
  // Remove controller from state
  setUploadControllers(prev => {
    const updated = { ...prev };
    delete updated[fileId];
    return updated;
  });
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

  // Add this progress display component right before your return statement:
const renderUploadProgress = () => {
  const activeUploads = Object.entries(uploadProgress);
  if (activeUploads.length === 0) return null;
  
  return (
    <div style={{
      position: 'fixed',
      bottom: '70px',
      left: '20px',
      right: '20px',
      background: 'white',
      border: '1px solid #ddd',
      borderRadius: '8px',
      padding: '12px',
      boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
      zIndex: 9999,
      maxHeight: '200px',
      overflowY: 'auto'
    }}>
      <div style={{ fontSize: '13px', fontWeight: 'bold', marginBottom: '8px', color: '#333' }}>
        Uploading {activeUploads.length} file{activeUploads.length > 1 ? 's' : ''}...
      </div>
      {activeUploads.map(([fileId, data]) => (
        <div key={fileId} style={{ marginBottom: '10px', position: 'relative' }}>
          {/* X cancel button */}
          <button
            onClick={() => cancelUpload(fileId)}
            style={{
              position: 'absolute',
              top: '-5px',
              right: '-5px',
              background: '#dc3545',
              color: 'white',
              border: 'none',
              borderRadius: '50%',
              width: '20px',
              height: '20px',
              fontSize: '12px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 10,
              fontWeight: 'bold'
            }}
          >
            ×
          </button>
          
          {/* File name and progress percentage */}
          <div style={{ 
            fontSize: '12px', 
            color: '#666', 
            marginBottom: '4px',
            display: 'flex',
            justifyContent: 'space-between',
            paddingRight: '15px' // Space for X button
          }}>
            <span style={{ 
              maxWidth: '200px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}>
              {data.fileName}
            </span>
            <span>{data.progress}%</span>
          </div>
          
          {/* Progress bar */}
          <div style={{
            width: '100%',
            height: '4px',
            background: '#f0f0f0',
            borderRadius: '2px',
            overflow: 'hidden'
          }}>
            <div style={{
              width: `${data.progress}%`,
              height: '100%',
              background: '#28a745',
              transition: 'width 0.3s ease'
            }} />
          </div>
        </div>
      ))}
    </div>
  );
};

// Then in your return statement, add the progress display:
return (
  <div className="bottom-bar-conversation uk-flex uk-flex-middle" style={{ position: 'relative' }}>
    {/* Render both image and file progress bars */}
    {renderImageUploadProgress()}
    {renderUploadProgress()}
    
    {/* Emoji picker */}
    {isPicker && (
      <div className="picker">
        <Picker
          onSelect={(emoji) => setText((prev) => prev + emoji.native)}
          showSkinTones={false}
          showPreview={false}
          theme="light"
        />
      </div>
    )}
    
    {/* Text input - disable during any upload */}
    <input
      disabled={isUploading || isImageUploading}
      value={text}
      onKeyPress={handleKeyPress}
      onChange={(e) => setText(e.target.value)}
      className="search-input"
      placeholder="Type a message..."
      type="text"
    />
    
    {/* Emoji button */}
    <div className="button smile" onClick={() => showPicker(!isPicker)}>
      <FiSmile />
    </div>
    
    {/* Image upload button - NOW USING imageButtonStyle */}
    <div 
      className="button image-attach" 
      onClick={() => !isImageUploading && imageInput.current.click()}
      style={imageButtonStyle}  // <-- Using the defined style
    >
      <FiImage />
    </div>
    
    {/* File upload button */}
    <div 
      className="button attach" 
      onClick={() => !isUploading && fileInput.current.click()}
      style={{ opacity: isUploading ? 0.5 : 1 }}
    >
      <FiPaperclip />
    </div>
    
    {/* Send message button */}
    <div className="button" onClick={sendMessage}>
      <FiSend />
    </div>
    
    {/* Image input - NOW USING handleImageInputChange */}
    <input
      ref={imageInput}
      onChange={handleImageInputChange}  // <-- Using the defined handler
      type="file"
      className="file-input"
      accept="image/*"
      multiple
    />
    
    {/* File input */}
    <input
      ref={fileInput}
      onChange={(e) => sendFiles(e.target.files)}
      type="file"
      className="file-input"
      multiple
    />
  </div>
);
}

export default BottomBar;