import apiClient from "../api/apiClient";

const getRoom = (id) => {
  return apiClient.post("/api/room/join", { id });
};

export default getRoom;
