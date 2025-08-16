import apiClient from "../api/apiClient";

const createRoom = (counterpart) => {
  return apiClient.post("/api/room/create", { counterpart });
};

export default createRoom;
