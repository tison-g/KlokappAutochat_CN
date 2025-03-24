# KlokAI 聊天自动化工具 🚀

一个基于终端的 KlokApp AI 聊天自动化工具，支持会话令牌认证和弹性重试机制。

---

## ✨ 主要功能

- **🔑 会话令牌认证** - 使用 KlokApp 会话令牌直接登录
- **📊 交互式仪表盘** - 使用 `blessed` 和 `blessed-contrib` 构建的精美终端界面
- **🤖 自动化提示** - 使用 Groq API 生成创意提示
- **⏳ 速率限制管理** - 达到限制时自动冷却
- **📌 点数追踪** - 实时监控推理点数
- **🔄 自动重试** - 处理网络和服务器错误
- **📡 流验证** - 确保消息成功传递
- **🌐 代理支持** - 可使用用户提供的代理，默认使用系统 IP
- **📜 详细日志** - 全面的监控和调试

---

## 📂 目录结构

```
klokapp-automation/
├── package.json         # 项目依赖
├── session-token.key    # 登录会话令牌（必需）
├── groq-api.key        # Groq API 密钥
├── proxies.txt         # 代理配置（可选）
├── info.log            # 监控日志文件
├── index.js            # 主入口点
├── config.js           # 应用配置
└── src/
    ├── api/            # KlokApp API 函数
    ├── ui/             # UI 组件
    ├── services/       # 外部服务
    └── utils/          # 实用工具
```

---

## 🛠️ 安装说明

### 🔹 Linux/macOS

1️⃣ 打开终端并克隆仓库：
   ```sh
   git clone https://github.com/tison-g/KlokappAutochat_CN.git
   cd KlokappAutochat_CN
   ```

2️⃣ 安装依赖：
   ```sh
   npm install
   ```

3️⃣ 配置**代理**：
   - 使用 nano 打开 `proxies.txt`：
     ```sh
     nano proxies.txt
     ```
   - 按以下格式添加代理：
     ```sh
     http://username:password@ip:port
     ```
   - 示例：
     ```sh
     http://user123:pass456@192.168.1.1:8080
     ```
   - 如果 `proxies.txt` 为空或缺失，应用将使用默认系统 IP。
   - 保存文件（按 `CTRL + X`，然后按 `Y`，最后按 `Enter`）。

4️⃣ 配置**会话令牌**：
   ```sh
   nano session-token.key
   ```
   - 粘贴你的 `session_token` 并保存文件。

5️⃣ 注册 **Groq API 密钥**：
   - 访问 [Groq Console](https://console.groq.com/login) 并创建账户。
   - 复制你的 **API 密钥**并保存：
     ```sh
     nano groq-api.key
     ```
   - 粘贴你的 API 密钥并保存文件。

6️⃣ 运行应用：
   ```sh
   npm run start
   ```

### 🔹 Windows

1️⃣ 打开 **PowerShell** 并运行：
   ```powershell
   git clone https://github.com/tison-g/KlokappAutochat_CN.git
   cd Klok-BOT
   ```

2️⃣ 安装依赖：
   ```powershell
   npm install
   ```

3️⃣ 配置**代理**：
   - 打开 `proxies.txt` 并按以下格式添加代理：
     ```sh
     http://username:password@ip:port
     ```
   - 示例：
     ```sh
     http://user123:pass456@192.168.1.1:8080
     ```
   - 如果 `proxies.txt` 为空或缺失，应用将使用默认系统 IP。

4️⃣ 配置**会话令牌**：
   - 使用 Notepad++ 打开 `session-token.key` 并粘贴你的 **session_token**。
   - 保存并关闭文件。

5️⃣ 注册 **Groq API 密钥**：
   - 访问 [Groq Console](https://console.groq.com/login) 并创建账户。
   - 使用 Notepad++ 打开 `groq-api.key` 并粘贴你的 **Groq API KEY**。
   - 复制你的 **API 密钥**并保存在 `groq-api.key` 中。

6️⃣ 启动应用：
   ```powershell
   npm run start
   ```

---

## 🔐 设置会话令牌

1️⃣ 在浏览器中**登录 KlokApp**。
2️⃣ 打开**开发者工具**（按 `F12` 或 `Ctrl + Shift + I`）。
3️⃣ 导航到 **Application** > **Local Storage** > `https://klokapp.ai`。
4️⃣ 找到并复制 `session_token` 值。

📌 **示例截图：**

![会话令牌指南](assets/session-token-guide.png)

---

## 🎛️ 运行自动化

启动脚本：
```sh
npm start
```

### 🎮 键盘控制

- `S` - 开始自动化（需要 session-token.key）
- `P` - 暂停自动化
- `R` - 恢复自动化
- `L` - 清除日志文件
- `I` - 显示文件信息
- `H` - 显示帮助
- `Q` 或 `Esc` - 退出应用

---

## 📜 日志和错误处理

- **自动重试** - 网络/服务器失败时重试
- **指数退避** - 连续失败时增加等待时间
- **错误日志** - 记录所有失败以便调试
- **自动恢复** - 条件恢复正常时自动继续

---

## 🛠️ 其他命令

清除日志文件：
```sh
npm run clear-logs
```

---

## 🔗 有用链接 🌍

- [原作者仓库](https://github.com/rpchubs)
- [KlokAI](https://klokapp.ai?referral_code=QTTJ6UPX)
- [Groq Console](https://console.groq.com/login)

---

🚀 **祝您使用愉快！** 🎯
