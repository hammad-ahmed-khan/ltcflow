import axios from "axios";
import Config from "../config";
import store from "../store";

const uploadFile = (file, token, onProgress = () => {}) => {
  const url = `${Config.url || ""}/api/upload/file`;
  const state = store.getState();
  const companyId = state.company?.companyId;

  const data = new FormData();

  data.append("file", file, file.name);

  const config = {
    onUploadProgress: onProgress,
    headers: {}, // initialize headers object
  };

  if (companyId) {
    config.headers["X-Company-Id"] = companyId;
  }

  return axios.post(url, data, config);
};

export default uploadFile;
