import apiClient from "../api/apiClient";

const getFavorites = () => {
  return apiClient.post("/api/favorites/list", {});
};

export default getFavorites;
