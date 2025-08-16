import apiClient from "../api/apiClient";

const getMeetingRoom = (data) => {
  return apiClient.post("/api/meeting/get", data);
};

export default getMeetingRoom;
