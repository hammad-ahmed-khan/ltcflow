module.exports = [
  {
    tag: "more-messages",
    callback: require("./more-messages"),
  },
  {
    tag: "more-images",
    callback: require("./more-images"),
  },
  {
    tag: "more-rooms",
    callback: require("./more-rooms"),
  },
  {
    tag: "status",
    callback: require("./status"),
  },
  {
    tag: "message",
    callback: require("./message"),
  },
  {
    tag: "message-delivered",
    callback: require("./message-delivered"),
  },
  {
    tag: "message-read",
    callback: require("./message-read"),
  },
];
