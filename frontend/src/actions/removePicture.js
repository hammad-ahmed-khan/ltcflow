import apiClient from "../api/apiClient";

const removePicture = () => {
  return apiClient.post("/api/picture/remove");
};

export default removePicture;
