import apiClient from "../api/apiClient";

const getRooms = (limit = 30) => {
  return apiClient.post("/api/rooms/list", { limit });
};

export default getRooms;
