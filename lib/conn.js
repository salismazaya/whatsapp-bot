// https://github.com/salismazaya/whatsapp-bot

const { WAConnection } = require("@adiwajshing/baileys");
const conn = new WAConnection();
conn.maxCachedMessages = 15;

module.exports = conn;