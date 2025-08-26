import apiClient from "../api/apiClient";

const editUserProfile = (profileData) => {
  return apiClient.post("/api/edit-profile", profileData);
};

export default editUserProfile;
