// https://github.com/salismazaya/whatsapp-bot
// Jika ingin mengubah / mengedit, mohon untuk tidak menghilangkan link github asli di dalam bot terimakasih ^_^

const fs = require("fs");
const conn = require("./lib/conn.js");;
const messageHandler = require("./messageHandler.js");

if (fs.existsSync("login.json")) conn.loadAuthInfo("login.json");

conn.on("credentials-updated", () => {
	const authInfo = conn.base64EncodedAuthInfo();
	fs.writeFileSync("login.json", JSON.stringify(authInfo));
});


conn.on("message-new", (message) => {
	messageHandler(message).catch(e => {
		console.log("[ERROR] " + e.message);
		conn.sendMessage(message.key.remoteJid, "Terjadi error! coba lagi nanti", "conversation", { quoted: message })
	});
});


conn.connect()
	.then(() => {
		console.log("[OK] Login sukses! kirim !help untuk menampilkan perintah")
	})
	.catch(e => {
		if (fs.existsSync("login.json")) fs.unlinkSync("login.json");
		console.log("[ERROR] Login gagal!")
	});
