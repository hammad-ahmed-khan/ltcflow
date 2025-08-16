import apiClient from "../api/apiClient";

const getMeetings = () => {
  return apiClient.post("/api/meeting/list", {});
};

export default getMeetings;
