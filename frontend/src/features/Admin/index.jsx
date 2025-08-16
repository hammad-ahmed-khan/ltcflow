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
    const { isActive, tokenExpiry, createdAt } = user;
    
    if (isActive) {
      return (
        <div className="uk-flex uk-flex-column uk-flex-center">
          <span style={{
            backgroundColor: '#e8f5e8',
            color: '#2e7d2e',
            border: '1px solid #a3d977',
            padding: '4px 8px',
            borderRadius: '12px',
            fontSize: '12px',
            fontWeight: '500',
            display: 'flex',
            alignItems: 'center',
            gap: '4px'
          }}>
            <FiUserCheck size={12} />
            Registered
          </span>
          <span style={{ fontSize: '10px', color: '#666', marginTop: '2px' }}>
            {getTimeAgo(user.updatedAt)}
          </span>
        </div>
      );
    } else {
      const isExpired = tokenExpiry && new Date() > new Date(tokenExpiry);
      return (
        <div className="uk-flex uk-flex-column uk-flex-center">
          <span style={{
            backgroundColor: isExpired ? '#ffebee' : '#fff3e0',
            color: isExpired ? '#c62828' : '#f57c00',
            border: `1px solid ${isExpired ? '#ef9a9a' : '#ffcc02'}`,
            padding: '4px 8px',
            borderRadius: '12px',
            fontSize: '12px',
            fontWeight: '500',
            display: 'flex',
            alignItems: 'center',
            gap: '4px'
          }}>
            {isExpired ? <FiUserX size={12} /> : <FiClock size={12} />}
            {isExpired ? 'Expired' : 'Invited'}
          </span>
          <span style={{ fontSize: '10px', color: '#666', marginTop: '2px' }}>
            {isExpired ? getTimeAgo(tokenExpiry) : getTimeAgo(createdAt)}
          </span>
        </div>
      );
    }
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
        const isPending = !row.isActive;
        const isExpired = row.tokenExpiry && new Date() > new Date(row.tokenExpiry);
        
        return (
          <div className="uk-flex uk-flex-column uk-flex-center" style={{ gap: '4px' }}>
            <div className="uk-flex" style={{ gap: '4px' }}>
              {isPending && !isExpired && (
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
                className={`uk-button uk-button-small ${
                  isPending ? 'uk-button-danger' : (row.isActive ? 'uk-button-danger' : 'uk-button-success')
                }`}
                style={{ 
                  fontSize: '10px', 
                  padding: '4px 8px',
                  transition: 'all 0.2s ease'
                }}
                onClick={() => toggleUserStatus(row.id, row.isActive, row.username, isPending)}
                disabled={loading[`toggle_${row.id}`]}
                title={
                  isPending ? 'Cancel this user\'s pending invitation' : 
                  row.isActive ? 'Deactivate this user\'s account access' : 'Activate this user\'s account access'
                }
                onMouseEnter={(e) => e.target.style.transform = 'scale(1.05)'}
                onMouseLeave={(e) => e.target.style.transform = 'scale(1)'}
              >
                {loading[`toggle_${row.id}`] ? (
                  <div data-uk-spinner="ratio: 0.5" />
                ) : (
                  <>
                    {isPending ? (
                      <>
                        <FiX size={12} style={{ marginRight: '4px' }} />
                        Cancel Invitation
                      </>
                    ) : (
                      <>
                        {row.isActive ? (
                          <>
                            <FiToggleRight size={12} style={{ marginRight: '4px' }} />
                            Deactivate User
                          </>
                        ) : (
                          <>
                            <FiToggleLeft size={12} style={{ marginRight: '4px' }} />
                            Activate User
                          </>
                        )}
                      </>
                    )}
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
      isActive: user.isActive,
      tokenExpiry: user.tokenExpiry,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    }));

    switch (statusFilter) {
      case 'active':
        return allUsers.filter(user => user.isActive);
      case 'pending':
        return allUsers.filter(user => 
          !user.isActive && (!user.tokenExpiry || new Date() <= new Date(user.tokenExpiry))
        );
      case 'deactivated':
        return allUsers.filter(user => 
          !user.isActive && user.tokenExpiry && new Date() > new Date(user.tokenExpiry)
        );
      default:
        return allUsers;
    }
  };

  const data = getFilteredUsers();

  // Calculate user statistics for analytics
  const getUserStatistics = () => {
    const totalUsers = users.length;
    const activeUsers = users.filter(u => u.isActive).length;
    const pendingInvites = users.filter(u => 
      !u.isActive && (!u.tokenExpiry || new Date() <= new Date(u.tokenExpiry))
    ).length;
    const expiredInvites = users.filter(u => 
      !u.isActive && u.tokenExpiry && new Date() > new Date(u.tokenExpiry)
    ).length;
    
    return { totalUsers, activeUsers, pendingInvites, expiredInvites };
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

      {/* Analytics Summary Card */}
      <div className="uk-container uk-container-small uk-margin-small">
        <div className="uk-card uk-card-default uk-card-small uk-border-rounded" style={{ 
          backgroundColor: '#fafafa',
          border: '1px solid #e5e5e5'
        }}>
          <div className="uk-card-body uk-padding-small">
            <div className="uk-grid-small uk-child-width-1-4@m uk-child-width-1-2@s uk-text-center" data-uk-grid>
              <div>
                <div className="uk-flex uk-flex-column uk-flex-center">
                  <div style={{ 
                    fontSize: '24px', 
                    fontWeight: 'bold', 
                    color: '#666',
                    lineHeight: '1'
                  }}>
                    {stats.totalUsers}
                  </div>
                  <div style={{ 
                    fontSize: '12px', 
                    color: '#999',
                    marginTop: '2px'
                  }}>
                    Total Users
                  </div>
                </div>
              </div>
              <div>
                <div className="uk-flex uk-flex-column uk-flex-center">
                  <div style={{ 
                    fontSize: '24px', 
                    fontWeight: 'bold', 
                    color: '#2e7d2e',
                    lineHeight: '1'
                  }}>
                    {stats.activeUsers}
                  </div>
                  <div style={{ 
                    fontSize: '12px', 
                    color: '#999',
                    marginTop: '2px'
                  }}>
                    Registered
                  </div>
                </div>
              </div>
              <div>
                <div className="uk-flex uk-flex-column uk-flex-center">
                  <div style={{ 
                    fontSize: '24px', 
                    fontWeight: 'bold', 
                    color: '#f57c00',
                    lineHeight: '1'
                  }}>
                    {stats.pendingInvites}
                  </div>
                  <div style={{ 
                    fontSize: '12px', 
                    color: '#999',
                    marginTop: '2px'
                  }}>
                    Pending Invites
                  </div>
                </div>
              </div>
              <div>
                <div className="uk-flex uk-flex-column uk-flex-center">
                  <div style={{ 
                    fontSize: '24px', 
                    fontWeight: 'bold', 
                    color: '#c62828',
                    lineHeight: '1'
                  }}>
                    {stats.expiredInvites}
                  </div>
                  <div style={{ 
                    fontSize: '12px', 
                    color: '#999',
                    marginTop: '2px'
                  }}>
                    Expired Invites
                  </div>
                </div>
              </div>
            </div>
            
            {/* Quick Stats Bar */}
            <div className="uk-margin-small-top">
              <div style={{ 
                height: '6px', 
                backgroundColor: '#e5e5e5', 
                borderRadius: '3px',
                overflow: 'hidden',
                display: 'flex'
              }}>
                {stats.totalUsers > 0 && (
                  <>
                    <div style={{ 
                      width: `${(stats.activeUsers / stats.totalUsers) * 100}%`,
                      backgroundColor: '#2e7d2e'
                    }} title={`${((stats.activeUsers / stats.totalUsers) * 100).toFixed(1)}% Registered`} />
                    <div style={{ 
                      width: `${(stats.pendingInvites / stats.totalUsers) * 100}%`,
                      backgroundColor: '#f57c00'
                    }} title={`${((stats.pendingInvites / stats.totalUsers) * 100).toFixed(1)}% Pending`} />
                    <div style={{ 
                      width: `${(stats.expiredInvites / stats.totalUsers) * 100}%`,
                      backgroundColor: '#c62828'
                    }} title={`${((stats.expiredInvites / stats.totalUsers) * 100).toFixed(1)}% Expired`} />
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Status Filter Tabs */}
      <div className="uk-flex uk-flex-center uk-margin-small">
        <div className="uk-subnav uk-subnav-pill" data-uk-subnav>
          <li className={statusFilter === 'all' ? 'uk-active' : ''}>
            <a 
              onClick={() => setStatusFilter('all')}
              title="Show all users regardless of status"
              style={{ 
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => !e.target.closest('li').classList.contains('uk-active') && (e.target.style.backgroundColor = '#f8f8f8')}
              onMouseLeave={(e) => !e.target.closest('li').classList.contains('uk-active') && (e.target.style.backgroundColor = '')}
            >
              All Users
            </a>
          </li>
          <li className={statusFilter === 'active' ? 'uk-active' : ''}>
            <a 
              onClick={() => setStatusFilter('active')}
              title="Show only users who have completed registration"
              style={{ 
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => !e.target.closest('li').classList.contains('uk-active') && (e.target.style.backgroundColor = '#f8f8f8')}
              onMouseLeave={(e) => !e.target.closest('li').classList.contains('uk-active') && (e.target.style.backgroundColor = '')}
            >
              Registered
            </a>
          </li>
          <li className={statusFilter === 'pending' ? 'uk-active' : ''}>
            <a 
              onClick={() => setStatusFilter('pending')}
              title="Show users with pending invitations awaiting activation"
              style={{ 
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => !e.target.closest('li').classList.contains('uk-active') && (e.target.style.backgroundColor = '#f8f8f8')}
              onMouseLeave={(e) => !e.target.closest('li').classList.contains('uk-active') && (e.target.style.backgroundColor = '')}
            >
              Pending Invitations
            </a>
          </li>
          <li className={statusFilter === 'deactivated' ? 'uk-active' : ''}>
            <a 
              onClick={() => setStatusFilter('deactivated')}
              title="Show deactivated users and expired invitations"
              style={{ 
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => !e.target.closest('li').classList.contains('uk-active') && (e.target.style.backgroundColor = '#f8f8f8')}
              onMouseLeave={(e) => !e.target.closest('li').classList.contains('uk-active') && (e.target.style.backgroundColor = '')}
            >
              Deactivated
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