import { combineReducers } from "redux";
import emoji from "./emoji";
import io from "./io";
import messages from "./messages";
import rtc from "./rtc";
import company from "./companyReducer"; // import your new reducer
import callsReducer from "./callsReducer";
import unreadReducer from "./unreadReducer"; // ✅ ADD THIS

export default combineReducers({
  emoji,
  io,
  messages,
  rtc,
  company, // add here
  calls: callsReducer,
  unread: unreadReducer, // ✅ ADD THIS
});
