// frontend/src/features/Panel/components/MissedCalls.jsx
import { useEffect } from 'react';
import { useGlobal } from 'reactn';
import { useNavigate } from 'react-router-dom';
import moment from 'moment';
import { FiPhoneOff, FiPhone, FiVideo, FiMessageCircle } from 'react-icons/fi';
import Picture from '../../../components/Picture';
import { getMissedCalls, clearMissedCalls, markMissedSeen } from '../../../actions/missedCalls';

function MissedCalls() {
  const [missedCalls, setMissedCalls] = useGlobal('missedCalls');
  const setMissedUnseen = useGlobal('missedUnseen')[1];
  const searchText = useGlobal('search')[0] || '';
  const navigate = useNavigate();

  const load = () => {
    getMissedCalls()
      .then((res) => setMissedCalls(res.data.calls || []))
      .catch((err) => console.log(err));
  };

  // Load on open, and clear the badge (mark seen). Entries remain until Clear All.
  useEffect(() => {
    load();
    markMissedSeen()
      .then(() => setMissedUnseen(0))
      .catch((err) => console.log(err));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const clearAll = async () => {
    try {
      await clearMissedCalls();
      setMissedCalls([]);
      setMissedUnseen(0);
    } catch (e) {
      console.log(e);
    }
  };

  const q = searchText.trim().toLowerCase();
  const calls = (missedCalls || []).filter((c) => {
    if (!q) return true;
    const name = c.type === 'group'
      ? (c.group?.title || '')
      : `${c.counterpart?.firstName || ''} ${c.counterpart?.lastName || ''}`;
    return name.toLowerCase().includes(q);
  });

  return (
    <div className="missed-calls">
      <div className="missed-header uk-flex uk-flex-between uk-flex-middle">
        <h3 className="missed-title">Missed Calls</h3>
        {calls.length > 0 && (
          <div className="clear-all-button" onClick={clearAll}>
            Clear All
          </div>
        )}
      </div>

      {calls.length === 0 && (
        <div className="notice">
          {q ? `No missed calls for "${searchText}"` : 'No missed calls.'}
        </div>
      )}

      {calls.map((c) => {
        const isGroup = c.type === 'group';
        const display = isGroup
          ? { firstName: c.group?.title || 'Group', lastName: '' }
          : (c.counterpart || { firstName: 'Unknown', lastName: 'User' });
        const name = isGroup
          ? (c.group?.title || 'Group')
          : `${display.firstName || 'Unknown'} ${display.lastName || ''}`.trim();

        return (
          <div className="missed-row uk-flex uk-flex-middle" key={c.meetingId}>
            <div className="profile">
              <Picture
                user={display}
                group={isGroup}
                picture={isGroup ? c.group?.picture : undefined}
                title={isGroup ? c.group?.title : undefined}
              />
            </div>
            <div className="text" style={{ flexGrow: 1 }}>
              <div className="name">{name}</div>
              <div className="subtitle uk-flex uk-flex-middle">
                <FiPhoneOff className="missed-icon" />
                {c.media === 'video' ? 'Video call' : 'Voice call'}
                {'  ·  '}
                {moment(c.at).format('MMM D h:mm A')}
              </div>
            </div>
            {c.roomId && (
              <div
                className="chat-button uk-flex uk-flex-middle"
                onClick={() => navigate(`/room/${c.roomId}`, { replace: true })}
              >
                <FiMessageCircle className="chat-icon" />
                {isGroup ? 'Open' : 'Chat'}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default MissedCalls;