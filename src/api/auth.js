const fs = require("fs");
const path = require("path");
const axios = require("axios");
const config = require("../../config");
const {
  log,
  logToFile,
  logApiRequest,
  logApiResponse,
  logApiError,
  readFile,
  fileExists,
} = require("../utils");
const pLimit = require("p-limit");

// =========== PROXY IMPORTS & GLOBALS ===========
// 代理导入和全局变量
const { HttpsProxyAgent } = require("https-proxy-agent");
const { HttpProxyAgent } = require("http-proxy-agent");

const PROXY_FILE = "proxies.txt";
let allProxies = [];
let currentProxyIndex = 0;
let persistentAgent = null;

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
 
  persistentAgent = null;
  return proxyUrl;
}

function getProxyAgent(targetUrl) {
  if (persistentAgent) return persistentAgent;
  const proxyUrl = getCurrentProxy();
  if (!proxyUrl) return null;
  if (targetUrl.startsWith("https")) {
    persistentAgent = new HttpsProxyAgent(proxyUrl);
  } else {
    persistentAgent = new HttpProxyAgent(proxyUrl);
  }
  return persistentAgent;
}
// =========== END PROXY LOGIC ===========
// 结束代理逻辑

const SESSION_TOKEN_PATH = path.join(process.cwd(), "session-token.key");

const MAX_RETRIES = 5;
const RETRY_DELAY_MS = 2000;
const RETRY_MULTIPLIER = 1.5;

let sessionToken = null;
let cachedUserInfo = null;

let allTokens = [];
let currentTokenIndex = 0;

function getSessionToken() {
  return sessionToken;
}

function getTokenInfo() {
  return {
    currentIndex: currentTokenIndex,
    totalTokens: allTokens.length,
    hasMultipleTokens: allTokens.length > 1,
  };
}

function readAllSessionTokensFromFile() {
  try {
    if (fileExists(SESSION_TOKEN_PATH)) {
      const fileContent = readFile(SESSION_TOKEN_PATH);
      if (fileContent && fileContent.trim().length > 0) {
        const tokens = fileContent
          .split("\n")
          .map((line) => line.trim())
          .filter((line) => line.length > 0);

        logToFile("Read session tokens from file", {
          tokenCount: tokens.length,
          tokenPreview: tokens.map((t) => t.substring(0, 10) + "..."),
        });

        return tokens;
      }
    }
    return [];
  } catch (error) {
    logToFile("Error reading session tokens from file", {
      error: error.message,
    });
    return [];
  }
}

async function verifyToken(token) {
  try {
    log("Verifying token validity...", "info");
    // 验证令牌有效性...
    logToFile("Verifying token validity");
    // 验证令牌有效性

    const headers = {
      ...config.DEFAULT_HEADERS,
      "X-Session-Token": token,
    };

    const verifyRequest = async () => {
      logApiRequest("GET", `${config.BASE_URL}/me`, null, headers);

      const agent = getProxyAgent(config.BASE_URL);
      const axiosConfig = {
        headers,
        timeout: 10000,
      };
      if (agent) {
        if (config.BASE_URL.startsWith("https")) {
          axiosConfig.httpsAgent = agent;
        } else {
          axiosConfig.httpAgent = agent;
        }
      }

      const response = await axios.get(`${config.BASE_URL}/me`, axiosConfig);
      logApiResponse("/me", response.data, response.status, response.headers);
      return response.status === 200;
    };

    return await executeWithRetry(verifyRequest, "Token verification");
    // 使用重试执行验证令牌
  } catch (error) {
    log(`Token verification failed: ${error.message}`, "warning");
    // 令牌验证失败
    logToFile("Token verification failed", { error: error.message });
    // 令牌验证失败
    return false;
  }
}

async function verifyAndCleanupTokens() {
  try {
    log("Verifying and cleaning up tokens...", "info");
    // 验证和清理令牌...
    logToFile("Starting token verification and cleanup");
    // 开始令牌验证和清理

    const tokens = readAllSessionTokensFromFile();

    if (tokens.length === 0) {
      log("No tokens found to verify", "warning");
      // 没有找到要验证的令牌
      return 0;
    }

    log(`Verifying ${tokens.length} tokens...`, "info");
    // 验证 ${tokens.length} 个令牌...

    // Khởi tạo p-limit để giới hạn số lượng luồng song song (có thể điều chỉnh số luồng này)
    const limit = pLimit(config.THREADS || 10); // Chạy tối đa 5 luồng song song
    // 创建 p-limit 以限制并发线程数（可以调整线程数）
    // 运行最多 5 个并发线程

    // Tạo các promise để kiểm tra từng token song song
    const promises = tokens.map((token, index) =>
      limit(async () => {
        log(`Verifying token ${index + 1}/${tokens.length}...`, "info");
        // 验证令牌 ${index + 1}/${tokens.length}...

        const isValid = await verifyToken(token);

        if (isValid) {
          log(`Token ${index + 1}/${tokens.length} is valid`, "success");
          // 令牌 ${index + 1}/${tokens.length} 有效
        } else {
          log(`Token ${index + 1}/${tokens.length} is invalid or expired`, "warning");
          // 令牌 ${index + 1}/${tokens.length} 无效或已过期
        }
      })
    );

    // Chờ đợi tất cả các promise hoàn thành và lọc ra các token hợp lệ
    const validTokens = (await Promise.all(promises)).filter(Boolean); // Loại bỏ các null (token không hợp lệ)
    // 等待所有 promise 完成并过滤出有效令牌
    // 移除所有 null 值（无效令牌）

    // Ghi lại các token hợp lệ vào file
    fs.writeFileSync(
      SESSION_TOKEN_PATH,
      validTokens.join("\n") + (validTokens.length > 0 ? "\n" : "")
    );

    log(
      `Token verification complete. ${validTokens.length}/${tokens.length} tokens are valid`,
      validTokens.length > 0 ? "success" : "warning"
    );
    // 令牌验证完成。${validTokens.length}/${tokens.length} 个令牌有效
    logToFile("Token verification and cleanup completed", {
      totalTokens: tokens.length,
      validTokens: validTokens.length,
    });
    // 令牌验证和清理完成

    allTokens = validTokens;
    currentTokenIndex = 0;

    return validTokens.length;
  } catch (error) {
    log(`Error during token verification: ${error.message}`, "error");
    // 令牌验证期间出错
    logToFile("Token verification failed", { error: error.message });
    // 令牌验证失败
    return 0;
  }
}

function getCurrentSessionToken() {
  if (allTokens.length === 0) {
    allTokens = readAllSessionTokensFromFile();
    currentTokenIndex = 0;
  }

  if (allTokens.length === 0) {
    return null;
  }

  if (currentTokenIndex >= allTokens.length) {
    currentTokenIndex = 0;
  }

  return allTokens[currentTokenIndex];
}

function switchToNextToken() {
  if (allTokens.length === 0) {
    allTokens = readAllSessionTokensFromFile();
  }

  if (allTokens.length === 0) {
    return null;
  }

  currentTokenIndex = (currentTokenIndex + 1) % allTokens.length;
  sessionToken = allTokens[currentTokenIndex];

  log(
    `Switched to account ${currentTokenIndex + 1}/${allTokens.length}`,
    "info"
  );
  // 切换到账号 ${currentTokenIndex + 1}/${allTokens.length}
  logToFile(`Switched to next token`, {
    newIndex: currentTokenIndex,
    totalTokens: allTokens.length,
    tokenPreview: sessionToken.substring(0, 10) + "...",
  });
  // 切换到下一个令牌

  cachedUserInfo = null;

  return sessionToken;
}

function getAuthHeaders(headers = {}) {
  if (!sessionToken) {
    throw new Error("Not authenticated. Please login first.");
    // 未认证。请先登录。
  }

  return {
    ...config.DEFAULT_HEADERS,
    ...headers,
    "X-Session-Token": sessionToken,
  };
}

async function executeWithRetry(requestFn, requestName, retryCount = 0) {
  try {
    return await requestFn();
  } catch (error) {
    const isNetworkError =
      error.message.includes("socket hang up") ||
      error.message.includes("network") ||
      error.message.includes("timeout") ||
      error.message.includes("ECONNREFUSED");

    const isServerError = error.response && error.response.status >= 500;

    const isAuthError =
      error.response &&
      (error.response.status === 401 || error.response.status === 403);

    if (isAuthError && allTokens.length > 1) {
      logToFile(
        `Auth error with current token, switching to next token`,
        {
          error: error.message,
          previousTokenIndex: currentTokenIndex,
        },
        false
      );
      // 当前令牌出现验证错误，切换到下一个令牌

      switchToNextToken();

      return executeWithRetry(requestFn, `${requestName} (with new token)`, 0);
      // 使用新令牌重试执行
    }

    if ((isNetworkError || isServerError) && retryCount < MAX_RETRIES) {
      switchToNextProxy();
      const nextRetryCount = retryCount + 1;
      const delay = RETRY_DELAY_MS * Math.pow(RETRY_MULTIPLIER, retryCount);

      logToFile(
        `${requestName} failed (${error.message}). Retrying (${nextRetryCount}/${MAX_RETRIES}) in ${delay / 1000}s...`,
        {
          error: error.message,
          retry: nextRetryCount,
          maxRetries: MAX_RETRIES,
          delayMs: delay,
        },
        false
      );
      // ${requestName} 失败 (${error.message})。在 ${delay / 1000}s 后重试 (${nextRetryCount}/${MAX_RETRIES})...

      await new Promise((resolve) => setTimeout(resolve, delay));

      return executeWithRetry(requestFn, requestName, nextRetryCount);
    }

    throw error;
  }
}

async function login(switchToken = false) {
  try {
    log("Starting login with session token...", "info");
    // 开始使用会话令牌登录...
    logToFile("Starting login with session token");
    // 开始使用会话令牌登录

    if (switchToken || !sessionToken) {
      if (switchToken) {
        switchToNextToken();
      } else {
        sessionToken = getCurrentSessionToken();
      }
    }

    if (!sessionToken) {
      const error = new Error(
        "No session token found. Please add session-token.key file with at least one token."
      );
      log(error.message, "error");
      logToFile("Login failed - no token file or empty file");
      // 登录失败 - 没有令牌文件或文件为空
      throw error;
    }

    log("Session token loaded", "info");
    // 会话令牌已加载
    log("Validating session token...", "info");
    // 验证会话令牌...

    const validateRequest = async () => {
      log("Testing session token validity...", "info");
      // 测试会话令牌有效性...

      const agent = getProxyAgent(config.BASE_URL);
      const axiosConfig = { headers: getAuthHeaders() };
      if (agent) {
        if (config.BASE_URL.startsWith("https")) {
          axiosConfig.httpsAgent = agent;
        } else {
          axiosConfig.httpAgent = agent;
        }
      }

      const response = await axios.get(`${config.BASE_URL}/me`, axiosConfig);
      logApiResponse("/me", response.data, response.status, response.headers);
      cachedUserInfo = response.data;
      return response.data;
    };

    try {
      await executeWithRetry(validateRequest, "Token validation");
      // 使用重试执行令牌验证

      log(
        `Session token is valid! Account ${currentTokenIndex + 1}/${
          allTokens.length
        }`,
        "success"
      );
      // 会话令牌有效！账号 ${currentTokenIndex + 1}/${allTokens.length}
      logToFile("Login successful with session token", {
        userId: cachedUserInfo.user_id,
        authProvider: cachedUserInfo.auth_provider,
        tokenIndex: currentTokenIndex,
        totalTokens: allTokens.length,
      });
      // 使用会话令牌登录成功

      return sessionToken;
    } catch (error) {
      if (allTokens.length > 1) {
        log("Token invalid, trying next token...", "warning");
        // 令牌无效，尝试下一个令牌...
        switchToNextToken();
        return login(false);
      }
      throw error;
    }
  } catch (error) {
    const errorMsg = `Login failed: ${error.message}`;
    log(errorMsg, "error");
    logToFile("Login failed", { error: error.message });
    // 登录失败
    sessionToken = null;
    throw error;
  }
}

async function getUserInfo(useCache = false) {
  if (useCache && cachedUserInfo) {
    logToFile("Returning user info from cache");
    // 从缓存返回用户信息
    return cachedUserInfo;
  }

  try {
    log("Getting user information...", "info");
    // 获取用户信息...
    logToFile("Getting user information");
    // 获取用户信息

    const headers = getAuthHeaders();

    const getUserRequest = async () => {
      logApiRequest("GET", `${config.BASE_URL}/me`, null, headers);

      const agent = getProxyAgent(config.BASE_URL);
      const requestConfig = {
        headers,
        timeout: 10000,
      };
      if (agent) {
        if (config.BASE_URL.startsWith("https")) {
          requestConfig.httpsAgent = agent;
        } else {
          requestConfig.httpAgent = agent;
        }
      }

      const response = await axios.get(`${config.BASE_URL}/me`, requestConfig);
      logApiResponse("/me", response.data, response.status, response.headers);
      return response.data;
    };

    const userData = await executeWithRetry(getUserRequest, "Get user info");
    // 使用重试执行获取用户信息
    log("User info retrieved successfully", "success");
    // 用户信息检索成功
    cachedUserInfo = userData;
    return userData;
  } catch (error) {
    const errorMsg = `Error getting user info: ${error.message}`;
    log(errorMsg, "error");
    logApiError("/me", error);
    throw error;
  }
}

async function makeApiRequest(method, endpoint, data = null, additionalHeaders = {}) {
  try {
    const headers = getAuthHeaders(additionalHeaders);
    const url = `${config.BASE_URL}${endpoint}`;

    const apiRequest = async () => {
      logApiRequest(method, url, data, headers);

      const agent = getProxyAgent(url);
      const requestConfig = {
        method,
        url,
        headers,
        timeout: 10000,
      };
      if (agent) {
        if (url.startsWith("https")) {
          requestConfig.httpsAgent = agent;
        } else {
          requestConfig.httpAgent = agent;
        }
      }
      if (data) {
        requestConfig.data = data;
      }

      const response = await axios(requestConfig);
      logApiResponse(endpoint, response.data, response.status, response.headers);
      return response.data;
    };

    return await executeWithRetry(apiRequest, `${method} ${endpoint}`);
    // 使用重试执行 API 请求
  } catch (error) {
    const errorMsg = `API request failed (${method} ${endpoint}): ${error.message}`;
    log(errorMsg, "error");
    logApiError(endpoint, error);
    throw error;
  }
}

module.exports = {
  verifyToken,
  verifyAndCleanupTokens,
  login,
  getUserInfo,
  getSessionToken,
  getAuthHeaders,
  getCurrentSessionToken,
  getTokenInfo,
  switchToNextToken,
  makeApiRequest,
  executeWithRetry,
  readAllSessionTokensFromFile,
};
