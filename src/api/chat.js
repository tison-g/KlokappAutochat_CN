const fs = require("fs");
const path = require("path");
const axios = require("axios");
const crypto = require("crypto");
const config = require("../../config");
const { getAuthHeaders, executeWithRetry } = require("./auth");
const { getUserPoints } = require("./points");
const {
  log,
  logChat,
  logToFile,
  logApiRequest,
  logApiResponse,
  logApiError,
} = require("../utils");

const { HttpsProxyAgent } = require("https-proxy-agent");
const { HttpProxyAgent } = require("http-proxy-agent");

const PROXY_FILE = "proxies.txt";

let allProxies = [];
let currentProxyIndex = 0;

function readAllProxiesFromFile() {
  try {
    if (fs.existsSync(PROXY_FILE)) {
      const fileContent = fs.readFileSync(PROXY_FILE, "utf8");
      const proxies = fileContent
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.length > 0);
      return proxies;
    }
    return [];
  } catch (err) {
    console.error("Error reading proxies file:", err.message);
    return [];
  }
}

function getCurrentProxy() {
  if (allProxies.length === 0) {
    allProxies = readAllProxiesFromFile();
    currentProxyIndex = 0;
  }
  if (allProxies.length === 0) {
    log("No proxies found, using machine's default IP.");
    // 未找到代理，使用机器的默认 IP
    return null;
  }
  if (currentProxyIndex >= allProxies.length) {
    currentProxyIndex = 0;
  }
  const proxyUrl = allProxies[currentProxyIndex];
  return proxyUrl;
}

function switchToNextProxy() {
  if (allProxies.length === 0) {
    allProxies = readAllProxiesFromFile();
  }
  if (allProxies.length === 0) {
    log("No proxies available to switch, using machine's default IP.");
    // 没有可切换的代理，使用机器的默认 IP
    return null;
  }
  currentProxyIndex = (currentProxyIndex + 1) % allProxies.length;
  const proxyUrl = allProxies[currentProxyIndex];
  try {
    const parsedUrl = new URL(proxyUrl);
    log(`Switched to proxy: ${parsedUrl.hostname}`);
    // 切换到代理：
  } catch (err) {
    log(`Switched to proxy: ${proxyUrl}`);
    // 切换到代理：
  }
  return proxyUrl;
}

function getProxyAgent(targetUrl) {
  const proxyUrl = getCurrentProxy();
  if (!proxyUrl) return null;
  if (targetUrl.startsWith("https")) {
    return new HttpsProxyAgent(proxyUrl);
  } else {
    return new HttpProxyAgent(proxyUrl);
  }
}

let currentThread = null;
let selectedModel = null;

function setSelectedModel(modelName) {
  selectedModel = modelName;
  log(`Selected model: ${modelName}`, "info");
  // 选择的模型：
  logToFile(`Selected model: ${modelName}`);
  // 选择的模型：
}

function getSelectedModel() {
  return selectedModel;
}

function createThread() {
  const threadId = crypto.randomUUID();
  currentThread = {
    id: threadId,
    title: "",
    messages: [],
    created_at: new Date().toISOString(),
  };
  log(`New chat thread created: ${threadId}`, "success");
  // 创建新的聊天线程：
  logToFile("New chat thread created", {
    threadId: threadId,
    createdAt: currentThread.created_at,
  });
  // 创建新的聊天线程：
  return currentThread;
}

async function verifyPointIncrease(beforePoints) {
  try {
    await new Promise((resolve) => setTimeout(resolve, 3000));
    const pointData = await getUserPoints();
    const afterPoints = pointData.points.inference;
    const pointIncreased = afterPoints > beforePoints;
    logToFile(
      `Point verification: ${pointIncreased ? "Points increased" : "No change in points"}`,
      {
        before: beforePoints,
        after: afterPoints,
        difference: afterPoints - beforePoints,
      }
    );
    // 点数验证：点数增加/点数无变化
    return pointIncreased;
  } catch (error) {
    logToFile(`Error verifying points: ${error.message}`, { error: error.message }, false);
    // 验证点数时出错：
    return false;
  }
}

async function sendChatMessage(content) {
  try {
    if (!selectedModel) {
      throw new Error("No model selected. Please select a model first.");
      // 未选择模型。请先选择一个模型。
    }
    if (!currentThread) {
      createThread();
    }
    let beforePoints = 0;
    try {
      const pointData = await getUserPoints();
      beforePoints = pointData.points.inference;
      logToFile(`Points before chat: ${beforePoints}`);
      // 聊天前的点数：
    } catch (pointError) {
      logToFile(`Failed to get points before chat: ${pointError.message}`, { error: pointError.message }, false);
      // 聊天前获取点数失败：
    }
    const userMessage = { role: "user", content };
    currentThread.messages.push(userMessage);
    logChat(content, "user");
    logToFile("Sending chat message", {
      threadId: currentThread.id,
      model: selectedModel,
      messageContent: content.substring(0, 100) + (content.length > 100 ? "..." : ""),
      messageLength: content.length,
    });
    // 发送聊天消息：
    const chatPayload = {
      id: currentThread.id,
      title: currentThread.title || "",
      language: "english",
      messages: currentThread.messages,
      model: selectedModel,
      sources: [],
    };
    log(`Sending chat message to ${selectedModel}...`, "info");
    // 发送聊天消息到 ${selectedModel}...
    let streamAborted = false;
    let aiResponse = "";
    const sendChatRequest = async () => {
      try {
        logApiRequest(
          "POST",
          `${config.BASE_URL}/chat`,
          chatPayload,
          { ...getAuthHeaders(), "Content-Type": "application/json" },
          true
        );
        const agent = getProxyAgent(config.BASE_URL);
        const axiosConfig = {
          headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
          responseType: "text",
          timeout: 30000,
        };
        if (agent) {
          if (config.BASE_URL.startsWith("https")) {
            axiosConfig.httpsAgent = agent;
          } else {
            axiosConfig.httpAgent = agent;
          }
        }
        const response = await axios.post(`${config.BASE_URL}/chat`, chatPayload, axiosConfig);
        logApiResponse(
          "/chat",
          {
            model: selectedModel,
            threadId: currentThread.id,
            responseStatus: response.status,
            responsePreview:
              typeof response.data === "string"
                ? response.data.substring(0, 200) + (response.data.length > 200 ? "..." : "")
                : response.data,
            responseLength: typeof response.data === "string" ? response.data.length : "N/A",
          },
          response.status,
          response.headers,
          true
        );
        return response;
      } catch (error) {
        if (error.message.includes("stream") && error.message.includes("abort")) {
          streamAborted = true;
          logToFile("Stream aborted, will verify with points", { error: error.message });
          // 流中断，将通过点数验证
          return { data: "", status: 200, headers: {} };
        }
        throw error;
      }
    };
    let response;
    try {
      response = await executeWithRetry(sendChatRequest, `Chat to ${selectedModel}`);
      // 使用重试执行聊天到 ${selectedModel}
    } catch (error) {
      streamAborted = true;
      logToFile(`All retries failed, will verify with points: ${error.message}`, { error: error.message });
      // 所有重试失败，将通过点数验证：
      response = { data: "", status: 0, headers: {} };
    }
    if (streamAborted) {
      log("Verifying chat with point increase...", "warning");
      // 通过点数增加验证聊天...
      const pointVerified = await verifyPointIncrease(beforePoints);
      if (pointVerified) {
        log("Chat verified successfully through point increase!", "success");
        // 通过点数增加成功验证聊天！
        aiResponse = "[Response received but stream was aborted. Chat verified through point increase]";
        // [已收到响应，但流已中止。通过点数增加验证聊天]
      } else {
        throw new Error("Chat failed: Stream aborted and no point increase detected");
        // 聊天失败：流已中止，未检测到点数增加
      }
    } else {
      if (typeof response.data === "string") {
        try {
          const dataLines = response.data.split("\n");
          for (const line of dataLines) {
            if (line.startsWith("data:")) {
              const jsonStr = line.substring(5).trim();
              const eventData = JSON.parse(jsonStr);
              if (eventData && eventData.content) {
                aiResponse = eventData.content;
                break;
              }
            }
          }
          if (!aiResponse && response.data.length > 0) {
            aiResponse = "[Response received but could not be parsed]";
            // [已收到响应，但无法解析]
          }
        } catch (parseError) {
          logToFile("Error parsing streaming response", {
            error: parseError.message,
            responsePreview: response.data.substring(0, 500),
          }, false);
          // 解析流式响应时出错：
          aiResponse = "[Response could not be parsed]";
          // [响应无法解析]
        }
      }
      if (!aiResponse) {
        aiResponse = "Response received (streaming responses not fully implemented)";
        // 收到响应（流式响应未完全实现）
      }
    }
    currentThread.messages.push({ role: "assistant", content: aiResponse });
    logChat(aiResponse, "assistant");
    logToFile("Received AI response", {
      threadId: currentThread.id,
      model: selectedModel,
      responsePreview: aiResponse.substring(0, 100) + (aiResponse.length > 100 ? "..." : ""),
      responseLength: aiResponse.length,
      streamAborted: streamAborted,
    });
    // 收到 AI 响应：
    return aiResponse;
  } catch (error) {
    const errorMsg = `Error sending chat message: ${error.message}`;
    log(errorMsg, "error");
    logApiError("/chat", error);
    throw error;
  }
}

function getCurrentThread() {
  return currentThread;
}

module.exports = {
  createThread,
  sendChatMessage,
  setSelectedModel,
  getSelectedModel,
  getCurrentThread,
};
