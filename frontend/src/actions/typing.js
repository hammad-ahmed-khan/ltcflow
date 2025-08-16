import apiClient from "../api/apiClient";

const typing = (room, isTyping) => () => {
  apiClient
    .post("/api/typing", { room, isTyping })
    .then(() => {})
    .catch((err) => {
      console.log(err);
    });
};

export default typing;

/*
import axios from 'axios';
import Config from '../config';

const typing = (room, isTyping) => () => {
  axios
    .post(`${Config.url || ''}/api/typing`, { room, isTyping })
    .then(() => {})
    .catch((err) => {
      console.log(err);
    });
};

export default typing;
*/
