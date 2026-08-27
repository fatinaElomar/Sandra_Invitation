/**
 * ════════════════════════════════════════════════════════════
 *  JHONY & SANDRA — WEDDING RSVP & WHATSAPP APPROVAL SCRIPT
 * ════════════════════════════════════════════════════════════
 * 
 *  COLUMNS:
 *  A: Full Name
 *  B: Phone Number
 *  C: Attendance (Yes, I will attend / Unable to attend)
 *  D: Requested Guests (Number entered by guest)
 *  E: Approval Status (Dropdown: Pending / Approved / Refused)
 *  F: Approved Guests (Number approved by event owner)
 *  G: WhatsApp Link (1-Click send button with custom message)
 *  H: Message / Warm Wishes
 *  I: Submitted At
 */

const HEADERS = [
  'Full Name',          // Col A (1)
  'Phone Number',       // Col B (2)
  'Attendance',         // Col C (3)
  'Requested Guests',   // Col D (4)
  'Approval Status',    // Col E (5) -> Dropdown: Pending / Approved / Refused
  'Approved Guests',    // Col F (6) -> Owner can adjust (e.g. from 4 to 2)
  'WhatsApp Link',      // Col G (7) -> 1-Click WhatsApp Send Link
  'Message / Wishes',   // Col H (8)
  'Submitted At'        // Col I (9)
];

// ── Web App Endpoint (Receives RSVP from Website) ─────────
function doPost(e) {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();

    // 1. Ensure Row 1 Headers are always up to date
    ensureHeaders(sheet);

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

    const isUnable = data.attendance && data.attendance.toLowerCase().includes('unable');
    const requestedGuests = isUnable ? 0 : (parseInt(data.guests, 10) || 1);
    const initialStatus = isUnable ? 'Refused' : 'Pending';
    const initialApproved = isUnable ? 0 : requestedGuests;
    const rowIndex = sheet.getLastRow() + 1;

    // 3. Build WhatsApp 1-Click formula for this row
    const waFormula = buildWhatsAppFormula(rowIndex);

    // 4. Append the new RSVP row
    sheet.appendRow([
      data.fullName   || '',
      data.phone      || '',
      data.attendance || '',
      requestedGuests,
      initialStatus,
      initialApproved,
      waFormula,
      data.message    || '',
      data.timestamp  || new Date().toLocaleString('en-GB')
    ]);

    // 5. Apply Dropdown & Styling to the new row
    applyRowFormatting(sheet, rowIndex, initialStatus);

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

// ── Ensure Row 1 has the Correct Headers ──────────────────
function ensureHeaders(sheet) {
  if (sheet.getLastRow() === 0 || sheet.getRange(1, 5).getValue() !== 'Approval Status') {
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
    const headerRange = sheet.getRange(1, 1, 1, HEADERS.length);
    headerRange.setFontWeight('bold');
    headerRange.setBackground('#1a1a1a');
    headerRange.setFontColor('#c9a84c');
    headerRange.setHorizontalAlignment('center');
    sheet.setFrozenRows(1);
  }
}

// ── Dropdown Validation & Status Color Coding ─────────────
function applyRowFormatting(sheet, row, status) {
  // Dropdown on Column E (Approval Status)
  const cell = sheet.getRange(row, 5);
  const rule = SpreadsheetApp.newDataValidation()
    .requireValueInList(['Pending', 'Approved', 'Refused'], true)
    .setAllowInvalid(false)
    .build();
  cell.setDataValidation(rule);

  // Status color
  if (status === 'Approved') {
    cell.setBackground('#d4edda').setFontColor('#155724').setFontWeight('bold');
  } else if (status === 'Refused') {
    cell.setBackground('#f8d7da').setFontColor('#721c24').setFontWeight('bold');
  } else {
    cell.setBackground('#fff3cd').setFontColor('#856404').setFontWeight('normal');
  }
}

// ── Dynamic WhatsApp Formula Generator ────────────────────
function buildWhatsAppFormula(row) {
  return `=IF(A${row}="","", HYPERLINK("https://api.whatsapp.com/send?phone=" & SUBSTITUTE(SUBSTITUTE(SUBSTITUTE(SUBSTITUTE(IF(LEFT(TRIM(B${row}),1)="+", MID(SUBSTITUTE(B${row}," ",""),2,50), IF(LEFT(SUBSTITUTE(B${row}," ",""),3)="961", SUBSTITUTE(B${row}," ",""), "961" & SUBSTITUTE(B${row}," ",""))), "-",""), "(",""), ")",""), " ","") & "&text=" & ENCODEURL(IF(E${row}="Approved", IF(F${row}<D${row}, "Hello " & A${row} & "! 💍 Jhony & Sandra Wedding: Thank you for your RSVP! Due to venue capacity, your attendance has been confirmed for " & F${row} & " guest(s) (originally requested " & D${row} & "). We can't wait to celebrate with you on October 10th! 🎉", "Hello " & A${row} & "! 💍 Jhony & Sandra Wedding: Your attendance has been confirmed for " & F${row} & " guest(s)! We can't wait to celebrate with you on October 10th! 🎉"), IF(E${row}="Refused", "Hello " & A${row} & ", thank you for your RSVP to Jhony & Sandra's wedding. Due to venue capacity and seating limitations, we are unfortunately unable to accommodate your attendance request. Thank you so much for your understanding and warm wishes! ♥", "Hello " & A${row} & "! Your RSVP for Jhony & Sandra's wedding is currently pending review."))), IF(E${row}="Approved", "📲 Send Approval (" & F${row} & ")", IF(E${row}="Refused", "📲 Send Refusal", "⏳ Pending Link"))))`;
}

// ── Edit Trigger (When Owner Changes Status in Google Sheet) ──
function onEdit(e) {
  if (!e || !e.range) return;
  const sheet = e.range.getSheet();
  const row   = e.range.getRow();
  const col   = e.range.getColumn();

  if (row < 2) return; // Skip header row

  // When Column E (Status) or Column F (Approved Guests) is edited:
  if (col === 5 || col === 6) {
    const status          = sheet.getRange(row, 5).getValue();
    const requestedGuests = parseInt(sheet.getRange(row, 4).getValue(), 10) || 1;
    let approvedGuests    = parseInt(sheet.getRange(row, 6).getValue(), 10);

    if (status === 'Approved' && (isNaN(approvedGuests) || approvedGuests <= 0)) {
      approvedGuests = requestedGuests;
      sheet.getRange(row, 6).setValue(approvedGuests);
    } else if (status === 'Refused') {
      sheet.getRange(row, 6).setValue(0);
    }

    // Refresh WhatsApp link & formatting
    sheet.getRange(row, 7).setFormula(buildWhatsAppFormula(row));
    applyRowFormatting(sheet, row, status);
  }
}

// ── Custom Menu in Google Sheets ──────────────────────────
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('💍 Wedding RSVP Admin')
    .addItem('🛠️ Format / Fix All Headers & Dropdowns', 'fixAllRows')
    .addToUi();
}

/**
 * Click this button in Google Sheets menu anytime to format 
 * all existing rows with dropdowns, colors, and WhatsApp links!
 */
function fixAllRows() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  ensureHeaders(sheet);

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    SpreadsheetApp.getUi().alert('Headers created! Waiting for RSVPs.');
    return;
  }

  for (let r = 2; r <= lastRow; r++) {
    const status = sheet.getRange(r, 5).getValue() || 'Pending';
    const requested = parseInt(sheet.getRange(r, 4).getValue(), 10) || 1;
    const approvedCell = sheet.getRange(r, 6);

    if (!approvedCell.getValue() && status === 'Approved') {
      approvedCell.setValue(requested);
    }

    applyRowFormatting(sheet, r, status);
    sheet.getRange(r, 7).setFormula(buildWhatsAppFormula(r));
  }

  sheet.autoResizeColumns(1, HEADERS.length);
  SpreadsheetApp.getUi().alert('All rows formatted with Approval dropdowns and WhatsApp links! ✓');
}
