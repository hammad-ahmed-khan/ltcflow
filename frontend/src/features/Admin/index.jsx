import { useEffect, useRef, useState } from 'react';
import { useGlobal } from 'reactn';
import DataTable from 'react-data-table-component';
import { FiSearch, FiMail, FiRefreshCw, FiToggleLeft, FiToggleRight, FiClock, FiUserPlus, FiUserCheck, FiUserX, FiX } from 'react-icons/fi';
import { useToasts } from 'react-toast-notifications';
import TopBar from './components/TopBar';
import BottomBar from './components/BottomBar';
import './Admin.sass';
import search from '../../actions/search';
import apiClient from '../../api/apiClient';
import Popup from './components/Popup';

function Admin() {
  const { addToast } = useToasts();
  const setOver = useGlobal('over')[1];
  const [users, setUsers] = useState([]);
  const searchInput = useRef();
  const setSearchResults = useGlobal('searchResults')[1];
  const [searchText, setSearch] = useGlobal('search');
  const [popup, setPopup] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState({});
  const [statusFilter, setStatusFilter] = useState('all');

  const onChange = (e) => {
    setSearch(e.target.value);
    search(e.target.value)
      .then((res) => setSearchResults(res.data.users))
      .catch((err) => console.log(err));
  };

  useEffect(() => {
    search(searchText || null, 10000).then((res) => {
      setUsers(res.data.users);
    });
  }, [searchText]);

  const back = () => setOver(false);

  const refreshUserList = () => {
    search(searchText || null, 10000).then((res) => {
      setUsers(res.data.users);
    });
  };

  // Helper function to format user role for display with tooltips
  const formatUserRole = (level) => {
    const roleMap = {
      'user': { label: 'Standard User', tooltip: 'Can only chat with assigned groups' },
      'manager': { label: 'Group Manager', tooltip: 'Can create groups and join any group' }, 
      'admin': { label: 'Administrator', tooltip: 'Can administrate the system and manage users' },
      'root': { label: 'Super Admin', tooltip: 'Full system access and control' }
    };
    return roleMap[level] || { label: level || 'Not Set', tooltip: 'Role not defined' };
  };

  // Helper function to get role badge color  
  const getRoleBadgeStyle = (level) => {
    const styles = {
      'user': { backgroundColor: '#e3f2fd', color: '#1976d2', border: '1px solid #bbdefb' },
      'manager': { backgroundColor: '#f3e5f5', color: '#7b1fa2', border: '1px solid #ce93d8' },
      'admin': { backgroundColor: '#fff3e0', color: '#f57c00', border: '1px solid #ffcc02' },
      'root': { backgroundColor: '#ffebee', color: '#c62828', border: '1px solid #ef9a9a' }
    };
    return styles[level] || { backgroundColor: '#f5f5f5', color: '#666', border: '1px solid #ddd' };
  };

  // Helper function to format dates
  const formatDate = (dateString) => {
    if (!dateString) return 'Never';
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
  };

  // Helper function to get time ago
  const getTimeAgo = (dateString) => {
    if (!dateString) return 'Never';
    const now = new Date();
    const date = new Date(dateString);
    const diffMs = now - date;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    
    if (diffDays > 0) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    if (diffHours > 0) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffMinutes > 0) return `${diffMinutes} minute${diffMinutes > 1 ? 's' : ''} ago`;
    return 'Just now';
  };

  // Resend invitation
  const resendInvitation = async (userId, userEmail) => {
    setLoading(prev => ({...prev, [`resend_${userId}`]: true}));
    try {
      const response = await apiClient.post('/api/regenerate-activation', { userId });
      addToast(`Invitation resent to ${userEmail}`, {
        appearance: 'success',
        autoDismiss: true,
      });
      refreshUserList();
    } catch (error) {
      addToast('Failed to resend invitation', {
        appearance: 'error',
        autoDismiss: true,
      });
    } finally {
      setLoading(prev => ({...prev, [`resend_${userId}`]: false}));
    }
  };

  // Cancel invitation or toggle user status
  const toggleUserStatus = async (userId, currentStatus, username, isPending = false) => {
    const action = isPending ? 'cancel invitation' : (currentStatus ? 'deactivate' : 'activate');
    setLoading(prev => ({...prev, [`toggle_${userId}`]: true}));
    try {
      const response = await apiClient.post('/api/toggle-user-status', { 
        userId, 
        isActive: !currentStatus 
      });
      addToast(`${isPending ? 'Invitation cancelled' : `User ${username} ${action}d`} successfully`, {
        appearance: 'success',
        autoDismiss: true,
      });
      refreshUserList();
    } catch (error) {
      addToast(`Failed to ${action} user`, {
        appearance: 'error',
        autoDismiss: true,
      });
    } finally {
      setLoading(prev => ({...prev, [`toggle_${userId}`]: false}));
    }
  };

  // Enhanced status badge for invitation status
const getDetailedStatusBadge = (user) => {
  const { status, tokenExpiry, createdAt, updatedAt } = user;
  
  const statusConfig = {
    'active': {
      backgroundColor: '#e8f5e8',
      color: '#2e7d2e',
      border: '1px solid #a3d977',
      icon: FiUserCheck,
      label: 'Active',
      timestamp: getTimeAgo(updatedAt)
    },
    'pending': {
      backgroundColor: '#fff3e0',
      color: '#f57c00',
      border: '1px solid #ffcc02',
      icon: FiClock,
      label: 'Pending',
      timestamp: getTimeAgo(createdAt)
    },
    'expired': {
      backgroundColor: '#ffebee',
      color: '#c62828',
      border: '1px solid #ef9a9a',
      icon: FiUserX,
      label: 'Expired',
      timestamp: getTimeAgo(tokenExpiry)
    },
    'deactivated': {
      backgroundColor: '#f5f5f5',
      color: '#666',
      border: '1px solid #ddd',
      icon: FiUserX,
      label: 'Deactivated',
      timestamp: getTimeAgo(updatedAt)
    }
  };

  // Get config for current status, default to pending if status not found
  const config = statusConfig[status] || statusConfig['pending'];
  const IconComponent = config.icon;

  return (
    <div className="uk-flex uk-flex-column uk-flex-center">
      <span style={{
        backgroundColor: config.backgroundColor,
        color: config.color,
        border: config.border,
        padding: '4px 8px',
        borderRadius: '12px',
        fontSize: '12px',
        fontWeight: '500',
        display: 'flex',
        alignItems: 'center',
        gap: '4px'
      }}>
        <IconComponent size={12} />
        {config.label}
      </span>
      <span style={{ fontSize: '10px', color: '#666', marginTop: '2px' }}>
        {config.timestamp}
      </span>
    </div>
  );
};

  const columns = [
  {
    name: 'User Info',
    selector: (row) => row.firstName,
    sortable: true,
    width: '200px',
    cell: (row) => (
      <div className="uk-flex uk-flex-column">
        <div style={{ fontWeight: '500', fontSize: '14px' }}>
          {row.firstName} {row.lastName}
        </div>
        <div style={{ fontSize: '12px', color: '#666' }}>
          @{row.username}
        </div>
        <div style={{ fontSize: '11px', color: '#999' }}>
          {row.email}
        </div>
      </div>
    ),
  },
  {
    name: 'Invitation Status',
    selector: (row) => row.isActive,
    sortable: true,
    width: '120px',
    cell: (row) => getDetailedStatusBadge(row),
  },
  {
    name: 'Role',
    selector: (row) => row.level,
    sortable: true,
    width: '130px',
    cell: (row) => {
      const roleInfo = formatUserRole(row.level);
      return (
        <span
          style={{
            ...getRoleBadgeStyle(row.level),
            padding: '4px 8px',
            borderRadius: '12px',
            fontSize: '12px',
            fontWeight: '500',
            display: 'inline-block',
            textAlign: 'center',
            cursor: 'help',
          }}
          title={roleInfo.tooltip}
        >
          {roleInfo.label}
        </span>
      );
    },
  },
  {
    name: 'Invitation Details',
    sortable: false,
    width: '160px',
    cell: (row) => (
      <div className="uk-flex uk-flex-column uk-text-small">
        <div style={{ fontSize: '11px', color: '#666' }}>
          <strong>Created:</strong> {formatDate(row.createdAt)}
        </div>
        {row.tokenExpiry && !row.isActive && (
          <div
            style={{
              fontSize: '11px',
              color:
                row.tokenExpiry && new Date() > new Date(row.tokenExpiry)
                  ? '#c62828'
                  : '#f57c00',
            }}
          >
            <strong>Expires:</strong> {formatDate(row.tokenExpiry)}
          </div>
        )}
        {row.isActive && (
          <div style={{ fontSize: '11px', color: '#2e7d2e' }}>
            <strong>Activated:</strong> {formatDate(row.updatedAt)}
          </div>
        )}
      </div>
    ),
  },
  {
    name: 'Quick Actions',
    sortable: false,
    width: '200px',
    cell: (row) => {
      const isPending = row.status === 'pending';
      const isExpired = row.status === 'expired';
      const isActive = row.status === 'active';
      const isDeactivated = row.status === 'deactivated';

      return (
        <div className="uk-flex uk-flex-column uk-flex-center" style={{ gap: '4px' }}>
          <div className="uk-flex" style={{ gap: '4px' }}>
            {/* Pending or Expired: Resend + Cancel */}
            {(isPending || isExpired) && (
              <>
                <button
                  className="uk-button uk-button-small uk-button-primary"
                  style={{ fontSize: '10px', padding: '4px 8px' }}
                  onClick={() => resendInvitation(row.id, row.email)}
                  disabled={loading[`resend_${row.id}`]}
                  title="Resend invitation email to this user"
                >
                  {loading[`resend_${row.id}`] ? (
                    <div data-uk-spinner="ratio: 0.5" />
                  ) : (
                    <>
                      <FiMail size={12} style={{ marginRight: '4px' }} />
                      Resend
                    </>
                  )}
                </button>

                <button
                  className="uk-button uk-button-small uk-button-danger"
                  style={{ fontSize: '10px', padding: '4px 8px' }}
                  onClick={() => cancelInvitation(row.id)}
                  disabled={loading[`cancel_${row.id}`]}
                  title="Cancel this user's pending invitation"
                >
                  {loading[`cancel_${row.id}`] ? (
                    <div data-uk-spinner="ratio: 0.5" />
                  ) : (
                    <>
                      <FiX size={12} style={{ marginRight: '4px' }} />
                      Cancel
                    </>
                  )}
                </button>
              </>
            )}

            {/* Active: Show Deactivate */}
            {isActive && (
              <button
                className="uk-button uk-button-small uk-button-danger"
                style={{ fontSize: '10px', padding: '4px 8px' }}
                onClick={() => toggleUserStatus(row.id, 'deactivate', row.username)}
                disabled={loading[`toggle_${row.id}`]}
                title="Deactivate this user's account"
              >
                {loading[`toggle_${row.id}`] ? (
                  <div data-uk-spinner="ratio: 0.5" />
                ) : (
                  <>
                    <FiToggleRight size={12} style={{ marginRight: '4px' }} />
                    Deactivate
                  </>
                )}
              </button>
            )}

            {/* Deactivated: Show Activate */}
            {isDeactivated && (
              <button
                className="uk-button uk-button-small uk-button-success"
                style={{ fontSize: '10px', padding: '4px 8px' }}
                onClick={() => toggleUserStatus(row.id, 'activate', row.username)}
                disabled={loading[`toggle_${row.id}`]}
                title="Activate this user's account"
              >
                {loading[`toggle_${row.id}`] ? (
                  <div data-uk-spinner="ratio: 0.5" />
                ) : (
                  <>
                    <FiToggleLeft size={12} style={{ marginRight: '4px' }} />
                    Activate
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      );
    },
  }, // ✅ this closing brace was missing before
  {
    name: 'Manage',
    sortable: false,
    width: '100px',
    cell: (row) => (
      <div className="uk-flex uk-flex-column" style={{ gap: '4px' }}>
        <a
          className="uk-link-text uk-text-small"
          onClick={() => {
            setUser(row);
            setPopup('edit');
          }}
          style={{
            fontSize: '11px',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            padding: '2px 4px',
            borderRadius: '4px',
          }}
          title="Edit this user's profile and permissions"
          onMouseEnter={(e) => {
            e.target.style.backgroundColor = '#f8f8f8';
            e.target.style.transform = 'scale(1.05)';
          }}
          onMouseLeave={(e) => {
            e.target.style.backgroundColor = 'transparent';
            e.target.style.transform = 'scale(1)';
          }}
        >
          Edit User
        </a>
        <a
          className="uk-link-text uk-text-small uk-text-danger"
          onClick={() => {
            setUser(row);
            setPopup('delete');
          }}
          style={{
            fontSize: '11px',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            padding: '2px 4px',
            borderRadius: '4px',
          }}
          title="Permanently delete this user and all associated data"
          onMouseEnter={(e) => {
            e.target.style.backgroundColor = '#ffebee';
            e.target.style.transform = 'scale(1.05)';
          }}
          onMouseLeave={(e) => {
            e.target.style.backgroundColor = 'transparent';
            e.target.style.transform = 'scale(1)';
          }}
        >
          Delete User
        </a>
      </div>
    ),
  },
];


  // Filter users based on status
const getFilteredUsers = () => {
  const allUsers = users.map(user => ({
    id: user._id,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    username: user.username,
    level: user.level,
    status: user.status, // FIXED: Added status field
    tokenExpiry: user.tokenExpiry,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    // Add any other fields you need from the user schema
    phone: user.phone,
    picture: user.picture,
    tagLine: user.tagLine,
    lastOnline: user.lastOnline,
    activationToken: user.activationToken,
    tokenExpiry: user.tokenExpiry
  }));

  // FIXED: Use status field for filtering
  switch (statusFilter) {
    case 'active':
      return allUsers.filter(user => user.status === 'active');
    case 'pending':
      return allUsers.filter(user => user.status === 'pending');
    case 'expired':
      return allUsers.filter(user => user.status === 'expired');
    case 'deactivated':
      return allUsers.filter(user => user.status === 'deactivated');
    default:
      return allUsers; // Show all users
  }
};

  const data = getFilteredUsers();

// Calculate user statistics for analytics
const getUserStatistics = () => {
  const totalUsers = users.length;
  const activeUsers = users.filter(u => u.status === 'active').length;
  const pendingUsers = users.filter(u => ['pending', 'expired'].includes(u.status)).length;
  const deactivatedUsers = users.filter(u => u.status === 'deactivated').length;
  
  return { 
    totalUsers, 
    activeUsers, 
    pendingUsers, 
    deactivatedUsers 
  };
};
  const stats = getUserStatistics();

  return (
    <div className="admin content uk-flex uk-flex-column">
      <TopBar back={back} />
      
      <div className="search-bar uk-flex uk-flex-center uk-flex-middle">
        <div className="icon" onClick={() => searchInput.current.focus()}>
          <FiSearch />
        </div>
        <div className="uk-inline search">
          <input className="uk-input uk-border-pill" placeholder="Search users..." ref={searchInput} onChange={onChange} />
        </div>
        <button 
          className="uk-button uk-button-default uk-margin-small-left"
          onClick={refreshUserList}
          title="Refresh the user list to see latest changes"
          style={{ transition: 'all 0.2s ease' }}
          onMouseEnter={(e) => {
            e.target.style.transform = 'scale(1.05)';
            e.target.style.backgroundColor = '#f8f8f8';
          }}
          onMouseLeave={(e) => {
            e.target.style.transform = 'scale(1)';
            e.target.style.backgroundColor = '';
          }}
        >
          <FiRefreshCw size={16} />
        </button>
      </div>
      
      {/* Status Filter Tabs with Counts */}
      <div className="uk-flex uk-flex-center uk-margin-small">
        <div className="uk-subnav uk-subnav-pill" data-uk-subnav>
          <li className={statusFilter === 'all' ? 'uk-active' : ''}>
            <a 
              onClick={() => setStatusFilter('all')}
              title="Show all users regardless of status"
              style={{ 
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                color: statusFilter === 'all' ? '#333' : 'inherit', // Dark text when active
                whiteSpace: 'nowrap' // Prevent text wrapping
              }}
              onMouseEnter={(e) => !e.target.closest('li').classList.contains('uk-active') && (e.target.style.backgroundColor = '#f8f8f8')}
              onMouseLeave={(e) => !e.target.closest('li').classList.contains('uk-active') && (e.target.style.backgroundColor = '')}
            >
              All
              <span style={{
                backgroundColor: statusFilter === 'all' ? '#333' : '#666', // Darker when active
                color: 'white',
                padding: '2px 6px',
                borderRadius: '10px',
                fontSize: '11px',
                fontWeight: '500',
                minWidth: '20px',
                textAlign: 'center'
              }}>
                {stats.totalUsers}
              </span>
            </a>
          </li>
          <li className={statusFilter === 'active' ? 'uk-active' : ''}>
            <a 
              onClick={() => setStatusFilter('active')}
              title="Show only active users"
              style={{ 
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                color: statusFilter === 'active' ? '#333' : 'inherit', // Dark text when active
                whiteSpace: 'nowrap' // Prevent text wrapping
              }}
              onMouseEnter={(e) => !e.target.closest('li').classList.contains('uk-active') && (e.target.style.backgroundColor = '#f8f8f8')}
              onMouseLeave={(e) => !e.target.closest('li').classList.contains('uk-active') && (e.target.style.backgroundColor = '')}
            >
              Active
              <span style={{
                backgroundColor: statusFilter === 'active' ? '#1e5f1e' : '#2e7d2e', // Darker green when active
                color: 'white',
                padding: '2px 6px',
                borderRadius: '10px',
                fontSize: '11px',
                fontWeight: '500',
                minWidth: '20px',
                textAlign: 'center'
              }}>
                {stats.activeUsers}
              </span>
            </a>
          </li>
          <li className={statusFilter === 'pending' ? 'uk-active' : ''}>
            <a 
              onClick={() => setStatusFilter('pending')}
              title="Show all users who haven't completed activation yet"
              style={{ 
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                color: statusFilter === 'pending' ? '#333' : 'inherit', // Dark text when active
                whiteSpace: 'nowrap' // Prevent text wrapping
              }}
              onMouseEnter={(e) => !e.target.closest('li').classList.contains('uk-active') && (e.target.style.backgroundColor = '#f8f8f8')}
              onMouseLeave={(e) => !e.target.closest('li').classList.contains('uk-active') && (e.target.style.backgroundColor = '')}
            >
              Pending
              <span style={{
                backgroundColor: statusFilter === 'pending' ? '#cc5500' : '#f57c00', // Darker orange when active
                color: 'white',
                padding: '2px 6px',
                borderRadius: '10px',
                fontSize: '11px',
                fontWeight: '500',
                minWidth: '20px',
                textAlign: 'center'
              }}>
                {stats.pendingUsers}
              </span>
            </a>
          </li>
          <li className={statusFilter === 'deactivated' ? 'uk-active' : ''}>
            <a 
              onClick={() => setStatusFilter('deactivated')}
              title="Show only inactive users"
              style={{ 
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                color: statusFilter === 'deactivated' ? '#333' : 'inherit', // Dark text when active
                whiteSpace: 'nowrap' // Prevent text wrapping
              }}
              onMouseEnter={(e) => !e.target.closest('li').classList.contains('uk-active') && (e.target.style.backgroundColor = '#f8f8f8')}
              onMouseLeave={(e) => !e.target.closest('li').classList.contains('uk-active') && (e.target.style.backgroundColor = '')}
            >
              Deactivated
              <span style={{
                backgroundColor: statusFilter === 'deactivated' ? '#8b1a1a' : '#c62828', // Darker red when active
                color: 'white',
                padding: '2px 6px',
                borderRadius: '10px',
                fontSize: '11px',
                fontWeight: '500',
                minWidth: '20px',
                textAlign: 'center'
              }}>
                {stats.deactivatedUsers}
              </span>
            </a>
          </li>
        </div>
      </div>
      
      <div className="content uk-flex uk-flex-center uk-flex-middle uk-flex-column">
        <div className="data-table" style={{ background: '#fff', width: '100%', maxWidth: '1200px' }}>
          <div className="data-create uk-flex uk-flex-between uk-flex-middle">
            <button 
              className="uk-button uk-button-primary" 
              onClick={() => setPopup('create')}
              style={{ transition: 'all 0.2s ease' }}
              title="Send an invitation to a new user to join your organization"
              onMouseEnter={(e) => e.target.style.transform = 'scale(1.05)'}
              onMouseLeave={(e) => e.target.style.transform = 'scale(1)'}
            >
              <FiUserPlus size={16} style={{ marginRight: '8px' }} />
              Invite User
            </button>
            <div className="uk-text-small uk-text-muted">
              {statusFilter === 'all' ? `Showing all ${data.length} users` : 
               statusFilter === 'active' ? `Showing ${data.length} registered users` :
               statusFilter === 'pending' ? `Showing ${data.length} pending invitations` :
               `Showing ${data.length} deactivated users`}
            </div>
          </div>
          <DataTable
            columns={columns}
            data={data}
            defaultSortField="firstName"
            pagination
            paginationPerPage={20}
            dense
            striped
            responsive
          />
        </div>
      </div>
      <BottomBar />
      {popup && (
        <Popup
          onClose={(shouldUpdate) => {
            if (shouldUpdate) {
              refreshUserList();
            }
            setPopup(null);
          }}
          user={user}
          type={popup}
        />
      )}
    </div>
  );
}

export default Admin;