// https://github.com/salismazaya/whatsapp-bot

const fs = require("fs");
const axios = require("axios");
const fstring = require("sprintf-js").sprintf;
const webp = require('webp-converter');
const PDFDocument = require("pdfkit");
const { MessageType, Mimetype } = require("@adiwajshing/baileys");
const { conn } = require("./conn.js");
const { texts } = require("./text.js");

if (!fs.existsSync(".temp")) fs.mkdirSync(".temp");

const inPdfInput = [];
const bufferImagesForPdf = {};

async function main(conn) {
	conn.on("credentials-updated", () => {
	    const authInfo = conn.base64EncodedAuthInfo();
	    fs.writeFileSync("login.json", JSON.stringify(authInfo));
	});

	try {
		conn.loadAuthInfo("login.json");
	} catch(e) {
		if (fs.existsSync("login.json")) fs.unlinkSync("login.json");
	}

	await conn.connect().catch(e => {
		if (fs.existsSync("login.json")) fs.unlinkSync("login.json");
		console.log("Login failed!")
	});

	conn.on("message-new", async (message) => {
		if (!message.message || message.key.fromMe) return;
		const senderNumber = message.key.remoteJid;

		if (inPdfInput.includes(senderNumber)) {
			if (message.message.stickerMessage) return;
			if (message.message.conversation == "!done" || bufferImagesForPdf[senderNumber].length > 19) {
				const pdf = new PDFDocument({ autoFirstPage:false });
				const bufferImages = bufferImagesForPdf[senderNumber];
				for (let i = 0; i < bufferImages.length; i++) {
					const image = pdf.openImage(bufferImages[i]);
					pdf.addPage({ size:[image.width, image.height] });
					pdf.image(image, 0, 0);
				}

				const pathFile = ".temp/" + Math.floor(Math.random() * 1000000 + 1) + ".pdf";
				const file = fs.createWriteStream(pathFile);
				pdf.pipe(file)
				pdf.end()

				file.on("finish", async () => {
					await conn.sendMessage(senderNumber, fs.readFileSync(pathFile), MessageType.document, { mimetype: Mimetype.pdf, filename: senderNumber.split("@")[0] + ".pdf", quoted: message});
					fs.unlinkSync(pathFile);
					inPdfInput.splice(inPdfInput.indexOf(senderNumber), 1);
					delete bufferImagesForPdf[senderNumber];
				})
				

			} else if (message.message.imageMessage && message.message.imageMessage.mimetype == "image/jpeg") {
				const bufferImage = await conn.downloadMediaMessage(message);
				bufferImagesForPdf[senderNumber].push(bufferImage);

				conn.sendMessage(senderNumber, `[${bufferImagesForPdf[senderNumber].length}] Sukses menambah gambar!, kirim *!done* jika selesai`, MessageType.text, { quoted: message })
			
			} else {
				conn.sendMessage(senderNumber, "Itu bukan gambar! kirim *!done* jika selesai", MessageType.text, { quoted: message })
			}


		} else if (message.message.conversation == "!command") {
			conn.sendMessage(senderNumber, fstring(texts.command, conn.user.name), MessageType.text, { quoted: message })
		
		} else if (message.message.imageMessage && message.message.imageMessage.caption == "!sticker" && message.message.imageMessage.mimetype == "image/jpeg") {
			const pathFile = ".temp/" + Math.floor(Math.random() * 1000000 + 1) + ".jpg";
			fs.writeFileSync(pathFile, await conn.downloadMediaMessage(message));

			const imageB64 = fs.readFileSync(pathFile).toString("base64");
			const webpImageB64 = await webp.str2webpstr(imageB64, "jpg", "-q 80");
			const image = Buffer.from(webpImageB64, "base64");

			fs.unlinkSync(pathFile);
			conn.sendMessage(senderNumber, image, MessageType.sticker, { quoted: message });
		
		} else if (message.message.extendedTextMessage && message.message.extendedTextMessage.text == "!toimg" 
			&& message.message.extendedTextMessage.contextInfo.quotedMessage.stickerMessage
			&& message.message.extendedTextMessage.contextInfo.quotedMessage.stickerMessage.mimetype == "image/webp") {
			
			message.message = message.message.extendedTextMessage.contextInfo.quotedMessage
			const pathFile = ".temp/" + Math.floor(Math.random() * 1000000 + 1) + ".jpg";
			fs.writeFileSync(pathFile, await conn.downloadMediaMessage(message));

			await webp.dwebp(pathFile, pathFile, "-o");
			const image = fs.readFileSync(pathFile);

			fs.unlinkSync(pathFile);
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

		} else if (message.message.conversation == "!pdf") {
			inPdfInput.push(senderNumber);
			bufferImagesForPdf[senderNumber] = [];

			conn.sendMessage(senderNumber, "Silahkan kirim gambarnya satu persatu! jangan spam ya!", MessageType.text, { quoted: message })

		} 

		
	});

}

main(conn);