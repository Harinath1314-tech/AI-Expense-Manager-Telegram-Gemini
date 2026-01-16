// --- CONFIGURATION ---
// 1. Get Key from: https://aistudio.google.com/app/apikey
var GEMINI_API_KEY = "PASTE_YOUR_GEMINI_KEY_HERE"; 

// 2. Get Token from @BotFather on Telegram
var BOT_TOKEN = "PASTE_YOUR_BOT_TOKEN_HERE"; 

// 3. Found in your Google Sheet URL: /spreadsheets/d/THIS_PART/edit
var SHEET_ID = "PASTE_YOUR_SHEET_ID_HERE"; 

// 4. Found in your Drive Folder URL: /folders/THIS_PART
var FOLDER_ID = "PASTE_YOUR_FOLDER_ID_HERE"; 

// 5. Get IDs from @userinfobot on Telegram
var USERS = {
  "YOUR_TELEGRAM_USER_ID_1": "User_1", 
  "YOUR_TELEGRAM_USER_ID_2": "User_2"
};
// ---------------------

function doPost(e) {
  var chatId = null;
  try {
    var data = JSON.parse(e.postData.contents);
    if (!data.message) return;

    chatId = data.message.chat.id;
    var userId = data.message.from.id;
    var text = data.message.text || data.message.caption || "";
    var photo = data.message.photo;
    var name = USERS[userId] || "Unknown";
    
    if (text === "/start") {
      sendMessage(chatId, "Hello " + name + "! AI Expense Tracker is ready.");
      return;
    }

    // 1. IMAGE UPLOAD
    var fileUrl = "No Bill";
    var imageBlob = null;

    if (photo) {
      sendMessage(chatId, "📸 Reading receipt...");
      try {
        var fileId = photo[photo.length - 1].file_id;
        var fileUrlTg = "https://api.telegram.org/bot" + BOT_TOKEN + "/getFile?file_id=" + fileId;
        var fileResponse = UrlFetchApp.fetch(fileUrlTg);
        var filePath = JSON.parse(fileResponse.getContentText()).result.file_path;
        var downloadUrl = "https://api.telegram.org/file/bot" + BOT_TOKEN + "/" + filePath;
        
        imageBlob = UrlFetchApp.fetch(downloadUrl).getBlob();
        
        var dateString = new Date().toISOString().slice(0,10);
        var folder = DriveApp.getFolderById(FOLDER_ID);
        var driveFile = folder.createFile(imageBlob).setName("Expense_" + dateString + ".jpg");
        driveFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
        fileUrl = driveFile.getUrl();
      } catch (err) {
        fileUrl = "Upload Failed"; 
      }
    } else {
      sendMessage(chatId, "🧠 Processing...");
    }

    // 2. DATA PROCESSING
    var expense = {};
    try {
      var aiRaw = callGeminiWithRetry(text, imageBlob);
      expense = cleanAndParseJSON(aiRaw);
    } catch (aiError) {
      sendMessage(chatId, "⚠️ AI Busy (" + aiError.message + "). Using Manual Mode.");
      expense = manualParse(text);
    }
    
    // 3. DATE LOGIC (GMT+5:30 Fix)
    var finalDate = new Date(); 
    if (expense.date) {
      try {
        var dateStr = expense.date; 
        if (dateStr.length === 10) dateStr += " 00:00:00";
        var istDate = new Date(dateStr + " GMT+0530");
        if (!isNaN(istDate.getTime())) finalDate = istDate;
      } catch (e) {}
    }

    // 4. SAVE TO SHEET
    var ss = SpreadsheetApp.openById(SHEET_ID);
    var sheet = ss.getSheetByName("Expenses");
    
    var amount = expense.amount || 0;
    var category = expense.category || "Misc";
    var method = expense.method || "Cash";
    var where = expense.where || "Unknown";

    // Format Date for Telegram display
    var displayDate = Utilities.formatDate(finalDate, "GMT+5:30", "dd MMM yyyy, h:mm a");

    // APPEND ROW with an EMPTY placeholder for the Link column initially
    // Column Order: Date | By | Where | Why | How much | Method | Details | Bill Link
    sheet.appendRow([finalDate, name, where, category, amount, method, text, ""]);
    
    // --- 5. CREATE CLEAN LINK (The "Chip" Automation) ---
    var lastRow = sheet.getLastRow();
    var linkColumn = 8; // Column H is the 8th column

    if (fileUrl && fileUrl.indexOf("http") === 0) {
      // Create a Rich Text Value (Clickable "View Bill" text)
      var richValue = SpreadsheetApp.newRichTextValue()
        .setText("📄 View Bill")
        .setLinkUrl(fileUrl)
        .build();
      sheet.getRange(lastRow, linkColumn).setRichTextValue(richValue);
    } else {
      // If no valid link, just put text
      sheet.getRange(lastRow, linkColumn).setValue(fileUrl);
    }

    // --- 6. AUTO SORT (Run AFTER creating the link) ---
    sortSheetByDate(sheet);
    
    sendMessage(chatId, "✅ Saved: " + amount + " (" + category + ")\n📍 " + where + "\n📅 " + displayDate);

  } catch (criticalError) {
    if (chatId) sendMessage(chatId, "❌ CRITICAL ERROR: " + criticalError.toString());
  }
}

// --- AUTO SORT FUNCTION ---
function sortSheetByDate(sheet) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return;
  // Sort based on Column 1 (Date), Ascending
  sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).sort({column: 1, ascending: true});
}

// --- RETRY LOGIC ---
function callGeminiWithRetry(text, imageBlob) {
  var maxRetries = 3;
  for (var i = 0; i < maxRetries; i++) {
    try {
      return callGeminiVerified(text, imageBlob);
    } catch (e) {
      if (e.message.indexOf("Overloaded") !== -1 || e.message.indexOf("503") !== -1 || e.message.indexOf("quota") !== -1) {
        Utilities.sleep(2000); 
        continue;
      }
      throw e;
    }
  }
  throw new Error("AI Busy");
}

// --- VERIFIED AI CALLER ---
function callGeminiVerified(userText, imageBlob) {
  var listUrl = "https://generativelanguage.googleapis.com/v1beta/models?key=" + GEMINI_API_KEY.trim();
  var listResponse = UrlFetchApp.fetch(listUrl, {muteHttpExceptions: true});
  var listData = JSON.parse(listResponse.getContentText());
  
  if (listData.error) throw new Error("API Key Error");

  var safeKeywords = ["flash", "gemini-1.5-pro", "gemini-pro"];
  var selectedModel = "";

  if (listData.models) {
    for (var i = 0; i < safeKeywords.length; i++) {
      var wanted = safeKeywords[i];
      for (var j = 0; j < listData.models.length; j++) {
        var currentName = listData.models[j].name;
        if (currentName.indexOf(wanted) !== -1 && currentName.indexOf("experimental") === -1) {
          selectedModel = currentName;
          break;
        }
      }
      if (selectedModel) break; 
    }
  }

  if (!selectedModel) {
     if (listData.models) {
       for (var k=0; k<listData.models.length; k++) {
         if (listData.models[k].supportedGenerationMethods && listData.models[k].supportedGenerationMethods.indexOf("generateContent") !== -1) {
            selectedModel = listData.models[k].name;
            break;
         }
       }
     }
  }
  
  if (!selectedModel) throw new Error("No AI model found.");

  var url = "https://generativelanguage.googleapis.com/v1beta/" + selectedModel + ":generateContent?key=" + GEMINI_API_KEY.trim();
  
  // IST Time for Prompt
  var now = new Date();
  var istTimeStr = Utilities.formatDate(now, "GMT+5:30", "yyyy-MM-dd HH:mm");
  
  var promptText = `
    Context: Today is ${istTimeStr} (IST).
    Task: Extract expense data.
    Input: "${userText}"
    
    Rules:
    1. Amount: Number only.
    2. Category: ONE of [Food, Travel, Hospital, Misc].
    3. Method: ONE of [Gpay, Cash, Card]. Default to Cash.
    4. Where: Merchant name.
    5. Date:
       - If image, READ date from bill.
       - If text has time (e.g. "Yesterday", "10:30 PM"), calculate YYYY-MM-DD HH:mm based on Today.
       - If no date, return null.

    Return JSON ONLY: {"amount": number, "category": "String", "method": "String", "where": "String", "date": "YYYY-MM-DD HH:mm_or_null"}
  `;

  var parts = [{ "text": promptText }];

  if (imageBlob) {
    var base64Img = Utilities.base64Encode(imageBlob.getBytes());
    parts.push({ "inline_data": { "mime_type": "image/jpeg", "data": base64Img } });
  }

  var payload = { "contents": [{ "parts": parts }] };
  var options = {
    "method": "post",
    "contentType": "application/json",
    "payload": JSON.stringify(payload),
    "muteHttpExceptions": true
  };

  var response = UrlFetchApp.fetch(url, options);
  var result = JSON.parse(response.getContentText());

  if (result.error) throw new Error(result.error.message);
  
  if (result.candidates && result.candidates[0].content) {
    return result.candidates[0].content.parts[0].text;
  }
  return "{}";
}

// --- MANUAL FALLBACK ---
function manualParse(text) {
  var parts = text.split(" ");
  return {
    "amount": parts.length >= 1 ? parseFloat(parts[0]) || 0 : 0,
    "category": parts.length >= 2 ? parts[1] : "Misc",
    "method": parts.length >= 3 ? parts[2] : "Cash",
    "where": parts.length >= 4 ? parts.slice(3).join(" ") : "Unknown",
    "date": null
  };
}

// --- HELPER: CLEAN JSON ---
function cleanAndParseJSON(text) {
  try {
    var clean = text.replace(/```json/g, "").replace(/```/g, "");
    var firstBracket = clean.indexOf('{');
    var lastBracket = clean.lastIndexOf('}');
    if (firstBracket !== -1 && lastBracket !== -1) {
      clean = clean.substring(firstBracket, lastBracket + 1);
      return JSON.parse(clean);
    }
    throw new Error("No JSON found");
  } catch (e) {
    throw new Error("JSON Parse Error");
  }
}

function sendMessage(chatId, text) {
  try {
    var url = "https://api.telegram.org/bot" + BOT_TOKEN + "/sendMessage";
    var payload = { "chat_id": chatId, "text": text };
    UrlFetchApp.fetch(url, { "method": "post", "contentType": "application/json", "payload": JSON.stringify(payload) });
  } catch (e) {
    Logger.log("Failed to send Telegram message");
  }
}
