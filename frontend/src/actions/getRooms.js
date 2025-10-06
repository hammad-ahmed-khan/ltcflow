import apiClient from "../api/apiClient";

const getRooms = () => {
  return apiClient.post("/api/rooms/list", {});
};

export default getRooms;
