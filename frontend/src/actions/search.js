import apiClient from "../api/apiClient";

const search = (text, limit) => {
  return apiClient.post("/api/search", {
    limit: limit || 30,
    search: text || "",
  });
};

export default search;
