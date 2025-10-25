const express = require("express");
const router = express.Router();
const PushNotificationService = require("../services/PushNotificationService");
const config = require("../../config");

// Get VAPID public key
router.get("/vapid-public-key", (req, res) => {
  if (!config.pushNotifications.enabled) {
    return res.status(503).json({ error: "Push notifications disabled" });
  }

  res.json({
    publicKey: config.pushNotifications.vapidPublicKey,
  });
});

// Save push subscription
router.post("/subscribe", async (req, res) => {
  try {
    const { subscription } = req.body;
    const userId = req.user.id;
    const companyId = req.user.companyId;
    const userAgent = req.headers["user-agent"];

    if (!subscription || !subscription.endpoint || !subscription.keys) {
      return res.status(400).json({ error: "Invalid subscription" });
    }

    await PushNotificationService.saveSubscription(
      userId,
      companyId,
      subscription,
      userAgent
    );

    res.json({ success: true, message: "Subscription saved" });
  } catch (error) {
    console.error("Subscribe error:", error);
    res.status(500).json({ error: "Failed to save subscription" });
  }
});

// Remove push subscription
router.post("/unsubscribe", async (req, res) => {
  try {
    const { endpoint } = req.body;

    if (!endpoint) {
      return res.status(400).json({ error: "Endpoint required" });
    }

    await PushNotificationService.removeSubscription(endpoint);
    res.json({ success: true, message: "Subscription removed" });
  } catch (error) {
    console.error("Unsubscribe error:", error);
    res.status(500).json({ error: "Failed to remove subscription" });
  }
});

// Test notification (development only)
router.post("/test", async (req, res) => {
  if (process.env.NODE_ENV === "production") {
    return res.status(403).json({ error: "Not available in production" });
  }

  try {
    const userId = req.user.id;

    await PushNotificationService.sendToUser(userId, {
      title: "Test Notification",
      body: "This is a test push notification from LTC Flow!",
      tag: "test",
      requireInteraction: false,
    });

    res.json({ success: true, message: "Test notification sent" });
  } catch (error) {
    console.error("Test notification error:", error);
    res.status(500).json({ error: "Failed to send test notification" });
  }
});

module.exports = router;
