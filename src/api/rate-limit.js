const config = require("../../config");
const { makeApiRequest } = require("./auth");
const { log, logToFile } = require("../utils");

let rateLimitInfo = {
  limit: 0,          // 限制
  remaining: 0,      // 剩余
  resetTime: 0,      // 重置时间
  currentUsage: 0,   // 当前使用量
};

let cooldownActive = false;
let cooldownTimer = null;

/**
 * 获取速率限制信息
 * @returns {Promise<Object>}
 */
async function getRateLimit() {
  try {
    log("Checking rate limit...", "info");
    // 检查速率限制...
    logToFile("Checking rate limit");
    // 检查速率限制

    const response = await makeApiRequest("GET", "/rate-limit");

    rateLimitInfo = {
      limit: response.limit,
      remaining: response.remaining,
      resetTime: response.reset_time,
      currentUsage: response.current_usage || 0,
    };

    let resetTimeFormatted = "N/A";
    if (rateLimitInfo.resetTime > 0) {
      const minutes = Math.floor(rateLimitInfo.resetTime / 60);
      const seconds = rateLimitInfo.resetTime % 60;
      resetTimeFormatted = `${minutes}m ${seconds}s`;
    }

    log(
      `Rate limit: ${rateLimitInfo.remaining}/${rateLimitInfo.limit} remaining`,
      "info"
    );
    // 速率限制：剩余 ${rateLimitInfo.remaining}/${rateLimitInfo.limit}
    logToFile(`Rate limit status`, {
      limit: rateLimitInfo.limit,
      remaining: rateLimitInfo.remaining,
      resetTime: rateLimitInfo.resetTime,
      resetTimeFormatted: resetTimeFormatted,
      currentUsage: rateLimitInfo.currentUsage,
    });
    // 速率限制状态

    return rateLimitInfo;
  } catch (error) {
    throw error;
  }
}

/**
 * 检查速率限制是否可用
 * @returns {Promise<boolean>}
 */
async function checkRateLimitAvailability() {
  try {
    const { remaining } = await getRateLimit();

    const isAvailable = remaining > 0;
    logToFile(
      `Rate limit availability check: ${
        isAvailable ? "Available" : "Exhausted"
      }`,
      {
        remaining: remaining,
      }
    );
    // 速率限制可用性检查：可用/已耗尽

    return isAvailable;
  } catch (error) {
    logToFile(
      `Error checking rate limit, assuming available: ${error.message}`,
      {
        error: error.message,
      },
      false
    );
    // 检查速率限制时出错，假定可用：${error.message}
    return true;
  }
}

/**
 * 如果冷却时间处于活动状态，则取消当前冷却
 * @returns {boolean}
 */
function cancelCooldown() {
  if (!cooldownActive) {
    return false;
  }

  if (cooldownTimer) {
    clearTimeout(cooldownTimer);
    cooldownTimer = null;
  }

  cooldownActive = false;
  log("Cooldown cancelled", "info");
  // 冷却已取消
  logToFile("Cooldown cancelled manually");
  // 已手动取消冷却

  return true;
}

/**
 * 启动冷却计时器
 * @param {Function} onComplete
 * @returns {Promise<boolean>}
 */
async function startCooldown(onComplete) {
  try {
    if (cooldownActive) {
      log("Cooldown already active", "warning");
      // 冷却已经处于活动状态
      logToFile("Cooldown already active");
      // 冷却已经处于活动状态
      return false;
    }

    cooldownActive = true;

    let resetTime = 60;

    try {
      const rateLimit = await getRateLimit();
      resetTime = rateLimit.resetTime;
    } catch (error) {
      logToFile(
        `Failed to get rate limit for cooldown, using default: ${error.message}`,
        {
          error: error.message,
          defaultResetTime: resetTime,
        },
        false
      );
      // 获取冷却的速率限制失败，使用默认值：${error.message}
    }

    const cooldownSeconds = resetTime > 0 ? resetTime : 60;

    log(`Starting cooldown for ${cooldownSeconds} seconds...`, "warning");
    // 开始冷却 ${cooldownSeconds} 秒...
    logToFile(`Starting cooldown`, {
      durationSeconds: cooldownSeconds,
      estimatedEndTime: new Date(
        Date.now() + cooldownSeconds * 1000
      ).toISOString(),
    });
    // 开始冷却

    return new Promise((resolve) => {
      cooldownTimer = setTimeout(() => {
        cooldownActive = false;
        cooldownTimer = null;
        log("Cooldown complete!", "success");
        // 冷却完成！
        logToFile("Cooldown complete!");
        // 冷却完成！

        if (onComplete && typeof onComplete === "function") {
          onComplete();
        }

        resolve(true);
      }, cooldownSeconds * 1000);
    });
  } catch (error) {
    cooldownActive = false;
    const errorMsg = `Error during cooldown: ${error.message}`;
    // 冷却期间出错：${error.message}
    log(errorMsg, "error");
    logToFile("Error during cooldown", {
      error: error.message,
      stack: error.stack,
    });
    // 冷却期间出错
    throw error;
  }
}

/**
 * 检查冷却是否处于活动状态
 * @returns {boolean}
 */
function isCooldownActive() {
  return cooldownActive;
}

/**
 * 获取最后已知的速率限制信息
 * @returns {Object}
 */
function getLastKnownRateLimit() {
  return { ...rateLimitInfo };
}

module.exports = {
  getRateLimit,
  checkRateLimitAvailability,
  startCooldown,
  cancelCooldown,
  isCooldownActive,
  getLastKnownRateLimit,
};
