const config = require("../../config");
const { makeApiRequest } = require("./auth");
const { log, logToFile } = require("../utils");

let lastPointsUpdate = {
  total: 0,
  inference: 0,
  referral: 0,
};

/**
 * @returns {Promise<Object>} Points user
 * @returns {Promise<Object>} 用户点数
 */
async function getUserPoints() {
  try {
    log("Getting user points...", "info");
    // 获取用户点数...
    logToFile("Getting user points");
    // 获取用户点数

    const response = await makeApiRequest("GET", "/points");

    lastPointsUpdate = {
      total: response.total_points,
      inference: response.points.inference,
      referral: response.points.referral,
    };

    log(`Points retrieved: ${lastPointsUpdate.total} total points`, "success");
    // 获取的点数：总点数 ${lastPointsUpdate.total}
    logToFile(
      `Points retrieved: total=${lastPointsUpdate.total}, inference=${lastPointsUpdate.inference}, referral=${lastPointsUpdate.referral}`
    );
    // 获取的点数：总点数 total=${lastPointsUpdate.total}, 推理点数 inference=${lastPointsUpdate.inference}, 推荐点数 referral=${lastPointsUpdate.referral}

    return response;
  } catch (error) {
    const errorMsg = `Error getting points: ${error.message}`;
    // 获取点数时出错：${error.message}
    log(errorMsg, "error");

    logToFile(
      `Using last known points due to error: ${error.message}`,
      lastPointsUpdate
    );
    // 由于出错，使用上次已知的点数：${error.message}

    throw error;
  }
}

/**
 * @returns {Object}
 */
function getLastKnownPoints() {
  return lastPointsUpdate;
}

module.exports = {
  getUserPoints,
  getLastKnownPoints,
};
