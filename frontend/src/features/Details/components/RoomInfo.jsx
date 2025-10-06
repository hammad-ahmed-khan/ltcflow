// frontend/src/features/Details/components/RoomInfo.jsx
import { useState, useEffect } from 'react';
import './RoomInfo.sass';
import { FiCircle, FiImage, FiFile, FiLink, FiX, FiDownload, FiArrowLeft } from 'react-icons/fi';
import { useSelector } from 'react-redux';
import { useGlobal } from 'reactn';
import EnhancedLightbox from '../../Conversation/components/EnhancedLightbox';
import Picture from '../../../components/Picture';
import { buildImageUrl, buildFileUrl } from '../../../utils/urlUtils';
import getRoomMedia from '../../../actions/getRoomMedia';
import moment from 'moment';

function RoomInfo({ onBack }) {
  const room = useSelector((state) => state.io.room);
  const messages = useSelector((state) => state.io.messages) || [];
  const onlineUsers = useSelector((state) => state.io.onlineUsers);
  const user = useGlobal('user')[0];

  const [activeTab, setActiveTab] = useState('info');
  const [open, setOpen] = useState(null);
  const [imageMessages, setImageMessages] = useState([]);
  const [fileMessages, setFileMessages] = useState([]);
  const [linkMessages, setLinkMessages] = useState([]);
  const [loadingMedia, setLoadingMedia] = useState(false);

  // Fetch ALL media when component mounts or room changes
  useEffect(() => {
    if (room && room._id) {
      setLoadingMedia(true);
      getRoomMedia(room._id)
        .then((res) => {
          setImageMessages(res.data.images || []);
          setFileMessages(res.data.files || []);
          setLinkMessages(res.data.links || []);
          setLoadingMedia(false);
        })
        .catch((err) => {
          console.error('Error loading room media:', err);
          // Fallback to messages from Redux if API fails
          const images = messages.filter(msg => msg.type === 'image' && !msg.isDeleted);
          const files = messages.filter(msg => msg.type === 'file' && !msg.isDeleted);
          const urlRegex = /(https?:\/\/[^\s]+)/g;
          const links = messages.filter(msg => 
            msg.type === 'text' && 
            !msg.isDeleted && 
            msg.content && 
            urlRegex.test(msg.content)
          );
          setImageMessages(images);
          setFileMessages(files);
          setLinkMessages(links);
          setLoadingMedia(false);
        });
    }
  }, [room?._id]);

  let other = {
    firstName: 'A',
    lastName: 'A',
  };

  if (room && room.people) {
    room.people.forEach((person) => {
      if (person._id !== user.id) other = person;
    });
  }

  const getColor = (id) => {
    if (onlineUsers.filter((u) => u.id === id && u.status === 'busy').length > 0) return 'busy';
    if (onlineUsers.filter((u) => u.id === id && u.status === 'online').length > 0) return 'online';
    if (onlineUsers.filter((u) => u.id === id && u.status === 'away').length > 0) return 'away';
    return 'offline';
  };

  const compare = (a, b) => {
    if (a.firstName < b.firstName) return -1;
    if (a.firstName > b.firstName) return 1;
    if (a.lastName < b.lastName) return -1;
    if (a.lastName > b.lastName) return 1;
    return 0;
  };

  const people = room.people ? [...room.people].sort(compare) : [];

  const extractLinks = (text) => {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    return text.match(urlRegex) || [];
  };

  return (
    <div className="room-info-container">
      {/* Header */}
      <div className="room-info-header">
        <button className="back-button" onClick={onBack}>
          <FiArrowLeft />
        </button>
        <h3>{room.isGroup ? 'Group Info' : 'Contact Info'}</h3>
      </div>

      {/* Profile Section */}
      <div className="room-info-profile">
        <div className="profile-picture">
          <Picture 
            group={room.isGroup} 
            picture={room.isGroup ? room.picture : other.picture} 
            user={other} 
          />
        </div>
        <h2 className="profile-name">
          {room.isGroup ? room.title : `${other.firstName} ${other.lastName}`}
        </h2>
        {!room.isGroup && other.tagLine && (
          <p className="profile-tagline">{other.tagLine}</p>
        )}
        {room.isGroup && (
          <p className="profile-members">Group · {room.people.length} members</p>
        )}
      </div>

      {/* Tabs */}
      <div className="room-info-tabs">
        <button 
          className={`tab ${activeTab === 'info' ? 'active' : ''}`}
          onClick={() => setActiveTab('info')}
        >
          {room.isGroup ? 'Members' : 'Info'}
        </button>
        <button 
          className={`tab ${activeTab === 'media' ? 'active' : ''}`}
          onClick={() => setActiveTab('media')}
        >
          Media & Files
        </button>
      </div>

      {/* Content */}
      <div className="room-info-content">
        {activeTab === 'info' && (
          <div className="members-section">
            {room.isGroup && (
              <>
                <div className="section-header">
                  <h4>{people.length} Members</h4>
                </div>
                <div className="members-list">
                  {people.map((person, key) => (
                    <div className="member-item" key={key}>
                      <Picture picture={person.picture} user={person} />
                      <div className="member-info">
                        <div className="member-name">
                          {person.firstName} {person.lastName}
                        </div>
                        <div className="member-username">@{person.username || 'user'}</div>
                      </div>
                      <div className={`status-indicator ${getColor(person._id)}`}>
                        <FiCircle />
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
            {!room.isGroup && (
              <div className="contact-details">
                <div className="detail-item">
                  <span className="detail-label">Username</span>
                  <span className="detail-value">@{other.username || 'N/A'}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Email</span>
                  <span className="detail-value">{other.email || 'N/A'}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Status</span>
                  <span className={`detail-value ${getColor(other._id)}`}>
                    {getColor(other._id)}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'media' && (
          <div className="media-section">
            {/* Images */}
            <div className="media-category">
              <div className="category-header">
                <FiImage />
                <h4>Photos ({imageMessages.length})</h4>
              </div>
              {imageMessages.length > 0 ? (
                <div className="media-grid">
                  {imageMessages.slice(0, 12).map((msg) => (
                    <div 
                      key={msg._id} 
                      className="media-item"
                      onClick={() => setOpen(msg)}
                    >
                      <img 
                        src={buildImageUrl(msg.content, 256)} 
                        alt="Media"
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-state">No photos yet</div>
              )}
              {imageMessages.length > 12 && (
                <button className="view-all-btn">
                  View all {imageMessages.length} photos
                </button>
              )}
            </div>

            {/* Files */}
            <div className="media-category">
              <div className="category-header">
                <FiFile />
                <h4>Documents ({fileMessages.length})</h4>
              </div>
              {fileMessages.length > 0 ? (
                <div className="files-list">
                  {fileMessages.map((msg) => {
                    const fileName = msg.file?.name || msg.fileName || 'Unknown File';
                    const fileSize = msg.file?.size || msg.fileSize || 0;
                    const fileSizeMB = fileSize > 0 ? `${Math.round((fileSize / 1024 / 1024) * 100) / 100} MB` : 'Unknown size';
                    
                    return (
                      <a
                        key={msg._id}
                        href={buildFileUrl(msg.content)}
                        download={fileName}
                        className="file-item"
                      >
                        <div className="file-icon">
                          <FiFile />
                        </div>
                        <div className="file-info">
                          <div className="file-name">{fileName}</div>
                          <div className="file-meta">
                            {fileSizeMB}
                            {msg.date && ` · ${moment(msg.date).format('MMM DD, YYYY')}`}
                          </div>
                        </div>
                        <div className="file-download">
                          <FiDownload />
                        </div>
                      </a>
                    );
                  })}
                </div>
              ) : (
                <div className="empty-state">No documents yet</div>
              )}
            </div>

            {/* Links */}
            <div className="media-category">
              <div className="category-header">
                <FiLink />
                <h4>Links ({linkMessages.length})</h4>
              </div>
              {linkMessages.length > 0 ? (
                <div className="links-list">
                  {linkMessages.map((msg) => {
                    const links = extractLinks(msg.content);
                    return links.map((link, idx) => (
                      <a
                        key={`${msg._id}-${idx}`}
                        href={link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="link-item"
                      >
                        <div className="link-icon">
                          <FiLink />
                        </div>
                        <div className="link-info">
                          <div className="link-url">{link}</div>
                          <div className="link-meta">
                            Shared by {msg.author.firstName} · {moment(msg.date).format('MMM DD')}
                          </div>
                        </div>
                      </a>
                    ));
                  })}
                </div>
              ) : (
                <div className="empty-state">No links yet</div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Lightbox for images */}
      {open && imageMessages.length > 0 && (
        <EnhancedLightbox
          images={imageMessages}
          currentImage={open}
          onClose={() => setOpen(null)}
          buildImageUrl={buildImageUrl}
        />
      )}
    </div>
  );
}

export default RoomInfo;