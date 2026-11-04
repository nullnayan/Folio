# Folio — Private, 100% Offline Mobile PDF Engine

> **Zero Cloud. Zero Telemetry. Complete Document Privacy.**

Folio is an open-source, offline-first mobile PDF utility engineered with **React Native**, **Expo**, and **pdf-lib**. Unlike cloud-based document tools that upload your sensitive documents (tax records, IDs, bank statements) to remote servers, Folio executes all PDF operations **100% in-memory directly on your device**.

---

## ⚡ Core Features

- 🔄 **Convert:** Seamless Photos ↔ PDF generation with custom page sizing & compression.
- 🔀 **Join & Split:** Merge multiple PDF files or extract targeted page ranges instantly.
- 🔐 **Protect & Encrypt:** Password-protect sensitive PDFs with native AES encryption.
- 📉 **Compress & Optimize:** Shrink large PDFs to meet portal upload limits (job applications, government portals).
- ✍️ **Sign & Watermark:** Place digital signatures, timestamps, and custom text watermarks.
- 📑 **Page Management:** Reorder, rotate, or delete specific pages on the fly.
- 🌐 **Bilingual Interface:** Full English & Hindi localization with smooth haptic feedback.

---

## 🔒 Architectural Privacy Guarantee

| Feature | Standard Cloud Tools (ILovePDF, etc.) | Folio |
|---|---|---|
| **Execution** | Uploaded to remote servers | 100% Local Device Runtime |
| **Network Reliance** | Requires active internet | Works completely offline |
| **Data Retention** | Stored on third-party servers | Never leaves your device |
| **File Limit & Paywalls** | Aggressive quotas & subscriptions | Free & open-source |

---

## 🛠️ Tech Stack

- **Framework:** [React Native](https://reactnative.dev/) + [Expo](https://expo.dev/) (SDK 57)
- **PDF Engine:** [`pdf-lib`](https://pdf-lib.js.org/) (Client-side JavaScript byte manipulation)
- **Language:** TypeScript
- **Target Platform:** Android (.apk) & iOS
- **Haptics & Media:** `expo-haptics`, `expo-file-system`, `expo-sharing`

---

## 🚀 Local Development Setup

```bash
# Clone the repository
git clone https://github.com/nullnayan/Folio.git
cd Folio

# Install dependencies
npm install

# Start the Expo development server
npx expo start
```

---

## 📄 License
Copyright © 2026 Nayan Kumar. All rights reserved.  
This software and source code are proprietary. Publicly available for showcase, portfolio evaluation, and review purposes only. Commercial use or reproduction is prohibited without written permission.
