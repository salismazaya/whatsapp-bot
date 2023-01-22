// https://github.com/salismazaya/whatsapp-bot

const fs = require("fs")
const axios = require("axios")
const PDFDocument = require("pdfkit")
const brainly = require("brainly-scraper")
const tesseract = require("node-tesseract-ocr")
const WSF = require("wa-sticker-formatter")
const webpConverter = require("./lib/webpconverter.js")
const bahasa_planet = require('./lib/bahasa_planet')
const { downloadMediaMessage } = require("@adiwajshing/baileys")

const inPdfInput = []
const questionAnswer = {}
const bufferImagesForPdf = {}
const quotesList = JSON.parse(fs.readFileSync("lib/quotes.json", "utf-8"))
const factList = JSON.parse(fs.readFileSync("lib/fact.json", "utf-8"))

module.exports = async (sock, message) => {
	const senderNumber = message.key.remoteJid
	const imageMessage = message.message.imageMessage
	const videoMessage = message.message.videoMessage
	const stickerMessage = message.message.stickerMessage
	const extendedTextMessage = message.message.extendedTextMessage
	const quotedMessageContext = extendedTextMessage && extendedTextMessage.contextInfo && extendedTextMessage.contextInfo
	const quotedMessage = quotedMessageContext && quotedMessageContext.quotedMessage
	const textMessage = message.message.conversation || message.message.extendedTextMessage && message.message.extendedTextMessage.text || imageMessage && imageMessage.caption || videoMessage && videoMessage.caption
	let command, parameter
	if (textMessage) {
		// command = textMessage.trim().split(" ")[0]
		// parameter = textMessage.trim().split(" ").slice(1).join(" ")

		let a = textMessage.trim().split("\n")
		let b = ""
		command = a[0].split(" ")[0]
		b += a[0].split(" ").slice(1).join(" ")
		b += a.slice(1).join("\n")
		parameter = b.trim()
	}

	if (inPdfInput.includes(senderNumber)) {
		if (stickerMessage) return
		if (command == "!done" || bufferImagesForPdf[senderNumber].length > 19) {
			const pdf = new PDFDocument({ autoFirstPage:false })
			const bufferImages = bufferImagesForPdf[senderNumber]
			for (const bufferImage of bufferImages) {
				const image = pdf.openImage(bufferImage)
				pdf.addPage({ size:[image.width, image.height] })
				pdf.image(image, 0, 0)
			}

			const pathFile = ".temp/" + Math.floor(Math.random() * 1000000 + 1) + ".pdf"
			const file = fs.createWriteStream(pathFile)
			pdf.pipe(file)
			pdf.end()

			file.on("finish", () => {
				const file = fs.readFileSync(pathFile)
				sock.sendMessage(senderNumber, {'document': file}, { filename: Math.floor(Math.random() * 1000000) + ".pdf", quoted: message})
				fs.unlinkSync(pathFile)
				inPdfInput.splice(inPdfInput.indexOf(senderNumber), 1)
				delete bufferImagesForPdf[senderNumber]
			})

		} else if (command == "!cancel") {
			delete bufferImagesForPdf[senderNumber]
			inPdfInput.splice(inPdfInput.indexOf(senderNumber), 1)
			sock.sendMessage(senderNumber, {"text": "Operasi dibatalkan!"}, { quoted: message })

		} else if (imageMessage && imageMessage.mimetype == "image/jpeg") {
			const bufferImage = await downloadMediaMessage(message, "buffer")
			bufferImagesForPdf[senderNumber].push(bufferImage)

			sock.sendMessage(senderNumber, {text:`[${bufferImagesForPdf[senderNumber].length}] Sukses menambah gambar!, kirim *!done* jika selesai, *!cancel* jika ingin membatalkan`}, { quoted: message })
			
		} else {
			sock.sendMessage(senderNumber, {text:"Itu bukan gambar! kirim *!done* jika selesai, *!cancel* jika ingin membatalkan"}, { quoted: message })
		}

		return
	}

	switch (command) {
		case "!help":
		{
			const text = `Halo kak selamat datang di *${sock.user.name}*!

- kirim *!help* untuk melihat daftar perintah dari bot ini

- kirim *!contact* untuk menghubungi pembuat bot

- kirim gambar dengan caption *!sticker* untuk membuat sticker

- kirim *!pdf* untuk membuat pdf dari gambar

- reply sticker dengan caption *!toimg* untuk membuat sticker ke gambar

- reply sticker bergerak dengan caption *!togif* untuk membuat sticker ke gif (error)

- kirim *!textsticker [text kamu]* untuk membuat text sticker
  contoh: !textsticker ini sticker

- kirim *!giftextsticker [text kamu]* untuk membuat text sticker jedag jedug
  contoh: !giftextsticker ini sticker

- kirim video dengan caption *!gifsticker* untuk membuat sticker bergerak (tidak stabil)

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

- *!math* untuk mengerjakan soal matematika 

- *!bplanet [alias] [text]*
   contoh: !bplanet g kamu lagi ngapain?

- kirim gambar dengan caption *!ocr* untuk mendapatkan text dari gambar (error)

Bot sensitif terhadap simbol / spasi / huruf kecil / huruf besar jadi, bot tidak akan membalas jika terjadi kesalahan penulisan!

Bot ini open source loh! kakak bisa cek di https://github.com/salismazaya/whatsapp-bot (jika ingin mengedit mohon untuk tidak hilangankan link ini)

apa? mau traktir aku? boleh banget https://saweria.co/salismazaya`.replace("(jika ingin mengedit mohon untuk tidak hilangankan link ini)", "")

			sock.sendMessage(senderNumber, { text }, { quoted: message })
			break
		}

		case "!contact":
		{
			const text = `Hubungi saya di

- Facebook: fb.me/salismazaya
- Telegram: t.me/salismiftah
- Email: salismazaya@gmail.com`
			sock.sendMessage(senderNumber, { text }, { quoted: message })
			break
		}

		case "!sticker":
		case "!stiker":
		{
			if (quotedMessage) {
				message.message = quotedMessage
			}

			if (!message.message.imageMessage || message.message.imageMessage.mimetype != "image/jpeg") {
				sock.sendMessage(senderNumber, {text: "Tidak ada gambar :)"}, { quoted: message })
				break
			}

			const image = await downloadMediaMessage(message, "buffer")
			const sticker = new WSF.Sticker(image, { crop: false, pack: "i hope you fine :)", author: 'Darto Tempest' })
			await sticker.build()
			const bufferImage = await sticker.get()
			sock.sendMessage(senderNumber, {sticker: bufferImage}, { quoted: message })
			break
		}

		case "!toimg":
		{
			if (!quotedMessage || !quotedMessage.stickerMessage || quotedMessage.stickerMessage.mimetype != "image/webp") {
				sock.sendMessage(senderNumber, {text: "Harus me-reply sticker :)"}, { quoted: message })
				break
			}

			message.message = quotedMessage
			const webpImage = await downloadMediaMessage(message, "buffer")
			const jpgImage = await webpConverter.webpToJpg(webpImage)
			sock.sendMessage(senderNumber, {image: jpgImage, caption: "Ini gambarnya kak!"}, { quoted: message })
			break
		}

		
		case "!togif":
		{
			if (!quotedMessage || !quotedMessage.stickerMessage || quotedMessage.stickerMessage.mimetype != "image/webp") {
				sock.sendMessage(senderNumber, {text: "Harus me-reply sticker :)"}, { quoted: message })
				break
			}

			message.message = quotedMessage
			const webpImage = await downloadMediaMessage(message, "buffer")
			const video = await webpConverter.webpToVideo(webpImage)
			sock.sendMessage(senderNumber, {video, mimetype: 'image/gif'}, { quoted: message })
			break
		}

		case "!write":
		case "!nulis":
		{
			if (!parameter) {
				sock.sendMessage(senderNumber, {text: "Tidak ada text :)"},  { quoted: message })
				break
			}

			const response = await axios.post("https://salism3api.pythonanywhere.com/write", { "text": parameter })
			const imagesUrl = response.data.images.slice(0, 4)

			for (const imageUrl of imagesUrl) {
				const response = await axios({
					url: imageUrl,
					method: "GET",
					responseType: "arraybuffer",
				})
				const image = Buffer.from(response.data, "binary")
				await sock.sendMessage(senderNumber, { image }, { quoted: message })
			}
			break
		}

		case "!pdf":
		{
			if (message.participant) {
				sock.sendMessage(senderNumber, {text: "Fitur ini tidak bisa berjalan di grup :("}, { quoted: message })
				break
			}

			if (imageMessage) {
				sock.sendMessage(senderNumber, {text: "Kirim tanpa gambar!"}, { quoted: message })
				break
			}

			inPdfInput.push(senderNumber)
			bufferImagesForPdf[senderNumber] = []

			sock.sendMessage(senderNumber, {text: "Silahkan kirim gambarnya satu persatu! jangan spam ya!"}, { quoted: message })
			break
		}

		case "!brainly":
		{
			if (!parameter) {
				sock.sendMessage(senderNumber, {text: "Inputnya salah kak :)"}, { quoted: message })
				break
			}

			const data = await brainly(parameter)
			if (data.succses && data.data.length <= 0) {
				sock.sendMessage(senderNumber, {text: "Pertanyaan tidak ditemukan :("}, { quoted: message })

			} else if (data.success) {
				for (const question of data.data.slice(0, 3)) {
					const text = `*Pertanyaan:* ${question.pertanyaan.trim()}\n\n*Jawaban*: ${question.jawaban[0].text.replace("Jawaban:", "").trim()}`
					await sock.sendMessage(senderNumber, { text }, { quoted: message })
				}
			}
			break
		}

		case "!quotes":
		{
			const quotes = quotesList[Math.floor(Math.random() * quotesList.length)]
			const text = `_"${quotes.quote}"_\n\n - ${quotes.by}`
			sock.sendMessage(senderNumber, { text }, { quoted: message })
			break
		}

		case "!randomfact":
		case "!fact":
		{
			const fact = factList[Math.floor(Math.random() * factList.length)]
			const text = `_${fact}_`
			sock.sendMessage(senderNumber, { text }, { quoted: message })
			break
		}

		case "!gtts":
		case "!tts":
		case "!text2sound":
		{
			if (!parameter) {
				sock.sendMessage(senderNumber, {text: "Inputnya salah kak :)"}, { quoted: message })
				break
			}

			if (parameter.split(" ").length == 1) {
				sock.sendMessage(senderNumber, {text: "Tidak ada kode bahasa / teks"}, { quoted: message })
				break
			}

			const language = parameter.split(" ")[0]
			const text = parameter.split(" ").splice(1).join(" ")
			axios({
				url: `https://salism3api.pythonanywhere.com/text2sound`,
				method: "POST",
				responseType: "arraybuffer",
				data: {
					"languageCode": language,
					"text": text,
				}
			}).then(response => {
				const audio = Buffer.from(response.data, "binary")
				sock.sendMessage(senderNumber, {'audio': audio}, { ptt: true, quoted: message })

			}).catch(response => {
				console.log(response)
				sock.sendMessage(senderNumber, {text: `Kode bahasa *${language}* tidak ditemukan :(`}, { quoted: message })

			})
			break
		}

		case "!wikipedia":
		case "!wiki":
		{
			if (!parameter) {
				sock.sendMessage(senderNumber, {text: "Inputnya salah kak :)"}, { quoted: message })
				break
			}

			axios.post("http://salism3api.pythonanywhere.com/wikipedia", { "query":parameter })
				.then(response => {
					const text = `*${response.data.title}*\n\n${response.data.content}`
					sock.sendMessage(senderNumber, { text }, { quoted: message })
				})
				.catch(e => {
					if ([ 500, 400, 404 ].includes(e.response.status)) {
						sock.sendMessage(senderNumber, {text: `Artikel tidak ditemukan :(`}, { quoted: message })
					} else {
						throw e
					}
				})
			break
		}

		case "!textsticker":
		case "!textstiker":
		{
			if (!parameter) {
				sock.sendMessage(senderNumber, {text: "Inputnya salah kak :)"}, { quoted: message })
				break
			}

			const response = await axios.post("https://salism3api.pythonanywhere.com/text2img", { "text":parameter.slice(0,60) })
			const sticker = new WSF.Sticker(response.data.image, { crop: false, pack: "i hope you fine :)", author: 'Darto Tempest' })
			await sticker.build()
			const bufferImage = await sticker.get()
			sock.sendMessage(senderNumber, {sticker: bufferImage}, { quoted: message })
			break
		}

		case "!ocr":
		{
			if (quotedMessage) {
				message.message = quotedMessage
			}

			if (!message.message.imageMessage || message.message.imageMessage.mimetype != "image/jpeg") {
				sock.sendMessage(senderNumber, "Tidak ada gambar :)", { quoted: message })
				break
			}
			const imagePath = Math.floor(Math.random() * 1000000) + '.jpg'
			const image = await downloadMediaMessage(message, 'buffer')
			fs.writeFileSync(imagePath, image)
			const textImage = (await tesseract.recognize(imagePath)).trim()
			fs.unlinkSync(imagePath)

			sock.sendMessage(senderNumber, {text: textImage}, { quoted: message })		
			break
		}

		case "!gifsticker":
		{
			if (quotedMessage) {
				message.message = quotedMessage
			}

			if (!message.message.videoMessage || message.message.videoMessage.mimetype != "video/mp4") {
				sock.sendMessage(senderNumber, "Tidak ada video :)", { quoted: message })
				break
			}

			if (message.message.videoMessage.seconds > 8) {
				sock.sendMessage(senderNumber, "Maksimal 8 detik!", { quoted: message })
				break	
			}

			const image = await downloadMediaMessage(message, "buffer")
			const sticker = new WSF.Sticker(image, { animated: true, pack: "i hope you fine :)", author: 'Darto Tempest' })
			await sticker.build()
			const bufferImage = await sticker.get()
			sock.sendMessage(senderNumber, {sticker: bufferImage}, { quoted: message })
			break
		}

		case "!giftextsticker":
		{
			if (!parameter) {
				sock.sendMessage(senderNumber, "Inputnya salah kak :)", { quoted: message })
				break
			}

			const response = await axios.post("https://salism3api.pythonanywhere.com/text2gif/", { "text":parameter.slice(0,60) })
			let image = await axios.get(response.data.image, { "responseType":"arraybuffer" })
			image = Buffer.from(image.data, "binary")
			image = await webpConverter.gifToWebp(image)
			sock.sendMessage(senderNumber, {sticker: image}, { quoted: message })
			break	
		}


		case "!math":
		{
			const response = await axios.get("https://salism3api.pythonanywhere.com/math/")
			let image = await axios.get(response.data.image, { "responseType":"arraybuffer" })
			image = Buffer.from(image.data, "binary")
			const msg = await sock.sendMessage(senderNumber, { image, caption: "Balas pesan ini untuk menjawab!" }, { quoted: message})
			questionAnswer[msg.key.id] = response.data.answer

			setTimeout(() => {
				if (questionAnswer[msg.key.id]) {
					sock.sendMessage(senderNumber, {text: "Waktu habis!"}, { quoted: msg })
					delete questionAnswer[msg.key.id]
				}
			}, 600 * 1000)
			break
		}

                /**
                 * Konversi bahasa planet
                 * use: !bplanet g kamu lagi ngapain
                 * result: kagamugu lagagigi ngagapagaigin
                 **/
                case '!bplanet':
                    if (quotedMessage) message.message = quotedMessage
                    if (!!parameter) {
                        var [ alias, ...text ] = parameter.split` `
                        text = text.join` `
                        conn['sendMessage'](senderNumber, {text: bahasa_planet(text, alias)}, {
                            quoted: message
                        })
                    } else {
                        var contoh = '[wrong format]\n\nformat: !bplanet <alias> <text>\ncontoh: !bplanet g kamu lagi ngapain?'
                        conn['sendMessage'](senderNumber, {text: contoh}, {
                            quoted: message
                        })
                    }
                    break
		default:
		{
			if (quotedMessage && questionAnswer[quotedMessageContext.stanzaId] && textMessage) {
				const answer = questionAnswer[quotedMessageContext.stanzaId]
				if (answer == parseInt(textMessage)) {
					sock.sendMessage(senderNumber, {text: "Keren! jawaban benar"}, { quoted: message })
					delete questionAnswer[quotedMessageContext.stanzaId]
				} else {
					sock.sendMessage(senderNumber, {text: "Jawaban salah!"}, { quoted: message })
				}

			} else if (!message.participant && !stickerMessage) {
				sock.sendMessage(senderNumber, {text: "Command tidak terdaftar, kirim *!help* untuk melihat command terdaftar"}, { quoted: message })
			}
		}

	}
}
