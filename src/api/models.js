const config = require("../../config");
const { makeApiRequest } = require("./auth");
const { setSelectedModel } = require("./chat");
const { log, logToFile } = require("../utils");

let modelsCache = null;

/**
 * @param {boolean} forceRefresh
 * @returns {Promise<Array>}
 */
async function getModels(forceRefresh = false) {
  try {
    if (modelsCache && !forceRefresh) {
      logToFile("Returning models from cache", {
        modelCount: modelsCache.length,
      });
      // 从缓存返回模型
      return modelsCache;
    }

    log("Getting available models...", "info");
    // 获取可用模型...
    logToFile("Getting available models");
    // 获取可用模型

    const response = await makeApiRequest("GET", "/models");

    modelsCache = response;

    const modelInfo = modelsCache.map((model) => ({
      name: model.name,
      display: model.display,
      id: model.id,
      is_pro: model.is_pro,
      active: model.active,
    }));

    log(`Retrieved ${modelsCache.length} available models`, "success");
    // 检索到 ${modelsCache.length} 个可用模型
    logToFile(`Retrieved ${modelsCache.length} available models`, {
      models: modelInfo,
    });
    // 检索到 ${modelsCache.length} 个可用模型

    return modelsCache;
  } catch (error) {
    throw error;
  }
}

/**
 * @returns {Promise<string>}
 */
async function selectDefaultModel() {
  try {
    const models = await getModels();

    const modelStatuses = models.map((model) => ({
      name: model.name,
      is_pro: model.is_pro,
      active: model.active,
    }));

    logToFile("Available models for selection", { models: modelStatuses });
    // 可供选择的可用模型

    const defaultModel = models.find(
      (model) => !model.is_pro && model.active
    )?.name;

    if (!defaultModel) {
      const error = new Error("No suitable default model found");
      // 未找到合适的默认模型
      logToFile("No suitable default model found", { models: modelStatuses });
      // 未找到合适的默认模型
      throw error;
    }

    setSelectedModel(defaultModel);
    log(`Default model selected: ${defaultModel}`, "success");
    // 选择的默认模型：${defaultModel}
    logToFile(`Default model selected: ${defaultModel}`);
    // 选择的默认模型：${defaultModel}

    return defaultModel;
  } catch (error) {
    const errorMsg = `Error selecting default model: ${error.message}`;
    // 选择默认模型时出错：${error.message}
    log(errorMsg, "error");
    logToFile("Error selecting default model", {
      error: error.message,
      stack: error.stack,
    });
    // 选择默认模型时出错
    throw error;
  }
}

module.exports = {
  getModels,
  selectDefaultModel,
};
