require('dotenv').config()

const { default: makeWASocket, DisconnectReason, useMultiFileAuthState, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys')
const { downloadMediaMessage } = require("@whiskeysockets/baileys")
const { initializeAgentExecutorWithOptions } = require("langchain/agents")
const { ChatOpenAI } = require("langchain/chat_models/openai")
const { DynamicTool } = require("langchain/tools")
const { BufferWindowMemory, ChatMessageHistory } = require("langchain/memory");
const { SystemMessage } = require('langchain/schema')
const fs = require("fs")
const axios = require("axios")
const tesseract = require("node-tesseract-ocr")
const WSF = require("wa-sticker-formatter")
const webpConverter = require("./lib/webpconverter.js")
const redis = require('./redis.js')
const yargs = require('yargs/yargs')

global.yargs = yargs(process.argv).argv

const MEMORY = {}
const chat = new ChatOpenAI({ modelName: process.env.MODEL_NAME || 'gpt-4o-mini', temperature: 0.3 });


async function connectToWhatsApp() {
	try {
		await redis.connect()
	} catch (err) {

	}
	const { state, saveCreds } = await useMultiFileAuthState('login')
	const { version } = await fetchLatestBaileysVersion()

	const sock = makeWASocket({
		version,
		printQRInTerminal: true,
		auth: state,
	})

	sock.ev.on('connection.update', async (update) => {
		const { connection, lastDisconnect } = update
		if (connection === 'close') {
			var _a, _b
			var shouldReconnect = ((_b = (_a = lastDisconnect.error) === null || _a === void 0 ? void 0 : _a.output) === null || _b === void 0 ? void 0 : _b.statusCode) !== DisconnectReason.loggedOut
			console.log('connection closed due to ', lastDisconnect.error, ', reconnecting ', shouldReconnect)
			if (shouldReconnect) {
				connectToWhatsApp()
			}
		} else if (connection === 'open') {
			console.log('opened connection')
		}
	})

	sock.ev.on('creds.update', saveCreds)

	sock.ev.on('messages.upsert', (m) => {
		const messageKeys = m.messages.map(message => {
			if (!message.message || message.key.fromMe || message.key && message.key.remoteJid == 'status@broadcast') {
				return null;
			}

			return message.key
		}).filter(k => k != null)

		if (messageKeys.length > 0) {
			sock.readMessages(messageKeys).catch(() => {
				console.log("Terjadi error saat membaca pesan")
			})
		}

		m.messages.forEach(async (message) => {
			if (!message.message || message.key.fromMe || message.key && message.key.remoteJid == 'status@broadcast') return
			if (message.message.ephemeralMessage) {
				message.message = message.message.ephemeralMessage.message
			}

			const myNumber = sock.user.id.split(':')[0]
			const senderNumber = message.key.remoteJid
			const isGroup = senderNumber.endsWith('@g.us')
			const imageMessage = message.message.imageMessage
			const videoMessage = message.message.videoMessage
			const stickerMessage = message.message.stickerMessage
			const extendedTextMessage = message.message.extendedTextMessage
			const quotedMessageContext = extendedTextMessage && extendedTextMessage.contextInfo && extendedTextMessage.contextInfo
			const quotedMessage = quotedMessageContext && quotedMessageContext.quotedMessage
			const textMessage = message.message.conversation || message.message.extendedTextMessage && message.message.extendedTextMessage.text || imageMessage && imageMessage.caption || videoMessage && videoMessage.caption || 'lakukuan sesuatu'
			const isMentioned = textMessage.includes('@' + myNumber)

			if (isGroup && !isMentioned) {
				return
			}

			const tools = [
				new DynamicTool({
					name: 'image_to_sticker',
					description: 'untuk membuat sticker dari gambar (id) yang dikirim',
					func: async (image_id) => {
						try {
							const image = Buffer.from(await redis.get(image_id), 'base64')

							const sticker = new WSF.Sticker(image, { crop: false, pack: "i hope you fine :)", author: 'Dato Sang Peretas' })
							await sticker.build()
							const bufferImage = await sticker.get()
							await sock.sendMessage(senderNumber, { sticker: bufferImage }, { quoted: message })
							return 'beri tau user bahwa berhasil tanpa embel-embel'
						} catch (err) {
							return 'gagal'
						}
					}
				}),
				new DynamicTool({
					name: 'text_to_sticker',
					description: 'untuk mengubah text ke sticker',
					func: async (text) => {
						try {
							const response = await axios.post("https://salism3api.pythonanywhere.com/text2img", { "text": text.slice(0, 60) })
							const sticker = new WSF.Sticker(response.data.image, { crop: false, pack: "i hope you fine :)", author: 'Sugito Tempest' })
							await sticker.build()
							const bufferImage = await sticker.get()
							await sock.sendMessage(senderNumber, { sticker: bufferImage }, { quoted: message })
							return 'beri tau user bahwa konversinya berhasil'
						} catch (err) {
							return 'gagal'
						}
					}
				}),
				new DynamicTool({
					name: 'text_to_sticker_gif',
					description: 'untuk mengubah text ke sticker gerak',
					func: async (text) => {
						try {
							const response = await axios.post("https://salism3api.pythonanywhere.com/text2gif/", { "text": text.slice(0, 60) })
							let image = await axios.get(response.data.image, { "responseType": "arraybuffer" })
							image = Buffer.from(image.data, "binary")
							image = await webpConverter.gifToWebp(image)
							await sock.sendMessage(senderNumber, { sticker: image }, { quoted: message })
							return 'beri tau user bahwa konversinya berhasil'
						} catch (err) {
							return 'gagal'
						}
					}
				}),
				new DynamicTool({
					name: 'ocr',
					description: 'untuk mengubah gambar ke text',
					func: async (id) => {
						try {
							const image = Buffer.from(await redis.get(id), 'base64')
							const imagePath = Math.floor(Math.random() * 1000000) + '.jpg'
							fs.writeFileSync(imagePath, image)
							const textImage = (await tesseract.recognize(imagePath)).trim()
							fs.unlinkSync(imagePath)
							return 'hasilnya: ' + textImage
						} catch (err) {
							return 'gagal'
						}
					}
				})
			]

			let memory = MEMORY[senderNumber]
			if (!memory) {
				memory = new BufferWindowMemory({
					chatHistory: new ChatMessageHistory([
						new SystemMessage('Kamu adalah Vera. asisten virtual berbasis whatsapp bot. kamu dibuat oleh Salis Mazaya, programmer jago yang sudah berpengalaman selama 5 tahun'),
						new SystemMessage(`
Berikut adalah hal-hal yang mungkin bisa kamu lakukan!
						
1. Menjawab Pertanyaan
2. Ubah Text ke Sticker
3. Ubah Text ke Sticker Gerak
4. Mengubah Gambar ke Text (OCR)
						`.trim())
					]),
					memoryKey: 'chat_history',
					returnMessages: true,
					k: 10,
				})
				MEMORY[senderNumber] = memory
			}


			const executor = await initializeAgentExecutorWithOptions(tools, chat, {
				agentType: "openai-functions",
				verbose: true,
				memory,
			})

			if (imageMessage) {
				const image = await downloadMediaMessage(message, 'buffer')
				const id = 'img_' + Math.random().toString(36).slice(2, 7)
				await redis.set(id, image.toString('base64'), { EX: 30000 })
				await memory.chatHistory.addUserMessage(`ini id gambarnya ${id} untuk kamu proses`)
			}

			if (videoMessage && videoMessage.mimetype == "video/mp4") {
				if (videoMessage.seconds > 8) {
					// await sock.sendMessage(senderNumber, { text: 'Maksimal 8 detik kak!' }, { quoted: message })
					return 'beri tau user. bahwa maksimal durasinya adalah 8 detik'
				}

				const image = await downloadMediaMessage(message, 'buffer')
				const id = 'img_' + Math.random().toString(36).slice(2, 7)
				await redis.set(id, image.toString('base64'), { EX: 30000 })
				await memory.chatHistory.addUserMessage(`ini id videonya ${id} untuk kamu proses`)
			}

			if (stickerMessage) {
				return
			}

			try {
				await sock.sendPresenceUpdate('composing', message.key.remoteJid)
				const { output } = await executor.invoke({ 'input': textMessage })
				await sock.sendMessage(message.key.remoteJid, { text: output }, { quoted: message });
			} catch (e) {
				if (!global.yargs.dev) {
					console.log("[ERROR] " + e.message);
					await sock.sendMessage(message.key.remoteJid, { "text": "Terjadi error! coba lagi nanti" }, { quoted: message });
				} else {
					console.log(e);
				}
			} finally {
				await sock.sendPresenceUpdate('available', message.key.remoteJid)
			}
		})
	})

}

connectToWhatsApp()