// backend/src/calls/index.js
//
// Entry point for the call lifecycle module.

const callManager = require("./CallManager");
const initCallSocket = require("./initCallSocket");
const constants = require("./constants");

module.exports = {
  callManager,
  initCallSocket,
  ...constants,
};
