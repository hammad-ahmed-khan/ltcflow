import apiClient from "../api/apiClient";

const postAdd = ({ userID, meetingID }) => {
  return apiClient.post("/api/meeting/add", { userID, meetingID });
};

export default postAdd;
