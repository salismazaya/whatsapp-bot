// https://github.com/salismazaya/whatsapp-bot

const fs = require("fs");
const axios = require("axios");
const PDFDocument = require("pdfkit");
const brainly = require("brainly-scraper");
const webpConverter = require("./webpconverter.js");
const { MessageType, Mimetype } = require("@adiwajshing/baileys");
const { lolHumanApiKey } = require("./data.js");
const { conn } = require("./conn.js");

const inPdfInput = [];
const bufferImagesForPdf = {};

async function messageHandler(message) {
	if (!message.message || message.key.fromMe) return;

	const senderNumber = message.key.remoteJid;
	const imageMessage = message.message.imageMessage;
	const stickerMessage = message.message.stickerMessage;
	const extendedTextMessage = message.message.extendedTextMessage;
	const quotedMessage = extendedTextMessage && extendedTextMessage.contextInfo && extendedTextMessage.contextInfo.quotedMessage;
	const textMessage = message.message.conversation || message.message.extendedTextMessage && message.message.extendedTextMessage.text;
	let command, parameter;
	if (textMessage) {
		command = textMessage.trim().split(" ")[0];
		parameter = textMessage.trim().split(" ").splice(1).join(" ");
	}
	
	// if (imageMessage && imageMessage.mimetype == "image/jpeg") {
	// 	const image = await conn.downloadMediaMessage(message);
	// 	const imageBase64 = image.toString("base64");
	// 	const response = await axios.post("http://salism3api.pythonanywhere.com/faceCheck/", { image:imageBase64 })
	// 	if (response.data.face) {
	// 		conn.sendMessage(senderNumber, "Siapa itu kak? kok keren sih?", MessageType.text, { quoted: message })
	// 	}
	// }

	if (inPdfInput.includes(senderNumber)) {
		if (stickerMessage) return;
		if (command == "!done" || bufferImagesForPdf[senderNumber].length > 19) {
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

			file.on("finish", () => {
				const file = fs.readFileSync(pathFile);
				conn.sendMessage(senderNumber, file, MessageType.document, { mimetype: Mimetype.pdf, filename: senderNumber.split("@")[0] + ".pdf", quoted: message});
				fs.unlinkSync(pathFile);
				inPdfInput.splice(inPdfInput.indexOf(senderNumber), 1);
				delete bufferImagesForPdf[senderNumber];
			})
				

		} else if (imageMessage && imageMessage.mimetype == "image/jpeg") {
			const bufferImage = await conn.downloadMediaMessage(message);
			bufferImagesForPdf[senderNumber].push(bufferImage);

			conn.sendMessage(senderNumber, `[${bufferImagesForPdf[senderNumber].length}] Sukses menambah gambar!, kirim *!done* jika selesai`, MessageType.text, { quoted: message })
			
		} else {
			conn.sendMessage(senderNumber, "Itu bukan gambar! kirim *!done* jika selesai", MessageType.text, { quoted: message })
		}


	} else if (command == "!help") {
		const text = `Halo kak selamat datang di *${conn.user.name}*!

- kirim *!help* untuk melihat daftar perintah dari bot ini

- kirim *!contact* untuk menghubungi pembuat bot

- kirim gambar dengan caption *!sticker* untuk membuat sticker

- kirim *!pdf* untuk membuat pdf dari gambar

- reply sticker dengan caption *!toimg* untuk membuat sticker ke gambar

- kirim *!write [masukan text disini]* untuk menulis ke kertas
  contoh: !write ini tulisanku

- kirim *!brainly [pertanyaan kamu]* untuk mencari pertanyaan dan jawaban di brainly
  contoh: !brainly apa itu nodejs

- *!quotes* untuk mendapatkan quotes

- *!randomfact* untuk mendapatkan pengetahuan acak

- *!gtts [kode bahasa] [text]* untuk mengubah text ke suara google. Untuk kode bahasa dilihat disini https://s.id/xSj1g
  contoh: !gtts id saya bot

- *!wikipedia [query]* untuk mencari dan membaca artikel di wikipedia
  contoh: !wikipedia Python

- kirim gambar dengan caption *!wait* untuk mencari judul dan episode anime dari scene

Bot sensitif terhadap simbol / spasi / huruf kecil / huruf besar jadi, bot tidak akan membalas jika terjadi kesalahan penulisan!

Bot ini open source loh! kakak bisa cek di https://github.com/salismazaya/whatsapp-bot

apa? mau traktir aku? boleh banget https://saweria.co/salismazaya`

		conn.sendMessage(senderNumber, text, MessageType.text, { quoted: message })
		
	} else if (command == "!contact") {
		const text = `Hubungi saya di

- Facebook: fb.me/salismazaya
- Telegram: t.me/salismiftah
- Email: salismazaya@gmail.com`
		conn.sendMessage(senderNumber, text, MessageType.text, { quoted: message, detectLinks: false })


	} else if (imageMessage && imageMessage.caption == "!sticker" && imageMessage.mimetype == "image/jpeg") {
		const image = await conn.downloadMediaMessage(message);
		const webpImage = await webpConverter.imageToWebp(image);
		conn.sendMessage(senderNumber, webpImage, MessageType.sticker, { quoted: message });
		
	} else if (quotedMessage && command == "!toimg" && quotedMessage.stickerMessage && quotedMessage.stickerMessage.mimetype == "image/webp") {
		message.message = quotedMessage;
		const webpImage = await conn.downloadMediaMessage(message);
		const jpgImage = await webpConverter.webpToJpg(webpImage);
		conn.sendMessage(senderNumber, jpgImage, MessageType.image, { quoted: message, caption: "Ini gambarnya kak!" });
		
	} else if (command == "!write" && parameter) {
		const response = await axios.post("https://salism3.pythonanywhere.com/write", { "text": parameter });
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

	} else if (command == "!pdf") {
		inPdfInput.push(senderNumber);
		bufferImagesForPdf[senderNumber] = [];

		conn.sendMessage(senderNumber, "Silahkan kirim gambarnya satu persatu! jangan spam ya!", MessageType.text, { quoted: message })

	} else if (command == "!brainly" && parameter) {
		const data = await brainly(parameter);
		if (data.succses && data.data.length <= 0) {
			conn.sendMessage(senderNumber, "Pertanyaan tidak ditemukan :(", MessageType.text, { quoted: message })
		
		} else if (data.success) {
			for (const question of data.data.slice(0, 3)) {
				const text = `*Pertanyaan:* ${question.pertanyaan.trim()}\n\n*Jawaban*: ${question.jawaban[0].text.replace("Jawaban:", "").trim()}`
				await conn.sendMessage(senderNumber, text, MessageType.text, { quoted: message })
			}
		}

	} else if (command == "!quotes") {
		const response = await axios.get("http://lolhuman.herokuapp.com/api/random/quotes?apikey=" + lolHumanApiKey);
		const text = `_"${response.data.result.quote}"_\n\n - ${response.data.result.by}`;
		await conn.sendMessage(senderNumber, text, MessageType.text, { quoted: message });
		
	} else if (command == "!randomfact") {
		const response = await axios.get("http://lolhuman.herokuapp.com/api/random/faktaunik?apikey=" + lolHumanApiKey);
		const text = response.data.result;
		await conn.sendMessage(senderNumber, text, MessageType.text, { quoted: message });
		
	} else if (command == "!gtts" && parameter) {
		if (parameter.split(" ").length == 1) {
			conn.sendMessage(senderNumber, "Tidak ada kode bahasa / teks", MessageType.text, { quoted: message });
			return;
		}

		const language = parameter.split(" ")[0];
		const text = parameter.split(" ").splice(1).join(" ");
		axios({
			url: `https://salism3api.pythonanywhere.com/gtts/`,
			method: "POST",
			responseType: "arraybuffer",
			data: {
				"languageCode": language,
				"text": text,
			}
		}).then(response => {
			const audio = Buffer.from(response.data, "binary");
			conn.sendMessage(senderNumber, audio, MessageType.audio, { ptt: true, quoted: message });

		}).catch(response => {
			conn.sendMessage(senderNumber, `Kode negara *${language}* tidak ditemukan :(`, MessageType.text, { quoted: message });

		})
		
	} else if (command == "!wikipedia" && parameter) {
		const response = await axios.post("http://salism3api.pythonanywhere.com/wikipedia/", { "query":parameter });
		if (response.data.message == "not found") {
			conn.sendMessage(senderNumber, `Artikel tidak ditemukan :(`, MessageType.text, { quoted: message });
		} else {
			const text = `*${response.data.title}*\n\n${response.data.content}`;
			conn.sendMessage(senderNumber, text, MessageType.text, { quoted: message });
		}

	} else if (imageMessage && imageMessage.caption == "!wait") {
		const image = await conn.downloadMediaMessage(message);
		const imageBase64 = image.toString("base64");

		const response = await axios.post("https://trace.moe/api/search", { "image":imageBase64 });
		const result = response.data.docs[0];

		const text = `Nama Anime : _${result.title_romaji}_\nSeason : _${result.season}_\nEpisode : _${result.episode}_\nAkurasi : _${result.similarity}_`
		conn.sendMessage(senderNumber, text, MessageType.text, { quoted: message });

	} else {
		if (!message.participant && !stickerMessage) conn.sendMessage(senderNumber, "Command tidak terdaftar, kirim *!help* untuk melihat command terdaftar", MessageType.text, { quoted: message });
	}

}

exports.messageHandler = messageHandler;

