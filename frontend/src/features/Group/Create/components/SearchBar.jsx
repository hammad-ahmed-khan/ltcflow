import React, { useState, useEffect, useCallback } from 'react';
import { useGlobal } from 'reactn';
import { FiSearch, FiX } from 'react-icons/fi';
import search from '../../../../actions/search';
import { debounce } from 'lodash';

function SearchBar() {
  const [, setSearchResults] = useGlobal('searchResults');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);

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

      // ADD THIS DEBUG LOG:
      if (context === 'groups') {
        console.log("🔍 GROUPS DEBUG:", {
          allRooms: rooms,
          groupRooms: rooms?.filter(r => r.isGroup),
          groupDetails: rooms?.filter(r => r.isGroup)?.map(r => ({
            id: r._id,
            name: r.name,
            description: r.description,
            topic: r.topic,
            isGroup: r.isGroup
          })),
          searchQuery: query
        });
      }

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
  // Effect to trigger search when query changes
  useEffect(() => {
    debouncedSearch(searchQuery);
    
    // Cleanup function to cancel pending debounced calls
    return () => {
      debouncedSearch.cancel();
    };
  }, [searchQuery, debouncedSearch]);

  // Load initial results on mount
  useEffect(() => {
    search().then(res => {
      setSearchResults(res.data.users);
    }).catch(err => {
      console.error('Initial search error:', err);
    });
  }, [setSearchResults]);

  const handleSearchChange = (e) => {
    setSearchQuery(e.target.value);
  };

  const clearSearch = () => {
    setSearchQuery('');
  };

  return (
    <div className="search-bar">
      <div className="search-input-container">
        <FiSearch className="search-icon" size={16} />
        <input
          type="text"
          placeholder="Search for members to add..."
          value={searchQuery}
          onChange={handleSearchChange}
          className="search-input"
        />
        {searchQuery && (
          <button 
            onClick={clearSearch}
            className="clear-button"
            title="Clear search"
          >
            <FiX size={16} />
          </button>
        )}
        {isSearching && (
          <div className="search-spinner">
            <div className="spinner-icon"></div>
          </div>
        )}
      </div>
      
      {searchQuery && (
        <div className="search-info">
          Searching for "{searchQuery}"
        </div>
      )}
    </div>
  );
}

export default SearchBar;