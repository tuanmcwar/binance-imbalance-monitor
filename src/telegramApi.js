
import axios from "axios";
import FormData from "form-data";
import { config } from "./config.js";

const telegram = axios.create({
  baseURL: `https://api.telegram.org/bot${config.telegramToken}`,
  timeout: 35000
});

export { telegram };

export async function sendMessage(text, options = {}) {
  const { data } = await telegram.post("/sendMessage", {
    chat_id: config.telegramChatId,
    text,
    ...options
  });

  if (!data.ok) {
    throw new Error(data.description || "Telegram gửi lỗi");
  }

  return data.result;
}

export async function sendPhoto(imageBuffer, options = {}) {
  const form = new FormData();

  form.append("chat_id", config.telegramChatId);

  form.append("photo", imageBuffer, {
    filename: "chart.png",
    contentType: "image/png"
  });

  if (options.caption) {
    form.append("caption", options.caption);
  }

  if (options.reply_markup) {
    form.append(
      "reply_markup",
      JSON.stringify(options.reply_markup)
    );
  }

  const { data } = await telegram.post("/sendPhoto", form, {
    headers: form.getHeaders(),
    timeout: 60000,
    maxBodyLength: Infinity
  });

  if (!data.ok) {
    throw new Error(data.description || "Telegram gửi ảnh lỗi");
  }

  return data.result;
}
