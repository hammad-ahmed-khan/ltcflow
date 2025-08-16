import apiClient from "../api/apiClient";

const changePicture = (imageID) => {
  return apiClient.post("/api/picture/change", { imageID });
};

export default changePicture;
