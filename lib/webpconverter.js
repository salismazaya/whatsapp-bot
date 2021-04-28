// https://github.com/salismazaya/whatsapp-bot

const fs = require("fs");
const FileType = require('file-type');
const { exec } = require("child_process");

if (!fs.existsSync(".temp")) fs.mkdirSync(".temp");

function imageToWebp(bufferImage) {
	return new Promise((resolve, reject) => {
		FileType.fromBuffer(bufferImage)
			.then((response) => {
				try {
					const pathFile = ".temp/" + Math.floor(Math.random() * 1000000 + 1) + "." + response.ext;
					fs.writeFileSync(pathFile, bufferImage);
					exec(`cwebp -q 50 ${pathFile} -o ${pathFile}.webp`, (error, stdout, stderr) => {
						if (!fs.existsSync(pathFile + ".webp")) {
							reject(new Error("failed convert file!"));
							fs.unlinkSync(pathFile);
							return;
						}
						const webpBufferImage = fs.readFileSync(pathFile + ".webp");
						fs.unlinkSync(pathFile);
						fs.unlinkSync(pathFile + ".webp");
						resolve(webpBufferImage);
					});

				} catch(e) {
					reject(e);
				}
			})
			.catch(e => reject(e));
	});
}

function webpToJpg(bufferImage) {
	return new Promise((resolve, reject) => {
		try {
			const pathFile = ".temp/" + Math.floor(Math.random() * 1000000 + 1) + ".webp";
			fs.writeFileSync(pathFile, bufferImage);

			exec(`dwebp ${pathFile} -o ${pathFile}.jpg`, (error, stdout, stderr) => {
				if (!fs.existsSync(pathFile + ".jpg")) {
					reject(new Error("failed convert file!"));
					fs.unlinkSync(pathFile);
					return;
				}
				const jpgBufferImage = fs.readFileSync(pathFile + ".jpg");
				fs.unlinkSync(pathFile);
				fs.unlinkSync(pathFile + ".jpg");
				resolve(jpgBufferImage);
			})
		} catch(e) {
			reject(e);
		}
	});
}

function gifToWebp(bufferImage) {
	return new Promise((resolve, reject) => {
		try {
			const pathFile = ".temp/" + Math.floor(Math.random() * 1000000 + 1) + ".gif";
			fs.writeFileSync(pathFile, bufferImage);

			exec(`gif2webp ${pathFile} -o ${pathFile}.webp`, (error, stdout, stderr) => {
				if (!fs.existsSync(pathFile + ".webp")) {
					reject(new Error("failed convert file!"));
					fs.unlinkSync(pathFile);
					return;
				}
				const webpBuffer = fs.readFileSync(pathFile + ".webp");
				fs.unlinkSync(pathFile);
				fs.unlinkSync(pathFile + ".webp");
				resolve(webpBuffer);
			})
		} catch(e) {
			reject(e);
		}
	});
}

module.exports = { imageToWebp, webpToJpg, gifToWebp }