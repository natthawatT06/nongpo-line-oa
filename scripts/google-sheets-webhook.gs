const SHEETS = {
  farmer_registrations: [
    'created_at',
    'line_user_id',
    'full_name',
    'phone',
    'province',
    'district',
  ],
  farmer_fields: [
    'created_at',
    'line_user_id',
    'field_name',
    'crop',
    'area_rai',
    'latitude',
    'longitude',
    'province',
    'district',
    'note',
  ],
  farmer_planting_plans: [
    'created_at',
    'line_user_id',
    'farmer_field_id',
    'field_name',
    'crop',
    'variety',
    'planting_date',
    'method',
    'seed_rate',
    'water_plan',
    'note',
  ],
};

function doPost(event) {
  try {
    const payload = JSON.parse(event.postData.contents || '{}');
    const sheetName = payload.sheet;
    const headers = SHEETS[sheetName];

    if (!headers) {
      return json({ ok: false, message: `Unknown sheet: ${sheetName}` }, 400);
    }

    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = spreadsheet.getSheetByName(sheetName) || spreadsheet.insertSheet(sheetName);
    ensureHeaders(sheet, headers);

    const row = payload.row || {};
    sheet.appendRow(headers.map((header) => {
      if (header === 'created_at') return new Date();
      return row[header] ?? '';
    }));

    return json({ ok: true, sheet: sheetName, rowNumber: sheet.getLastRow() });
  } catch (error) {
    return json({ ok: false, message: error.message }, 500);
  }
}

function ensureHeaders(sheet, headers) {
  const current = sheet.getRange(1, 1, 1, headers.length).getValues()[0];
  const matches = headers.every((header, index) => current[index] === header);

  if (!matches) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
  }
}

function json(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}
