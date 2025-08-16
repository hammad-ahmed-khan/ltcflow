import apiClient from "../api/apiClient";

const getInfo = () => {
  return apiClient.get("/api/info");
};

export default getInfo;
