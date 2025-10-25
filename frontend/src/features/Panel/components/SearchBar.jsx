// frontend/src/features/Panel/components/SearchBar.jsx
// Fixed SearchBar with proper group search and default user loading

import { useRef, useEffect, useCallback } from 'react';
import './SearchBar.sass';
import { FiSearch, FiX } from 'react-icons/fi';
import { useGlobal } from 'reactn';
import { useSelector } from 'react-redux';
import { performContextSearch } from '../../../actions/contextSearch';
import search from '../../../actions/search'; // Original search function

function SearchBar() {
  const searchInput = useRef();
  
  // Global state
  const [nav] = useGlobal('nav');
  const [user] = useGlobal('user');
  const [searchResults, setSearchResults] = useGlobal('searchResults', []);
  const [searchContext, setSearchContext] = useGlobal('searchContext', null);
  const [searchText, setSearch] = useGlobal('search', '');
  const [favorites] = useGlobal('favorites', []);
  
  // Redux state
  const rooms = useSelector((state) => state.io.rooms);

  // Simple debounce function
  const debounce = (func, wait) => {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  };

  // Load all users when on search tab with no query
  const loadAllUsers = useCallback(async () => {
    try {
      console.log("🔍 Loading all users for search tab");
      const result = await search(''); // Empty search to get all users
      setSearchResults(result.data.users || []);
      setSearchContext('search');
    } catch (error) {
      console.error('❌ Error loading users:', error);
      setSearchResults([]);
    }
  }, [setSearchResults, setSearchContext]);

  // Debounced search function
  const debouncedSearch = useCallback(
    debounce(async (query, context) => {
      console.log("🔍 SearchBar - Starting search:", { query, context });
      
      if (!query.trim()) {
        // If no query and we're on search tab, load all users
        if (context === 'search') {
          loadAllUsers();
          return;
        }
        clearSearch();
        return;
      }

      try {
        const searchData = {
          rooms: rooms || [],
          favorites: favorites || [],
          currentUserId: user?.id
        };

        console.log("🔍 SearchBar - Search data:", {
          roomsCount: searchData.rooms.length,
          groupsCount: searchData.rooms.filter(r => r.isGroup).length,
          favoritesCount: searchData.favorites.length,
          context,
          query
        });

        const result = await performContextSearch(query, context, searchData);
        
        console.log("🔍 SearchBar - Search result:", {
          context,
          resultCount: result.data.results?.length || result.data.users?.length,
          results: result.data.results || result.data.users
        });
        
        if (context === 'search') {
          setSearchResults(result.data.users || []);
        } else {
          setSearchResults(result.data.results || []);
        }
        
        setSearchContext(context);
      } catch (error) {
        console.error('❌ Search error:', error);
        setSearchResults([]);
        setSearchContext(null);
      }
    }, 300),
    [rooms, favorites, user?.id, setSearchResults, setSearchContext, loadAllUsers]
  );

  // Handle navigation changes
  useEffect(() => {
    console.log("🔍 SearchBar - Nav changed:", { nav, searchText });
    
    if (nav === 'search') {
      if (searchText) {
        // Search with query
        debouncedSearch(searchText, 'search');
      } else {
        // Load all users when switching to search tab with no query
        loadAllUsers();
      }
    } else if (searchText) {
      // Context search for other tabs
      debouncedSearch(searchText, nav);
    } else {
      // Clear search when switching tabs with no query
      clearSearch();
    }
  }, [nav, debouncedSearch, loadAllUsers, searchText]);

  const getSearchPlaceholder = (currentNav) => {
    switch(currentNav) {
      case 'rooms': return 'Search chats...';
      case 'groups': return 'Search groups...';
      case 'favorites': return 'Search favorites...';
      default: return 'Search users...';
    }
  };

  const handleSearch = (query) => {
    console.log("🔍 SearchBar - Handle search:", { query, nav });
    setSearch(query);
    
    const context = nav === 'search' ? 'search' : nav;
    
    if (!query.trim()) {
      if (context === 'search') {
        loadAllUsers();
      } else {
        clearSearch();
      }
      return;
    }

    debouncedSearch(query, context);
  };

  const clearSearch = () => {
    console.log("🔍 SearchBar - Clearing search");
    setSearch('');
    setSearchResults([]);
    setSearchContext(null);
    if (searchInput.current) {
      searchInput.current.value = '';
    }
  };

  const onChange = (e) => {
    const query = e.target.value;
    handleSearch(query);
  };

  const onClearClick = () => {
    clearSearch();
    searchInput.current?.focus();
    
    // If we're on search tab, reload all users
    if (nav === 'search') {
      loadAllUsers();
    }
  };

  const onSearchIconClick = () => {
    searchInput.current?.focus();
  };

  const onKeyDown = (e) => {
    if (e.key === 'Escape') {
      clearSearch();
      if (nav === 'search') {
        loadAllUsers();
      }
    }
  };

  return (
    <div className="search-bar uk-flex uk-flex-center uk-flex-middle">
      <div className="icon" onClick={onSearchIconClick}>
        <FiSearch />
      </div>
      <div className="uk-inline search">
        <input 
          className="uk-input uk-border-pill" 
          placeholder={getSearchPlaceholder(nav)}
          ref={searchInput} 
          onChange={onChange}
          onKeyDown={onKeyDown}
          defaultValue={searchText || ''}
          autoComplete="off"
          spellCheck="false"
        />
        {searchText && (
          <div className="clear-search" onClick={onClearClick} title="Clear search">
            <FiX />
          </div>
        )}
      </div>
    </div>
  );
}

export default SearchBar;