// frontend/src/features/Conversation/components/MessageInfo.jsx
//
// WhatsApp-style "Message Info" modal. Shown for the sender's own group
// messages: lists who has read (blue), who it was delivered to (gray), and
// who hasn't received it yet — each with a timestamp.

import { useEffect, useState } from 'react';
import moment from 'moment';
import { FiX } from 'react-icons/fi';
import ClipLoader from 'react-spinners/ClipLoader';
import Picture from '../../../components/Picture';
import getMessageInfo from '../../../actions/getMessageInfo';

const overlayStyle = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.5)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 2000,
};

const panelStyle = {
  background: '#fff',
  width: 'min(420px, 92vw)',
  maxHeight: '80vh',
  borderRadius: 12,
  overflow: 'hidden',
  display: 'flex',
  flexDirection: 'column',
  boxShadow: '0 12px 40px rgba(0,0,0,0.3)',
};

function Row({ entry, color }) {
  const { user, at } = entry;
  return (
    <div style={{ display: 'flex', alignItems: 'center', padding: '10px 16px', gap: 12 }}>
      <div style={{ width: 40, height: 40, flexShrink: 0 }}>
        <Picture user={user} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, color: '#222', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {(user.firstName || 'Unknown')} {(user.lastName || '')}
        </div>
        {at && (
          <div style={{ fontSize: 12, color }}>
            {moment(at).format('MMM DD, YYYY · h:mm A')}
          </div>
        )}
      </div>
    </div>
  );
}

function Section({ title, color, entries }) {
  if (!entries || entries.length === 0) return null;
  return (
    <div>
      <div
        style={{
          padding: '10px 16px 4px',
          fontSize: 12,
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: 0.5,
          color,
        }}
      >
        {title} · {entries.length}
      </div>
      {entries.map((e) => (
        <Row key={(e.user && e.user._id) || Math.random()} entry={e} color={color} />
      ))}
    </div>
  );
}

function MessageInfo({ messageId, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(false);
    getMessageInfo(messageId)
      .then((res) => {
        if (!active) return;
        setData(res.data);
        setLoading(false);
      })
      .catch((err) => {
        if (!active) return;
        console.error('Failed to load message info:', err);
        setError(true);
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [messageId]);

  const READ = '#53bdeb';
  const GRAY = '#8696a0';

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={panelStyle} onClick={(e) => e.stopPropagation()}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '14px 16px',
            borderBottom: '1px solid #eee',
          }}
        >
          <div style={{ fontWeight: 700, fontSize: 16 }}>Message Info</div>
          <div onClick={onClose} style={{ cursor: 'pointer', color: '#666', display: 'flex' }}>
            <FiX size={20} />
          </div>
        </div>

        <div style={{ overflowY: 'auto' }}>
          {loading && (
            <div style={{ padding: 40, display: 'flex', justifyContent: 'center' }}>
              <ClipLoader size={32} color="#666" loading />
            </div>
          )}

          {!loading && error && (
            <div style={{ padding: 24, textAlign: 'center', color: '#999' }}>
              Could not load message info.
            </div>
          )}

          {!loading && !error && data && (
            <>
              <Section title="Read by" color={READ} entries={data.readBy} />
              <Section title="Delivered to" color={GRAY} entries={data.delivered} />
              <Section title="Pending" color={GRAY} entries={data.pending} />
              {(!data.readBy || data.readBy.length === 0) &&
                (!data.delivered || data.delivered.length === 0) &&
                (!data.pending || data.pending.length === 0) && (
                  <div style={{ padding: 24, textAlign: 'center', color: '#999' }}>
                    No recipients.
                  </div>
                )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default MessageInfo;
