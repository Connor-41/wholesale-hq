import { useState, useEffect, useCallback, useMemo } from "react";
import InvestorliftBuyers from "./InvestorliftBuyers";

const CU_TOKEN   = "pk_282840044_WW0I1SITP27QRPETB6MH0JB9MOP9YPI8";
const DISP_ID    = "901612411878";
const ACQ_ID     = "901609332178";

const EC_STAGES  = ["New Contract","Dispositions","JV Process","Assigned","Closed"];
const EC_COLORS  = {
  "New Contract": { dot:"#1D9E75", bg:"#E1F5EE", text:"#0F6E56" },
  "Dispositions": { dot:"#378ADD", bg:"#E6F1FB", text:"#185FA5" },
  "JV Process":   { dot:"#534AB7", bg:"#EEEDFE", text:"#3C3489" },
  "Assigned":     { dot:"#BA7517", bg:"#FAEEDA", text:"#854F0B" },
  "Closed":       { dot:"#3B6D11", bg:"#EAF3DE", text:"#27500A" },
};
const ACQ_PALETTE = [
  { dot:"#1D9E75", bg:"#E1F5EE", text:"#0F6E56" },
  { dot:"#378ADD", bg:"#E6F1FB", text:"#185FA5" },
  { dot:"#534AB7", bg:"#EEEDFE", text:"#3C3489" },
  { dot:"#BA7517", bg:"#FAEEDA", text:"#854F0B" },
  { dot:"#3B6D11", bg:"#EAF3DE", text:"#27500A" },
  { dot:"#993556", bg:"#FBEAF0", text:"#72243E" },
  { dot:"#888780", bg:"#F1EFE8", text:"#444441" },
];
const WS_CAT_META = {
  wholesale_income: { label:"Wholesale income",  color:"#1D9E75", bg:"#E1F5EE", text:"#0F6E56" },
  wholesale_tools:  { label:"Wholesale tools",   color:"#534AB7", bg:"#EEEDFE", text:"#3C3489" },
  overhead:         { label:"Software/overhead", color:"#888780", bg:"#F1EFE8", text:"#444441" },
  wholesale_cost:   { label:"Deal costs",        color:"#E24B4A", bg:"#FCEBEB", text:"#791F1F" },
  fees:             { label:"Bank fees",         color:"#B4B2A9", bg:"#F1EFE8", text:"#5F5E5A" },
};
const OVERRIDES = {
  "02/26/2026|35995":    "wholesale_income",
  "10/03/2025|13500":    "wholesale_income",
  "03/05/2026|35995":    "wholesale_income",
};
const WS_INCOME_KW = ["assignment","massengill","smith road","trassack","marigold","attorney trust","barker","southern shore","thrivesf","jlo invest","mountain assets","usa regrowth","pantheon","artemis","finestead","healing.*palms","family tree","look partners","ouroboros","ifp fund","quail run","axis utility"];
const OVERHEAD_KW  = ["docusign","sqsp","squarespace","land id","google.*workspace","gsuite","google.*gsuite","slack","zoom\\.","loom subscription","loom.com","lucid software","companycam","buildertrend","buildxact","myfico","thecreditconfidential","progressive ins","noble desktop","frontier ai","claude\\.","anthropic","rocket money","openphone","quo.*openphone","mailchimp","zapier","veed","meetup","highlevel","gohighlevel","nc licensing board","monthly service fee","intuit.*qbooks","quickbooks","intuit.*live","indeed","linkedin.*job","land id inc","remitly"];
const WS_TOOLS_KW  = ["mojo dialer","smarter contact","land portal","investorlift","directskip","real side re educati","theericcl","wholesale takeover","top level consulting","all-in advisor","robbins research"];

function match(desc, kws) { const d=desc.toLowerCase(); return kws.some(k=>new RegExp(k).test(d)); }
function categorizeTxn(date, desc, txnType, amount) {
  if(txnType==="ACCT_XFER") return null;
  if(txnType==="FEE_TRANSACTION") return "fees";
  const key=`${date}|${Math.abs(amount)}`;
  if(OVERRIDES[key]) return OVERRIDES[key];
  if(amount>0){
    if(txnType==="WIRE_INCOMING"||txnType==="ACH_CREDIT"){
      if(match(desc,WS_INCOME_KW)) return "wholesale_income";
    }
    return null;
  }
  if(txnType==="WIRE_OUTGOING") return "wholesale_cost";
  if(match(desc,OVERHEAD_KW))   return "overhead";
  if(match(desc,WS_TOOLS_KW))   return "wholesale_tools";
  return null;
}
function tx(date,desc,amt,txnType,acct){ const cat=categorizeTxn(date,desc,txnType,amt); if(!cat) return null; return{date,desc,amt,txnType,acct,cat}; }
function mkTxns(rows,acct){ return rows.map(([d,desc,amt,t])=>tx(d,desc,amt,t,acct)).filter(Boolean); }

const RAW_1395=[
  ["03/20/2026","Lucid Software Inc.",-11.98,"DEBIT_CARD"],["03/17/2026","Slack",-47.63,"DEBIT_CARD"],["03/13/2026","Real Side RE Education",-99.00,"DEBIT_CARD"],["03/12/2026","INTUIT *QBooks Onlin",-115.00,"DEBIT_CARD"],["03/12/2026","Buildertrend",-799.00,"DEBIT_CARD"],["03/09/2026","Land ID Inc",-16.32,"DEBIT_CARD"],["03/06/2026","NC Licensing Board",-107.63,"DEBIT_CARD"],["03/05/2026","Wire: Lowry Law — Assignment (confirmed)",35995.00,"WIRE_INCOMING"],["03/04/2026","SQSP* Squarespace",-14.00,"DEBIT_CARD"],["03/03/2026","DocuSign",-105.62,"DEBIT_CARD"],["03/02/2026","GOOGLE *Workspace_or",-136.80,"DEBIT_CARD"],["03/02/2026","CompanyCam",-99.00,"DEBIT_CARD"],["02/26/2026","Wire: Lowry Law — Assignment (confirmed)",35995.00,"WIRE_INCOMING"],["02/26/2026","Wire fee",-15.00,"FEE_TRANSACTION"],["02/20/2026","Lucid Software Inc.",-11.98,"DEBIT_CARD"],["02/17/2026","Slack",-51.64,"DEBIT_CARD"],["02/13/2026","INTUIT *QBooks Onlin",-115.00,"DEBIT_CARD"],["02/13/2026","Buildertrend",-799.00,"DEBIT_CARD"],["02/13/2026","Overdraft fee",-34.00,"FEE_TRANSACTION"],["02/09/2026","Land ID Inc",-16.32,"DEBIT_CARD"],["02/04/2026","SQSP* Squarespace",-14.00,"DEBIT_CARD"],["02/03/2026","DocuSign",-105.62,"DEBIT_CARD"],["02/02/2026","GOOGLE *Workspace_or",-119.82,"DEBIT_CARD"],["01/30/2026","Monthly service fee",-15.00,"FEE_TRANSACTION"],["01/28/2026","CompanyCam",-99.00,"DEBIT_CARD"],["01/27/2026","Zoom",-17.40,"DEBIT_CARD"],["01/20/2026","Lucid Software Inc.",-11.98,"DEBIT_CARD"],["01/14/2026","Wire fee",-15.00,"FEE_TRANSACTION"],["01/14/2026","Wire: Axis Utility — Assignment proceeds",6067.52,"WIRE_INCOMING"],["01/13/2026","Real Side RE Education",-99.00,"DEBIT_CARD"],["01/13/2026","INTUIT *QBooks Onlin",-115.00,"DEBIT_CARD"],["01/12/2026","Buildertrend",-799.00,"DEBIT_CARD"],["01/07/2026","Land ID Inc",-16.32,"DEBIT_CARD"],["01/07/2026","Loom Subscription",-48.00,"DEBIT_CARD"],["01/05/2026","SQSP* Squarespace",-14.00,"DEBIT_CARD"],["01/05/2026","DocuSign",-105.62,"DEBIT_CARD"],["01/02/2026","GOOGLE *Workspace_or",-123.78,"DEBIT_CARD"],["12/31/2025","Monthly service fee",-15.00,"FEE_TRANSACTION"],["12/29/2025","CompanyCam",-99.00,"DEBIT_CARD"],["12/10/2025","Wire: Barker Law — Assignment 530 Massengill",11500.00,"WIRE_INCOMING"],["12/08/2025","Land ID Inc",-16.32,"DEBIT_CARD"],["12/08/2025","Loom Subscription",-51.69,"DEBIT_CARD"],["12/04/2025","SQSP* Squarespace",-14.00,"DEBIT_CARD"],["12/03/2025","DocuSign",-105.62,"DEBIT_CARD"],["12/01/2025","GOOGLE *Workspace_or",-132.00,"DEBIT_CARD"],["11/28/2025","Monthly service fee",-15.00,"FEE_TRANSACTION"],["11/24/2025","Wire: Axis Utility — Assignment proceeds",9040.00,"WIRE_INCOMING"],["11/12/2025","INTUIT *QBooks Onlin",-115.00,"DEBIT_CARD"],["11/12/2025","Buildertrend",-799.00,"DEBIT_CARD"],["11/07/2025","Land ID Inc",-16.32,"DEBIT_CARD"],["11/06/2025","Loom Subscription",-24.00,"DEBIT_CARD"],["11/03/2025","DocuSign",-105.62,"DEBIT_CARD"],["11/03/2025","GOOGLE *GSUITE_orcut",-126.03,"DEBIT_CARD"],["10/31/2025","Monthly service fee",-15.00,"FEE_TRANSACTION"],["10/31/2025","Wire: Fidelity Bank — Attorney Trust Funds",21298.73,"WIRE_INCOMING"],["10/14/2025","DocuSign",-8.86,"DEBIT_CARD"],["10/14/2025","INTUIT *QBooks Onlin",-115.00,"DEBIT_CARD"],["10/14/2025","Buildertrend",-799.00,"DEBIT_CARD"],["10/07/2025","Land ID Inc",-16.32,"DEBIT_CARD"],["10/06/2025","Loom Subscription",-24.00,"DEBIT_CARD"],["10/03/2025","DocuSign",-92.55,"DEBIT_CARD"],["10/01/2025","GOOGLE *GSUITE_orcut",-105.60,"DEBIT_CARD"],["09/29/2025","Monthly service fee",-15.00,"FEE_TRANSACTION"],["09/03/2025","DocuSign",-70.77,"DEBIT_CARD"],["09/02/2025","GOOGLE *GSUITE_orcut",-105.60,"DEBIT_CARD"],["08/29/2025","Monthly service fee",-15.00,"FEE_TRANSACTION"],["08/07/2025","Land ID Inc",-14.99,"DEBIT_CARD"],["08/06/2025","Loom Subscription",-24.00,"DEBIT_CARD"],["08/04/2025","SQSP* Squarespace",-14.00,"DEBIT_CARD"],["08/04/2025","DocuSign",-70.77,"DEBIT_CARD"],["08/01/2025","GOOGLE *GSUITE_orcut",-95.75,"DEBIT_CARD"],["07/31/2025","Monthly service fee",-15.00,"FEE_TRANSACTION"],["07/07/2025","Land ID Inc",-14.99,"DEBIT_CARD"],["07/07/2025","Loom Subscription",-24.00,"DEBIT_CARD"],["07/03/2025","DocuSign",-70.77,"DEBIT_CARD"],["07/01/2025","GOOGLE *GSUITE_orcut",-43.92,"DEBIT_CARD"],
];
const RAW_8235=[
  ["03/24/2026","The Land Portal",-497.00,"DEBIT_CARD"],["03/23/2026","Mailchimp",-21.78,"DEBIT_CARD"],["03/20/2026","Zapier",-29.99,"DEBIT_CARD"],["03/19/2026","QUO (OpenPhone)",-153.88,"DEBIT_CARD"],["03/18/2026","Wire fee",-15.00,"FEE_TRANSACTION"],["03/18/2026","Wire: Lowry Law — 566 Quail Run (assignment)",2000.00,"WIRE_INCOMING"],["03/12/2026","Wire out — Tobacco Rd EMD Return",-5850.00,"WIRE_OUTGOING"],["03/12/2026","Wire out — Tobacco Rd Down Payment Return",-29555.00,"WIRE_OUTGOING"],["03/12/2026","Wire out — O'Hara Late Fee",-450.00,"WIRE_OUTGOING"],["03/12/2026","All-In Advisors coaching",-899.00,"DEBIT_CARD"],["03/12/2026","Mojo Dialer",-209.00,"DEBIT_CARD"],["03/11/2026","Robbins Research",-39.00,"DEBIT_CARD"],["03/10/2026","Wire: Morgan & Perry Law — 4146 Tobacco Rd (assignment)",41979.69,"WIRE_INCOMING"],["03/06/2026","Wire out — O'Hara EMD Interest",-5100.00,"WIRE_OUTGOING"],["03/06/2026","Wire out — 117 Mars Dr EMD",-3900.00,"WIRE_OUTGOING"],["03/05/2026","Wire: Pantheon Capital Advisors (assignment)",16000.00,"WIRE_INCOMING"],["03/03/2026","Smarter Contact",-1305.41,"DEBIT_CARD"],["03/02/2026","Wire out — Tobacco Rd Fair Oaks",-2098.50,"WIRE_OUTGOING"],["03/02/2026","Anthropic (Claude)",-108.88,"DEBIT_CARD"],["03/02/2026","MyFICO",-39.95,"DEBIT_CARD"],["02/26/2026","Wire: Pantheon Capital Advisors (assignment)",20000.00,"WIRE_INCOMING"],["02/26/2026","Wire: Pantheon Capital Advisors (assignment)",32225.00,"WIRE_INCOMING"],["02/23/2026","Wire: ThriveSF Capital — 273 Deaton (assignment)",4500.00,"WIRE_INCOMING"],["02/23/2026","Wire: Look Partners — 180 Branch Rd (assignment)",4589.00,"WIRE_INCOMING"],["02/23/2026","Top Level Consulting (Eric Cline)",-997.00,"DEBIT_CARD"],["02/20/2026","Zapier",-29.99,"DEBIT_CARD"],["02/19/2026","Anthropic",-44.64,"DEBIT_CARD"],["02/19/2026","The Land Portal",-1500.00,"DEBIT_CARD"],["02/19/2026","QUO (OpenPhone)",-153.88,"DEBIT_CARD"],["02/18/2026","Anthropic",-27.22,"DEBIT_CARD"],["02/18/2026","INTUIT *QBooks Onlin",-87.64,"DEBIT_CARD"],["02/12/2026","Mojo Dialer",-209.00,"DEBIT_CARD"],["02/12/2026","All-In Advisors coaching",-899.00,"DEBIT_CARD"],["02/11/2026","Robbins Research",-39.00,"DEBIT_CARD"],["02/06/2026","Wire: Fidelity Bank — NC Board of Trustees (assignment)",6194.85,"WIRE_INCOMING"],["02/03/2026","Smarter Contact",-990.88,"DEBIT_CARD"],["02/03/2026","GoHighLevel",-10.00,"DEBIT_CARD"],["01/30/2026","Monthly service fee",-8.50,"FEE_TRANSACTION"],["01/30/2026","Wire out — Magnolia Ashland",-5745.83,"WIRE_OUTGOING"],["01/30/2026","Wire out — Good Shepherd & Tobacco",-3316.50,"WIRE_OUTGOING"],["01/30/2026","Wire out — 566 Quail Rd DD",-1000.00,"WIRE_OUTGOING"],["01/30/2026","Wholesale Takeover 2 (Eric Cline)",-997.00,"DEBIT_CARD"],["01/29/2026","Wire: Lowry Law (assignment)",18495.00,"WIRE_INCOMING"],["01/26/2026","The Land Portal",-497.00,"DEBIT_CARD"],["01/26/2026","GoHighLevel",-105.61,"DEBIT_CARD"],["01/23/2026","DirectSkip",-700.00,"DEBIT_CARD"],["01/20/2026","Wire: Scarboro Attorney — O'Hara Drive (assignment)",11354.84,"WIRE_INCOMING"],["01/20/2026","QUO (OpenPhone)",-61.31,"DEBIT_CARD"],["01/12/2026","Mojo Dialer",-209.00,"DEBIT_CARD"],["01/12/2026","All-In Advisors coaching",-899.00,"DEBIT_CARD"],["01/12/2026","DirectSkip",-148.55,"DEBIT_CARD"],["01/07/2026","Wire out — Opal EMD Return",-7750.00,"WIRE_OUTGOING"],["01/06/2026","Wire: ThriveSF — 273 Deaton (assignment)",6103.00,"WIRE_INCOMING"],["01/06/2026","Wire: Look Partners — 180 Branch Rd (assignment)",10595.00,"WIRE_INCOMING"],["01/06/2026","Wire: USA Regrowth — 2585 Cabin Branch (assignment)",12842.00,"WIRE_INCOMING"],["01/06/2026","Wire out — 62 Turf P&L",-2381.00,"WIRE_OUTGOING"],["01/06/2026","Wire out — 117 Mars P&L",-4036.00,"WIRE_OUTGOING"],["01/02/2026","Wire out — Tobacco Jan 1",-2098.50,"WIRE_OUTGOING"],["01/02/2026","MyFICO",-39.95,"DEBIT_CARD"],["12/31/2025","Monthly service fee",-13.20,"FEE_TRANSACTION"],["12/29/2025","Wire out — Pasture Ln EMD Return",-3360.00,"WIRE_OUTGOING"],["12/24/2025","Wire: Summit Bank — Mountain Assets 806 Opal (assignment)",28138.00,"WIRE_INCOMING"],["12/24/2025","The Land Portal",-497.00,"DEBIT_CARD"],["12/15/2025","Wire: Georgia Banking — IFP Fund Trassacks (assignment)",14550.00,"WIRE_INCOMING"],["12/15/2025","Smarter Contact",-869.91,"DEBIT_CARD"],["12/12/2025","All-In Advisors coaching",-899.00,"DEBIT_CARD"],["12/12/2025","Mojo Dialer",-209.00,"DEBIT_CARD"],["12/09/2025","Wire out — Marigold EMD",-5250.00,"WIRE_OUTGOING"],["12/09/2025","Wire out — Cumberland Interest",-2000.00,"WIRE_OUTGOING"],["12/08/2025","Wire: Summit Bank — USA Regrowth 117 Mars (assignment)",2150.00,"WIRE_INCOMING"],["12/08/2025","Wire: Summit Bank — Mountain Assets 806 Opal (assignment)",2477.00,"WIRE_INCOMING"],["12/08/2025","Wire: Summit Bank — JLO 3122 Willowcreek (assignment)",7763.00,"WIRE_INCOMING"],["12/08/2025","Wire: Heritage Bank — ThriveSF 273 Deaton (assignment)",9676.00,"WIRE_INCOMING"],["12/08/2025","Wire: Summit Bank — JLO 735 Harris Mill (assignment)",14326.00,"WIRE_INCOMING"],["12/02/2025","Wire out — Tobacco Dec 1",-2098.50,"WIRE_OUTGOING"],["11/21/2025","Wire: Ouroboros — 3225 Marigold (assignment)",25768.00,"WIRE_INCOMING"],["11/21/2025","Wire out — 1120 Pasture EMD",-5000.00,"WIRE_OUTGOING"],["11/20/2025","Wire: Summit Bank — USA Regrowth Cabin (assignment)",1882.00,"WIRE_INCOMING"],["11/20/2025","Wire: Heritage Bank — ThriveSF (assignment)",2815.00,"WIRE_INCOMING"],["11/20/2025","Wire: Summit Bank — JLO Harris Mill & Plaza (assignment)",13575.00,"WIRE_INCOMING"],["11/20/2025","Wire: Summit Bank — Mountain Assets 806 Opal (assignment)",18300.00,"WIRE_INCOMING"],["11/14/2025","Smarter Contact",-869.91,"DEBIT_CARD"],["11/12/2025","All-In Advisors coaching",-899.00,"DEBIT_CARD"],["11/12/2025","Mojo Dialer",-209.00,"DEBIT_CARD"],["11/10/2025","Wire: Georgia Banking — IFP Fund Trassacks (assignment)",22460.00,"WIRE_INCOMING"],["11/06/2025","Wire out — Good Shepherd Trail deposit",-5000.00,"WIRE_OUTGOING"],["11/03/2025","Wire out — Tobacco Nov 1",-2098.50,"WIRE_OUTGOING"],["11/03/2025","Wire out — 10015 Smith Rd",-5600.00,"WIRE_OUTGOING"],["10/31/2025","Wire: Barker Law — Assignment Fee 10015 Smith Road",31400.00,"WIRE_INCOMING"],["10/30/2025","Wire: Summit Bank — JLO 3122 Willowcreek (assignment)",2358.00,"WIRE_INCOMING"],["10/30/2025","Wire: Summit Bank — JLO 735 Harris Mill (assignment)",3914.00,"WIRE_INCOMING"],["10/30/2025","Wire: Summit Bank — Mountain Assets 806 Opal (assignment)",7965.00,"WIRE_INCOMING"],["10/22/2025","Wire: Pantheon Capital Advisors (assignment)",30325.00,"WIRE_INCOMING"],["10/22/2025","Wire out — Canal Promissory Return",-4050.00,"WIRE_OUTGOING"],["10/17/2025","Wire: Lowry Law (assignment)",1000.00,"WIRE_INCOMING"],["10/17/2025","Wire: Heritage Bank — ThriveSF (assignment)",3108.00,"WIRE_INCOMING"],["10/17/2025","Wire: Summit Bank — JLO 735 Harris Mill (assignment)",4580.00,"WIRE_INCOMING"],["10/17/2025","Wire: Summit Bank — Mountain Assets (assignment)",7151.00,"WIRE_INCOMING"],["10/14/2025","Smarter Contact",-869.91,"DEBIT_CARD"],["10/14/2025","Mojo Dialer",-23.39,"DEBIT_CARD"],["10/10/2025","Wire: Heritage Bank — ThriveSF (assignment)",1458.00,"WIRE_INCOMING"],["10/10/2025","Wire: Summit Bank — Mountain Assets (assignment)",8018.00,"WIRE_INCOMING"],["10/10/2025","Wire: Summit Bank — JLO 735 Harris Mill (assignment)",10083.00,"WIRE_INCOMING"],["10/09/2025","Wire: Pantheon Capital Advisors (assignment)",16875.00,"WIRE_INCOMING"],["10/03/2025","Wire: Heritage Bank — ThriveSF (assignment)",3280.00,"WIRE_INCOMING"],["10/03/2025","Wire: Lowry Law — Assignment (confirmed)",13500.00,"WIRE_INCOMING"],["10/02/2025","Wire out — Tobacco Oct 1",-2098.50,"WIRE_OUTGOING"],["10/01/2025","Wire: Axis Utility — Trassacks (assignment)",20000.00,"WIRE_INCOMING"],["10/01/2025","Wire out — Trassacks Closing",-71182.51,"WIRE_OUTGOING"],["09/26/2025","Wire: Summit Bank — Mountain Assets (assignment)",3932.00,"WIRE_INCOMING"],["09/26/2025","Wire: Heritage Bank — ThriveSF (assignment)",5492.00,"WIRE_INCOMING"],["09/24/2025","Mojo Dialer",-14.17,"DEBIT_CARD"],["09/19/2025","Wire: Summit Bank — JLO 3122 Willowcreek (assignment)",250.00,"WIRE_INCOMING"],["09/19/2025","Wire: Summit Bank — USA Regrowth 117 Mars (assignment)",948.00,"WIRE_INCOMING"],["09/19/2025","Wire: Summit Bank — JLO 735 Harris Mill (assignment)",3842.00,"WIRE_INCOMING"],["09/19/2025","Wire: Pantheon Capital Advisors (assignment)",4950.00,"WIRE_INCOMING"],["09/19/2025","Wire: Heritage Bank — ThriveSF (assignment)",9605.00,"WIRE_INCOMING"],["09/16/2025","Wire: Summit Bank — Mountain Assets (assignment)",450.00,"WIRE_INCOMING"],["09/16/2025","Wire: Summit Bank — USA Regrowth (assignment)",1185.00,"WIRE_INCOMING"],["09/16/2025","Wire: Summit Bank — JLO 206 Plaza (assignment)",2100.00,"WIRE_INCOMING"],["09/12/2025","Wire out — Dustin — 24 Hour Closing",-1532.25,"WIRE_OUTGOING"],["09/08/2025","Wire: Heritage Bank — ThriveSF (assignment)",834.00,"WIRE_INCOMING"],["09/05/2025","Wire: Summit Bank — USA Regrowth 117 Mars (assignment)",120.00,"WIRE_INCOMING"],["09/05/2025","Wire: Summit Bank — Mountain Assets (assignment)",450.00,"WIRE_INCOMING"],["09/05/2025","Wire: Summit Bank — JLO 3122 Willow Creek (assignment)",2200.00,"WIRE_INCOMING"],["09/03/2025","Wire out — O'Hara Downpayment",-725.56,"WIRE_OUTGOING"],["08/29/2025","Wire: Heritage Bank — ThriveSF (assignment)",900.00,"WIRE_INCOMING"],["08/29/2025","Wire: Summit Bank — Mountain Assets (assignment)",3222.00,"WIRE_INCOMING"],["08/29/2025","Wire: Summit Bank — USA Regrowth (assignment)",6878.00,"WIRE_INCOMING"],["08/29/2025","Wire: Summit Bank — JLO Harris Mill (assignment)",14808.00,"WIRE_INCOMING"],["08/22/2025","Wire: Summit Bank — USA Regrowth (assignment)",3703.00,"WIRE_INCOMING"],["08/22/2025","Wire: Heritage Bank — ThriveSF (assignment)",12725.00,"WIRE_INCOMING"],["08/22/2025","Wire: Summit Bank — JLO Willow Creek (assignment)",23415.00,"WIRE_INCOMING"],["08/19/2025","Wire out — Ed Thomas Closing",-18064.32,"WIRE_OUTGOING"],["08/19/2025","Wire out — Cruz Home Painting",-17360.00,"WIRE_OUTGOING"],["08/13/2025","Wire out — Tobacco Rd Closing",-6213.20,"WIRE_OUTGOING"],["08/08/2025","Wire: Summit Bank — JLO (assignment)",513.00,"WIRE_INCOMING"],["08/08/2025","Wire: Summit Bank — USA Regrowth (assignment)",9531.00,"WIRE_INCOMING"],["08/06/2025","Wire: Pantheon Capital Advisors (assignment)",23825.00,"WIRE_INCOMING"],["08/04/2025","Wire: Heritage Bank — ThriveSF (assignment)",311.00,"WIRE_INCOMING"],["08/04/2025","Wire: Summit Bank — JLO Willow Creek (assignment)",8574.00,"WIRE_INCOMING"],["08/04/2025","Wire: Summit Bank — JLO Willow Creek (assignment)",8974.00,"WIRE_INCOMING"],["08/01/2025","Wire out — Aug 1 Magnolia Interest",-3894.37,"WIRE_OUTGOING"],["07/29/2025","Wire: Heritage Bank — ThriveSF (assignment)",1450.00,"WIRE_INCOMING"],["07/29/2025","Wire: Summit Bank — JLO (assignment)",3940.00,"WIRE_INCOMING"],["07/29/2025","Wire: Summit Bank — USA Regrowth (assignment)",11710.00,"WIRE_INCOMING"],["07/25/2025","Wire out — Wire Rd Loan Payback",-26021.05,"WIRE_OUTGOING"],["07/14/2025","Wire: Heritage Bank — Artemis3 (assignment)",22500.00,"WIRE_INCOMING"],["07/11/2025","Wire: Summit Bank — JLO (assignment)",6986.00,"WIRE_INCOMING"],["07/11/2025","Wire: Summit Bank — JLO 3122 Willow Creek (assignment)",12200.00,"WIRE_INCOMING"],["07/11/2025","Wire: Summit Bank — JLO 206 Plaza (assignment)",14174.00,"WIRE_INCOMING"],["07/10/2025","Wire out — 704 E Ashland Cash to Close",-32776.58,"WIRE_OUTGOING"],["07/09/2025","Wire: Pantheon Capital Advisors (assignment)",34500.00,"WIRE_INCOMING"],["07/03/2025","Wire: Summit Bank — USA Regrowth (assignment)",8036.00,"WIRE_INCOMING"],
];

const TXNS_1395=mkTxns(RAW_1395,"Fort Rose (...1395)");
const TXNS_8235=mkTxns(RAW_8235,"Orcutt Const. (...8235)");
const ALL_TXNS=[...TXNS_1395,...TXNS_8235].sort((a,b)=>new Date(b.date)-new Date(a.date));

function buildAcqColorMap(s){const m={};s.forEach((v,i)=>{m[v.toLowerCase().trim()]=ACQ_PALETTE[i%ACQ_PALETTE.length];});return m;}
function getECColor(s){const k=Object.keys(EC_COLORS).find(k=>k.toLowerCase()===(s||"").toLowerCase().trim());return k?EC_COLORS[k]:{dot:"#888780",bg:"#F1EFE8",text:"#444441"};}
async function cuFetch(path){const r=await fetch(`https://api.clickup.com/api/v2${path}`,{headers:{Authorization:CU_TOKEN}});return r.json();}
async function getAllTasks(listId){let page=0,all=[];while(true){const d=await cuFetch(`/list/${listId}/task?limit=100&page=${page}&include_closed=true`);if(!d.tasks?.length)break;all=[...all,...d.tasks];if(d.tasks.length<100)break;page++;}return all;}
function fmt(n){return(n<0?"-":"")+"$"+Math.abs(n).toLocaleString("en-US",{maximumFractionDigits:0});}

function ECPill({status}){const c=getECColor(status);return<span style={{fontSize:10,padding:"2px 8px",borderRadius:20,fontWeight:500,background:c.bg,color:c.text,whiteSpace:"nowrap"}}>{status||"Unknown"}</span>;}
function AcqPill({label,colorMap}){const c=colorMap?.[(label||"").toLowerCase().trim()]||ACQ_PALETTE[6];return<span style={{fontSize:10,padding:"2px 8px",borderRadius:20,fontWeight:500,background:c.bg,color:c.text,whiteSpace:"nowrap",textTransform:"capitalize"}}>{label}</span>;}
function CatPill({cat}){const m=WS_CAT_META[cat]||WS_CAT_META.overhead;return<span style={{fontSize:10,padding:"2px 8px",borderRadius:20,fontWeight:500,background:m.bg,color:m.text,whiteSpace:"nowrap"}}>{m.label}</span>;}
function MetricCard({label,value,sub,color}){return(<div style={{background:"#f5f5f3",borderRadius:8,padding:"12px 14px"}}><div style={{fontSize:11,color:"#888",textTransform:"uppercase",letterSpacing:".05em",marginBottom:6}}>{label}</div><div style={{fontSize:20,fontWeight:500,color:color||"#1a1a1a",lineHeight:1}}>{value}</div>{sub&&<div style={{fontSize:11,marginTop:4,color:"#888"}}>{sub}</div>}</div>);}

export default function App() {
  const [page,setPage]=useState("overview");
  const [dispTasks,setDispTasks]=useState([]);
  const [acqTasks,setAcqTasks]=useState([]);
  const [acqStatuses,setAcqStatuses]=useState([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState(null);
  const [dealSearch,setDealSearch]=useState("");
  const [aiInput,setAiInput]=useState("");
  const [aiOutput,setAiOutput]=useState("Ask me anything — \"Which stage needs attention?\" or \"What's my wholesale income this month?\"");
  const [aiLoading,setAiLoading]=useState(false);
  const [txnAcct,setTxnAcct]=useState("both");
  const [txnCat,setTxnCat]=useState("all");
  const [txnSearch,setTxnSearch]=useState("");

  const load=useCallback(async()=>{
    setLoading(true);setError(null);
    try{
      const[aList,dTasks,aTasks]=await Promise.all([cuFetch(`/list/${ACQ_ID}`),getAllTasks(DISP_ID),getAllTasks(ACQ_ID)]);
      setAcqStatuses((aList.statuses||[]).map(s=>s.status));
      setDispTasks(dTasks);setAcqTasks(aTasks);
    }catch(e){setError("Could not reach ClickUp.");}
    setLoading(false);
  },[]);

  useEffect(()=>{load();},[load]);

  const acqColorMap=useMemo(()=>buildAcqColorMap(acqStatuses),[acqStatuses]);
  const dispCounts=useMemo(()=>{const c={};EC_STAGES.forEach(s=>c[s]=0);dispTasks.forEach(t=>{const st=(t.status?.status||"").toLowerCase();const m=EC_STAGES.find(s=>st.includes(s.toLowerCase()));if(m)c[m]++;});return c;},[dispTasks]);
  const acqCounts=useMemo(()=>{const c={};acqStatuses.forEach(s=>c[s]=0);acqTasks.forEach(t=>{const s=t.status?.status||"";c[s]=(c[s]||0)+1;});return c;},[acqTasks,acqStatuses]);
  const recentDisp=useMemo(()=>[...dispTasks].sort((a,b)=>b.date_updated-a.date_updated).slice(0,6),[dispTasks]);
  const recentAcq=useMemo(()=>[...acqTasks].sort((a,b)=>b.date_updated-a.date_updated).slice(0,6),[acqTasks]);
  const baseTxns=useMemo(()=>txnAcct==="1395"?TXNS_1395:txnAcct==="8235"?TXNS_8235:ALL_TXNS,[txnAcct]);
  const visibleTxns=useMemo(()=>{let t=baseTxns;if(txnCat!=="all")t=t.filter(x=>x.cat===txnCat);if(txnSearch)t=t.filter(x=>x.desc.toLowerCase().includes(txnSearch.toLowerCase()));return t;},[baseTxns,txnCat,txnSearch]);
  const totals=useMemo(()=>{const t={};Object.keys(WS_CAT_META).forEach(k=>t[k]=0);baseTxns.forEach(x=>{t[x.cat]=(t[x.cat]||0)+x.amt;});return t;},[baseTxns]);
  const wsIncome=totals.wholesale_income||0;
  const wsExpenses=(totals.wholesale_cost||0)+(totals.wholesale_tools||0)+(totals.overhead||0)+(totals.fees||0);
  const wsNet=wsIncome+wsExpenses;
  const filteredDisp=useMemo(()=>dispTasks.filter(t=>t.name?.toLowerCase().includes(dealSearch.toLowerCase())),[dispTasks,dealSearch]);
  const filteredAcq=useMemo(()=>acqTasks.filter(t=>t.name?.toLowerCase().includes(dealSearch.toLowerCase())),[acqTasks,dealSearch]);

  async function askAI(){
    if(!aiInput.trim()||aiLoading)return;
    setAiLoading(true);const q=aiInput;setAiInput("");
    const ctx={dispositions:{total:dispTasks.length,stageCounts:dispCounts},acquisitions:{total:acqTasks.length,stageCounts:acqCounts},financials:{wholesaleIncome:fmt(wsIncome),wholesaleExpenses:fmt(wsExpenses),netWholesale:fmt(wsNet)},recentDispositions:recentDisp.map(t=>({name:t.name,status:t.status?.status}))};
    try{
      const r=await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:1000,system:`You are an AI business assistant for Connor Orcutt (Fort Rose Capital). He runs a wholesale real estate business using Eric Cline's 5-stage pipeline: New Contract → Dispositions → JV Process → Assigned → Closed. Live data: ${JSON.stringify(ctx)}. Be concise (2-4 sentences), specific, and actionable. Today is March 23, 2026.`,messages:[{role:"user",content:q}]})});
      const data=await r.json();
      setAiOutput(data.content?.find(b=>b.type==="text")?.text||"No response.");
    }catch{setAiOutput("Could not reach AI.");}
    setAiLoading(false);
  }

  const S={background:"#fff",border:"1px solid #e5e5e3",borderRadius:12,padding:"14px 16px"};
  const T={fontSize:11,fontWeight:500,color:"#888",textTransform:"uppercase",letterSpacing:".05em",marginBottom:12};
  const DR={display:"flex",alignItems:"center",gap:8,padding:"7px 0",borderBottom:"1px solid #f0f0ee"};
  const NAV=[{id:"overview",label:"Overview"},{id:"dispositions",label:"Dispositions"},{id:"acquisitions",label:"Acquisitions"},{id:"transactions",label:"Transactions"},{id:"buyers",label:"IL Buyers"}];

  return(
    <div style={{display:"grid",gridTemplateColumns:"200px 1fr",minHeight:"100vh",background:"#fff",fontFamily:"-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif"}}>
      <div style={{background:"#f9f9f7",borderRight:"1px solid #e5e5e3",padding:"20px 0",display:"flex",flexDirection:"column",gap:2,position:"sticky",top:0,height:"100vh"}}>
        <div style={{padding:"0 16px 14px",borderBottom:"1px solid #e5e5e3",marginBottom:8}}>
          <div style={{fontSize:16,fontWeight:600,color:"#1a1a1a",lineHeight:1.3}}>WholeSale HQ</div>
          <div style={{fontSize:11,color:"#aaa",letterSpacing:".05em",textTransform:"uppercase",marginTop:3}}>Fort Rose Capital</div>
        </div>
        {NAV.map(n=>(
          <div key={n.id} onClick={()=>{setPage(n.id);setDealSearch("");}} style={{padding:"9px 16px",fontSize:13,cursor:"pointer",color:page===n.id?"#1a1a1a":"#666",fontWeight:page===n.id?500:400,background:page===n.id?"#fff":"transparent",borderLeft:page===n.id?"2px solid #1D9E75":"2px solid transparent"}}>{n.label}</div>
        ))}
        <div style={{flex:1}}/>
        <div onClick={load} style={{padding:"9px 16px",fontSize:12,color:"#1D9E75",cursor:"pointer",fontWeight:500}}>{loading?"Syncing...":"↻ Refresh ClickUp"}</div>
        <div style={{padding:"8px 16px",fontSize:11,color:"#aaa"}}>Connor Orcutt</div>
      </div>

      <div style={{padding:24,display:"flex",flexDirection:"column",gap:16,overflowY:"auto"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div style={{fontSize:22,fontWeight:600,color:"#1a1a1a"}}>{{overview:"Overview",dispositions:"Dispositions",acquisitions:"Acquisitions",transactions:"Transactions",buyers:"Investorlift Buyers"}[page]}</div>
          <div style={{display:"flex",gap:8,alignItems:"center"}}>
            {error&&<span style={{fontSize:12,color:"#E24B4A"}}>{error}</span>}
            <div style={{fontSize:12,color:"#888",background:"#f5f5f3",padding:"5px 10px",borderRadius:8,border:"1px solid #e5e5e3"}}>{loading?"Syncing ClickUp...":`${dispTasks.length+acqTasks.length} deals live`}</div>
          </div>
        </div>

        {page==="overview"&&<>
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10}}>
            <MetricCard label="Acquisitions" value={loading?"—":acqTasks.length} sub="leads in pipeline"/>
            <MetricCard label="Dispositions" value={loading?"—":dispTasks.length} sub="under contract" color="#1D9E75"/>
            <MetricCard label="Wholesale income" value={fmt(wsIncome)} color="#1D9E75" sub="assignment fees"/>
            <MetricCard label="Net wholesale" value={fmt(wsNet)} color={wsNet>=0?"#1D9E75":"#E24B4A"} sub="income minus expenses"/>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
            <div style={S}>
              <div style={T}>Dispositions — Eric Cline stages</div>
              {loading?<div style={{fontSize:13,color:"#888"}}>Loading from ClickUp...</div>:EC_STAGES.map(s=>{const count=dispCounts[s]||0;const pct=dispTasks.length>0?Math.round((count/dispTasks.length)*100):0;const c=EC_COLORS[s];return(<div key={s} style={{marginBottom:10}}><div style={{display:"flex",justifyContent:"space-between",marginBottom:4,fontSize:12}}><span style={{color:"#1a1a1a"}}>{s}</span><span style={{color:"#888"}}>{count} · {pct}%</span></div><div style={{height:5,background:"#f0f0ee",borderRadius:4,overflow:"hidden"}}><div style={{height:"100%",width:`${pct}%`,background:c.dot,borderRadius:4}}/></div></div>);})}
            </div>
            <div style={S}>
              <div style={T}>Acquisitions — lead stages</div>
              {loading?<div style={{fontSize:13,color:"#888"}}>Loading from ClickUp...</div>:acqStatuses.map(s=>{const count=acqCounts[s]||0;const pct=acqTasks.length>0?Math.round((count/acqTasks.length)*100):0;const c=acqColorMap[s.toLowerCase().trim()]||ACQ_PALETTE[6];return(<div key={s} style={{marginBottom:10}}><div style={{display:"flex",justifyContent:"space-between",marginBottom:4,fontSize:12}}><span style={{color:"#1a1a1a"}}>{s}</span><span style={{color:"#888"}}>{count} · {pct}%</span></div><div style={{height:5,background:"#f0f0ee",borderRadius:4,overflow:"hidden"}}><div style={{height:"100%",width:`${pct}%`,background:c.dot,borderRadius:4}}/></div></div>);})}
            </div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
            <div style={S}><div style={T}>Recent dispositions</div>{recentDisp.map(t=>(<div key={t.id} style={DR}><span style={{fontSize:13,color:"#1a1a1a",flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.name}</span><ECPill status={t.status?.status}/></div>))}</div>
            <div style={S}><div style={T}>Recent acquisitions</div>{recentAcq.map(t=>(<div key={t.id} style={DR}><span style={{fontSize:13,color:"#1a1a1a",flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.name}</span><AcqPill label={t.status?.status} colorMap={acqColorMap}/></div>))}</div>
          </div>
          <div style={{background:"#f9f9f7",border:"1px solid #e5e5e3",borderRadius:12,padding:"14px 16px"}}>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
              <div style={{width:8,height:8,borderRadius:"50%",background:aiLoading?"#BA7517":"#1D9E75"}}/>
              <div style={{fontSize:11,fontWeight:500,color:"#888",textTransform:"uppercase",letterSpacing:".05em"}}>AI business assistant</div>
            </div>
            <div style={{fontSize:13,color:"#1a1a1a",lineHeight:1.65,minHeight:48,marginBottom:10}}>{aiLoading?"Thinking...":aiOutput}</div>
            <div style={{display:"flex",gap:8}}>
              <input value={aiInput} onChange={e=>setAiInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&askAI()} placeholder="Ask about your pipeline or deals..." style={{flex:1,fontSize:13,padding:"7px 10px",borderRadius:8,border:"1px solid #e5e5e3",background:"#fff",color:"#1a1a1a",outline:"none"}}/>
              <button onClick={askAI} style={{fontSize:13,padding:"7px 14px",borderRadius:8,border:"1px solid #e5e5e3",background:"#fff",color:"#1a1a1a",cursor:"pointer",fontWeight:500}}>Ask ↗</button>
            </div>
          </div>
        </>}

        {page==="dispositions"&&<>
          <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:10}}>
            {EC_STAGES.map(s=><MetricCard key={s} label={s} value={dispCounts[s]||0} sub="deals" color={EC_COLORS[s].dot}/>)}
          </div>
          <input value={dealSearch} onChange={e=>setDealSearch(e.target.value)} placeholder="Search deals..." style={{fontSize:13,padding:"8px 12px",borderRadius:8,border:"1px solid #e5e5e3",background:"#f9f9f7",color:"#1a1a1a",outline:"none"}}/>
          <div style={S}><div style={T}>All dispositions ({filteredDisp.length})</div>
            {loading?<div style={{fontSize:13,color:"#888"}}>Loading from ClickUp...</div>:filteredDisp.map(t=>(<div key={t.id} style={{...DR,flexWrap:"wrap"}}><span style={{fontSize:13,color:"#1a1a1a",flex:1,minWidth:120,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.name}</span><ECPill status={t.status?.status}/><span style={{fontSize:11,color:"#aaa",marginLeft:"auto"}}>{t.date_updated?new Date(parseInt(t.date_updated)).toLocaleDateString():""}</span></div>))}
          </div>
        </>}

        {page==="acquisitions"&&<>
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10}}>
            {acqStatuses.map(s=><MetricCard key={s} label={s} value={acqCounts[s]||0} sub="leads"/>)}
          </div>
          <input value={dealSearch} onChange={e=>setDealSearch(e.target.value)} placeholder="Search leads..." style={{fontSize:13,padding:"8px 12px",borderRadius:8,border:"1px solid #e5e5e3",background:"#f9f9f7",color:"#1a1a1a",outline:"none"}}/>
          <div style={S}><div style={T}>All acquisitions ({filteredAcq.length})</div>
            {loading?<div style={{fontSize:13,color:"#888"}}>Loading from ClickUp...</div>:filteredAcq.map(t=>(<div key={t.id} style={{...DR,flexWrap:"wrap"}}><span style={{fontSize:13,color:"#1a1a1a",flex:1,minWidth:120,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.name}</span><AcqPill label={t.status?.status} colorMap={acqColorMap}/><span style={{fontSize:11,color:"#aaa",marginLeft:"auto"}}>{t.date_updated?new Date(parseInt(t.date_updated)).toLocaleDateString():""}</span></div>))}
          </div>
        </>}

        {page==="buyers"&&<InvestorliftBuyers/>}

        {page==="transactions"&&<>
          <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
            {[["both","Both accounts"],["1395","Fort Rose (...1395)"],["8235","Orcutt Const. (...8235)"]].map(([v,l])=>(
              <button key={v} onClick={()=>setTxnAcct(v)} style={{fontSize:12,padding:"5px 12px",borderRadius:8,cursor:"pointer",border:"1px solid #e5e5e3",background:txnAcct===v?"#f0f0ee":"#fff",color:"#1a1a1a",fontWeight:txnAcct===v?500:400}}>{l}</button>
            ))}
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10}}>
            <MetricCard label="Wholesale income" value={fmt(wsIncome)} color="#1D9E75" sub="assignment fees"/>
            <MetricCard label="Wholesale expenses" value={fmt(wsExpenses)} color="#E24B4A" sub="tools, software, deal costs"/>
            <MetricCard label="Net wholesale" value={fmt(wsNet)} color={wsNet>=0?"#1D9E75":"#E24B4A"} sub="income minus expenses"/>
          </div>
          <div style={S}><div style={T}>Filter by category</div>
            <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
              <button onClick={()=>setTxnCat("all")} style={{fontSize:11,padding:"4px 10px",borderRadius:20,cursor:"pointer",border:"1px solid #e5e5e3",background:txnCat==="all"?"#f0f0ee":"transparent",color:"#666",fontWeight:txnCat==="all"?500:400}}>All</button>
              {Object.entries(WS_CAT_META).filter(([k])=>(totals[k]||0)!==0).map(([k,m])=>(
                <button key={k} onClick={()=>setTxnCat(k===txnCat?"all":k)} style={{fontSize:11,padding:"4px 10px",borderRadius:20,cursor:"pointer",border:"1px solid #e5e5e3",background:txnCat===k?m.bg:"transparent",color:txnCat===k?m.text:"#666",fontWeight:txnCat===k?500:400}}>{m.label} {fmt(totals[k]||0)}</button>
              ))}
            </div>
          </div>
          <div style={{display:"flex",gap:8,alignItems:"center"}}>
            <input value={txnSearch} onChange={e=>setTxnSearch(e.target.value)} placeholder="Search transactions..." style={{flex:1,fontSize:13,padding:"7px 10px",borderRadius:8,border:"1px solid #e5e5e3",background:"#f9f9f7",color:"#1a1a1a",outline:"none"}}/>
            <span style={{fontSize:12,color:"#aaa"}}>{visibleTxns.length} transactions</span>
          </div>
          <div style={S}><div style={T}>Wholesale transactions</div>
            {visibleTxns.map((t,i)=>(<div key={i} style={{display:"flex",alignItems:"center",gap:8,padding:"7px 0",borderBottom:"1px solid #f0f0ee",flexWrap:"wrap"}}>
              <div style={{flex:1,minWidth:140}}>
                <div style={{fontSize:13,color:"#1a1a1a",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",maxWidth:320}}>{t.desc}</div>
                <div style={{fontSize:11,color:"#aaa",marginTop:1}}>{t.date} · {t.acct}</div>
              </div>
              <CatPill cat={t.cat}/>
              <div style={{fontSize:13,fontWeight:500,color:t.amt>=0?"#1D9E75":"#E24B4A",minWidth:80,textAlign:"right"}}>{t.amt>=0?"+":""}{fmt(t.amt)}</div>
            </div>))}
          </div>
        </>}
      </div>
    </div>
  );
}
