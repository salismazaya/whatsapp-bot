<p align="center">
  <img src="https://i.postimg.cc/4Zz0WjN0/IMG-20210202-071517-319.jpg" width=500/>
</p>

<div align="center"><h3>Simple Whatsapp Bot Made <br>With <a href="https://github.com/adiwajshing/Baileys">Baileys</a></h3></div> 

### Install di Termux
````
pkg install nodejs-lts git tesseract libwebp wget imagemagick ffmpeg
git clone https://github.com/salismazaya/whatsapp-bot
wget https://raw.githubusercontent.com/tesseract-ocr/tessdata_best/master/ind.traineddata
mv ind.traineddata /data/data/com.termux/files/usr/share/tessdata 
cd whatsapp-bot
npm install
node index.js
````

### Install di Linux (ubuntu & debian)
```
sudo apt install npm git webp imagemagick ffmpeg
sudo apt install tesseract-ocr tesseract-ocr-ind
sudo npm install -g n
sudo n stable
git clone https://github.com/salismazaya/whatsapp-bot
cd whatsapp-bot
npm install
node index.js
```

### fitur
```
- convert gambar ke sticker
- convert gambar ke sticker tanpa background
- convert text ke sticker
- convert text ke gif sticker
- convert video ke sticker
- convert sticker ke gambar
- convert sticker ke gif
- convert gambar ke pdf
- nulis
- brainly
- ocr
- random quotes
- random pengetahuan
- text to sound
- wikipedia
- soal matematika
- bahasa planet
```
