// https://github.com/salismazaya/whatsapp-bot
// Jika ingin mengubah / mengedit, mohon untuk tidak menghilangkan link github asli di dalam bot terimakasih ^_^

const fs = require("fs");
const axios = require("axios");
const PDFDocument = require("pdfkit");
const brainly = require("brainly-scraper");
const { MessageType, Mimetype } = require("@adiwajshing/baileys");
const { conn } = require("./conn.js");
const webpConverter = require("./webpconverter.js")

if (!fs.existsSync(".temp")) fs.mkdirSync(".temp");

const inPdfInput = [];
const bufferImagesForPdf = {};

async function main() {
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

		if (message.message.imageMessage && message.message.imageMessage.mimetype == "image/jpeg") {
			const image = await conn.downloadMediaMessage(message);
			const imageBase64 = image.toString("base64");
			const response = await axios.post("http://salism3api.pythonanywhere.com/faceCheck/", { image:imageBase64 })
			if (response.data.face == 1) {
				conn.sendMessage(senderNumber, "Siapa itu kak? kok keren sih?", MessageType.text, { quoted: message })
			}
		}

		if (inPdfInput.includes(senderNumber)) {
			if (message.message.stickerMessage) return;
			if (message.message.conversation == "!done" || bufferImagesForPdf[senderNumber].length > 19) {
				const pdf = new PDFDocument({ autoFirstPage:false });
				const bufferImages = bufferImagesForPdf[senderNumber];
				for (const bufferImage of bufferImages) {
					const image = pdf.openImage(bufferImage);
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


		} else if (message.message.conversation == "!help") {
			const text = `Halo kak selamat datang di *${conn.user.name}*!

- kirim *!help* untuk melihat daftar perintah dari bot ini

- kirim *!contact* untuk menghubungi pembuat bot

- kirim gambar dengan caption *!sticker* untuk membuat sticker

- kirim *!pdf* untuk membuat pdf dari gambar

- reply sticker dengan caption *!toimg* untuk membuat sticker ke gambar

- kirim *!write "masukan text disini"* untuk menulis ke kertas

- kirim *!brainly "pertanyaan kamu"* untuk mencari pertanyaan dan jawaban di brainly

Bot sensitif terhadap simbol / spasi / huruf kecil / huruf besar jadi, bot tidak akan membalas jika terjadi kesalahan penulisan!

Bot ini open source loh! kakak bisa cek di https://github.com/salismazaya/whatsapp-bot

apa? mau traktir aku? boleh banget https://saweria.co/salismazaya`

			conn.sendMessage(senderNumber, text, MessageType.text, { quoted: message })
		
		} else if (message.message.conversation == "!contact") {
			const text = `Hubungi saya di

- Whatsapp: wa.me/6283154881466
- Facebook: fb.me/salismazaya
- Telegram: t.me/salismiftah
- Email: salismazaya@gmail.com`
			conn.sendMessage(senderNumber, text, MessageType.text, { quoted: message })


		} else if (message.message.imageMessage && message.message.imageMessage.caption == "!sticker" && message.message.imageMessage.mimetype == "image/jpeg") {
			const image = await conn.downloadMediaMessage(message);
			const webpImage = await webpConverter.imageToWebp(image);
			conn.sendMessage(senderNumber, webpImage, MessageType.sticker, { quoted: message });
		
		} else if (message.message.extendedTextMessage && message.message.extendedTextMessage.text == "!toimg" 
			&& message.message.extendedTextMessage.contextInfo.quotedMessage.stickerMessage
			&& message.message.extendedTextMessage.contextInfo.quotedMessage.stickerMessage.mimetype == "image/webp") {
			
			message.message = message.message.extendedTextMessage.contextInfo.quotedMessage
			const webpImage = await conn.downloadMediaMessage(message);
			const jpgImage = await webpConverter.webpToJpg(webpImage);
			conn.sendMessage(senderNumber, jpgImage, MessageType.image, { quoted: message, caption: "Ini gambarnya kak!" });
		
		} else if (typeof(message.message.conversation) == "string" && message.message.conversation.startsWith("!write ")) {
			const response = await axios.post("https://salism3.pythonanywhere.com/write", { "text": message.message.conversation.replace("!write ", "") });
			const imagesUrl = response.data.images.slice(0, 4);

			for (const imageUrl of imagesUrl) {
				const response = await axios({
					url: imageUrl,
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

		} else if (typeof(message.message.conversation) == "string" && message.message.conversation.startsWith("!brainly ")) {
			const data = await brainly(message.message.conversation.replace("!brainly ", ""));
			if (data.success) {
				for (const question of data.data.slice(0, 3)) {
					const text = `*Pertanyaan:* ${question.pertanyaan.trim()}\n\n*Jawaban*: ${question.jawaban[0].text.replace("Jawaban:", "").trim()}`
					await conn.sendMessage(senderNumber, text, MessageType.text, { quoted: message })
				}
			}

		} else {
			if (!message.participant && !message.message.stickerMessage && !message.message.imageMessage) conn.sendMessage(senderNumber, "kamu ngetik apa sih? aku gk ngerti, kirim *!help* untuk bantuan", MessageType.text, { quoted: message })
		}

		
	});

}

main();