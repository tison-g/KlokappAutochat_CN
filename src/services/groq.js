const { Groq } = require("groq-sdk");
const config = require("../../config");
const { readFile, fileExists, log } = require("../utils");

let groqClient = null;

/**
 * 初始化并返回 Groq 客户端实例
 * @returns {Object} 返回 Groq 客户端对象
 */
function initGroqClient() {
  try {
    if (groqClient) return groqClient;

    let apiKey;

    if (fileExists(config.GROQ_API_KEY_PATH)) {
      apiKey = readFile(config.GROQ_API_KEY_PATH);
    } else {
      apiKey = process.env.GROQ_API_KEY;
    }

    if (!apiKey) {
      throw new Error(
        "未找到 Groq API 密钥。请创建 groq-api.key 文件或设置 GROQ_API_KEY 环境变量。"
      );
    }

    groqClient = new Groq({ apiKey });
    log("Groq 客户端初始化成功", "success");

    return groqClient;
  } catch (error) {
    log(`初始化 Groq 客户端时出错: ${error.message}`, "error");
    throw error;
  }
}

/**
 * 生成用户消息
 * @returns {Promise<string>} 返回生成的消息内容
 */
async function generateUserMessage() {
  try {
    const client = initGroqClient();

    const completion = await client.chat.completions.create({
      messages: [
        {
          role: "system",
          content:
            "您是一位有帮助的助手。生成一个随机的、有趣的问题或提示给 AI 助手。保持简洁（最多 2 句话），并且要能引发有趣的对话。[...]"
        },
        {
          role: "user",
          content: "生成一个有趣的提示。",
        },
      ],
      model: config.GROQ_MODEL,
    });

    return completion.choices[0].message.content;
  } catch (error) {
    log(`使用 Groq 生成消息时出错: ${error.message}`, "error");
    return "你好，能告诉我一些有趣的事情吗？";
  }
}

module.exports = {
  initGroqClient,
  generateUserMessage,
};
