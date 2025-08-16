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

  // Toggle user status
  const toggleUserStatus = async (userId, currentStatus, username) => {
    let newStatus;
    switch (currentStatus) {
      case 'pending':
      case 'expired':
        newStatus = 'active';
        break;
      case 'active':
        newStatus = 'deactivated';
        break;
      case 'deactivated':
        newStatus = 'active';
        break;
      default:
        newStatus = 'active';
    }
    
    setLoading(prev => ({...prev, [`toggle_${userId}`]: true}));
    try {
      const response = await apiClient.post('/api/toggle-user-status', { 
        userId, 
        newStatus 
      });
      addToast(`User ${username} status changed to ${newStatus}`, {
        appearance: 'success',
        autoDismiss: true,
      });
      refreshUserList();
    } catch (error) {
      addToast(`Failed to update user status`, {
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
        icon: FiUserCheck,
        bgColor: '#e8f5e8',
        textColor: '#2e7d2e',
        borderColor: '#a3d977',
        label: 'Active',
        timestamp: getTimeAgo(updatedAt)
      },
      'pending': {
        icon: FiClock,
        bgColor: '#fff3e0',
        textColor: '#f57c00',
        borderColor: '#ffcc02',
        label: 'Pending',
        timestamp: getTimeAgo(createdAt)
      },
      'expired': {
        icon: FiUserX,
        bgColor: '#ffebee',
        textColor: '#c62828',
        borderColor: '#ef9a9a',
        label: 'Expired',
        timestamp: getTimeAgo(tokenExpiry)
      },
      'deactivated': {
        icon: FiUserX,
        bgColor: '#f5f5f5',
        textColor: '#666',
        borderColor: '#ddd',
        label: 'Deactivated',
        timestamp: getTimeAgo(updatedAt)
      }
    };

    const config = statusConfig[status] || statusConfig['pending'];
    const IconComponent = config.icon;
    
    return (
      <div className="uk-flex uk-flex-column uk-flex-center">
        <span style={{
          backgroundColor: config.bgColor,
          color: config.textColor,
          border: `1px solid ${config.borderColor}`,
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
              cursor: 'help'
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
            <div style={{ fontSize: '11px', color: row.tokenExpiry && new Date() > new Date(row.tokenExpiry) ? '#c62828' : '#f57c00' }}>
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
        const canResend = ['pending', 'expired'].includes(row.status);
        
        const getActionButton = () => {
          switch (row.status) {
            case 'pending':
            case 'expired':
              return {
                text: 'Activate User',
                className: 'uk-button-success',
                title: 'Manually activate this user account'
              };
            case 'active':
              return {
                text: 'Deactivate User',
                className: 'uk-button-danger',
                title: 'Deactivate this user account'
              };
            case 'deactivated':
              return {
                text: 'Reactivate User',
                className: 'uk-button-success',
                title: 'Reactivate this user account'
              };
            default:
              return {
                text: 'Activate User',
                className: 'uk-button-success',
                title: 'Activate this user account'
              };
          }
        };

        const actionButton = getActionButton();
        
        return (
          <div className="uk-flex uk-flex-column uk-flex-center" style={{ gap: '4px' }}>
            <div className="uk-flex" style={{ gap: '4px' }}>
              {canResend && (
                <button
                  className="uk-button uk-button-small uk-button-primary"
                  style={{ 
                    fontSize: '10px', 
                    padding: '4px 8px',
                    transition: 'all 0.2s ease'
                  }}
                  onClick={() => resendInvitation(row.id, row.email)}
                  disabled={loading[`resend_${row.id}`]}
                  title="Resend invitation email to this user"
                  onMouseEnter={(e) => e.target.style.transform = 'scale(1.05)'}
                  onMouseLeave={(e) => e.target.style.transform = 'scale(1)'}
                >
                  {loading[`resend_${row.id}`] ? (
                    <div data-uk-spinner="ratio: 0.5" />
                  ) : (
                    <>
                      <FiMail size={12} style={{ marginRight: '4px' }} />
                      Resend Invite
                    </>
                  )}
                </button>
              )}
              
              <button
                className={`uk-button uk-button-small ${actionButton.className}`}
                style={{ 
                  fontSize: '10px', 
                  padding: '4px 8px',
                  transition: 'all 0.2s ease'
                }}
                onClick={() => toggleUserStatus(row.id, row.status, row.username)}
                disabled={loading[`toggle_${row.id}`]}
                title={actionButton.title}
                onMouseEnter={(e) => e.target.style.transform = 'scale(1.05)'}
                onMouseLeave={(e) => e.target.style.transform = 'scale(1)'}
              >
                {loading[`toggle_${row.id}`] ? (
                  <div data-uk-spinner="ratio: 0.5" />
                ) : (
                  <>
                    {row.status === 'active' ? (
                      <FiToggleRight size={12} style={{ marginRight: '4px' }} />
                    ) : (
                      <FiToggleLeft size={12} style={{ marginRight: '4px' }} />
                    )}
                    {actionButton.text}
                  </>
                )}
              </button>
            </div>
          </div>
        );
      },
    },
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
              borderRadius: '4px'
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
              borderRadius: '4px'
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
      status: user.status,
      tokenExpiry: user.tokenExpiry,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    }));

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
        return allUsers;
    }
  };

  const data = getFilteredUsers();

  // Calculate user statistics for analytics
  const getUserStatistics = () => {
    const totalUsers = users.length;
    const activeUsers = users.filter(u => u.status === 'active').length;
    const pendingUsers = users.filter(u => u.status === 'pending').length;
    const expiredUsers = users.filter(u => u.status === 'expired').length;
    const deactivatedUsers = users.filter(u => u.status === 'deactivated').length;
    
    return { totalUsers, activeUsers, pendingUsers, expiredUsers, deactivatedUsers };
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
              title="Show only users who have completed registration"
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
              title="Show users with pending invitations"
              style={{ 
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                color: statusFilter === 'pending' ? '#333' : 'inherit',
                whiteSpace: 'nowrap'
              }}
              onMouseEnter={(e) => !e.target.closest('li').classList.contains('uk-active') && (e.target.style.backgroundColor = '#f8f8f8')}
              onMouseLeave={(e) => !e.target.closest('li').classList.contains('uk-active') && (e.target.style.backgroundColor = '')}
            >
              Pending
              <span style={{
                backgroundColor: statusFilter === 'pending' ? '#cc5500' : '#f57c00',
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
          <li className={statusFilter === 'expired' ? 'uk-active' : ''}>
            <a 
              onClick={() => setStatusFilter('expired')}
              title="Show users with expired invitations"
              style={{ 
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                color: statusFilter === 'expired' ? '#333' : 'inherit',
                whiteSpace: 'nowrap'
              }}
              onMouseEnter={(e) => !e.target.closest('li').classList.contains('uk-active') && (e.target.style.backgroundColor = '#f8f8f8')}
              onMouseLeave={(e) => !e.target.closest('li').classList.contains('uk-active') && (e.target.style.backgroundColor = '')}
            >
              Expired
              <span style={{
                backgroundColor: statusFilter === 'expired' ? '#8b1a1a' : '#c62828',
                color: 'white',
                padding: '2px 6px',
                borderRadius: '10px',
                fontSize: '11px',
                fontWeight: '500',
                minWidth: '20px',
                textAlign: 'center'
              }}>
                {stats.expiredUsers}
              </span>
            </a>
          </li>
          <li className={statusFilter === 'deactivated' ? 'uk-active' : ''}>
            <a 
              onClick={() => setStatusFilter('deactivated')}
              title="Show deactivated users"
              style={{ 
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                color: statusFilter === 'deactivated' ? '#333' : 'inherit',
                whiteSpace: 'nowrap'
              }}
              onMouseEnter={(e) => !e.target.closest('li').classList.contains('uk-active') && (e.target.style.backgroundColor = '#f8f8f8')}
              onMouseLeave={(e) => !e.target.closest('li').classList.contains('uk-active') && (e.target.style.backgroundColor = '')}
            >
              Deactivated
              <span style={{
                backgroundColor: statusFilter === 'deactivated' ? '#666' : '#999',
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
               statusFilter === 'active' ? `Showing ${data.length} active users` :
               statusFilter === 'pending' ? `Showing ${data.length} pending users` :
               statusFilter === 'expired' ? `Showing ${data.length} expired invitations` :
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