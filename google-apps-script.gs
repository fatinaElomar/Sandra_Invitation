/**
 * ════════════════════════════════════════════════════════════
 *  JHONY & SANDRA — SMART RSVP VERIFICATION & APPROVAL SYSTEM
 * ════════════════════════════════════════════════════════════
 * 
 *  HOW IT WORKS:
 *  1. Tab 1: "Guest List" -> Enter invited names and their allowed guest count.
 *  2. Tab 2: "RSVP Responses" -> Auto-checks the guest list when submitted.
 *  3. Intelligent Fuzzy Matching: Matches names with spelling variations
 *     (e.g., "Reem Elomar" == "Rim Al Omar" == "Reem Alomar").
 *  4. Instant Live Approval Check:
 *     - If matched & guests <= allowed -> APPROVED (Popup on website)
 *     - If matched & guests > allowed  -> PARTIAL APPROVED (Popup with capacity limit)
 *     - If NOT matched on list         -> REFUSED (Popup notice)
 *  5. 1-Click WhatsApp confirmation links in every row.
 */

const RESPONSES_HEADERS = [
  'Entered Name',         // Col A (1)
  'Matched List Name',    // Col B (2)
  'Phone Number',         // Col C (3)
  'Attendance',           // Col D (4)
  'Requested Guests',     // Col E (5)
  'Approved Guests',      // Col F (6)
  'Approval Status',      // Col G (7) -> Approved / Partial / Refused
  'WhatsApp Link',        // Col H (8) -> 1-Click WhatsApp Button
  'Message / Wishes',     // Col I (9)
  'Submitted At'          // Col J (10)
];

const GUEST_LIST_HEADERS = [
  'Invited Full Name',    // Col A
  'Max Allowed Guests',   // Col B
  'Category / Notes'      // Col C
];

// ── Web App Endpoint (POST: Guest RSVP Submission) ────────
function doPost(e) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    ensureSheetSetup(ss);

    const guestListSheet = ss.getSheetByName('Guest List');
    const responsesSheet = ss.getSheetByName('RSVP Responses');

    // 1. Parse incoming RSVP data
    let data = {};
    if (e && e.postData && e.postData.contents) {
      try { data = JSON.parse(e.postData.contents); }
      catch (err) { data = e.parameter || {}; }
    } else if (e && e.parameter) {
      data = e.parameter;
    }

    const enteredName = String(data.fullName || '').trim();
    const phone = String(data.phone || '').trim();
    const attendance = String(data.attendance || '').trim();
    const requestedGuests = parseInt(data.guests, 10) || 1;
    const message = String(data.message || '').trim();
    const timestamp = String(data.timestamp || new Date().toLocaleString('en-GB'));
    const isUnable = attendance.toLowerCase().includes('unable');

    // 2. Perform Fuzzy Verification against "Guest List" tab
    const matchResult = findGuestInList(guestListSheet, enteredName);

    let status = 'Pending';
    let approvedGuests = 0;
    let resultType = 'approved';
    let clientMessage = '';

    if (isUnable) {
      status = 'Declined';
      approvedGuests = 0;
      resultType = 'declined';
      clientMessage = `Thank you ${enteredName} for letting us know. We'll miss you! ♥`;
    } else if (matchResult.found) {
      const maxAllowed = matchResult.maxGuests;

      if (requestedGuests <= maxAllowed) {
        status = 'Approved';
        approvedGuests = requestedGuests;
        resultType = 'approved';
        clientMessage = `Welcome, ${enteredName}! 🎉 Your RSVP has been confirmed for ${approvedGuests} guest(s). We can't wait to celebrate with you!`;
      } else {
        status = 'Approved (Capacity Limit)';
        approvedGuests = maxAllowed;
        resultType = 'partial';
        clientMessage = `Dear ${enteredName}, you requested ${requestedGuests} guests. Due to venue seating capacity, your attendance is confirmed for ${approvedGuests} guest(s).`;
      }
    } else {
      // Not found on pre-approved list
      status = 'Refused (Not on list)';
      approvedGuests = 0;
      resultType = 'refused';
      clientMessage = `Dear ${enteredName}, we could not find this name on our pre-approved invitation guest list. If you believe this is an error, please contact the couple directly.`;
    }

    // 3. Record in "RSVP Responses" Tab
    const rowIndex = responsesSheet.getLastRow() + 1;
    const waFormula = buildWhatsAppFormula(rowIndex);

    responsesSheet.appendRow([
      enteredName,
      matchResult.matchedName || '—',
      phone,
      attendance,
      requestedGuests,
      approvedGuests,
      status,
      waFormula,
      message,
      timestamp
    ]);

    // Apply Dropdown & Color formatting
    applyRowFormatting(responsesSheet, rowIndex, status);
    responsesSheet.autoResizeColumns(1, RESPONSES_HEADERS.length);

    // 4. Return instant result to website popup
    const responsePayload = {
      result: resultType,
      status: status,
      enteredName: enteredName,
      matchedName: matchResult.matchedName,
      requestedGuests: requestedGuests,
      approvedGuests: approvedGuests,
      message: clientMessage
    };

    return ContentService
      .createTextOutput(JSON.stringify(responsePayload))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({
        result: 'error',
        message: err.message
      }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// ── GET Endpoint (Health Check & Live Name Verification) ──
function doGet(e) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    ensureSheetSetup(ss);

    if (e && e.parameter && e.parameter.checkName) {
      const guestListSheet = ss.getSheetByName('Guest List');
      const match = findGuestInList(guestListSheet, e.parameter.checkName);
      return ContentService
        .createTextOutput(JSON.stringify(match))
        .setMimeType(ContentService.MimeType.JSON);
    }

    return ContentService
      .createTextOutput(JSON.stringify({
        result: 'ok',
        message: 'Jhony & Sandra Smart RSVP Verification is active ✓'
      }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ result: 'error', message: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// ════════════════════════════════════════════════════════════
// ADVANCED PHONETIC & FUZZY NAME MATCHING
// ════════════════════════════════════════════════════════════

/**
 * Normalizes names to handle English/Arabic transliterations:
 * - reem / rim / rym
 * - el omar / al omar / alomar / elomar
 * - jhonny / jhony / johnny
 * - removes double letters, prefixes, vowels discrepancies
 */
function normalizeName(str) {
  if (!str) return '';
  let s = String(str).toLowerCase().trim();

  // Normalize diacritics / accents
  s = s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  // Remove honorific titles
  s = s.replace(/\b(mr|mrs|ms|dr|eng|sheikh|sayed|haj|hajj)\b\.?\s*/g, '');

  // Normalize common Arabic prefixes (el -> al, el- -> al )
  s = s.replace(/\bel\s*-\s*/g, 'al ')
       .replace(/\bel\s+/g, 'al ')
       .replace(/\bal\s*-\s*/g, 'al ')
       .replace(/\babd\s+el\s*/g, 'abdal')
       .replace(/\babd\s+al\s*/g, 'abdal')
       .replace(/\babdel\s*/g, 'abdal');

  // Phonetic vowel harmonizations
  s = s.replace(/ee+/g, 'i')
       .replace(/ea+/g, 'i')
       .replace(/y+/g, 'i')
       .replace(/oo+/g, 'u')
       .replace(/ou+/g, 'u')
       .replace(/kh+/g, 'k')
       .replace(/gh+/g, 'g')
       .replace(/ph+/g, 'f')
       .replace(/ch+/g, 'sh');

  // Collapse double consonants (e.g. mm -> m, ll -> l, tt -> t)
  s = s.replace(/([b-df-hj-np-tv-z])\1+/g, '$1');

  // Remove all non-alphanumeric chars
  return s.replace(/[^a-z0-9]/g, '');
}

/**
 * Calculates Levenshtein string distance similarity (0.0 to 1.0)
 */
function stringSimilarity(s1, s2) {
  if (s1 === s2) return 1.0;
  if (!s1 || !s2) return 0.0;

  const longer = s1.length >= s2.length ? s1 : s2;
  const shorter = s1.length < s2.length ? s1 : s2;
  const lLen = longer.length;
  if (lLen === 0) return 1.0;

  const costs = [];
  for (let i = 0; i <= longer.length; i++) {
    let lastValue = i;
    for (let j = 0; j <= shorter.length; j++) {
      if (i === 0) {
        costs[j] = j;
      } else if (j > 0) {
        let newValue = costs[j - 1];
        if (longer.charAt(i - 1) !== shorter.charAt(j - 1)) {
          newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
        }
        costs[j - 1] = lastValue;
        lastValue = newValue;
      }
    }
    if (i > 0) costs[shorter.length] = lastValue;
  }

  return (lLen - costs[shorter.length]) / lLen;
}

/**
 * Searches the "Guest List" tab for an entered name with fuzzy matching
 */
function findGuestInList(sheet, enteredName) {
  if (!sheet) return { found: false };
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return { found: false };

  const listData = sheet.getRange(2, 1, lastRow - 1, 2).getValues();
  const normEntered = normalizeName(enteredName);

  let bestMatch = null;
  let highestScore = 0;

  for (let i = 0; i < listData.length; i++) {
    const originalName = String(listData[i][0] || '').trim();
    const maxGuests = parseInt(listData[i][1], 10) || 1;
    if (!originalName) continue;

    const normList = normalizeName(originalName);

    // 1. Exact normalized match
    if (normEntered === normList) {
      return {
        found: true,
        matchedName: originalName,
        maxGuests: maxGuests,
        score: 1.0
      };
    }

    // 2. Similarity calculation
    const score = stringSimilarity(normEntered, normList);
    if (score > highestScore) {
      highestScore = score;
      bestMatch = {
        found: true,
        matchedName: originalName,
        maxGuests: maxGuests,
        score: score
      };
    }
  }

  // Confident match threshold (>= 78% phonetic similarity)
  if (bestMatch && highestScore >= 0.78) {
    return bestMatch;
  }

  return { found: false, score: highestScore };
}

// ════════════════════════════════════════════════════════════
// SHEET SETUP & FORMATTING
// ════════════════════════════════════════════════════════════

function ensureSheetSetup(ss) {
  let guestSheet = ss.getSheetByName('Guest List');
  let respSheet = ss.getSheetByName('RSVP Responses');

  // If only default "Sheet1" exists, rename it
  if (!guestSheet && !respSheet) {
    const sheets = ss.getSheets();
    respSheet = sheets[0];
    respSheet.setName('RSVP Responses');
    guestSheet = ss.insertSheet('Guest List', 0);
  }

  if (!guestSheet) guestSheet = ss.insertSheet('Guest List', 0);
  if (!respSheet) respSheet = ss.insertSheet('RSVP Responses', 1);

  // Setup "Guest List" Tab
  if (guestSheet.getLastRow() === 0) {
    guestSheet.getRange(1, 1, 1, GUEST_LIST_HEADERS.length).setValues([GUEST_LIST_HEADERS]);
    guestSheet.getRange(1, 1, 1, GUEST_LIST_HEADERS.length)
      .setFontWeight('bold')
      .setBackground('#1a1a1a')
      .setFontColor('#c9a84c')
      .setHorizontalAlignment('center');

    // Add initial sample guest list entries for the couple
    guestSheet.appendRow(['Reem El Omar', 2, 'Bride VIP Guest']);
    guestSheet.appendRow(['Jhony & Sandra Family', 4, 'Family Table']);
    guestSheet.appendRow(['Karim Haddad', 1, 'Friend']);
    guestSheet.setFrozenRows(1);
    guestSheet.autoResizeColumns(1, 3);
  }

  // Setup "RSVP Responses" Tab
  if (respSheet.getLastRow() === 0 || respSheet.getRange(1, 7).getValue() !== 'Approval Status') {
    respSheet.getRange(1, 1, 1, RESPONSES_HEADERS.length).setValues([RESPONSES_HEADERS]);
    respSheet.getRange(1, 1, 1, RESPONSES_HEADERS.length)
      .setFontWeight('bold')
      .setBackground('#1a1a1a')
      .setFontColor('#c9a84c')
      .setHorizontalAlignment('center');
    respSheet.setFrozenRows(1);
  }
}

// ── Dropdown & Color Formatting ───────────────────────────
function applyRowFormatting(sheet, row, status) {
  const cell = sheet.getRange(row, 7); // Col G (Approval Status)
  const rule = SpreadsheetApp.newDataValidation()
    .requireValueInList(['Approved', 'Approved (Capacity Limit)', 'Refused (Not on list)', 'Declined', 'Pending'], true)
    .setAllowInvalid(false)
    .build();
  cell.setDataValidation(rule);

  if (status.startsWith('Approved')) {
    cell.setBackground('#d4edda').setFontColor('#155724').setFontWeight('bold');
  } else if (status.startsWith('Refused')) {
    cell.setBackground('#f8d7da').setFontColor('#721c24').setFontWeight('bold');
  } else {
    cell.setBackground('#fff3cd').setFontColor('#856404').setFontWeight('normal');
  }
}

// ── WhatsApp 1-Click Formula for Col H ─────────────────────
function buildWhatsAppFormula(row) {
  return `=IF(A${row}="","", HYPERLINK("https://api.whatsapp.com/send?phone=" & SUBSTITUTE(SUBSTITUTE(SUBSTITUTE(SUBSTITUTE(IF(LEFT(TRIM(C${row}),1)="+", MID(SUBSTITUTE(C${row}," ",""),2,50), IF(LEFT(SUBSTITUTE(C${row}," ",""),3)="961", SUBSTITUTE(C${row}," ",""), "961" & SUBSTITUTE(C${row}," ",""))), "-",""), "(",""), ")",""), " ","") & "&text=" & ENCODEURL(IF(LEFT(G${row},8)="Approved", IF(F${row}<E${row}, "Hello " & A${row} & "! 💍 Jhony & Sandra Wedding: Thank you for your RSVP! Due to venue capacity, your attendance has been confirmed for " & F${row} & " guest(s) (originally requested " & E${row} & "). We can't wait to celebrate with you on October 10th! 🎉", "Hello " & A${row} & "! 💍 Jhony & Sandra Wedding: Your attendance has been confirmed for " & F${row} & " guest(s)! We can't wait to celebrate with you on October 10th! 🎉"), IF(LEFT(G${row},7)="Refused", "Hello " & A${row} & ", thank you for your RSVP to Jhony & Sandra's wedding. Due to venue capacity and seating limitations, we are unfortunately unable to accommodate your attendance request. Thank you so much for your understanding and warm wishes! ♥", "Hello " & A${row} & "! Your RSVP for Jhony & Sandra's wedding is received."))), IF(LEFT(G${row},8)="Approved", "📲 Send Approval (" & F${row} & ")", IF(LEFT(G${row},7)="Refused", "📲 Send Refusal", "⏳ WhatsApp Link"))))`;
}

// ── Google Sheets Custom Menu ─────────────────────────────
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('💍 Wedding RSVP Admin')
    .addItem('🛠️ Setup & Fix All Tabs and Dropdowns', 'fixAllTabs')
    .addToUi();
}

function fixAllTabs() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  ensureSheetSetup(ss);

  const respSheet = ss.getSheetByName('RSVP Responses');
  const lastRow = respSheet.getLastRow();

  if (lastRow >= 2) {
    for (let r = 2; r <= lastRow; r++) {
      const status = respSheet.getRange(r, 7).getValue() || 'Pending';
      applyRowFormatting(respSheet, r, status);
      respSheet.getRange(r, 8).setFormula(buildWhatsAppFormula(r));
    }
  }

  SpreadsheetApp.getUi().alert('Both "Guest List" and "RSVP Responses" tabs are fully set up and synchronized! ✓');
}
