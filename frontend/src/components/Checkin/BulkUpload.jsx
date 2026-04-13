import { useState, useRef } from 'react';
import { Upload, Download, X, FileSpreadsheet, Loader2, CheckCircle, AlertCircle, Users } from 'lucide-react';
import * as XLSX from 'xlsx';

export default function BulkUpload({ onUpload, onClose, partyId, loading }) {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState([]);
  const [errors, setErrors] = useState([]);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef(null);

  // Parse uploaded file (CSV or Excel)
  const handleFile = (f) => {
    if (!f) return;

    const validTypes = [
      'text/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ];
    const ext = f.name.split('.').pop().toLowerCase();

    if (!validTypes.includes(f.type) && !['csv', 'xlsx', 'xls'].includes(ext)) {
      setErrors(['Invalid file type. Please upload a CSV or Excel file (.csv, .xlsx, .xls)']);
      return;
    }

    setFile(f);
    setErrors([]);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json(sheet, { defval: '' });

        if (json.length === 0) {
          setErrors(['File is empty. Please add guest data.']);
          return;
        }

        // Normalize column names (case-insensitive matching)
        const guests = json.map((row, i) => {
          const normalized = {};
          for (const [key, val] of Object.entries(row)) {
            normalized[key.toLowerCase().trim()] = String(val).trim();
          }

          return {
            rowNum: i + 2, // Excel row (1-indexed + header)
            name: normalized['name'] || normalized['guest name'] || normalized['guest_name'] || normalized['fullname'] || normalized['full name'] || '',
            email: normalized['email'] || normalized['gmail'] || normalized['e-mail'] || normalized['mail'] || normalized['email id'] || normalized['emailid'] || '',
            phone: normalized['phone'] || normalized['contact'] || normalized['contact number'] || normalized['contact_number'] || normalized['mobile'] || normalized['phone number'] || normalized['phone_number'] || '',
            plusOnes: parseInt(normalized['plus ones'] || normalized['plus_ones'] || normalized['plusones'] || normalized['guests'] || '0') || 0,
            notes: normalized['notes'] || normalized['remarks'] || normalized['note'] || '',
          };
        });

        // Validate
        const rowErrors = [];
        const validGuests = [];

        guests.forEach((g) => {
          if (!g.name) {
            rowErrors.push(`Row ${g.rowNum}: Name is missing — skipped`);
            return;
          }
          if (g.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(g.email)) {
            rowErrors.push(`Row ${g.rowNum}: "${g.email}" is not a valid email — guest added without email`);
            g.email = '';
          }
          if (g.phone) {
            g.phone = g.phone.replace(/[\s\-\(\)]/g, '');
          }
          validGuests.push(g);
        });

        setPreview(validGuests);
        setErrors(rowErrors);
      } catch (err) {
        console.error('Parse error:', err);
        setErrors(['Failed to parse file. Please check the format.']);
      }
    };
    reader.readAsArrayBuffer(f);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) handleFile(f);
  };

  const handleSubmit = () => {
    if (preview.length === 0) return;
    onUpload(preview.map((g) => ({
      name: g.name,
      email: g.email,
      phone: g.phone,
      plusOnes: g.plusOnes,
      notes: g.notes,
    })));
  };

  const downloadSample = () => {
    const sampleData = [
      { 'Name': 'Rahul Sharma', 'Email': 'rahul@example.com', 'Phone': '9876543210', 'Plus Ones': 2, 'Notes': 'VIP Guest' },
      { 'Name': 'Priya Patel', 'Email': 'priya@example.com', 'Phone': '9123456789', 'Plus Ones': 0, 'Notes': '' },
      { 'Name': 'Anil Kumar', 'Email': 'anil@company.com', 'Phone': '8765432190', 'Plus Ones': 3, 'Notes': 'Vegetarian' },
      { 'Name': 'Sneha Reddy', 'Email': '', 'Phone': '7654321098', 'Plus Ones': 1, 'Notes': 'Late arrival' },
    ];

    const ws = XLSX.utils.json_to_sheet(sampleData);
    // Set column widths
    ws['!cols'] = [{ wch: 20 }, { wch: 25 }, { wch: 15 }, { wch: 10 }, { wch: 20 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Guest List');
    XLSX.writeFile(wb, `AKAN_Guest_Template_${partyId || 'Party'}.xlsx`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-[#af4408]" />
            <div>
              <h3 className="font-bold text-gray-900">Upload Guest List</h3>
              <p className="text-[11px] text-gray-500">CSV or Excel file with Name, Email, Phone</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Download template */}
          <button
            onClick={downloadSample}
            className="flex items-center gap-2 px-4 py-2.5 bg-green-50 text-green-700 rounded-lg text-sm font-medium hover:bg-green-100 transition-colors w-full justify-center"
          >
            <Download className="w-4 h-4" /> Download Sample Template (.xlsx)
          </button>

          {/* Drop zone */}
          {!file ? (
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
                dragOver ? 'border-[#af4408] bg-[#af4408]/5' : 'border-gray-300 hover:border-gray-400'
              }`}
            >
              <Upload className={`w-8 h-8 mx-auto mb-3 ${dragOver ? 'text-[#af4408]' : 'text-gray-400'}`} />
              <p className="text-sm text-gray-600 font-medium">Drop your file here or click to browse</p>
              <p className="text-xs text-gray-400 mt-1">Supports .csv, .xlsx, .xls</p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={(e) => handleFile(e.target.files?.[0])}
                className="hidden"
              />
            </div>
          ) : (
            <div className="flex items-center justify-between bg-gray-50 rounded-lg px-4 py-2.5">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-green-600" />
                <span className="text-sm font-medium text-gray-700">{file.name}</span>
              </div>
              <button
                onClick={() => { setFile(null); setPreview([]); setErrors([]); }}
                className="text-xs text-red-600 hover:text-red-800 font-medium"
              >
                Remove
              </button>
            </div>
          )}

          {/* Errors */}
          {errors.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                <span className="text-xs font-semibold text-amber-700">Warnings</span>
              </div>
              {errors.map((err, i) => (
                <p key={i} className="text-xs text-amber-600 mt-0.5">{err}</p>
              ))}
            </div>
          )}

          {/* Preview */}
          {preview.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-gray-700 flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5" />
                  {preview.length} guests ready to import
                </span>
                <span className="text-[10px] text-gray-400">
                  {preview.filter((g) => g.email).length} with email
                </span>
              </div>
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <div className="max-h-[250px] overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr>
                        <th className="text-left px-3 py-2 font-semibold text-gray-600">#</th>
                        <th className="text-left px-3 py-2 font-semibold text-gray-600">Name</th>
                        <th className="text-left px-3 py-2 font-semibold text-gray-600">Email</th>
                        <th className="text-left px-3 py-2 font-semibold text-gray-600">Phone</th>
                        <th className="text-left px-3 py-2 font-semibold text-gray-600">+</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {preview.map((g, i) => (
                        <tr key={i} className="hover:bg-gray-50">
                          <td className="px-3 py-1.5 text-gray-400">{i + 1}</td>
                          <td className="px-3 py-1.5 font-medium text-gray-900">{g.name}</td>
                          <td className="px-3 py-1.5 text-gray-500">{g.email || <span className="text-gray-300">—</span>}</td>
                          <td className="px-3 py-1.5 text-gray-500">{g.phone || <span className="text-gray-300">—</span>}</td>
                          <td className="px-3 py-1.5 text-gray-500">{g.plusOnes || '0'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t flex items-center gap-2">
          <button
            onClick={handleSubmit}
            disabled={loading || preview.length === 0}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-[#af4408] text-white rounded-lg text-sm font-medium hover:bg-[#8e3706] transition-colors disabled:opacity-50"
          >
            {loading ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Importing...</>
            ) : (
              <><CheckCircle className="w-4 h-4" /> Import {preview.length} Guests</>
            )}
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2.5 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
