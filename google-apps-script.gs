/**
 * ════════════════════════════════════════════════════════════
 *  JHONY & SANDRA — WEDDING RSVP & WHATSAPP APPROVAL SYSTEM
 * ════════════════════════════════════════════════════════════
 * 
 *  FEATURES:
 *  1. Saves guest RSVPs with requested Number of Guests.
 *  2. Approval workflow (Pending / Approved / Refused).
 *  3. Allows owner to approve fewer guests (e.g. requested 4, approved 2).
 *  4. Instant 1-Click WhatsApp send link in every row.
 *  5. Optional background automated WhatsApp sending via API (UltraMsg / Twilio / GreenAPI).
 *  6. Live Dashboard: Approved Guests count, Pending count, Refused count.
 */

// ── Configuration (Optional: for background automated WhatsApp API) ──
const WHATSAPP_API_CONFIG = {
  // If you use UltraMsg (https://ultramsg.com) or similar WhatsApp API:
  ENABLED: false,               // Set to true if you have an API instance
  INSTANCE_ID: 'instanceXXXX',  // e.g. instance12345
  TOKEN: 'your_token_here',     // your API token
};

const HEADERS = [
  'Full Name',          // Col A (1)
  'Phone Number',       // Col B (2)
  'Attendance',         // Col C (3)
  'Requested Guests',   // Col D (4)
  'Approval Status',    // Col E (5) -> Dropdown: Pending / Approved / Refused
  'Approved Guests',    // Col F (6) -> Number approved by owner
  'WhatsApp Link',      // Col G (7) -> One-Click WhatsApp Send
  'Message / Wishes',   // Col H (8)
  'Submitted At',       // Col I (9)
  'Notification Log',   // Col J (10)
];

// ── Web App Endpoint (Receives RSVP from Website) ─────────
function doPost(e) {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();

    // 1. If sheet is new, setup Dashboard & Headers
    if (sheet.getLastRow() === 0) {
      setupSheetStructure(sheet);
    }

    // 2. Parse incoming RSVP data
    let data = {};
    if (e && e.postData && e.postData.contents) {
      try {
        data = JSON.parse(e.postData.contents);
      } catch (err) {
        data = e.parameter || {};
      }
    } else if (e && e.parameter) {
      data = e.parameter;
    }

    const requestedGuests = parseInt(data.guests, 10) || (data.attendance && data.attendance.toLowerCase().includes('unable') ? 0 : 1);
    const initialStatus = (data.attendance && data.attendance.toLowerCase().includes('unable')) ? 'Refused' : 'Pending';
    const initialApproved = (initialStatus === 'Refused') ? 0 : requestedGuests;
    const rowIndex = sheet.getLastRow() + 1;

    // Build WhatsApp 1-Click Formula for this row
    const waFormula = buildWhatsAppFormula(rowIndex);

    // 3. Append the new RSVP row
    sheet.appendRow([
      data.fullName   || '',
      data.phone      || '',
      data.attendance || '',
      requestedGuests,
      initialStatus,
      initialApproved,
      waFormula,
      data.message    || '',
      data.timestamp  || new Date().toLocaleString('en-GB'),
      'Waiting for review'
    ]);

    // Apply Dropdown validation for Approval Status (Column E)
    applyDropdownValidation(sheet, rowIndex);

    sheet.autoResizeColumns(1, HEADERS.length);

    return ContentService
      .createTextOutput(JSON.stringify({ result: 'success' }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ result: 'error', message: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  return ContentService
    .createTextOutput(JSON.stringify({
      result:  'ok',
      message: 'Jhony & Sandra RSVP & WhatsApp Approval system is active ✓',
    }))
    .setMimeType(ContentService.MimeType.JSON);
}

// ── Setup Dashboard Banner & Formatting ───────────────────
function setupSheetStructure(sheet) {
  // Row 1: Title Banner
  sheet.getRange('A1:J1').merge().setValue('JHONY & SANDRA — WEDDING RSVP & APPROVAL DASHBOARD');
  sheet.getRange('A1').setFontWeight('bold').setFontSize(14).setBackground('#1a1a1a').setFontColor('#c9a84c').setHorizontalAlignment('center');

  // Row 2: Live Summary Totals
  sheet.getRange('A2:B2').merge().setValue('TOTAL APPROVED GUESTS:');
  sheet.getRange('A2').setFontWeight('bold').setFontSize(11).setBackground('#242424').setFontColor('#e8d08f').setHorizontalAlignment('right');
  sheet.getRange('C2').setFormula('=SUMIF(E6:E, "Approved", F6:F)').setFontWeight('bold').setFontSize(13).setBackground('#242424').setFontColor('#5cb85c').setHorizontalAlignment('center');

  sheet.getRange('D2:E2').merge().setValue('TOTAL REQUESTED GUESTS:');
  sheet.getRange('D2').setFontWeight('bold').setFontSize(11).setBackground('#242424').setFontColor('#e8d08f').setHorizontalAlignment('right');
  sheet.getRange('F2').setFormula('=SUM(D6:D)').setFontWeight('bold').setFontSize(13).setBackground('#242424').setFontColor('#ffffff').setHorizontalAlignment('center');

  sheet.getRange('G2:H2').merge().setValue('PENDING REVIEWS:');
  sheet.getRange('G2').setFontWeight('bold').setFontSize(11).setBackground('#242424').setFontColor('#e8d08f').setHorizontalAlignment('right');
  sheet.getRange('I2:J2').merge().setFormula('=COUNTIF(E6:E, "Pending")').setFontWeight('bold').setFontSize(13).setBackground('#242424').setFontColor('#f0ad4e').setHorizontalAlignment('center');

  // Row 3: Secondary Counts
  sheet.getRange('A3:B3').merge().setValue('TOTAL RSVP RESPONSES:');
  sheet.getRange('A3').setFontWeight('bold').setFontSize(10).setBackground('#2e2e2e').setFontColor('#cccccc').setHorizontalAlignment('right');
  sheet.getRange('C3').setFormula('=COUNTA(A6:A)').setFontWeight('bold').setFontSize(11).setBackground('#2e2e2e').setFontColor('#ffffff').setHorizontalAlignment('center');

  sheet.getRange('D3:E3').merge().setValue('APPROVED PARTIES:');
  sheet.getRange('D3').setFontWeight('bold').setFontSize(10).setBackground('#2e2e2e').setFontColor('#cccccc').setHorizontalAlignment('right');
  sheet.getRange('F3').setFormula('=COUNTIF(E6:E, "Approved")').setFontWeight('bold').setFontSize(11).setBackground('#2e2e2e').setFontColor('#5cb85c').setHorizontalAlignment('center');

  sheet.getRange('G3:H3').merge().setValue('REFUSED / DECLINED:');
  sheet.getRange('G3').setFontWeight('bold').setFontSize(10).setBackground('#2e2e2e').setFontColor('#cccccc').setHorizontalAlignment('right');
  sheet.getRange('I3:J3').merge().setFormula('=COUNTIF(E6:E, "Refused")').setFontWeight('bold').setFontSize(11).setBackground('#2e2e2e').setFontColor('#d9534f').setHorizontalAlignment('center');

  // Row 4: Empty space
  sheet.getRange('A4:J4').setBackground('#f5f5f5');

  // Row 5: Column Headers
  sheet.getRange('A5:J5').setValues([HEADERS]);
  const headerRange = sheet.getRange('A5:J5');
  headerRange.setFontWeight('bold').setBackground('#1a1a1a').setFontColor('#c9a84c').setHorizontalAlignment('center');

  // Freeze rows 1 to 5
  sheet.setFrozenRows(5);
  sheet.autoResizeColumns(1, HEADERS.length);
}

// ── Dropdown Validation for Column E (Approval Status) ───
function applyDropdownValidation(sheet, row) {
  const cell = sheet.getRange(row, 5); // Column E
  const rule = SpreadsheetApp.newDataValidation()
    .requireValueInList(['Pending', 'Approved', 'Refused'], true)
    .setAllowInvalid(false)
    .build();
  cell.setDataValidation(rule);
}

// ── Build Formula for WhatsApp Click-to-Send in Col G ─────
function buildWhatsAppFormula(row) {
  // Cleans the phone number and formats a dynamic WhatsApp link with personalized message
  return `=IF(A${row}="","", HYPERLINK("https://api.whatsapp.com/send?phone=" & SUBSTITUTE(SUBSTITUTE(SUBSTITUTE(SUBSTITUTE(IF(LEFT(TRIM(B${row}),1)="+", MID(SUBSTITUTE(B${row}," ",""),2,50), IF(LEFT(SUBSTITUTE(B${row}," ",""),3)="961", SUBSTITUTE(B${row}," ",""), "961" & SUBSTITUTE(B${row}," ",""))), "-",""), "(",""), ")",""), " ","") & "&text=" & ENCODEURL(IF(E${row}="Approved", IF(F${row}<D${row}, "Hello " & A${row} & "! 💍 Jhony & Sandra Wedding: Thank you for your RSVP! Due to venue capacity, your attendance has been confirmed for " & F${row} & " guest(s) (originally requested " & D${row} & "). We can't wait to celebrate with you on October 10th! 🎉", "Hello " & A${row} & "! 💍 Jhony & Sandra Wedding: Your attendance has been confirmed for " & F${row} & " guest(s)! We can't wait to celebrate with you on October 10th! 🎉"), IF(E${row}="Refused", "Hello " & A${row} & ", thank you for your RSVP to Jhony & Sandra's wedding. Due to venue capacity and seating limitations, we are unfortunately unable to accommodate your attendance request. Thank you so much for your understanding and warm wishes! ♥", "Hello " & A${row} & "! Your RSVP for Jhony & Sandra's wedding is currently pending review. We will confirm shortly!"))), IF(E${row}="Approved", "📲 Send Approval (" & F${row} & ")", IF(E${row}="Refused", "📲 Send Refusal", "⏳ Pending Link"))))`;
}

// ── Edit Trigger (Auto-Detect Approval / Refusal Change) ──
function onEdit(e) {
  if (!e || !e.range) return;
  const sheet = e.range.getSheet();
  const row   = e.range.getRow();
  const col   = e.range.getColumn();

  // If change happens in row 6+ (guest entries)
  if (row < 6) return;

  // Column E (Approval Status) or Column F (Approved Guests) edited
  if (col === 5 || col === 6) {
    const name            = sheet.getRange(row, 1).getValue(); // Col A
    const phone           = sheet.getRange(row, 2).getValue(); // Col B
    const requestedGuests = parseInt(sheet.getRange(row, 4).getValue(), 10) || 1; // Col D
    const status          = sheet.getRange(row, 5).getValue(); // Col E
    let approvedGuests    = parseInt(sheet.getRange(row, 6).getValue(), 10); // Col F

    // If approved and approvedGuests was empty or 0, default to requestedGuests
    if (status === 'Approved' && (isNaN(approvedGuests) || approvedGuests <= 0)) {
      approvedGuests = requestedGuests;
      sheet.getRange(row, 6).setValue(approvedGuests);
    } else if (status === 'Refused') {
      sheet.getRange(row, 6).setValue(0);
      approvedGuests = 0;
    }

    // Refresh the WhatsApp formula in Column G
    sheet.getRange(row, 7).setFormula(buildWhatsAppFormula(row));

    // Color code the status row
    const statusCell = sheet.getRange(row, 5);
    if (status === 'Approved') {
      statusCell.setBackground('#d4edda').setFontColor('#155724').setFontWeight('bold');
    } else if (status === 'Refused') {
      statusCell.setBackground('#f8d7da').setFontColor('#721c24').setFontWeight('bold');
    } else {
      statusCell.setBackground('#fff3cd').setFontColor('#856404').setFontWeight('normal');
    }

    // If Background WhatsApp API is configured, send automatically
    if (WHATSAPP_API_CONFIG.ENABLED && (status === 'Approved' || status === 'Refused')) {
      const message = generateWhatsAppMessage(name, requestedGuests, approvedGuests, status);
      const cleanPhone = cleanPhoneNumber(phone);
      const result = sendWhatsAppApi(cleanPhone, message);
      sheet.getRange(row, 10).setValue(result ? 'Sent via API ✓' : 'API Failed');
    } else {
      sheet.getRange(row, 10).setValue(status === 'Pending' ? 'Waiting review' : 'Click Col G link to Send 📲');
    }
  }
}

// ── Clean Phone Number Helper ─────────────────────────────
function cleanPhoneNumber(phone) {
  if (!phone) return '';
  let str = String(phone).trim();
  let digits = str.replace(/\D/g, '');

  if (str.startsWith('+')) {
    return digits;
  }
  // If Lebanese 8-digit without country code (e.g. 70123456 or 03123456)
  if (digits.startsWith('961')) {
    return digits;
  }
  if (digits.length === 8) {
    return '961' + digits;
  }
  if (digits.length === 7 && digits.startsWith('3')) {
    return '961' + digits;
  }
  return digits;
}

// ── Generate WhatsApp Message Text ────────────────────────
function generateWhatsAppMessage(name, requestedGuests, approvedGuests, status) {
  if (status === 'Approved') {
    if (approvedGuests < requestedGuests) {
      return `Dear ${name},\n\nThank you for your RSVP for Jhony & Sandra's Wedding (Saturday, October 10th)!\n\nDue to venue capacity, your attendance has been confirmed for ${approvedGuests} guest(s) (requested: ${requestedGuests}).\n\nWe look forward to celebrating with you! 💍🎉`;
    } else {
      return `Dear ${name},\n\nYour attendance for Jhony & Sandra's Wedding (Saturday, October 10th) has been confirmed for ${approvedGuests} guest(s)!\n\nWe can't wait to celebrate together! 💍🎉`;
    }
  } else if (status === 'Refused') {
    return `Dear ${name},\n\nThank you for your RSVP to Jhony & Sandra's Wedding.\n\nDue to venue capacity and seating limitations, we are unfortunately unable to accommodate your attendance request.\n\nThank you so much for your warm wishes and understanding! ♥`;
  }
  return '';
}

// ── WhatsApp API Sender (UltraMsg / REST compatible) ──────
function sendWhatsAppApi(phone, message) {
  try {
    const url = `https://api.ultramsg.com/${WHATSAPP_API_CONFIG.INSTANCE_ID}/messages/chat`;
    const payload = {
      token: WHATSAPP_API_CONFIG.TOKEN,
      to: phone,
      body: message,
    };
    const options = {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(payload),
      muteHttpExceptions: true,
    };
    const response = UrlFetchApp.fetch(url, options);
    const resText = response.getContentText();
    return response.getResponseCode() === 200 && resText.includes('sent');
  } catch (e) {
    Logger.log('WhatsApp API Error: ' + e.message);
    return false;
  }
}

// ── Custom Menu in Google Sheets ──────────────────────────
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('💍 Wedding RSVP Admin')
    .addItem('📊 Refresh Dashboard & Formulas', 'refreshAllFormulas')
    .addItem('📲 Send WhatsApp for All Approved', 'sendAllApproved')
    .addToUi();
}

function refreshAllFormulas() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const lastRow = sheet.getLastRow();
  if (lastRow < 6) return;

  for (let r = 6; r <= lastRow; r++) {
    applyDropdownValidation(sheet, r);
    sheet.getRange(r, 7).setFormula(buildWhatsAppFormula(r));
  }
  SpreadsheetApp.getUi().alert('Dashboard and WhatsApp links successfully updated! ✓');
}

function sendAllApproved() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const lastRow = sheet.getLastRow();
  if (lastRow < 6) {
    SpreadsheetApp.getUi().alert('No guest entries to process.');
    return;
  }

  let count = 0;
  for (let r = 6; r <= lastRow; r++) {
    const status = sheet.getRange(r, 5).getValue();
    if (status === 'Approved') {
      count++;
    }
  }
  SpreadsheetApp.getUi().alert(`Found ${count} Approved guest(s). Click the green link in Column G for each guest to send via WhatsApp! 📲`);
}
