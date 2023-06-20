// https://github.com/salismazaya/whatsapp-bot

const fs = require("fs")
const axios = require("axios")
const tesseract = require("node-tesseract-ocr")
const WSF = require("wa-sticker-formatter")
const webpConverter = require("./lib/webpconverter.js")
const { downloadMediaMessage } = require("@whiskeysockets/baileys")
const redis = require('./redis.js')

const { Configuration, OpenAIApi } = require("openai");

const configuration = new Configuration({
	apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);


module.exports = async (sock, message) => {
	const senderNumber = message.key.remoteJid
	const imageMessage = message.message.imageMessage
	const videoMessage = message.message.videoMessage
	const stickerMessage = message.message.stickerMessage
	const extendedTextMessage = message.message.extendedTextMessage
	const quotedMessageContext = extendedTextMessage && extendedTextMessage.contextInfo && extendedTextMessage.contextInfo
	const quotedMessage = quotedMessageContext && quotedMessageContext.quotedMessage
	const textMessage = message.message.conversation || message.message.extendedTextMessage && message.message.extendedTextMessage.text || imageMessage && imageMessage.caption || videoMessage && videoMessage.caption

	if (imageMessage) {
		const image = await downloadMediaMessage(message, 'buffer')
		const id = 'img_' + Math.random().toString(36).slice(2, 7)
		await redis.connect()
		await redis.set(id, image.toString('base64'), { EX: 30000 })
		await redis.rPush(`${senderNumber}_messages`, JSON.stringify({
			'role': 'user',
			'content': `ini gambarnya ${id}. hiraukan pesan ini jika ada id berikutnya`
		}))
		await redis.disconnect()
	}

	if (stickerMessage) {
		return
	}

	if (videoMessage && videoMessage.mimetype == "video/mp4") {
		if (videoMessage.seconds > 8) {
			await sock.sendMessage(senderNumber, { text: 'Maksimal 8 detik kak!' }, { quoted: message })
			return
		}

		const image = await downloadMediaMessage(message, 'buffer')
		const id = 'vid_' + Math.random().toString(36).slice(2, 7)
		await redis.connect()
		await redis.set(id, image.toString('base64'), { EX: 30000 })
		await redis.rPush(`${senderNumber}_messages`, JSON.stringify({
			'role': 'user',
			'content': `ini videonya ${id}. hiraukan pesan ini jika ada id berikutnya`
		}))
		await redis.disconnect()
	}

	if (textMessage) {
		await redis.connect()
		await redis.rPush(`${senderNumber}_messages`, JSON.stringify({
			'role': 'user',
			'content': textMessage
		}))
		await redis.disconnect()
	}

	await redis.connect()
	const user_messages = (await redis.lRange(`${senderNumber}_messages`, 0, -1)).map(x => {
		return JSON.parse(x)
	}).slice(-15)
	await redis.disconnect()


	const completion = await openai.createChatCompletion({
		model: "gpt-3.5-turbo-0613",
		messages: user_messages,
		functions: [
			{
				"name": "whoami",
				"description": "jika seseorang menanyakan siapa kamu atau siapa pembuatnya",
				"parameters": {
					"type": "object",
					"properties": {
					},
				}
			},
			{
				"name": "cando",
				"description": "jika seseorang menanyakan apa yang bisa kamu buat",
				"parameters": {
					"type": "object",
					"properties": {
					},
				}
			},
			{
				"name": "reset",
				"description": "jika seseorang mengirimkan bahwa percakapan kita tidak jelas atau ingin mereset konteks",
				"parameters": {
					"type": "object",
					"properties": {
					},
				}
			},
			{
				"name": "i2s",
				"description": "jika seseorang ingin membuat sticker dari gambar",
				"parameters": {
					"type": "object",
					"properties": {
						"id": {
							"type": "string",
							"description": "file id"
						},
					},
				}
			},
			{
				"name": "ocr",
				"description": "jika seseorang ingin menggunakan ocr",
				"parameters": {
					"type": "object",
					"properties": {
						"id": {
							"type": "string",
							"description": "file id"
						},
					},
				}
			},
			{
				"name": "t2s",
				"description": "jika seseorang ingin membuat sticker dari text",
				"parameters": {
					"type": "object",
					"properties": {
						"text": {
							"type": "string",
							"description": "text yang ingin diubah menjadi sticker"
						},
					},
				}
			},
			{
				"name": "t2sg",
				"description": "jika seseorang ingin membuat sticker gif dari text",
				"parameters": {
					"type": "object",
					"properties": {
						"text": {
							"type": "string",
							"description": "text yang ingin diubah menjadi sticker"
						},
					},
				}
			},
			{
				"name": "v2s",
				"description": "jika seseorang ingin membuat sticker dari video",
				"parameters": {
					"type": "object",
					"properties": {
						"id": {
							"type": "string",
							"description": "file id"
						},
					},
				}
			},
		]
	});

	const content = completion.data.choices[0]
	const function_call = content.message.function_call

	console.log(content, function_call)
	if (content.message.content) {
		await sock.sendMessage(senderNumber, { text: content.message.content }, { quoted: message })
		await redis.connect()
		await redis.rPush(`${senderNumber}_messages`, JSON.stringify({
			'role': 'assistant',
			'content': content.message.content
		}))
		await redis.disconnect()
		return;
	}

	const command = function_call.name.trim()
	const arguments = JSON.parse(function_call.arguments)


	switch (command) {
		case "reset":
			{
				await redis.connect()
				await redis.del(`${senderNumber}_messages`)
				await redis.disconnect()
				const text = 'Baik konteks telah di-reset'
				await sock.sendMessage(senderNumber, { text }, { quoted: message })
				break
			}
		case "whoami":
			{
				const text = `Perkenalkan nama saya Vera. Saya dikembangkan oleh Salis Mazaya menggunakan NodeJs, Baileys, Redis, OpenAI, dan lainnya :)`
				await sock.sendMessage(senderNumber, { text }, { quoted: message })
				break
			}
		case "cando":
			{
				const text = `
Beriku adalah hal-hal yang mungkin bisa saya lakukan!

1. Menjawab Pertanyaan
2. Ubah Poto ke Sticker
3. Ubah Sticker ke Poto
4. Ubah Text ke Sticker
5. Ubah Text ke Sticker Gerak
6. Mengubah Gambar ke Text (OCR)
				`.trim()
				await sock.sendMessage(senderNumber, { text }, { quoted: message })
				break
			}
		case "i2s":
			{
				if (!arguments.id || !arguments.id.startsWith('img_')) {
					await sock.sendMessage(senderNumber, { text: "Kirim gambarnya dong kak" }, { quoted: message })
					break
				}

				await redis.connect()
				const image = Buffer.from(await redis.get(arguments.id), 'base64')
				await redis.disconnect()

				const sticker = new WSF.Sticker(image, { crop: false, pack: "i hope you fine :)", author: 'Sugito Tempest' })
				await sticker.build()
				const bufferImage = await sticker.get()
				await sock.sendMessage(senderNumber, { sticker: bufferImage }, { quoted: message })
				break
			}

		case "t2s":
			{
				if (!arguments.text) {
					await sock.sendMessage(senderNumber, { text: "Kirim textnya dong kak" }, { quoted: message })
					await redis.connect()
					await redis.rPush(`${senderNumber}_messages`, JSON.stringify({
						'role': 'user',
						'content': 'dibawah adalah text nya'
					}))
					await redis.disconnect()
					break
				}

				const response = await axios.post("https://salism3api.pythonanywhere.com/text2img", { "text": arguments.text.slice(0, 60) })
				const sticker = new WSF.Sticker(response.data.image, { crop: false, pack: "i hope you fine :)", author: 'Sugito Tempest' })
				await sticker.build()
				const bufferImage = await sticker.get()
				await sock.sendMessage(senderNumber, { sticker: bufferImage }, { quoted: message })
				break
			}
		case "v2s":
			{
				if (!arguments.id || !arguments.id.startsWith('vid_')) {
					await sock.sendMessage(senderNumber, { text: "Kirim videonya dong kak" }, { quoted: message })
					break
				}

				await redis.connect()
				const image = Buffer.from(await redis.get(arguments.id), 'base64')
				await redis.disconnect()

				const sticker = new WSF.Sticker(image, { animated: true, pack: "i hope you fine :)", author: 'Sugito Tempest' })
				await sticker.build()
				const bufferImage = await sticker.get()
				await sock.sendMessage(senderNumber, { sticker: bufferImage }, { quoted: message })
				break

			}
		case "t2sg":
			{
				if (!arguments.text) {
					await sock.sendMessage(senderNumber, { text: "Kirim textnya dong kak" }, { quoted: message })
					await redis.connect()
					await redis.rPush(`${senderNumber}_messages`, JSON.stringify({
						'role': 'user',
						'content': 'dibawah adalah text nya'
					}))
					await redis.disconnect()
					break
				}

				const response = await axios.post("https://salism3api.pythonanywhere.com/text2gif/", { "text": arguments.text.slice(0, 60) })
				let image = await axios.get(response.data.image, { "responseType": "arraybuffer" })
				image = Buffer.from(image.data, "binary")
				image = await webpConverter.gifToWebp(image)
				await sock.sendMessage(senderNumber, { sticker: image }, { quoted: message })
				break
			}

		case "ocr":
			{
				if (!arguments.id || !arguments.id.startsWith('img_')) {
					await sock.sendMessage(senderNumber, { text: "Kirim gambarnya dong kak" }, { quoted: message })
					break
				}

				await redis.connect()
				const image = Buffer.from(await redis.get(arguments.id), 'base64')
				await redis.disconnect()

				const imagePath = Math.floor(Math.random() * 1000000) + '.jpg'
				fs.writeFileSync(imagePath, image)
				const textImage = (await tesseract.recognize(imagePath)).trim()
				fs.unlinkSync(imagePath)


				await sock.sendMessage(senderNumber, {text: textImage}, { quoted: message })		
				await redis.connect()
				await redis.rPush(`${senderNumber}_messages`, JSON.stringify({
					'role': 'assistant',
					'content': textImage
				}))
				await redis.disconnect()
				
				break
	
			}
	}

}
