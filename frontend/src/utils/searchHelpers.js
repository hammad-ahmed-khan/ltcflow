// frontend/src/utils/searchHelpers.js
// Search helper utilities for context-aware search

/**
 * Filter chat rooms (non-group rooms) based on search query
 * @param {Array} rooms - All rooms array
 * @param {string} query - Search query
 * @param {string} currentUserId - Current user's ID
 * @returns {Array} Filtered chat rooms
 */
export const filterChatRooms = (rooms, query, currentUserId) => {
  if (!query.trim()) return [];

  const chatRooms = rooms.filter((room) => !room.isGroup);
  const searchQuery = query.toLowerCase();

  return chatRooms.filter((room) => {
    // Find the other person in the chat (not current user)
    const otherPerson = room.people?.find(
      (person) => person._id !== currentUserId
    );
    if (!otherPerson) return false;

    // Search in multiple fields
    const searchFields = [
      otherPerson.firstName,
      otherPerson.lastName,
      otherPerson.username,
      otherPerson.email,
      `${otherPerson.firstName} ${otherPerson.lastName}`.trim(),
    ].filter(Boolean);

    return searchFields.some((field) =>
      field.toLowerCase().includes(searchQuery)
    );
  });
};

/**
 * Filter group rooms based on search query
 * @param {Array} rooms - All rooms array
 * @param {string} query - Search query
 * @returns {Array} Filtered group rooms
 */
export const filterGroupRooms = (rooms, query) => {
  if (!query.trim()) return [];

  const groupRooms = rooms.filter((room) => room.isGroup);
  const searchQuery = query.toLowerCase();

  return groupRooms.filter((room) => {
    // Search in group-specific fields
    const searchFields = [room.title, room.description, room.topic].filter(
      Boolean
    );

    return searchFields.some((field) =>
      field.toLowerCase().includes(searchQuery)
    );
  });
};

/**
 * Filter favorites based on search query
 * @param {Array} favorites - Favorites array
 * @param {string} query - Search query
 * @param {string} currentUserId - Current user's ID
 * @returns {Array} Filtered favorites
 */
export const filterFavorites = (favorites, query, currentUserId) => {
  if (!query.trim()) return [];

  const searchQuery = query.toLowerCase();

  return favorites.filter((room) => {
    if (room.isGroup) {
      // For group favorites, search in group fields
      const searchFields = [room.name, room.description, room.topic].filter(
        Boolean
      );

      return searchFields.some((field) =>
        field.toLowerCase().includes(searchQuery)
      );
    } else {
      // For chat favorites, search in other person's details
      const otherPerson = room.people?.find(
        (person) => person._id !== currentUserId
      );
      if (!otherPerson) return false;

      const searchFields = [
        otherPerson.firstName,
        otherPerson.lastName,
        otherPerson.username,
        otherPerson.email,
        `${otherPerson.firstName} ${otherPerson.lastName}`.trim(),
      ].filter(Boolean);

      return searchFields.some((field) =>
        field.toLowerCase().includes(searchQuery)
      );
    }
  });
};

/**
 * Get appropriate search placeholder based on current navigation
 * @param {string} nav - Current navigation state
 * @returns {string} Placeholder text
 */
export const getSearchPlaceholder = (nav) => {
  switch (nav) {
    case "rooms":
      return "Search chats...";
    case "groups":
      return "Search groups...";
    case "favorites":
      return "Search favorites...";
    case "search":
    default:
      return "Search users...";
  }
};

/**
 * Get appropriate empty search message based on context
 * @param {string} nav - Current navigation state
 * @param {string} query - Search query
 * @returns {string} Empty state message
 */
export const getEmptySearchMessage = (nav, query) => {
  const context =
    nav === "rooms"
      ? "chats"
      : nav === "groups"
      ? "groups"
      : nav === "favorites"
      ? "favorites"
      : "users";
  return `No ${context} found for "${query}"`;
};

/**
 * Debounce function to limit search frequency
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in milliseconds
 * @returns {Function} Debounced function
 */
export const debounce = (func, wait) => {
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

/**
 * Highlight search text in a string
 * @param {string} text - Text to highlight in
 * @param {string} query - Search query to highlight
 * @returns {Array} Array of text parts and highlighted parts
 */
export const highlightSearchText = (text, query) => {
  if (!query || !text) return [text];

  const parts = text.split(
    new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi")
  );
  return parts.map((part, index) => ({
    text: part,
    isHighlight: part.toLowerCase() === query.toLowerCase(),
    key: index,
  }));
};

/**
 * Get search context from navigation state
 * @param {string} nav - Current navigation state
 * @returns {string} Search context
 */
export const getSearchContext = (nav) => {
  return nav; // For now, context matches navigation
};

/**
 * Check if search should be performed
 * @param {string} query - Search query
 * @param {number} minLength - Minimum query length
 * @returns {boolean} Whether to perform search
 */
export const shouldPerformSearch = (query, minLength = 1) => {
  return query && query.trim().length >= minLength;
};

// Add this function to debug group filtering
export const debugFilterGroupRooms = (rooms, query) => {
  console.log("🔍 DEBUG - Group filtering:", {
    totalRooms: rooms.length,
    query: query,
    groupRooms: rooms.filter((room) => room.isGroup),
    groupRoomsDetailed: rooms
      .filter((room) => room.isGroup)
      .map((room) => ({
        id: room._id,
        name: room.name,
        description: room.description,
        topic: room.topic,
        title: room.title, // Maybe it's called title?
        groupName: room.groupName, // Or groupName?
        isGroup: room.isGroup,
        fullObject: room, // Show the complete object
      })),
  });

  if (!query.trim()) return [];

  const groupRooms = rooms.filter((room) => room.isGroup);
  const searchQuery = query.toLowerCase();

  console.log("🔍 DEBUG - Searching for:", searchQuery);

  const results = groupRooms.filter((room) => {
    // Let's check ALL possible name fields
    const searchFields = [
      room.name,
      room.title,
      room.groupName,
      room.displayName,
      room.description,
      room.topic,
    ].filter(Boolean);

    console.log("🔍 DEBUG - Checking room:", {
      roomId: room._id,
      roomName: room.name,
      roomTitle: room.title,
      roomGroupName: room.groupName,
      roomDisplayName: room.displayName,
      searchFields,
      fullRoomObject: room,
      matches: searchFields.some((field) =>
        field.toLowerCase().includes(searchQuery)
      ),
    });

    return searchFields.some((field) =>
      field.toLowerCase().includes(searchQuery)
    );
  });

  console.log("🔍 DEBUG - Final results:", results);
  return results;
};
