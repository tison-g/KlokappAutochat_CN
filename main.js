const fs = require("fs");
const path = require("path");
const { authenticateAllWallets } = require("./src/api/signin");
const {
  initDashboard,
  registerKeyHandler,
  render,
  updateStatus,
  widgets,
} = require("./src/ui");
const {
  initAutomation,
  startAutomation,
  pauseAutomation,
  resumeAutomation,
  manualSwitchAccount,
  getRunningState,
} = require("./src/automation");
const { auth } = require("./src/api");
const {
  log,
  logToFile,
  checkLogSize,
  clearLogFile,
  backupLogFile,
} = require("./src/utils");

// 从文件中读取私钥
function readPrivateKeysFromFile(filePath) {
  const absolutePath = path.resolve(filePath);
  if (!fs.existsSync(absolutePath)) {
    console.error(`文件 ${absolutePath} 不存在。`);
    return [];
  }
  const data = fs.readFileSync(absolutePath, "utf8");
  return data.split(/\r?\n/).filter(line => line.trim() !== "");
}

// 清除会话令牌文件
function clearSessionTokenFile() {
  const tokenPath = path.join(process.cwd(), "session-token.key");
  
  fs.writeFileSync(tokenPath, "", "utf8");
  console.log("[信息] session-token.key 已清除。");
}

async function main() {
  try {
    checkLogSize(); // 检查日志文件大小

    initDashboard(); // 初始化仪表板

    // clearSessionTokenFile(); // 清除会话令牌文件（已注释）

    log("欢迎使用 KlokApp 聊天自动化", "info");
    log("按 S 开始，P 暂停，R 恢复，H 查看帮助", "info");
    logToFile("KlokApp 聊天自动化已启动");

    // 验证并清理令牌
    const validTokenCount = await auth.verifyAndCleanupTokens();
    log(`令牌数量: ${validTokenCount}`)
    if (validTokenCount === 0) {
      // 没有有效令牌时，尝试认证
      log("未找到有效的会话令牌。正在尝试认证...", "info");
      updateStatus("正在认证...", "info");
      render();

      // 从 priv.txt 读取私钥
      const privateKeys = readPrivateKeysFromFile("priv.txt");
      if (privateKeys.length === 0) {
        log("在 priv.txt 文件中未找到私钥。", "error");
        updateStatus("缺少 priv.txt 文件中的私钥", "error");
      } else {
        log(`找到 ${privateKeys.length} 个私钥。正在认证...`, "info");

        await authenticateAllWallets(privateKeys);

        const tokens = auth.readAllSessionTokensFromFile();

        if (tokens.length === 0) {
          log("认证失败。未收到有效令牌。", "error");
          updateStatus("认证失败", "error");
        } else {
          log(`认证成功！${tokens.length} 个账户已就绪。`, "success");
          updateStatus(`${tokens.length} 个账户已就绪。按 S 开始`, "success");
        }
      }
    } else if (validTokenCount === 1) {
      log("找到一个有效的会话令牌！可以登录。", "success");
      updateStatus("会话令牌已就绪。按 S 开始", "success");
    } else {
      log(`找到 ${validTokenCount} 个有效的会话令牌！可以登录。`, "success");
      updateStatus(`${validTokenCount} 个账户已就绪。按 S 开始`, "success");
    }

    render();

    await initAutomation(); // 初始化自动化

    // 注册按键处理器 - S 键：开始自动化
    registerKeyHandler("s", async () => {
      if (!getRunningState()) {
        const tokens = auth.readAllSessionTokensFromFile();
        if (tokens.length === 0) {
          log(
            "未找到会话令牌。请添加 session-token.key 文件。",
            "error"
          );
          updateStatus("缺少 session-token.key", "error");
          render();
          return;
        }

        const isValid = await auth.verifyToken(tokens[0]);
        if (!isValid) {
          log("会话令牌已过期。需要重新认证。", "error");
          updateStatus("令牌已过期。按 'A' 重新认证", "error");
          render();
          return;
        }

        log("正在启动自动化...", "info");
        logToFile("开始自动化（用户启动）");
        startAutomation();
      } else {
        log("自动化已在运行中", "warning");
        logToFile("启动请求被忽略 - 自动化已在运行");
      }
    });

    // 注册按键处理器 - P 键：暂停自动化
    registerKeyHandler("p", () => {
      if (getRunningState()) {
        log("正在暂停自动化...", "info");
        logToFile("暂停自动化（用户操作）");
        pauseAutomation();
      } else {
        log("自动化未在运行", "warning");
        logToFile("暂停请求被忽略 - 自动化未在运行");
      }
    });

    // 注册按键处理器 - R 键：恢复自动化
    registerKeyHandler("r", () => {
      if (!getRunningState()) {
        log("正在恢复自动化...", "info");
        logToFile("恢复自动化（用户操作）");
        resumeAutomation();
      } else {
        log("自动化已在运行中", "warning");
        logToFile("恢复请求被忽略 - 自动化已在运行");
      }
    });

    // 注册按键处理器 - A 键：切换账户或重新认证
    registerKeyHandler("a", async () => {
      const tokenInfo = auth.getTokenInfo();
      if (getRunningState()) {
        log("正在手动切换账户...", "info");
        logToFile("手动切换账户已启动");

        const success = await manualSwitchAccount();
        if (success) {
          log("账户切换成功", "success");
        } else {
          log("账户切换失败", "error");
        }
      } else {
        if (tokenInfo.hasMultipleTokens) {
          log("只有一个账户可用，无法切换", "warning");
          return;
        }

        log("正在重新认证账户...", "info");
        logToFile("重新认证已启动");
        updateStatus("正在重新认证...", "info");
        render();

        const privateKeys = readPrivateKeysFromFile("priv.txt");
        if (privateKeys.length === 0) {
          log("在 priv.txt 文件中未找到私钥。", "error");
          updateStatus("缺少 priv.txt 文件中的私钥", "error");
        } else {
          await authenticateAllWallets(privateKeys);
          const tokens = auth.readAllSessionTokensFromFile();
          if (tokens.length > 0) {
            log(
              `重新认证成功！${tokens.length} 个账户已就绪。`,
              "success"
            );
            updateStatus(
              `${tokens.length} 个账户已就绪。按 S 开始`,
              "success"
            );
          } else {
            log("重新认证失败。未收到有效令牌。", "error");
            updateStatus("重新认证失败", "error");
          }
        }
      }
    });

    // 注册按键处理器 - L 键：清理日志文件
    registerKeyHandler("l", () => {
      const backupPath = backupLogFile();
      clearLogFile();
      if (backupPath) {
        log(`日志文件已清理并备份到 ${backupPath}`, "success");
        logToFile("日志文件已清理并备份（用户操作）");
      } else {
        log("日志文件已清理", "success");
        logToFile("日志文件已清理（用户操作）");
      }
      render();
    });

    // 注册按键处理器 - I 键：显示文件和账户信息
    registerKeyHandler("i", () => {
      const fs = require("fs");
      const path = require("path");

      try {
        const logPath = path.join(process.cwd(), "info.log");
        if (fs.existsSync(logPath)) {
          const stats = fs.statSync(logPath);
          const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2);
          const lastModified = new Date(stats.mtime).toLocaleString();

          log(
            `日志文件：大小=${fileSizeMB}MB，最后修改时间：${lastModified}`,
            "info"
          );
        } else {
          log("日志文件尚未存在", "info");
        }
      } catch (error) {
        log(`读取日志信息错误：${error.message}`, "error");
      }

      try {
        const tokens = auth.readAllSessionTokensFromFile();
        const tokenInfo = auth.getTokenInfo();

        if (tokens.length === 0) {
          log("未找到账户", "warning");
        } else if (tokens.length === 1) {
          log("已配置 1 个账户", "info");
        } else {
          log(
            `已配置 ${tokens.length} 个账户，当前：${
              tokenInfo.currentIndex + 1
            }/${tokenInfo.totalTokens}`,
            "info"
          );
        }
      } catch (error) {
        log(`检查账户时出错：${error.message}`, "error");
      }

      updateStatus("信息已显示", "info");

      setTimeout(() => {
        updateStatus(
          getRunningState() ? "运行中" : "就绪",
          getRunningState() ? "success" : "info"
        );
        render();
      }, 5000);

      render();
    });

    // 注册按键处理器 - H 键：显示帮助信息
    registerKeyHandler("h", () => {
      log("控制命令：", "info");
      log("S - 开始自动化（需要至少一个会话令牌）", "info");
      log("P - 暂停自动化", "info");
      log("R - 恢复自动化", "info");
      log("A - 运行时：切换到下一个账户；停止时：重新认证", "info");
      log("L - 清理日志文件并备份", "info");
      log("I - 显示文件和账户信息", "info");
      log("H - 显示此帮助", "info");
      log("Q 或 Esc - 退出应用", "info");

      updateStatus("帮助 - 按任意键继续", "info");
      render();

      setTimeout(() => {
        updateStatus(
          getRunningState() ? "运行中" : "就绪",
          getRunningState() ? "success" : "info"
        );
        render();
      }, 8000);
    });
  } catch (error) {
    log(`应用程序错误：${error.message}`, "error");
    logToFile(`应用程序错误：${error.message}`, { stack: error.stack });
    updateStatus("错误", "error");
    render();
  }
}

main();
