
import { config } from "./config.js";
import { telegram, sendMessage, sendPhoto } from "./telegramApi.js";

import {
  normalizeSymbol,
  mainKeyboard,
  helpText,
  addSymbol,
  removeSymbol,
  pauseSymbol,
  resumeSymbol,
  checkSymbol,
  listResult,
  statusResult,
  clearResult,
  clearConfirmation,
  menuResult,
  handleError
} from "./commands.js";

export { sendMessage, sendPhoto };

let running = false;
let offset = 0;

// ==========================================
// SEND REPORT + MENU BUTTON
// ==========================================

export async function sendReport(text) {
  return sendMessage(text, {
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: "📋 Danh sách coin",
            callback_data: "menu:list"
          }
        ]
      ]
    }
  });
}

// ==========================================
// CALLBACK
// ==========================================

async function answerCallback(callbackId, text = "") {
  await telegram.post("/answerCallbackQuery", {
    callback_query_id: callbackId,
    text
  });
}

async function sendResult(result) {
  if (typeof result === "string") {
    return sendMessage(result);
  }

  return sendMessage(result.text, {
    reply_markup: result.reply_markup
  });
}

// ==========================================
// COMMAND HANDLER
// ==========================================

async function handleCommand(text) {
  const [rawCommand, ...args] = text.trim().split(/\s+/);

  const command = rawCommand
    .split("@")[0]
    .toLowerCase();

  const rawSymbol = args[0] || "";

  if (command === "/start" || command === "/help") {
    return sendMessage(helpText(), {
      reply_markup: mainKeyboard()
    });
  }

  if (command === "/list") {
    return sendResult(listResult());
  }

  if (command === "/status") {
    return sendResult(statusResult());
  }

  if (command === "/clear") {
    return sendResult(clearConfirmation());
  }

  const supported = [
    "/add",
    "/remove",
    "/stop",
    "/pause",
    "/resume",
    "/check"
  ];

  if (!supported.includes(command)) {
    return sendMessage(
      "❌ Lệnh không hợp lệ. Gửi /help để xem hướng dẫn."
    );
  }

  const symbol = normalizeSymbol(rawSymbol);

  if (!symbol) {
    return sendMessage(
      `⚠️ Cú pháp: ${command} BTCUSDT`
    );
  }

  if (command === "/add") {
    return sendReport(await addSymbol(symbol));
  }

  if (command === "/remove" || command === "/stop") {
    return sendMessage(removeSymbol(symbol));
  }

  if (command === "/pause") {
    return sendMessage(pauseSymbol(symbol));
  }

  if (command === "/resume") {
    return sendMessage(await resumeSymbol(symbol));
  }

  if (command === "/check") {
    return sendReport(await checkSymbol(symbol));
  }
}

// ==========================================
// INLINE KEYBOARD HANDLER
// ==========================================

async function handleCallback(callback) {
  if (
    String(callback.message?.chat?.id) !==
    config.telegramChatId
  ) {
    await answerCallback(
      callback.id,
      "Không có quyền truy cập"
    );
    return;
  }

  await answerCallback(callback.id);

  const value = String(callback.data || "");
  const [action, argument] = value.split(":");

  if (action === "menu") {
    if (argument === "list") {
      return sendResult(listResult());
    }

    if (argument === "status") {
      return sendResult(statusResult());
    }

    if (argument === "clear") {
      return sendResult(clearConfirmation());
    }

    return sendResult(menuResult(argument));
  }

  if (action === "clear" && argument === "yes") {
    return sendMessage(clearResult());
  }

  const symbol = normalizeSymbol(argument);

  if (!symbol) {
    return sendMessage("❌ Coin không hợp lệ.");
  }

  if (action === "remove") {
    await sendMessage(removeSymbol(symbol));
    return sendResult(listResult());
  }

  if (action === "pause") {
    await sendMessage(pauseSymbol(symbol));
    return sendResult(listResult());
  }

  if (action === "resume") {
    await sendMessage(await resumeSymbol(symbol));
    return sendResult(listResult());
  }

  if (action === "check") {
    return sendReport(await checkSymbol(symbol));
  }
}

// ==========================================
// UPDATE HANDLER
// ==========================================

async function handleUpdate(update) {
  try {
    if (update.callback_query) {
      return await handleCallback(update.callback_query);
    }

    const message = update.message;

    if (!message) return;

    if (
      String(message.chat.id) !==
      config.telegramChatId
    ) {
      return;
    }

    const text = String(message.text || "").trim();

    if (!text) return;

    if (text.startsWith("/")) {
      return await handleCommand(text);
    }

    const symbol = normalizeSymbol(text);

    if (!symbol) {
      return sendMessage(
        "⚠️ Gửi mã coin như BTCUSDT hoặc dùng /help."
      );
    }

    return sendReport(await addSymbol(symbol));

  } catch (error) {
    return sendMessage(handleError(error));
  }
}

// ==========================================
// TELEGRAM POLLING
// ==========================================

export async function startTelegram() {
  running = true;
  let initialized = false;

  while (running) {
    try {
      if (!initialized) {
        const { data } = await telegram.get("/getMe");

        if (!data.ok) {
          throw new Error(
            data.description || "Telegram getMe failed"
          );
        }

        console.log(
          `🤖 Telegram: @${data.result.username}`
        );

        await telegram.post("/deleteWebhook", {
          drop_pending_updates: true
        });

        initialized = true;

        console.log("✅ TELEGRAM CONNECTED");
      }

      const response = await telegram.get("/getUpdates", {
        params: {
          offset,
          timeout: 20,
          allowed_updates: JSON.stringify([
            "message",
            "callback_query"
          ])
        },
        timeout: 30000
      });

      for (const update of response.data.result || []) {
        offset = update.update_id + 1;

        await handleUpdate(update);
      }

    } catch (error) {
      console.error(
        `[TELEGRAM ERROR] ${error.code || ""}: ${error.message}`
      );

      if (!running) break;

      console.log(
        "🔄 Thử kết nối lại sau 5 giây..."
      );

      await new Promise(resolve =>
        setTimeout(resolve, 5000)
      );
    }
  }
}

export function stopTelegram() {
  running = false;
}
