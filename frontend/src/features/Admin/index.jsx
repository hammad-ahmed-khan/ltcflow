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
      'user': { backgroundColor: '#e3f2fd', color: '#1976d2' },
      'manager': { backgroundColor: '#e8f5e8', color: '#2e7d32' },
      'admin': { backgroundColor: '#fff3e0', color: '#f57c00' },
      'root': { backgroundColor: '#ffebee', color: '#c62828' }
    };
    return styles[level] || { backgroundColor: '#f5f5f5', color: '#666' };
  };

  // Handle user activation/deactivation
  const handleUserActivation = async (userData, action) => {
    try {
      setLoading(prev => ({ ...prev, [userData.id]: true }));
      
      const response = await apiClient.post('/api/user/status', {
        userId: userData.id,
        action: action // 'activate' or 'deactivate'
      });

      if (response.data.status === 'success') {
        addToast(`User ${action}d successfully`, { appearance: 'success' });
        refreshUserList();
      }
    } catch (error) {
      addToast(`Failed to ${action} user`, { appearance: 'error' });
    } finally {
      setLoading(prev => ({ ...prev, [userData.id]: false }));
    }
  };

  // Handle resend activation
  const handleResendActivation = async (userData) => {
    try {
      setLoading(prev => ({ ...prev, [userData.id]: true }));
      
      const response = await apiClient.post('/api/user/resend-activation', {
        userId: userData.id
      });

      if (response.data.status === 'success') {
        addToast('Activation email sent successfully', { appearance: 'success' });
      }
    } catch (error) {
      addToast('Failed to send activation email', { appearance: 'error' });
    } finally {
      setLoading(prev => ({ ...prev, [userData.id]: false }));
    }
  };

  // Handle cancel activation  
  const handleCancelActivation = async (userData) => {
    try {
      setLoading(prev => ({ ...prev, [userData.id]: true }));
      
      const response = await apiClient.post('/api/user/cancel-activation', {
        userId: userData.id
      });

      if (response.data.status === 'success') {
        addToast('User invitation cancelled', { appearance: 'success' });
        refreshUserList();
      }
    } catch (error) {
      addToast('Failed to cancel invitation', { appearance: 'error' });
    } finally {
      setLoading(prev => ({ ...prev, [userData.id]: false }));
    }
  };

  const columns = [
    {
      name: 'Name',
      selector: row => `${row.firstName} ${row.lastName}`,
      sortable: true,
      cell: row => (
        <div style={{ display: 'flex', flexDirection: 'column', padding: '8px 0' }}>
          <span style={{ fontWeight: 'bold', marginBottom: '2px' }}>
            {row.firstName} {row.lastName}
          </span>
          <span style={{ fontSize: '12px', color: '#666' }}>
            @{row.username}
          </span>
        </div>
      ),
    },
    {
      name: 'Email',
      selector: row => row.email,
      sortable: true,
      cell: row => (
        <div style={{ fontSize: '13px' }}>
          {row.email}
        </div>
      ),
    },
    {
      name: 'Role',
      selector: row => row.level,
      sortable: true,
      cell: row => {
        const roleInfo = formatUserRole(row.level);
        const badgeStyle = getRoleBadgeStyle(row.level);
        return (
          <span
            style={{
              ...badgeStyle,
              padding: '4px 8px',
              borderRadius: '12px',
              fontSize: '11px',
              fontWeight: 'bold',
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}
            title={roleInfo.tooltip}
          >
            {roleInfo.label}
          </span>
        );
      },
    },
    {
      name: 'Status',
      selector: row => row.status,
      sortable: true,
      cell: row => {
        const statusStyles = {
          'active': { backgroundColor: '#e8f5e8', color: '#2e7d32', icon: FiUserCheck },
          'pending': { backgroundColor: '#fff3e0', color: '#f57c00', icon: FiClock },
          'expired': { backgroundColor: '#ffebee', color: '#c62828', icon: FiUserX },
          'deactivated': { backgroundColor: '#f5f5f5', color: '#666', icon: FiUserX }
        };
        
        const style = statusStyles[row.status] || statusStyles.deactivated;
        const IconComponent = style.icon;
        
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <IconComponent size={14} color={style.color} />
            <span
              style={{
                ...style,
                padding: '4px 8px',
                borderRadius: '12px',
                fontSize: '11px',
                fontWeight: 'bold',
                textTransform: 'capitalize'
              }}
            >
              {row.status}
            </span>
          </div>
        );
      },
    },
    {
      name: 'Actions',
      cell: row => (
        <div className="data-actions" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {/* Show different actions based on status */}
          {row.status === 'pending' && (
            <>
              <a
                onClick={() => handleResendActivation(row)}
                style={{
                  color: '#2e7d32',
                  cursor: 'pointer',
                  fontSize: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '4px 8px',
                  borderRadius: '4px',
                  backgroundColor: '#e8f5e8',
                  border: 'none',
                  textDecoration: 'none'
                }}
                title="Resend activation email"
              >
                <FiMail size={12} />
                Resend
              </a>
              <a
                onClick={() => handleCancelActivation(row)}
                style={{
                  color: '#c62828',
                  cursor: 'pointer',
                  fontSize: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '4px 8px',
                  borderRadius: '4px',
                  backgroundColor: '#ffebee',
                  border: 'none',
                  textDecoration: 'none'
                }}
                title="Cancel activation"
              >
                <FiX size={12} />
                Cancel
              </a>
            </>
          )}
          
          {row.status === 'active' && (
            <a
              onClick={() => handleUserActivation(row, 'deactivate')}
              style={{
                color: '#f57c00',
                cursor: 'pointer',
                fontSize: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '4px 8px',
                borderRadius: '4px',
                backgroundColor: '#fff3e0',
                border: 'none',
                textDecoration: 'none'
              }}
              title="Deactivate user"
            >
              <FiToggleLeft size={12} />
              Deactivate
            </a>
          )}
          
          {row.status === 'deactivated' && (
            <a
              onClick={() => handleUserActivation(row, 'activate')}
              style={{
                color: '#2e7d32',
                cursor: 'pointer',
                fontSize: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '4px 8px',
                borderRadius: '4px',
                backgroundColor: '#e8f5e8',
                border: 'none',
                textDecoration: 'none'
              }}
              title="Activate user"
            >
              <FiToggleRight size={12} />
              Activate
            </a>
          )}

          {/* Edit button - always show */}
          <a
            onClick={() => {
              setUser(row);
              setPopup('edit');
            }}
            style={{
              color: '#1976d2',
              cursor: 'pointer',
              fontSize: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '4px 8px',
              borderRadius: '4px',
              backgroundColor: '#e3f2fd',
              border: 'none',
              textDecoration: 'none'
            }}
            title="Edit user details"
          >
            Edit
          </a>

          {/* Delete button - always show */}
          <a
            onClick={() => {
              setUser(row);
              setPopup('delete');
            }}
            style={{
              color: '#c62828',
              cursor: 'pointer',
              fontSize: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '4px 8px',
              borderRadius: '4px',
              backgroundColor: '#ffebee',
              border: 'none',
              textDecoration: 'none'
            }}
            title="Delete user permanently"
          >
            Delete
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

  // Calculate user statistics for analytics - FIXED COUNTS
  const getUserStatistics = () => {
    const totalUsers = users.length;
    const activeUsers = users.filter(u => u.status === 'active').length;
    const pendingUsers = users.filter(u => u.status === 'pending').length;
    const expiredUsers = users.filter(u => u.status === 'expired').length;
    const deactivatedUsers = users.filter(u => u.status === 'deactivated').length;

    return {
      total: totalUsers,
      active: activeUsers,
      pending: pendingUsers,
      expired: expiredUsers,
      deactivated: deactivatedUsers
    };
  };

  const stats = getUserStatistics();

  return (
    <div className="admin">
      <TopBar back={back} />
      <div className="data-table">
        <div className="data-create">
          <button
            className="uk-button uk-button-honey"
            onClick={() => setPopup('create')}
          >
            <FiUserPlus style={{ marginRight: '8px' }} />
            Invite User
          </button>
        </div>

        {/* Status filter tabs with FIXED STYLING */}
        <div style={{ 
          display: 'flex', 
          borderBottom: '2px solid #e0e0e0', 
          marginBottom: '20px',
          backgroundColor: '#f8f9fa'
        }}>
          {[
            { key: 'all', label: 'All Users', count: stats.total },
            { key: 'active', label: 'Active', count: stats.active },
            { key: 'pending', label: 'Pending', count: stats.pending },
            { key: 'expired', label: 'Expired', count: stats.expired },
            { key: 'deactivated', label: 'Deactivated', count: stats.deactivated }
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setStatusFilter(tab.key)}
              style={{
                padding: '12px 20px',
                border: 'none',
                borderBottom: statusFilter === tab.key ? '3px solid #1976d2' : '3px solid transparent',
                // FIXED: Selected tab styling
                backgroundColor: statusFilter === tab.key ? '#ffffff' : 'transparent',
                color: statusFilter === tab.key ? '#1976d2' : '#666',
                fontWeight: statusFilter === tab.key ? 'bold' : 'normal',
                cursor: 'pointer',
                fontSize: '14px',
                transition: 'all 0.2s ease'
              }}
            >
              {tab.label} ({tab.count})
            </button>
          ))}
        </div>

        {/* Search bar */}
        <div className="search-bar" style={{ marginBottom: '20px' }}>
          <div style={{ position: 'relative', maxWidth: '400px' }}>
            <FiSearch 
              style={{ 
                position: 'absolute', 
                left: '12px', 
                top: '50%', 
                transform: 'translateY(-50%)', 
                color: '#666' 
              }} 
            />
            <input
              ref={searchInput}
              type="text"
              placeholder="Search users..."
              value={searchText}
              onChange={onChange}
              style={{
                width: '100%',
                padding: '10px 10px 10px 40px',
                border: '1px solid #ddd',
                borderRadius: '6px',
                fontSize: '14px'
              }}
            />
          </div>
        </div>

        {/* User statistics summary */}
        <div style={{ 
          marginBottom: '20px', 
          padding: '15px', 
          backgroundColor: '#f8f9fa', 
          borderRadius: '6px',
          border: '1px solid #e9ecef'
        }}>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center' 
          }}>
            <div>
              <span style={{ fontWeight: 'bold', fontSize: '16px' }}>
                {statusFilter === 'all' ? 
                 `Showing all ${data.length} users` : 
                 statusFilter === 'active' ? `Showing ${data.length} active users` :
                 statusFilter === 'pending' ? `Showing ${data.length} pending users` :
                 statusFilter === 'expired' ? `Showing ${data.length} expired invitations` :
                 `Showing ${data.length} deactivated users`}
              </span>
            </div>
            <button
              onClick={refreshUserList}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 12px',
                border: '1px solid #ddd',
                borderRadius: '4px',
                backgroundColor: '#fff',
                cursor: 'pointer',
                fontSize: '12px'
              }}
            >
              <FiRefreshCw size={12} />
              Refresh
            </button>
          </div>
        </div>

        {/* Data table */}
        <div style={{ backgroundColor: '#fff', borderRadius: '6px', overflow: 'hidden' }}>
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