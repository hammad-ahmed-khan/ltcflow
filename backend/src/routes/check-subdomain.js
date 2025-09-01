// routes/check-subdomain.js
const express = require("express");
const router = express.Router();
const Company = require("../models/Company");
const outsetaApi = require("../services/outsetaApi");

// Cache for Outseta account status (in-memory cache with cleanup)
// In production, consider using Redis for multi-server deployments
const outsetaStatusCache = new Map();
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const CLEANUP_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes

// Allowed Outseta account states (easily configurable)
const ALLOWED_OUTSETA_STATES = ["Active", "Trialing", "PastDue"];

// Security metrics (in production, send to monitoring service)
let failOpenCount = 0;
let unknownStatesEncountered = new Set();

// In-flight requests to prevent race conditions
const inflightRequests = new Map();

// Background cleanup to prevent memory leaks
// Guard against multiple intervals in hot-reload environments
function initCleanupInterval() {
  // Clear any existing interval first
  if (global._outsetaCleanupInterval) {
    clearInterval(global._outsetaCleanupInterval);
    console.log("🔄 Cleared existing Outseta cleanup interval");
  }

  global._outsetaCleanupInterval = setInterval(() => {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [id, entry] of outsetaStatusCache.entries()) {
      if (now - entry.timestamp > CACHE_TTL_MS) {
        outsetaStatusCache.delete(id);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      console.log(
        `🧹 Cache cleanup: removed ${cleanedCount} expired entries, ${outsetaStatusCache.size} remaining`
      );
    }
  }, CLEANUP_INTERVAL_MS);

  console.log("✅ Outseta cache cleanup interval initialized");
}

// Initialize cleanup interval
initCleanupInterval();

// Cleanup on process exit to prevent resource leaks
function cleanupResources() {
  if (global._outsetaCleanupInterval) {
    clearInterval(global._outsetaCleanupInterval);
    global._outsetaCleanupInterval = null;
    console.log("🧹 Outseta cleanup interval cleared on shutdown");
  }

  // Clear caches
  outsetaStatusCache.clear();
  inflightRequests.clear();
}

// Handle multiple signal types
["SIGTERM", "SIGINT", "SIGUSR2"].forEach((signal) => {
  process.on(signal, () => {
    console.log(`Received ${signal}, cleaning up Outseta resources...`);
    cleanupResources();
  });
});

// Helper function to check cache
function getCachedStatus(outsetaAccountId) {
  const cached = outsetaStatusCache.get(outsetaAccountId);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.data;
  }
  // Clean up expired entry immediately
  if (cached) {
    outsetaStatusCache.delete(outsetaAccountId);
  }
  return null;
}

// Helper function to set cache with optional cleanup
function setCachedStatus(outsetaAccountId, statusData) {
  outsetaStatusCache.set(outsetaAccountId, {
    data: statusData,
    timestamp: Date.now(),
  });

  // Probabilistic cleanup on write (10% chance to avoid O(n) on every write)
  if (Math.random() < 0.1) {
    const now = Date.now();
    for (const [id, entry] of outsetaStatusCache.entries()) {
      if (now - entry.timestamp > CACHE_TTL_MS) {
        outsetaStatusCache.delete(id);
      }
    }
  }
}

// Helper function to create consistent response
function createResponse(valid, company, options = {}) {
  const baseResponse = {
    valid,
    message: options.message || (valid ? "Company verified" : "Access denied"),
  };

  // Only include companyId if company exists
  if (company?._id) {
    baseResponse.companyId = company._id.toString();
  }

  // Only include outseta fields if relevant
  if (options.outsetaStatus !== undefined) {
    baseResponse.outsetaStatus = options.outsetaStatus;
  }

  if (company?.outsetaAccountId) {
    baseResponse.outsetaAccountId = company.outsetaAccountId;
  }

  if (options.isDemoAccount) {
    baseResponse.isDemoAccount = true;
  }

  // Add cache info for debugging (only in non-production)
  if (
    process.env.NODE_ENV !== "production" &&
    options.fromCache !== undefined
  ) {
    baseResponse.fromCache = options.fromCache;
  }

  return baseResponse;
}

// Authentication middleware for admin endpoints
function requireAuth(req, res, next) {
  // Replace with your actual auth logic
  const authToken = req.headers.authorization;

  if (!authToken || authToken !== `Bearer ${process.env.ADMIN_TOKEN}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  next();
}

// Helper function to check Outseta status with race condition protection
async function getOutsetaStatus(company) {
  const accountId = company.outsetaAccountId;

  // Check if request is already in flight
  if (inflightRequests.has(accountId)) {
    console.log(`⏳ Waiting for in-flight Outseta request: ${company.name}`);
    return await inflightRequests.get(accountId);
  }

  // Create promise for this request
  const requestPromise = (async () => {
    try {
      console.log(
        `🔍 Checking Outseta account status for: ${company.name} [${accountId}]`
      );

      const outsetaResponse = await outsetaApi.client.get(
        `/accounts/${accountId}`
      );
      const outsetaAccount = outsetaResponse.data;

      if (!outsetaAccount) {
        return { success: false, reason: "account_not_found" };
      }

      // Log unknown states for monitoring
      if (!ALLOWED_OUTSETA_STATES.includes(outsetaAccount.State)) {
        unknownStatesEncountered.add(outsetaAccount.State);
        console.warn(
          `⚠️ Unknown Outseta state encountered: ${outsetaAccount.State} for company: ${company.name}`
        );

        // In production, send alert to monitoring system
        // sendAlert('unknown_outseta_state', { state: outsetaAccount.State, company: company.name });
      }

      const statusData = {
        state: outsetaAccount.State,
        checkedAt: new Date().toISOString(),
      };

      // Cache the result
      setCachedStatus(accountId, statusData);

      return {
        success: true,
        statusData,
        isActive: ALLOWED_OUTSETA_STATES.includes(outsetaAccount.State),
      };
    } catch (error) {
      return {
        success: false,
        reason: "api_error",
        error: {
          status: error.response?.status,
          statusText: error.response?.statusText,
          data: error.response?.data,
          message: error.message,
        },
      };
    }
  })();

  // Store in-flight request
  inflightRequests.set(accountId, requestPromise);

  try {
    const result = await requestPromise;
    return result;
  } finally {
    // Clean up in-flight request
    inflightRequests.delete(accountId);
  }
}

// GET /api/check-subdomain?subdomain=company1
router.get("/check-subdomain", async (req, res) => {
  const { subdomain } = req.query;

  if (!subdomain) {
    return res.status(400).json(
      createResponse(false, null, {
        message: "Subdomain required",
      })
    );
  }

  const normalizedSubdomain = subdomain.toLowerCase().trim();

  try {
    // Find the company in local database (ensure subdomain field has lowercase index)
    const company = await Company.findOne({
      subdomain: normalizedSubdomain,
    });

    if (!company) {
      return res.json(
        createResponse(false, null, {
          message: "Company not found",
        })
      );
    }

    // Exception for demo subdomain - always allow access
    if (normalizedSubdomain === "demo") {
      console.log(`✅ Demo subdomain access granted: ${normalizedSubdomain}`);
      return res.json(
        createResponse(true, company, {
          isDemoAccount: true,
          message: "Demo account access granted",
        })
      );
    }

    // Check if company has Outseta integration
    if (!company.outsetaAccountId) {
      console.log(`⚠️ Company ${company.name} has no Outseta account ID`);
      return res.json(
        createResponse(false, company, {
          message: "Company not properly configured with billing system",
        })
      );
    }

    // Check if Outseta is configured
    if (!outsetaApi.isConfigured()) {
      console.warn("Outseta not configured - allowing access by default");
      return res.json(
        createResponse(true, company, {
          outsetaStatus: "not_configured",
          message: "Billing system not configured - access granted",
        })
      );
    }

    // Check cache first
    const cachedStatus = getCachedStatus(company.outsetaAccountId);
    if (cachedStatus) {
      console.log(
        `📋 Using cached Outseta status for: ${company.name} [${cachedStatus.state}]`
      );

      const isActive = ALLOWED_OUTSETA_STATES.includes(cachedStatus.state);
      return res.json(
        createResponse(isActive, company, {
          outsetaStatus: cachedStatus.state,
          message: isActive
            ? "Company verified (cached)"
            : `Company account is ${cachedStatus.state.toLowerCase()}`,
          fromCache: true,
        })
      );
    }

    // Get status from Outseta with race condition protection
    const result = await getOutsetaStatus(company);

    if (!result.success) {
      if (result.reason === "account_not_found") {
        console.log(
          `❌ Outseta account not found: ${company.outsetaAccountId}`
        );
        return res.json(
          createResponse(false, company, {
            message: "Company account not found in billing system",
          })
        );
      }

      // API error - handle fail-open scenario
      console.error("❌ Error checking Outseta account:", {
        company: company.name,
        outsetaAccountId: company.outsetaAccountId,
        ...result.error,
      });

      // Security alert for fail-open scenarios
      failOpenCount++;
      console.warn(
        `🚨 SECURITY ALERT: Outseta check failed, allowing access (fail-open #${failOpenCount})`,
        {
          company: company.name,
          subdomain: normalizedSubdomain,
          error: result.error?.message,
          timestamp: new Date().toISOString(),
        }
      );

      // Fail open (recommended for better user experience)
      return res.json(
        createResponse(true, company, {
          outsetaStatus: "check_failed",
          message:
            "Company found but billing status check failed - access granted",
        })
      );
    }

    // Success case
    const { statusData, isActive } = result;

    if (!isActive) {
      console.log(
        `❌ Outseta account inactive: ${company.name} [${statusData.state}]`
      );
      return res.json(
        createResponse(false, company, {
          outsetaStatus: statusData.state,
          message: `Company account is ${statusData.state.toLowerCase()}`,
        })
      );
    }

    // Account is active in Outseta
    console.log(
      `✅ Outseta account verified as active: ${company.name} [${statusData.state}]`
    );

    return res.json(
      createResponse(true, company, {
        outsetaStatus: statusData.state,
        message: "Company verified and active",
      })
    );
  } catch (error) {
    console.error("Error checking subdomain:", {
      subdomain: normalizedSubdomain,
      error: error.message,
      stack: error.stack,
    });

    res.status(500).json(
      createResponse(false, null, {
        message: "Server error",
      })
    );
  }
});

// Protected health check endpoint for monitoring cache and fail-open metrics
router.get("/check-subdomain/health", requireAuth, (req, res) => {
  res.json({
    status: "healthy",
    cache: {
      size: outsetaStatusCache.size,
      ttlMinutes: CACHE_TTL_MS / (60 * 1000),
      cleanupIntervalMinutes: CLEANUP_INTERVAL_MS / (60 * 1000),
    },
    metrics: {
      failOpenCount,
      unknownStatesEncountered: Array.from(unknownStatesEncountered),
      inflightRequestsCount: inflightRequests.size,
    },
    config: {
      allowedStates: ALLOWED_OUTSETA_STATES,
      nodeEnv: process.env.NODE_ENV,
    },
  });
});

// Protected cache management endpoint (for admin use)
router.delete("/check-subdomain/cache", requireAuth, (req, res) => {
  const previousSize = outsetaStatusCache.size;
  outsetaStatusCache.clear();
  inflightRequests.clear();
  failOpenCount = 0;
  unknownStatesEncountered.clear();

  console.log(
    `🧹 Outseta status cache cleared (${previousSize} entries removed)`
  );
  res.json({
    status: "cache cleared",
    entriesRemoved: previousSize,
  });
});

module.exports = router;
