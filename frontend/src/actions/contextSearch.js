// frontend/src/actions/contextSearch.js
// Context-aware search actions

import {
  filterChatRooms,
  filterGroupRooms,
  filterFavorites,
  shouldPerformSearch,
} from "../utils/searchHelpers";
import search from "./search"; // Original search function

/**
 * Perform context-aware search based on current navigation
 * @param {string} query - Search query
 * @param {string} context - Search context (rooms, groups, favorites, search)
 * @param {Object} data - Data object containing rooms, favorites, currentUserId
 * @returns {Promise} Promise resolving to search results
 */
export const performContextSearch = (query, context, data) => {
  return new Promise((resolve, reject) => {
    try {
      // Check if search should be performed
      if (!shouldPerformSearch(query)) {
        resolve({ data: { results: [], context } });
        return;
      }

      let results = [];

      switch (context) {
        case "rooms":
          results = filterChatRooms(
            data.rooms || [],
            query,
            data.currentUserId
          );
          resolve({ data: { results, context } });
          break;

        case "groups":
          results = filterGroupRooms(data.rooms || [], query);
          resolve({ data: { results, context } });
          break;

        case "favorites":
          results = filterFavorites(
            data.favorites || [],
            query,
            data.currentUserId
          );
          resolve({ data: { results, context } });
          break;

        case "search":
        default:
          // Use original search for global users
          search(query)
            .then((response) => {
              resolve({
                data: {
                  results: response.data.users || [],
                  users: response.data.users || [], // Keep original structure
                  context: "search",
                },
              });
            })
            .catch(reject);
          break;
      }
    } catch (error) {
      console.error("Context search error:", error);
      reject(error);
    }
  });
};

/**
 * Clear context search results
 * @returns {Object} Clear search action
 */
export const clearContextSearch = () => {
  return { data: { results: [], context: null, users: [] } };
};

/**
 * Search within a specific room/group's messages (future enhancement)
 * @param {string} roomId - Room ID to search within
 * @param {string} query - Search query
 * @returns {Promise} Promise resolving to message search results
 */
export const searchWithinRoom = (roomId, query) => {
  return new Promise((resolve) => {
    // This would call a backend API to search messages within a specific room
    // For now, return empty results as this is a future enhancement
    resolve({ data: { messages: [], roomId, query } });
  });
};

/**
 * Get search suggestions based on context (future enhancement)
 * @param {string} context - Search context
 * @param {Object} data - Data for generating suggestions
 * @returns {Array} Array of search suggestions
 */
export const getSearchSuggestions = (context, data) => {
  const suggestions = [];

  switch (context) {
    case "rooms":
      // Get recent chat partners
      if (data.rooms) {
        const recentChats = data.rooms
          .filter((room) => !room.isGroup)
          .slice(0, 5)
          .map((room) => {
            const otherPerson = room.people?.find(
              (p) => p._id !== data.currentUserId
            );
            return otherPerson
              ? `${otherPerson.firstName} ${otherPerson.lastName}`.trim()
              : null;
          })
          .filter(Boolean);
        suggestions.push(...recentChats);
      }
      break;

    case "groups":
      // Get recent group names
      if (data.rooms) {
        const recentGroups = data.rooms
          .filter((room) => room.isGroup)
          .slice(0, 5)
          .map((room) => room.name)
          .filter(Boolean);
        suggestions.push(...recentGroups);
      }
      break;

    case "favorites":
      // Get favorite names
      if (data.favorites) {
        const favoriteNames = data.favorites
          .slice(0, 5)
          .map((room) => {
            if (room.isGroup) {
              return room.name;
            } else {
              const otherPerson = room.people?.find(
                (p) => p._id !== data.currentUserId
              );
              return otherPerson
                ? `${otherPerson.firstName} ${otherPerson.lastName}`.trim()
                : null;
            }
          })
          .filter(Boolean);
        suggestions.push(...favoriteNames);
      }
      break;

    default:
      break;
  }

  return suggestions.slice(0, 3); // Return top 3 suggestions
};

export default {
  performContextSearch,
  clearContextSearch,
  searchWithinRoom,
  getSearchSuggestions,
};
