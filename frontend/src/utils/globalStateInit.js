// frontend/src/utils/globalStateInit.js
// Global state initialization for context-aware search

import { setGlobal } from "reactn";

/**
 * Initialize global state variables needed for context-aware search
 * Call this in your main index.js or App.js file
 */
export const initializeSearchGlobalState = () => {
  // Get existing global state to avoid overriding
  const existingGlobal = global.global || {};

  setGlobal({
    ...existingGlobal,
    // Search-related state
    searchContext: null, // Track which context search is active in ('rooms', 'groups', 'favorites', 'search')
    searchResults: [], // Search results array
    search: "", // Current search query

    // Ensure these exist if they don't already
    nav: existingGlobal.nav || "rooms", // Current navigation state
    user: existingGlobal.user || null, // Current user object
    favorites: existingGlobal.favorites || [], // Favorites array

    // UI state
    showRoomInfo: existingGlobal.showRoomInfo || false,

    // Optional: Search preferences (future enhancement)
    searchPreferences: {
      highlightResults: true,
      clearSearchOnSelect: false,
      searchHistoryEnabled: true,
      maxSearchHistory: 10,
    },
  });
};

/**
 * Clear search state
 */
export const clearSearchState = () => {
  setGlobal({
    searchContext: null,
    searchResults: [],
    search: "",
  });
};

/**
 * Update search context
 * @param {string} context - New search context
 */
export const updateSearchContext = (context) => {
  setGlobal({
    searchContext: context,
  });
};

/**
 * Update search results
 * @param {Array} results - New search results
 * @param {string} context - Search context
 */
export const updateSearchResults = (results, context) => {
  setGlobal({
    searchResults: results,
    searchContext: context,
  });
};

/**
 * Get current search state
 * @returns {Object} Current search state
 */
export const getCurrentSearchState = () => {
  return {
    searchContext: global.global?.searchContext || null,
    searchResults: global.global?.searchResults || [],
    search: global.global?.search || "",
    nav: global.global?.nav || "rooms",
  };
};

export default {
  initializeSearchGlobalState,
  clearSearchState,
  updateSearchContext,
  updateSearchResults,
  getCurrentSearchState,
};
