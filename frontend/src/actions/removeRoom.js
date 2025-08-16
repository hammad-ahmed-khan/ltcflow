import apiClient from "../api/apiClient";

const removeRoom = (id) => {
  return apiClient.post("/api/room/remove", { id });
};

export default removeRoom;
