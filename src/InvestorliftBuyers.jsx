import { useState, useRef } from "react";

const IL_API_KEY = "Op4whs*dDMi7+lkE@VP4_c2_WPb6-CYXBN--rPSf6yz+O%ln%H";
const IL_BASE    = "https://api.investorlift.com/v1";

// Expected CSV columns (case-insensitive): first_name, last_name, email, phone, company, state, city, zip, max_price, property_types, notes
const FIELD_MAP = {
  first_name:      ["first_name","first","firstname","fname"],
  last_name:       ["last_name","last","lastname","lname"],
  email:           ["email","email_address","e-mail"],
  phone:           ["phone","phone_number","mobile","cell"],
  company:         ["company","company_name","business"],
  city:            ["city"],
  state:           ["state","st"],
  zip:             ["zip","zip_code","postal","postal_code"],
  max_price:       ["max_price","max price","budget","max_budget"],
  property_types:  ["property_types","property type","types","type"],
  notes:           ["notes","note","comments","comment"],
};

function detectHeader(raw, key) {
  const aliases = FIELD_MAP[key];
  return raw.find(h => aliases.includes(h.toLowerCase().trim().replace(/\s+/g,"_")));
}

function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return { headers: [], rows: [] };
  const headers = lines[0].split(",").map(h => h.trim().replace(/^"|"$/g, ""));
  const rows = lines.slice(1).map(line => {
    const vals = [];
    let cur = "", inQ = false;
    for (const ch of line) {
      if (ch === '"') { inQ = !inQ; continue; }
      if (ch === "," && !inQ) { vals.push(cur.trim()); cur = ""; continue; }
      cur += ch;
    }
    vals.push(cur.trim());
    const obj = {};
    headers.forEach((h, i) => { obj[h] = vals[i] ?? ""; });
    return obj;
  });
  return { headers, rows };
}

function rowToBuyer(row, headers) {
  const get = key => {
    const h = detectHeader(headers, key);
    return h ? (row[h] || "") : "";
  };
  return {
    first_name:     get("first_name"),
    last_name:      get("last_name"),
    email:          get("email"),
    phone:          get("phone"),
    company:        get("company"),
    city:           get("city"),
    state:          get("state"),
    zip:            get("zip"),
    max_price:      get("max_price"),
    property_types: get("property_types"),
    notes:          get("notes"),
  };
}

async function createBuyer(buyer) {
  const body = { ...buyer };
  if (body.max_price) body.max_price = parseFloat(body.max_price.replace(/[^0-9.]/g, "")) || undefined;
  Object.keys(body).forEach(k => { if (!body[k]) delete body[k]; });

  const res = await fetch(`${IL_BASE}/buyers`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${IL_API_KEY}`,
      "X-API-Key": IL_API_KEY,
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { raw: text }; }
  return { ok: res.ok, status: res.status, data: json };
}

const S = { background:"#fff", border:"1px solid #e5e5e3", borderRadius:12, padding:"14px 16px" };
const T = { fontSize:11, fontWeight:500, color:"#888", textTransform:"uppercase", letterSpacing:".05em", marginBottom:12 };

export default function InvestorliftBuyers() {
  const [headers, setHeaders]   = useState([]);
  const [rows, setRows]         = useState([]);
  const [results, setResults]   = useState([]);   // {name, ok, status, msg}
  const [running, setRunning]   = useState(false);
  const [done, setDone]         = useState(false);
  const [fileName, setFileName] = useState("");
  const fileRef = useRef();

  function handleFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    setFileName(file.name);
    setResults([]);
    setDone(false);
    const reader = new FileReader();
    reader.onload = ev => {
      const { headers: h, rows: r } = parseCSV(ev.target.result);
      setHeaders(h);
      setRows(r);
    };
    reader.readAsText(file);
  }

  async function runImport() {
    if (!rows.length || running) return;
    setRunning(true);
    setDone(false);
    setResults([]);
    const out = [];
    for (const row of rows) {
      const buyer = rowToBuyer(row, headers);
      const name  = [buyer.first_name, buyer.last_name].filter(Boolean).join(" ") || buyer.email || "(unknown)";
      try {
        const res = await createBuyer(buyer);
        out.push({ name, ok: res.ok, status: res.status, msg: res.ok ? "Created" : (res.data?.message || res.data?.error || JSON.stringify(res.data)) });
      } catch (err) {
        out.push({ name, ok: false, status: "ERR", msg: err.message });
      }
      setResults([...out]);
      await new Promise(r => setTimeout(r, 200)); // rate-limit
    }
    setRunning(false);
    setDone(true);
  }

  const success = results.filter(r => r.ok).length;
  const failed  = results.filter(r => !r.ok).length;

  const detectedFields = Object.keys(FIELD_MAP).filter(k => detectHeader(headers, k));
  const missingFields  = ["first_name","last_name","email"].filter(k => !detectHeader(headers, k));

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
      {/* Upload */}
      <div style={S}>
        <div style={T}>1. Upload your spreadsheet (CSV)</div>
        <p style={{ fontSize:13, color:"#555", marginBottom:12, lineHeight:1.6 }}>
          Export your buyer list as a <strong>CSV</strong> file. Expected columns (names are flexible):<br/>
          <code style={{ fontSize:12, background:"#f5f5f3", padding:"2px 6px", borderRadius:4 }}>
            first_name, last_name, email, phone, company, city, state, zip, max_price, property_types, notes
          </code>
        </p>
        <input ref={fileRef} type="file" accept=".csv,.txt" onChange={handleFile} style={{ display:"none" }}/>
        <button onClick={() => fileRef.current.click()} style={{ fontSize:13, padding:"8px 16px", borderRadius:8, border:"1px solid #e5e5e3", background:"#f9f9f7", cursor:"pointer", fontWeight:500 }}>
          {fileName ? `📄 ${fileName}` : "Choose CSV file"}
        </button>
      </div>

      {/* Preview */}
      {rows.length > 0 && (
        <div style={S}>
          <div style={T}>2. Preview — {rows.length} buyers detected</div>

          {missingFields.length > 0 && (
            <div style={{ fontSize:12, color:"#BA7517", background:"#FAEEDA", padding:"8px 12px", borderRadius:8, marginBottom:12 }}>
              ⚠ Could not auto-detect columns: <strong>{missingFields.join(", ")}</strong>. Make sure your CSV headers match the expected names.
            </div>
          )}

          <div style={{ fontSize:12, color:"#555", marginBottom:10 }}>
            Detected fields: {detectedFields.map(f => (
              <span key={f} style={{ display:"inline-block", margin:"2px 3px", padding:"2px 8px", borderRadius:12, background:"#E1F5EE", color:"#0F6E56", fontSize:11 }}>{f}</span>
            ))}
          </div>

          <div style={{ overflowX:"auto" }}>
            <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12 }}>
              <thead>
                <tr>
                  {["Name","Email","Phone","Company","City/State","Max Price"].map(h => (
                    <th key={h} style={{ textAlign:"left", padding:"6px 8px", borderBottom:"1px solid #e5e5e3", color:"#888", fontWeight:500 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 10).map((row, i) => {
                  const b = rowToBuyer(row, headers);
                  return (
                    <tr key={i} style={{ borderBottom:"1px solid #f5f5f3" }}>
                      <td style={{ padding:"6px 8px" }}>{[b.first_name, b.last_name].filter(Boolean).join(" ") || "—"}</td>
                      <td style={{ padding:"6px 8px" }}>{b.email || "—"}</td>
                      <td style={{ padding:"6px 8px" }}>{b.phone || "—"}</td>
                      <td style={{ padding:"6px 8px" }}>{b.company || "—"}</td>
                      <td style={{ padding:"6px 8px" }}>{[b.city, b.state].filter(Boolean).join(", ") || "—"}</td>
                      <td style={{ padding:"6px 8px" }}>{b.max_price || "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {rows.length > 10 && <div style={{ fontSize:12, color:"#aaa", marginTop:6 }}>…and {rows.length - 10} more</div>}
          </div>

          <button
            onClick={runImport}
            disabled={running || missingFields.length > 0}
            style={{
              marginTop:16, fontSize:13, padding:"9px 20px", borderRadius:8,
              border:"none", cursor: running || missingFields.length > 0 ? "not-allowed" : "pointer",
              background: running ? "#e5e5e3" : "#1D9E75", color:"#fff", fontWeight:600
            }}
          >
            {running ? `Importing… (${results.length}/${rows.length})` : `Create ${rows.length} Buyers in Investorlift`}
          </button>
        </div>
      )}

      {/* Results */}
      {results.length > 0 && (
        <div style={S}>
          <div style={T}>3. Results</div>
          {done && (
            <div style={{ fontSize:13, marginBottom:12, padding:"8px 12px", borderRadius:8, background: failed === 0 ? "#E1F5EE" : "#FCEBEB", color: failed === 0 ? "#0F6E56" : "#791F1F" }}>
              {failed === 0 ? `✓ All ${success} buyers created successfully!` : `${success} created · ${failed} failed`}
            </div>
          )}
          <div style={{ maxHeight:320, overflowY:"auto" }}>
            {results.map((r, i) => (
              <div key={i} style={{ display:"flex", alignItems:"center", gap:8, padding:"5px 0", borderBottom:"1px solid #f5f5f3", fontSize:12 }}>
                <span style={{ width:16, textAlign:"center" }}>{r.ok ? "✓" : "✗"}</span>
                <span style={{ flex:1, color:"#1a1a1a" }}>{r.name}</span>
                <span style={{ color: r.ok ? "#1D9E75" : "#E24B4A", fontSize:11 }}>{r.ok ? "Created" : `${r.status}: ${r.msg}`}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
