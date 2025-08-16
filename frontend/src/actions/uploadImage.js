import axios from "axios";
import Config from "../config";
import store from "../store";

const upload = (image, token, onProgress = () => {}, crop) => {
  const url = `${Config.url || ""}/api/upload`;

  const state = store.getState();
  const companyId = state.company?.companyId;

  const data = new FormData();
  data.append("image", image, image.name);
  data.append("crop", crop);

  const config = {
    onUploadProgress: onProgress,
    headers: {}, // initialize headers object
  };

  if (companyId) {
    config.headers["X-Company-Id"] = companyId;
  }

  return axios.post(url, data, config);
};

export default upload;
