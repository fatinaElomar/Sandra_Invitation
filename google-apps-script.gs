/**
 * ════════════════════════════════════════════════════════════
 *  JHONY & SANDRA — Google Apps Script
 *  Appends each RSVP and shows LIVE TOTAL ATTENDING PEOPLE at top.
 * ════════════════════════════════════════════════════════════
 */

const HEADERS = [
  'Full Name',
  'Phone Number',
  'Email',
  'Attendance',
  'Number of Guests',
  'Message',
  'Submitted At',
];

function doPost(e) {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();

    // 1. If sheet is empty, create top Summary Banner + Headers
    if (sheet.getLastRow() === 0) {
      // Row 1: Title Banner
      sheet.getRange('A1:G1').merge().setValue('JHONY & SANDRA — WEDDING RSVP');
      sheet.getRange('A1').setFontWeight('bold').setFontSize(14).setBackground('#1a1a1a').setFontColor('#c9a84c').setHorizontalAlignment('center');

      // Row 2: Total Attending People Headcount (Live Formula!)
      sheet.getRange('A2:C2').merge().setValue('TOTAL ATTENDING PEOPLE:');
      sheet.getRange('A2').setFontWeight('bold').setFontSize(12).setBackground('#242424').setFontColor('#e8d08f').setHorizontalAlignment('right');
      sheet.getRange('D2').setFormula('=SUMIF(D5:D, "Yes*", E5:E)').setFontWeight('bold').setFontSize(14).setBackground('#242424').setFontColor('#c9a84c').setHorizontalAlignment('center');
      sheet.getRange('E2:F2').merge().setValue('Total Responses:');
      sheet.getRange('E2').setFontWeight('bold').setFontSize(10).setBackground('#242424').setFontColor('#cccccc').setHorizontalAlignment('right');
      sheet.getRange('G2').setFormula('=COUNTA(A5:A)').setFontWeight('bold').setFontSize(11).setBackground('#242424').setFontColor('#ffffff').setHorizontalAlignment('center');

      // Row 3: Empty space
      sheet.getRange('A3:G3').setBackground('#f5f5f5');

      // Row 4: Column Headers
      sheet.getRange('A4:G4').setValues([HEADERS]);
      const headerRange = sheet.getRange('A4:G4');
      headerRange.setFontWeight('bold').setBackground('#1a1a1a').setFontColor('#c9a84c').setHorizontalAlignment('center');

      // Freeze rows 1 to 4 so totals and headers stay visible while scrolling
      sheet.setFrozenRows(4);
      sheet.autoResizeColumns(1, HEADERS.length);
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

    const guestCount = parseInt(data.guests, 10) || 1;

    // 3. Append the new RSVP row
    sheet.appendRow([
      data.fullName   || '',
      data.phone      || '',
      data.email      || '',
      data.attendance || '',
      guestCount,
      data.message    || '',
      data.timestamp  || new Date().toLocaleString('en-GB'),
    ]);

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
      message: 'Jhony & Sandra RSVP sheet is active ✓',
    }))
    .setMimeType(ContentService.MimeType.JSON);
}
