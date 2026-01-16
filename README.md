## 💸 Zero-Cost AI Expense Manager

A **serverless, automated expense tracker** powered by **Google Gemini**, **Telegram**, and **Google Sheets**.

### 🎯 Project Goal

Stop manual data entry.
Just send a text like:

```
Lunch 250
```

or upload a photo of a bill to your **Telegram bot**.

The system will:

* Extract details using AI
* Categorize expenses
* Upload receipts to Google Drive
* Log everything into Google Sheets automatically

---

## 🚀 Key Features

* **100% Free Architecture**
  Built entirely on Free Tier APIs (Telegram, Google Apps Script, Gemini)

* **AI-Powered Extraction**
  Understands natural language like:

  * “Yesterday”
  * “Last night”
  * “Paid via GPay”

* **Receipt OCR**
  Upload a bill photo → date & amount extracted automatically

* **Time-Aware Intelligence**
  Converts relative times (e.g. `10 PM`) into your local timezone (IST / GMT+5:30)

* **Auto-Sorting**
  Expenses are sorted chronologically even if added late

* **Smart Linking**
  Auto-generated **View Bill** links pointing to Google Drive files

---

## 🛠️ Step-by-Step Setup Guide

Follow these **5 steps** to get your bot running in **under 10 minutes**.

---

## Step 1: Get the Telegram Bot Token

1. Open Telegram and search for `@BotFather`
2. Click **Start** and type:

   ```
   /newbot
   ```
3. Give your bot:

   * **Name:** `MyExpenseTracker`
   * **Username:** `MyExpense_bot`
4. Copy the **HTTP API Token**
   Example:

   ```
   123456:ABC-DEF1234ghIkl-zyx
   ```

---

## Step 2: Get the Gemini AI API Key

1. Go to **Google AI Studio**
2. Sign in with your Google account
3. Click **Create API Key**
4. Select **Create API key in new project**
5. Copy the API key (starts with `AIza...`)

---

## Step 3: Prepare Google Sheets & Drive

### A. Create the Receipt Folder

1. Go to Google Drive
2. Create a folder named:

   ```
   Receipts
   ```
3. Copy the **Folder ID** from the URL

Example:

```
drive.google.com/drive/folders/Case-Sensitve-Alphabets
```

Folder ID:

```
Case-Sensitve-Alphabets
```

---

### B. Create the Spreadsheet

1. Create a new Google Sheet
2. Copy the **Sheet ID** from the URL

Example:

```
docs.google.com/spreadsheets/d/Case-Sensitve-Alphabets/edit
```

Sheet ID:

```
Case-Sensitve-Alphabets
```

3. Rename the tab to:

   ```
   Expenses
   ```

4. Add these headers **exactly in Row 1**:

| Date | By | Where | Why | How much | Method | Details | Bill Link |
| ---- | -- | ----- | --- | -------- | ------ | ------- | --------- |

---

## Step 4: Add the Code

1. Open your Google Sheet
2. Go to:

   ```
   Extensions → Apps Script
   ```
3. Delete any existing code
4. Paste the code from `ExpenseBot.gs`
5. Update the configuration section:

```javascript
// --- CONFIGURATION ---
var GEMINI_API_KEY = "PASTE_YOUR_GEMINI_KEY_HERE";
var BOT_TOKEN = "PASTE_YOUR_TELEGRAM_BOT_TOKEN_HERE";
var SHEET_ID = "PASTE_YOUR_SHEET_ID_HERE";
var FOLDER_ID = "PASTE_YOUR_DRIVE_FOLDER_ID_HERE";

var USERS = {
  "000000000": "Hari" // You will update this later
};
```

---

## Step 5: Deploy & Connect

### A. Deploy the Script

1. Click **Deploy** → **New Deployment**
2. Click the ⚙️ **Gear Icon** → **Web App**
3. Set:

   * **Description:** Expense Bot
   * **Execute as:** Me
   * **Who has access:** Anyone ⚠️ (Important)
4. Click **Deploy**
5. Copy the **Web App URL** (ends with `/exec`)

---

### B. Set the Telegram Webhook

Replace the placeholders and open this URL in your browser:

```
https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook?url=<YOUR_WEB_APP_URL>
```

Expected response:

```json
{
  "ok": true,
  "description": "Webhook was set"
}
```

---

## 🏁 Final Step: Get Your Telegram User ID

To prevent strangers from using your bot:

1. Open your bot and click **Start**
2. Search for `@userinfobot`
3. Copy your **User ID** (e.g. `9999999999`)
4. Update the `USERS` section:

```javascript
var USERS = {
  "9999999999": "User 1",
  "8888888888": "User 2"
};
```

5. Deploy again:

```
Deploy → Manage Deployments → Edit → New Version → Deploy
```

---

## 💡 Usage Examples

| Input Type    | Example                               | Result                               |
| ------------- | ------------------------------------- | ------------------------------------ |
| Simple Text   | `Lunch at A2B for 350 via GPay`       | Logs date, amount, category & method |
| Receipt Photo | Upload bill image                     | OCR extracts date & amount           |
| Relative Time | `Medicine yesterday at 10pm 500 cash` | Converts to exact timestamp          |

---

## 📄 License

This project is licensed under the **MIT License**.
See the `LICENSE` file for more details.

---
