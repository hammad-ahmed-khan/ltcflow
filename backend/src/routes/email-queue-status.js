const Email = require("../models/Email");

module.exports = async (req, res) => {
  try {
    const pendingEmails = await Email.find({ sent: false })
      .sort({ createdAt: -1 })
      .limit(10);
    const sentEmails = await Email.find({ sent: true })
      .sort({ dateSent: -1 })
      .limit(5);
    const totalPending = await Email.countDocuments({ sent: false });
    const totalSent = await Email.countDocuments({ sent: true });

    console.log(`📊 Email Queue Status:`);
    console.log(`   Pending: ${totalPending}`);
    console.log(`   Sent: ${totalSent}`);

    res.status(200).json({
      status: "success",
      queue: {
        pending: totalPending,
        sent: totalSent,
        pendingEmails: pendingEmails.map((email) => ({
          id: email._id,
          to: email.to,
          subject: email.subject,
          createdAt: email.createdAt,
          attempts: email.attempts || 0,
        })),
        recentSent: sentEmails.map((email) => ({
          id: email._id,
          to: email.to,
          subject: email.subject,
          sentAt: email.dateSent,
        })),
      },
      cronJob: {
        enabled: true,
        interval: "Every 5 seconds",
        note: "Cron job processes queue automatically",
      },
    });
  } catch (error) {
    console.error("❌ Queue status error:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to get queue status",
      error: error.message,
    });
  }
};
