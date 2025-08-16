import apiClient from "../api/apiClient";

const createGroup = (data) => {
  return apiClient.post("/api/group/create", data);
};

export default createGroup;
