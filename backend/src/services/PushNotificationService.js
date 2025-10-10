const webPush = require("web-push");
const PushSubscription = require("../models/PushSubscription");
const config = require("../../config");

class PushNotificationService {
  constructor() {
    if (config.pushNotifications.enabled) {
      webPush.setVapidDetails(
        config.pushNotifications.vapidEmail,
        config.pushNotifications.vapidPublicKey,
        config.pushNotifications.vapidPrivateKey
      );
      console.log("✅ Push Notification Service initialized");
    }
  }

  async saveSubscription(userId, companyId, subscription, userAgent = "") {
    try {
      const deviceType = this.getDeviceType(userAgent);

      const pushSub = await PushSubscription.findOneAndUpdate(
        { endpoint: subscription.endpoint },
        {
          userId,
          companyId,
          endpoint: subscription.endpoint,
          keys: subscription.keys,
          userAgent,
          deviceType,
          lastUsed: new Date(),
        },
        { upsert: true, new: true }
      );

      console.log(`💾 Saved push subscription for user ${userId}`);
      return pushSub;
    } catch (error) {
      console.error("❌ Failed to save subscription:", error);
      throw error;
    }
  }

  async removeSubscription(endpoint) {
    try {
      await PushSubscription.deleteOne({ endpoint });
      console.log(`🗑️ Removed push subscription`);
    } catch (error) {
      console.error("❌ Failed to remove subscription:", error);
    }
  }

  async sendToUser(userId, payload) {
    if (!config.pushNotifications.enabled) return;

    try {
      const subscriptions = await PushSubscription.find({ userId });

      if (subscriptions.length === 0) {
        console.log(`ℹ️ No push subscriptions for user ${userId}`);
        return;
      }

      const results = await Promise.allSettled(
        subscriptions.map((sub) => this.sendNotification(sub, payload))
      );

      const successful = results.filter((r) => r.status === "fulfilled").length;
      console.log(
        `📤 Sent ${successful}/${subscriptions.length} push notifications`
      );
    } catch (error) {
      console.error("❌ Failed to send to user:", error);
    }
  }

  async sendToUsers(userIds, payload) {
    if (!config.pushNotifications.enabled) return;

    try {
      const subscriptions = await PushSubscription.find({
        userId: { $in: userIds },
      });

      if (subscriptions.length === 0) {
        console.log(`ℹ️ No subscriptions for ${userIds.length} users`);
        return;
      }

      const results = await Promise.allSettled(
        subscriptions.map((sub) => this.sendNotification(sub, payload))
      );

      const successful = results.filter((r) => r.status === "fulfilled").length;
      console.log(
        `📤 Sent ${successful}/${subscriptions.length} push notifications`
      );
    } catch (error) {
      console.error("❌ Failed to send to users:", error);
    }
  }

  async sendNotification(subscription, payload) {
    try {
      const pushSubscription = {
        endpoint: subscription.endpoint,
        keys: subscription.keys,
      };

      await webPush.sendNotification(pushSubscription, JSON.stringify(payload));

      await PushSubscription.updateOne(
        { _id: subscription._id },
        { lastUsed: new Date() }
      );

      return true;
    } catch (error) {
      if (error.statusCode === 410 || error.statusCode === 404) {
        console.log(`🗑️ Removing expired subscription`);
        await this.removeSubscription(subscription.endpoint);
      }
      throw error;
    }
  }

  getDeviceType(userAgent) {
    if (!userAgent) return "desktop";

    const ua = userAgent.toLowerCase();
    if (/(tablet|ipad|playbook|silk)|(android(?!.*mobile))/i.test(ua)) {
      return "tablet";
    }
    if (/mobile|iphone|ipod|blackberry|iemobile|opera mini/i.test(ua)) {
      return "mobile";
    }
    return "desktop";
  }

  async cleanupOldSubscriptions(daysOld = 90) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);

      const result = await PushSubscription.deleteMany({
        lastUsed: { $lt: cutoffDate },
      });

      console.log(`🧹 Cleaned up ${result.deletedCount} old subscriptions`);
      return result.deletedCount;
    } catch (error) {
      console.error("❌ Failed to cleanup subscriptions:", error);
    }
  }
}

module.exports = new PushNotificationService();
