const express = require("express"); // Ensure express is imported
const router = require("express").Router();
const passport = require("passport");
const jwt = require("express-jwt");
const Config = require("../../config");

router.get("/images/:id", require("./images"));
router.get("/files/:id", require("./files"));
router.get("/images/:id/:size", require("./images"));
router.get("/check-subdomain", require("./check-subdomain"));

router.post("/login", require("./login"));
router.post(
  "/typing",
  passport.authenticate("jwt", { session: false }, null),
  require("./typing")
);
router.post("/check-user", require("./checkUser"));
router.post(
  "/upload",
  passport.authenticate("jwt", { session: false }, null),
  require("./upload")
);
router.post(
  "/upload/file",
  passport.authenticate("jwt", { session: false }, null),
  require("./upload-file")
);
router.post("/register", require("./register"));
router.post(
  "/user/delete",
  passport.authenticate("jwt", { session: false }, null),
  require("./user-delete")
);
router.post(
  "/user/edit",
  passport.authenticate("jwt", { session: false }, null),
  require("./user-edit")
);
router.post(
  "/user/list",
  passport.authenticate("jwt", { session: false }, null),
  require("./user-list")
);

router.post(
  "/edit-profile",
  passport.authenticate("jwt", { session: false }, null),
  require("./edit-profile")
);

router.post(
  "/picture/change",
  passport.authenticate("jwt", { session: false }, null),
  require("./change-picture")
);
router.post(
  "/picture/remove",
  passport.authenticate("jwt", { session: false }, null),
  require("./change-picture")
);

router.post(
  "/favorite/toggle",
  passport.authenticate("jwt", { session: false }, null),
  require("./toggle-favorite")
);
router.post(
  "/favorites/list",
  passport.authenticate("jwt", { session: false }, null),
  require("./list-favorites")
);
router.post(
  "/rooms/list",
  passport.authenticate("jwt", { session: false }, null),
  require("./list-rooms")
);
router.post(
  "/room/get",
  passport.authenticate("jwt", { session: false }, null),
  require("./get-room")
);
router.post(
  "/room/create",
  passport.authenticate("jwt", { session: false }, null),
  require("./create-room")
);
router.post(
  "/room/join",
  passport.authenticate("jwt", { session: false }, null),
  require("./join-room")
);
router.post(
  "/room/remove",
  passport.authenticate("jwt", { session: false }, null),
  require("./remove-room")
);
router.post(
  "/search",
  passport.authenticate("jwt", { session: false }, null),
  require("./search")
);
router.post(
  "/message",
  passport.authenticate("jwt", { session: false }, null),
  require("./message")
);
router.post(
  "/messages/more",
  passport.authenticate("jwt", { session: false }, null),
  require("./more-messages")
);
router.post(
  "/group/create",
  passport.authenticate("jwt", { session: false }, null),
  require("./create-group")
);

router.post(
  "/rtc/create",
  passport.authenticate("jwt", { session: false }, null),
  require("./rtc/create")
);
router.post(
  "/rtc/join",
  passport.authenticate("jwt", { session: false }, null),
  require("./rtc/join")
);
router.post("/rtc/peers", require("./rtc/peers"));

router.post("/meeting/get", require("./meeting/get"));
router.post(
  "/meeting/call",
  passport.authenticate("jwt", { session: false }, null),
  require("./meeting/call")
);
router.post(
  "/meeting/add",
  passport.authenticate("jwt", { session: false }, null),
  require("./meeting/add")
);
router.post(
  "/meeting/answer",
  passport.authenticate("jwt", { session: false }, null),
  require("./meeting/answer")
);
router.post(
  "/meeting/close",
  passport.authenticate("jwt", { session: false }, null),
  require("./meeting/close")
);
router.post(
  "/meeting/list",
  passport.authenticate("jwt", { session: false }, null),
  require("./meeting/list")
);

router.post("/auth/change", require("./auth/change"));
router.post("/auth/code", require("./auth/code"));
router.post("/auth/verify", require("./auth/verify"));

router.post(
  "/users/change-password",
  passport.authenticate("jwt", { session: false }, null),
  require("./users/change-password")
);

router.get("/company/:id", require("./company"));
router.get(
  "/company/subdomain/:subdomain",
  require("./company").getCompanyBySubdomain
);
// 🆕 NEW: Company management routes (authenticated - root users only)
router.post(
  "/company/update",
  passport.authenticate("jwt", { session: false }, null),
  require("./company-management").updateCompany
);
router.post(
  "/company/logo/remove",
  passport.authenticate("jwt", { session: false }, null),
  require("./company-management").removeCompanyLogo
);
router.post("/company/create", require("./create-company"));

// User status management
router.post(
  "/toggle-user-status",
  passport.authenticate("jwt", { session: false }, null),
  require("./toggle-user-status")
);

// Test email route (for development)
router.post("/test-email", require("./test-email"));
router.use("/info", require("./info"));

router.post("/auth/forgot-password", require("./auth/forgot-password"));
router.post("/auth/reset-password", require("./auth/reset-password"));

router.post("/debug-email", require("./debug-email"));
router.post("/email-queue-status", require("./email-queue-status"));

// User activation routes
router.get("/activate/:token", require("./activate-user"));
router.post("/activation-upload", require("./activation-upload")); // 🆕 NEW: Unauthenticated upload for activation
router.post("/verify-activation-otp", require("./verify-activation-otp")); // NEW
router.post("/resend-activation-otp", require("./resend-activation-otp")); // NEW
router.post("/complete-activation", require("./complete-activation"));
router.post("/regenerate-activation", require("./regenerate-activation"));
router.post("/cancel-activation", require("./cancel-activation"));

router.post(
  "/group/add-member",
  passport.authenticate("jwt", { session: false }, null),
  require("./group-add-member")
);

router.post(
  "/group/remove-member",
  passport.authenticate("jwt", { session: false }, null),
  require("./group-remove-member")
);

router.post(
  "/group/update-info",
  passport.authenticate("jwt", { session: false }, null),
  require("./group-update-info")
);

// Webhook route
//router.post("/webhook/outseta", require("./outseta-webhook"));

module.exports = router;
