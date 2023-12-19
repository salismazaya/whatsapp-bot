FROM sitespeedio/node:ubuntu-20.04-nodejs-18.16.0

WORKDIR /app

COPY . .

RUN apt update
RUN apt install tesseract-ocr tesseract-ocr-ind webp ffmpeg imagemagick git -y
RUN npm install

CMD npm start