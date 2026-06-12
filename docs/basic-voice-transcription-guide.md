# Build a Basic Local Voice Transcription App

A minimal desktop app that records audio, transcribes it on your machine, and lets you copy the text. No accounts, no API keys, and your audio never leaves your computer.

This is a standalone guide. It distills the local-Whisper approach used by command-center's [`TranscriptionService.ts`](../src/main/services/transcription/TranscriptionService.ts) into a tiny app anyone can build on their own, without the rest of command-center.

> Note: this transcribes *what* is said, not *who* said it. Speaker-by-speaker breakdown (diarization) isn't included, since it requires extra tooling beyond local Whisper.

---

## What you'll need
- [Node.js](https://nodejs.org) installed (LTS version)
- A terminal and a code editor (VS Code is fine)
- ~10 minutes

---

## Step 1: Create the project

In a terminal:

```bash
mkdir voice-notes && cd voice-notes
npm init -y
npm install electron @huggingface/transformers
```

---

## Step 2: Create the files

You'll create 4 small files in the `voice-notes` folder.

### `package.json` — add a start script
Open `package.json` and set `"main"` and add a `start` script:

```json
{
  "name": "voice-notes",
  "version": "1.0.0",
  "main": "main.js",
  "scripts": {
    "start": "electron ."
  }
}
```

### `main.js` — the app window + transcription

```javascript
const { app, BrowserWindow, ipcMain } = require('electron')
const path = require('path')

// Pin the model to a specific version for stability + security
const MODEL_ID = 'onnx-community/whisper-base'

let transcriber = null
async function getTranscriber() {
  if (transcriber) return transcriber
  const { pipeline } = await import('@huggingface/transformers')
  transcriber = await pipeline('automatic-speech-recognition', MODEL_ID, { dtype: 'q8' })
  return transcriber
}

// Receives audio samples from the window, returns text
ipcMain.handle('transcribe', async (_event, pcmArray) => {
  const pipe = await getTranscriber()
  const result = await pipe(Float32Array.from(pcmArray), {
    language: 'en',
    task: 'transcribe',
    chunk_length_s: 30,
    stride_length_s: 5
  })
  return (typeof result === 'string' ? result : result?.text ?? '').trim()
})

function createWindow() {
  const win = new BrowserWindow({
    width: 600,
    height: 500,
    webPreferences: { preload: path.join(__dirname, 'preload.js') }
  })
  win.loadFile('index.html')
}

app.whenReady().then(createWindow)
app.on('window-all-closed', () => app.quit())
```

### `preload.js` — safe bridge between the window and the app

```javascript
const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('api', {
  transcribe: (pcmArray) => ipcRenderer.invoke('transcribe', pcmArray)
})
```

### `index.html` — the record/copy interface

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    body { font-family: system-ui; max-width: 540px; margin: 40px auto; padding: 0 20px; }
    button { font-size: 16px; padding: 10px 20px; margin: 6px 6px 6px 0; cursor: pointer; }
    textarea { width: 100%; height: 220px; margin-top: 16px; font-size: 14px; padding: 10px; }
    #status { color: #666; margin-left: 8px; }
  </style>
</head>
<body>
  <h2>🎙️ Voice Notes</h2>
  <button id="record">Start Recording</button>
  <button id="copy">Copy Transcript</button>
  <span id="status"></span>
  <textarea id="transcript" placeholder="Your transcript will appear here..."></textarea>

  <script>
    let mediaRecorder, chunks = [], recording = false
    const recordBtn = document.getElementById('record')
    const status = document.getElementById('status')
    const transcript = document.getElementById('transcript')

    recordBtn.onclick = async () => {
      if (!recording) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        mediaRecorder = new MediaRecorder(stream)
        chunks = []
        mediaRecorder.ondataavailable = e => chunks.push(e.data)
        mediaRecorder.onstop = async () => {
          stream.getTracks().forEach(t => t.stop())
          status.textContent = 'Transcribing...'
          // Decode recording to 16kHz mono PCM
          const blob = new Blob(chunks)
          const buf = await blob.arrayBuffer()
          const ctx = new AudioContext({ sampleRate: 16000 })
          const decoded = await ctx.decodeAudioData(buf)
          await ctx.close()
          const text = await window.api.transcribe(Array.from(decoded.getChannelData(0)))
          transcript.value = text
          status.textContent = 'Done'
        }
        mediaRecorder.start()
        recording = true
        recordBtn.textContent = 'Stop Recording'
        status.textContent = 'Recording...'
      } else {
        mediaRecorder.stop()
        recording = false
        recordBtn.textContent = 'Start Recording'
      }
    }

    document.getElementById('copy').onclick = () => {
      transcript.select()
      navigator.clipboard.writeText(transcript.value)
      status.textContent = 'Copied!'
    }
  </script>
</body>
</html>
```

---

## Step 3: Run it

```bash
npm start
```

A window opens. Click **Start Recording**, talk, click **Stop Recording**. The first time, it downloads the model (~75 MB, one-time), then transcribes. Edit the text if needed, then hit **Copy Transcript**.

---

## Tips
- **First run is slow** while the model downloads. After that it's cached and fast.
- **Better accuracy?** In `main.js`, change `whisper-base` to `whisper-small` (more accurate, a bit slower).
- **Privacy:** audio is processed entirely on your machine. Nothing is uploaded.
- **Mic only:** this records your microphone. Capturing audio from a call with others needs extra setup.
