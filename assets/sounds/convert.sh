for file in *.mp3; do
  ffmpeg -i "$file" "${file%.mp3}.wav"
done
