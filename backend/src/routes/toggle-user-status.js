const User = require("../models/User");
const Company = require("../models/Company");
const outsetaApi = require("../services/outsetaApi");

module.exports = async (req, res, next) => {
  const { userId, newStatus } = req.fields;
  const companyId = req.headers["x-company-id"];

  // Check if user has permission to manage users
  if (!["root", "admin"].includes(req.user.level)) {
    return res.status(401).json({ error: "Unauthorized User" });
  }

  if (!userId || !newStatus || !companyId) {
    return res
      .status(400)
      .json({ error: "User ID, status, and Company ID required." });
  }

  // Validate status
  const validStatuses = ["pending", "active", "deactivated", "expired"];
  if (!validStatuses.includes(newStatus)) {
    return res.status(400).json({ error: "Invalid status value." });
  }

  try {
    // Find the user within the same company
    const user = await User.findOne({
      _id: userId,
      companyId,
    });

    if (!user) {
      return res.status(404).json({
        error: "User not found.",
      });
    }

    // Prevent self-deactivation
    if (req.user.id === userId && newStatus === "deactivated") {
      return res.status(400).json({
        error: "You cannot deactivate your own account.",
      });
    }

    const oldStatus = user.status;

    // Update user status
    const updateData = { status: newStatus };

    // If deactivating or expiring, clear any existing activation tokens
    if (["deactivated", "expired"].includes(newStatus)) {
      updateData.$unset = {
        activationToken: 1,
        tokenExpiry: 1,
      };
    }

    const updatedUser = await User.findByIdAndUpdate(userId, updateData, {
      new: true,
    }).select("-password -activationToken");

    // Sync with Outseta based on status change
    let outsetaResult = null;
    if (outsetaApi.isConfigured()) {
      try {
        // Get company info for Outseta account ID
        const company = await Company.findById(companyId);

        if (company && company.outsetaAccountId) {
          // Handle deactivation - delete from Outseta
          if (newStatus === "deactivated" && user.outsetaPersonId) {
            console.log(
              `🔄 Deactivating user - deleting from Outseta: ${user.email}`
            );
            outsetaResult = await outsetaApi.deletePerson(user.outsetaPersonId);

            if (outsetaResult?.success) {
              // Clear outsetaPersonId since person was deleted
              await User.findByIdAndUpdate(userId, {
                $unset: { outsetaPersonId: 1 },
              });
              console.log(`✅ User deleted from Outseta: ${user.email}`);
            }
          }

          // Handle reactivation - add back to Outseta if not already there
          else if (
            (newStatus === "active" || newStatus === "pending") &&
            (oldStatus === "deactivated" || oldStatus === "expired")
          ) {
            console.log(
              `🔄 Reactivating user - checking Outseta status: ${user.email}`
            );

            // Check if person exists in Outseta
            let personExists = false;
            if (user.outsetaPersonId) {
              // Try to get person by ID to see if still exists
              try {
                const lookupResult = await outsetaApi.getPersonByEmail(
                  user.email
                );
                personExists = lookupResult?.success && lookupResult.person;
              } catch (lookupError) {
                console.log("Person lookup failed, will create new one");
              }
            }

            if (!personExists) {
              // Create person in Outseta
              console.log(
                `🔄 Creating reactivated user in Outseta: ${user.email}`
              );
              outsetaResult = await outsetaApi.createPerson(
                {
                  email: user.email,
                  firstName: user.firstName,
                  lastName: user.lastName,
                  phone: user.phone,
                },
                {
                  outsetaAccountId: company.outsetaAccountId,
                }
              );

              // Store new Outseta Person ID
              if (outsetaResult?.success && outsetaResult.personId) {
                await User.findByIdAndUpdate(userId, {
                  outsetaPersonId: outsetaResult.personId,
                });
                console.log(
                  `✅ Reactivated user created in Outseta: ${user.email} [${outsetaResult.personId}]`
                );
              }
            } else {
              console.log(`✅ User already exists in Outseta: ${user.email}`);
              outsetaResult = {
                success: true,
                message: "Person already exists",
              };
            }
          }
        }
      } catch (outsetaError) {
        console.error(
          "❌ Outseta sync failed for status change:",
          outsetaError
        );
        outsetaResult = { success: false, error: outsetaError.message };
        // Continue with local status update even if Outseta fails
      }
    }

    res.status(200).json({
      status: "success",
      message: `User status updated to ${newStatus} successfully.`,
      user: updatedUser,
      outseta: outsetaResult
        ? {
            synced: outsetaResult.success,
            action:
              newStatus === "deactivated"
                ? "deleted"
                : (newStatus === "active" || newStatus === "pending") &&
                  (oldStatus === "deactivated" || oldStatus === "expired")
                ? "created"
                : "none",
            personId: outsetaResult.personId || null,
            error: outsetaResult.error || null,
          }
        : { synced: false, reason: "not_configured" },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error updating user status." });
  }
};
