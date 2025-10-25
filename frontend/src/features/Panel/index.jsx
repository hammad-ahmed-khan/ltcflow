// frontend/src/features/Panel/index.jsx
// Enhanced Panel with proper search context handling

import { useEffect } from 'react';
import { useGlobal } from 'reactn';
import './Panel.sass';
import { useDispatch, useSelector } from 'react-redux';
import { useLocation } from 'react-router-dom';
import TopBar from './components/TopBar';
import SearchBar from './components/SearchBar';
import NavBar from './components/NavBar';
import MeetingBar from './components/MeetingBar';
import Room from './components/Room';
import User from './components/User';
import GroupList from './components/GroupList';
import getRooms from '../../actions/getRooms';
import search from '../../actions/search';
import getFavorites from '../../actions/getFavorites';
import Actions from '../../constants/Actions';
import Settings from './components/Settings';

function Panel() {
  const nav = useGlobal('nav')[0];
  const rooms = useSelector((state) => state.io.rooms);
  const roomsWithNewMessages = useSelector((state) => state.messages.roomsWithNewMessages);
  const groupsWithNewMessages = useSelector((state) => state.messages.groupsWithNewMessages);
  const [favorites, setFavorites] = useGlobal('favorites', []);
  const [callStatus] = useGlobal('callStatus');
  const [over] = useGlobal('over');
  
  // Search state
  const [searchText] = useGlobal('search', '');
  const [searchResults, setSearchResults] = useGlobal('searchResults', []);
  const [searchContext] = useGlobal('searchContext', null);

  const dispatch = useDispatch();
  const location = useLocation();

  useEffect(() => {
    getRooms()
      .then((res) => dispatch({ type: Actions.SET_ROOMS, rooms: res.data.rooms }))
      .catch((err) => console.log(err));
    
    // Load all users initially for search tab
    search('')
      .then((res) => {
        // Only set if searchResults is empty
        if (!searchResults || searchResults.length === 0) {
          setSearchResults(res.data.users || []);
        }
      })
      .catch((err) => console.log(err));
      
    getFavorites()
      .then((res) => setFavorites(res.data.favorites))
      .catch((err) => console.log(err));
  }, []);

  // Helper function for empty search messages
  const getEmptySearchMessage = (context, query) => {
    const contextName = context === 'rooms' ? 'chats' : 
                       context === 'groups' ? 'groups' : 
                       context === 'favorites' ? 'favorites' : 'users';
    return `No ${contextName} found for "${query}"`;
  };

  // Room lists
  const roomsList = rooms
    .filter(room => !room.isGroup)
    .map((room) => (
      <Room 
        key={`${room._id}-${roomsWithNewMessages.includes(room._id) ? 'unread' : 'read'}`}
        room={room} 
      />
    ));
    
  const searchResultsList = searchResults.map((user) => <User key={user._id} user={user} />);
  const favoritesList = favorites.map((room) => <Room key={room._id} room={room} />);

  // Context search results rendering
  const renderContextSearchResults = () => {
    if (!searchResults) return null;
    
    switch(searchContext) {
      case 'rooms':
      case 'groups':  
      case 'favorites':
        return searchResults.map((room) => (
          <Room 
            key={`search-${room._id}`} 
            room={room} 
            isSearchResult={true}
          />
        ));
      case 'search':
      default:
        return searchResults.map((user) => <User key={user._id} user={user} />);
    }
  };

  // Search state detection
  const isContextSearchActive = searchContext && searchContext !== 'search';
  const isSearchTabActive = nav === 'search';

  function Notice({ text }) {
    return <div className="notice">{text}</div>;
  }

  console.log("Panel Debug:", {
    nav,
    searchText,
    searchContext,
    searchResultsCount: searchResults?.length,
    isContextSearchActive,
    isSearchTabActive,
    roomsCount: rooms?.length,
    groupsCount: rooms?.filter(r => r.isGroup)?.length
  });

  return (
    <div className="panel">
      <TopBar />
      <SearchBar />
      <NavBar />
      {callStatus === 'in-call' && (!location.pathname.startsWith('/meeting') || over === false) && <MeetingBar />}
      <div className="rooms">
        
        {/* ROOMS TAB */}
        {nav === 'rooms' && (
          <>
            {isContextSearchActive && searchContext === 'rooms' ? (
              <>
                {renderContextSearchResults()}
                {searchResults.length === 0 && searchText && (
                  <Notice text={getEmptySearchMessage('rooms', searchText)} />
                )}
              </>
            ) : (
              <>
                {roomsList}
                {rooms.filter(r => !r.isGroup).length === 0 && (
                  <Notice text="No direct conversations yet. Search for someone to start chatting!" />
                )}
              </>
            )}
          </>
        )}

        {/* SEARCH TAB */}
        {nav === 'search' && (
          <>
            {searchResultsList}
            {searchResults.length === 0 && searchText && (
              <Notice text={`No search results for "${searchText}"`} />
            )}
            {searchResults.length === 0 && !searchText && (
              <Notice text="Loading users..." />
            )}
          </>
        )}

        {/* FAVORITES TAB */}
        {nav === 'favorites' && (
          <>
            {isContextSearchActive && searchContext === 'favorites' ? (
              <>
                {renderContextSearchResults()}
                {searchResults.length === 0 && searchText && (
                  <Notice text={getEmptySearchMessage('favorites', searchText)} />
                )}
              </>
            ) : (
              <>
                {favoritesList}
                {favorites.length === 0 && (
                  <Notice text="No favorites yet. Add a room to your favorites!" />
                )}
              </>
            )}
          </>
        )}

        {/* GROUPS TAB */}
        {nav === 'groups' && (
          <>
            {isContextSearchActive && searchContext === 'groups' ? (
              <>
                {renderContextSearchResults()}
                {searchResults.length === 0 && searchText && (
                  <Notice text={getEmptySearchMessage('groups', searchText)} />
                )}
              </>
            ) : (
              <GroupList />
            )}
          </>
        )}

        {nav === 'settings' && <Settings />}
      </div>
    </div>
  );
}

export default Panel;