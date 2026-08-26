/**
 * ════════════════════════════════════════════════════════════
 *  JHONY & SANDRA — Google Apps Script
 *  Appends each RSVP and shows LIVE TOTAL ATTENDING PEOPLE at top.
 * ════════════════════════════════════════════════════════════
 */

const HEADERS = [
  'Full Name',
  'Phone Number',
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
      sheet.getRange('A1:F1').merge().setValue('JHONY & SANDRA — WEDDING RSVP DASHBOARD');
      sheet.getRange('A1').setFontWeight('bold').setFontSize(14).setBackground('#1a1a1a').setFontColor('#c9a84c').setHorizontalAlignment('center');

      // Row 2: Total Attending & Total Invited Counts
      sheet.getRange('A2:B2').merge().setValue('TOTAL ATTENDING GUESTS:');
      sheet.getRange('A2').setFontWeight('bold').setFontSize(11).setBackground('#242424').setFontColor('#e8d08f').setHorizontalAlignment('right');
      sheet.getRange('C2').setFormula('=SUMIF(C6:C, "Yes*", D6:D)').setFontWeight('bold').setFontSize(13).setBackground('#242424').setFontColor('#c9a84c').setHorizontalAlignment('center');

      sheet.getRange('D2:E2').merge().setValue('TOTAL INVITED PEOPLE:');
      sheet.getRange('D2').setFontWeight('bold').setFontSize(11).setBackground('#242424').setFontColor('#e8d08f').setHorizontalAlignment('right');
      sheet.getRange('F2').setFormula('=SUM(D6:D)').setFontWeight('bold').setFontSize(13).setBackground('#242424').setFontColor('#ffffff').setHorizontalAlignment('center');

      // Row 3: Total Submissions & Declined Counts
      sheet.getRange('A3:B3').merge().setValue('TOTAL RSVP RESPONSES:');
      sheet.getRange('A3').setFontWeight('bold').setFontSize(10).setBackground('#2e2e2e').setFontColor('#cccccc').setHorizontalAlignment('right');
      sheet.getRange('C3').setFormula('=COUNTA(A6:A)').setFontWeight('bold').setFontSize(11).setBackground('#2e2e2e').setFontColor('#ffffff').setHorizontalAlignment('center');

      sheet.getRange('D3:E3').merge().setValue('NOT ATTENDING:');
      sheet.getRange('D3').setFontWeight('bold').setFontSize(10).setBackground('#2e2e2e').setFontColor('#cccccc').setHorizontalAlignment('right');
      sheet.getRange('F3').setFormula('=COUNTIF(C6:C, "No*")').setFontWeight('bold').setFontSize(11).setBackground('#2e2e2e').setFontColor('#d9534f').setHorizontalAlignment('center');

      // Row 4: Empty space
      sheet.getRange('A4:F4').setBackground('#f5f5f5');

      // Row 5: Column Headers
      sheet.getRange('A5:F5').setValues([HEADERS]);
      const headerRange = sheet.getRange('A5:F5');
      headerRange.setFontWeight('bold').setBackground('#1a1a1a').setFontColor('#c9a84c').setHorizontalAlignment('center');

      // Freeze rows 1 to 5 so totals and headers stay visible while scrolling
      sheet.setFrozenRows(5);
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
