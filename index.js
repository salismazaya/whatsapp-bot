// https://github.com/salismazaya/whatsapp-bot
// Jika ingin mengubah / mengedit, mohon untuk tidak menghilangkan link github asli di dalam bot terimakasih ^_^

const fs = require("fs");
const conn = require("./lib/conn.js");;
const messageHandler = require("./messageHandler.js");

if (fs.existsSync("login.json")) conn.loadAuthInfo("login.json");

conn.on("chat-update", async (message) => {
	try {
		if (!message.hasNewMessage) return;
		message = message.messages.all()[0];
		if (!message.message || message.key.fromMe || message.key && message.key.remoteJid == 'status@broadcast') return;

		await messageHandler(message);
	} catch(e) {
		console.log("[ERROR] " + e.message);
		conn.sendMessage(message.key.remoteJid, "Terjadi error! coba lagi nanti", "conversation", { quoted: message });
	}
});


conn.connect()
	.then(() => {
		fs.writeFileSync("login.json", JSON.stringify(conn.base64EncodedAuthInfo()));
		console.log("[OK] Login sukses! kirim !help untuk menampilkan perintah");
	})
	.catch(e => {
		if (fs.existsSync("login.json")) fs.unlinkSync("login.json");
		console.log("[ERROR] Login gagal!")
	});
