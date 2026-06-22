export type TemplateType = 'residential' | 'commercial';

export function getDefaultTemplate(type: TemplateType): { content_en: string; content_hi: string } {
  return type === 'residential' ? RESIDENTIAL : COMMERCIAL;
}

const RESIDENTIAL = {
  content_en: `RESIDENTIAL LEASE AGREEMENT

This Rental Agreement is made and executed on {{lease_start}} between:

LANDLORD: {{landlord_name}}
TENANT: {{tenant_name}}

PROPERTY:
The Landlord agrees to let out the residential premises at {{unit_address}}.

LEASE PERIOD: {{lease_start}} to {{lease_end}}

RENT:
Monthly rent: ₹{{monthly_rent}}, payable on or before the {{rent_due_day}}th of each month.

SECURITY DEPOSIT:
Refundable security deposit of ₹{{security_deposit}}.

ELECTRICITY:
Sanctioned load: {{sanctioned_load_kw}} kW. Electricity charges billed monthly based on actual meter readings.

TERMS AND CONDITIONS:
1. The Tenant shall use the premises for residential purposes only.
2. The Tenant shall not sublet the premises without prior written consent of the Landlord.
3. The Tenant shall maintain the premises in good condition and return it in the same condition at the end of the tenancy.
4. One month's notice shall be given by either party before vacating or terminating the tenancy.
5. The Tenant shall be responsible for any damage beyond normal wear and tear.
6. The security deposit shall be refunded within 30 days of vacating after deducting any dues.
7. The Tenant shall not carry out any structural modifications to the premises.
8. The Tenant shall comply with all applicable laws and regulations.

LANDLORD: ___________________    Date: ___________
{{landlord_name}}

TENANT: ___________________     Date: ___________
{{tenant_name}}`,

  content_hi: `आवासीय किराया अनुबंध

यह किराया समझौता {{lease_start}} को निम्नलिखित पक्षों के बीच किया जा रहा है:

मकान मालिक: {{landlord_name}}
किरायेदार: {{tenant_name}}

संपत्ति:
मकान मालिक किरायेदार को {{unit_address}} पर स्थित आवासीय परिसर किराए पर देने के लिए सहमत है।

किराया अवधि: {{lease_start}} से {{lease_end}} तक

किराया:
मासिक किराया ₹{{monthly_rent}}, प्रत्येक माह की {{rent_due_day}} तारीख को या उससे पहले देय।

सुरक्षा जमा:
वापसी योग्य सुरक्षा राशि ₹{{security_deposit}}।

बिजली:
स्वीकृत विद्युत भार {{sanctioned_load_kw}} किलोवाट। बिजली शुल्क मासिक मीटर रीडिंग के आधार पर बिल किया जाएगा।

नियम और शर्तें:
1. किरायेदार परिसर का उपयोग केवल आवासीय उद्देश्यों के लिए करेगा।
2. किरायेदार मकान मालिक की लिखित अनुमति के बिना परिसर को उपकिराए पर नहीं देगा।
3. किरायेदार परिसर को अच्छी स्थिति में रखेगा और अवधि के अंत में उसी स्थिति में वापस करेगा।
4. किरायेदारी समाप्त करने से पहले किसी भी पक्ष द्वारा एक माह का नोटिस दिया जाएगा।
5. सामान्य टूट-फूट से परे किसी भी नुकसान के लिए किरायेदार जिम्मेदार होगा।
6. सुरक्षा जमा, बकाया राशि काटकर, परिसर खाली करने के 30 दिनों के भीतर वापस की जाएगी।
7. किरायेदार परिसर में कोई संरचनात्मक बदलाव नहीं करेगा।
8. किरायेदार सभी लागू कानूनों और नियमों का पालन करेगा।

मकान मालिक के हस्ताक्षर: ___________________    दिनांक: ___________
{{landlord_name}}

किरायेदार के हस्ताक्षर: ___________________     दिनांक: ___________
{{tenant_name}}`,
};

const COMMERCIAL = {
  content_en: `COMMERCIAL LEASE AGREEMENT

This Commercial Rental Agreement is made and executed on {{lease_start}} between:

LANDLORD: {{landlord_name}}
TENANT/LESSEE: {{tenant_name}}

PROPERTY:
The Landlord agrees to let out the commercial premises at {{unit_address}} for business purposes.

LEASE PERIOD: {{lease_start}} to {{lease_end}}

RENT:
Monthly rent: ₹{{monthly_rent}}, payable on or before the {{rent_due_day}}th of each month.
GST shall be applicable as per prevailing government regulations.

SECURITY DEPOSIT:
Refundable security deposit of ₹{{security_deposit}}.

ELECTRICITY:
Sanctioned load: {{sanctioned_load_kw}} kW. Electricity charged monthly at commercial rates based on actual meter readings.

TERMS AND CONDITIONS:
1. The Tenant shall use the premises for lawful commercial/business purposes only.
2. The Tenant shall not sublet or assign the premises without prior written consent of the Landlord.
3. The Tenant shall obtain all required licenses and permits for business operations.
4. The Tenant shall maintain the premises in good condition. Three months' notice shall be given by either party before terminating the tenancy.
5. The Tenant shall be responsible for damage beyond normal wear and tear.
6. The security deposit shall be refunded within 45 days of vacating after deducting any dues.
7. The Tenant shall not carry out any structural modifications without written permission.
8. The Tenant shall comply with all applicable laws, regulations, and municipal requirements.
9. The Tenant shall not conduct any illegal or objectionable activities on the premises.

LANDLORD: ___________________    Date: ___________
{{landlord_name}}

TENANT: ___________________     Date: ___________
{{tenant_name}}`,

  content_hi: `वाणिज्यिक किराया अनुबंध

यह वाणिज्यिक किराया समझौता {{lease_start}} को निम्नलिखित पक्षों के बीच किया जा रहा है:

मकान मालिक: {{landlord_name}}
किरायेदार/पट्टेदार: {{tenant_name}}

संपत्ति:
मकान मालिक किरायेदार को {{unit_address}} पर स्थित वाणिज्यिक परिसर व्यावसायिक उद्देश्यों के लिए किराए पर देने के लिए सहमत है।

किराया अवधि: {{lease_start}} से {{lease_end}} तक

किराया:
मासिक किराया ₹{{monthly_rent}}, प्रत्येक माह की {{rent_due_day}} तारीख को या उससे पहले देय।
लागू सरकारी नियमों के अनुसार GST प्रयोज्य होगा।

सुरक्षा जमा:
वापसी योग्य सुरक्षा राशि ₹{{security_deposit}}।

बिजली:
स्वीकृत विद्युत भार {{sanctioned_load_kw}} किलोवाट। बिजली शुल्क वाणिज्यिक दरों पर मासिक मीटर रीडिंग के आधार पर बिल किया जाएगा।

नियम और शर्तें:
1. किरायेदार परिसर का उपयोग केवल कानूनी वाणिज्यिक/व्यावसायिक उद्देश्यों के लिए करेगा।
2. किरायेदार मकान मालिक की लिखित अनुमति के बिना परिसर को उपकिराए पर या हस्तांतरित नहीं करेगा।
3. किरायेदार व्यावसायिक संचालन के लिए सभी आवश्यक लाइसेंस और परमिट प्राप्त करेगा।
4. किरायेदार परिसर को अच्छी स्थिति में रखेगा। किरायेदारी समाप्त करने से पहले तीन माह का नोटिस दिया जाएगा।
5. सामान्य टूट-फूट से परे किसी भी नुकसान के लिए किरायेदार जिम्मेदार होगा।
6. सुरक्षा जमा, बकाया राशि काटकर, परिसर खाली करने के 45 दिनों के भीतर वापस की जाएगी।
7. किरायेदार मकान मालिक की लिखित अनुमति के बिना कोई संरचनात्मक बदलाव नहीं करेगा।
8. किरायेदार सभी लागू कानूनों, नियमों और नगरपालिका आवश्यकताओं का पालन करेगा।
9. किरायेदार परिसर में कोई अवैध या आपत्तिजनक गतिविधि नहीं करेगा।

मकान मालिक के हस्ताक्षर: ___________________    दिनांक: ___________
{{landlord_name}}

किरायेदार के हस्ताक्षर: ___________________     दिनांक: ___________
{{tenant_name}}`,
};
