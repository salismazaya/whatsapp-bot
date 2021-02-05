// https://github.com/salismazaya/whatsapp-bot

const fs = require("fs");
const axios = require("axios");
const fstring = require("sprintf-js").sprintf;
const webp = require('webp-converter');
const { MessageType, Mimetype } = require("@adiwajshing/baileys");
const { conn } = require("./conn.js");
const { texts } = require("./text.js");

async function main(conn) {
	conn.on("credentials-updated", () => {
	    const authInfo = conn.base64EncodedAuthInfo();
	    fs.writeFileSync("./login.json", JSON.stringify(authInfo));
	});

	try {
		await conn.loadAuthInfo("./login.json");
	} catch(e) {
		if (fs.existsSync("./login.json")) fs.unlinkSync("./login.json"); 
	}

	await conn.connect();

	conn.on("message-new", async (message) => {
		if (!message.message || message.key.fromMe) return;
		const senderNumber = message.key.remoteJid;

		if (message.message.conversation == "!command") {
			conn.sendMessage(senderNumber, fstring(texts.command, conn.user.name), MessageType.text, { quoted: message })
		
		} else if (message.message.imageMessage && message.message.imageMessage.caption == "!sticker" && message.message.imageMessage.mimetype == "image/jpeg") {
			const nameFile = Math.floor(Math.random() * 1000000 + 1) + ".jpg";
			fs.writeFileSync(nameFile, await conn.downloadMediaMessage(message));

			const imageB64 = fs.readFileSync(nameFile).toString("base64");
			const webpImageB64 = await webp.str2webpstr(imageB64, "jpg", "-q 80");
			const image = Buffer.from(webpImageB64, "base64");

			fs.unlinkSync(nameFile);
			conn.sendMessage(senderNumber, image, MessageType.sticker, { quoted: message });
		
		} else if (message.message.extendedTextMessage && message.message.extendedTextMessage.text == "!toimg" 
			&& message.message.extendedTextMessage.contextInfo.quotedMessage.stickerMessage
			&& message.message.extendedTextMessage.contextInfo.quotedMessage.stickerMessage.mimetype == "image/webp") {
			
			message.message = message.message.extendedTextMessage.contextInfo.quotedMessage
			const nameFile = Math.floor(Math.random() * 1000000 + 1) + ".jpg";
			fs.writeFileSync(nameFile, await conn.downloadMediaMessage(message));

			await webp.dwebp(nameFile, nameFile, "-o");
			const image = fs.readFileSync(nameFile);

			fs.unlinkSync(nameFile);
			conn.sendMessage(senderNumber, image, MessageType.image, { quoted: message, caption: "Ini gambarnya kak!" });
		
		} else if (typeof(message.message.conversation) == "string" && message.message.conversation.startsWith("!write ")) {
			const data = await axios.post("https://salism3.pythonanywhere.com/write", { "text": message.message.conversation.replace("!write ", "") });
			const imagesUrl = data.data.images.slice(0, 4);

			for (let i = 0; i < imagesUrl.length; i++) {
				const response = await axios({
					url: imagesUrl[i],
					method: "GET",
					responseType: "arraybuffer",
				});
				const image = Buffer.from(response.data, "binary");
				await conn.sendMessage(senderNumber, image, MessageType.image, { quoted: message });
			}

		}

		
	});

}

main(conn);