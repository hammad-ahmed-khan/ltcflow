// frontend/src/actions/getRoomMedia.js
import apiClient from "../api/apiClient";

const getRoomMedia = (roomId) => {
  return apiClient.post("/api/room/media", { roomId });
};

export default getRoomMedia;