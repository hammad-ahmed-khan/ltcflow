import apiClient from "../api/apiClient";

const toggleFavorite = (roomID) => {
  return apiClient.post("/api/favorite/toggle", { roomID });
};

export default toggleFavorite;
