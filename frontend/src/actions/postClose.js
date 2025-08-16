import apiClient from "../api/apiClient";

const postClose = ({ meetingID, userID }) => {
  return apiClient.post("/api/meeting/close", { meetingID, userID });
};

export default postClose;
