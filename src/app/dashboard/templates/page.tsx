'use client';

import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { Topbar } from '@/components/layout/Topbar';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { EmptyState } from '@/components/ui/EmptyState';
import { Modal } from '@/components/ui/Modal';
import { BookTemplate, Plus, Eye, CheckCircle, Wand2 } from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

// ── Starter template ───────────────────────────────────────────────────────

const STARTER_EN = `LEASE / RENT AGREEMENT

This Lease Agreement ("Agreement") is entered into on {{lease_start}} between:

LANDLORD: {{landlord_name}}
TENANT:   {{tenant_name}}
PREMISES: {{unit_address}}

1. TERM
This Agreement shall commence on {{lease_start}} and shall expire on {{lease_end}}, after which it may be renewed by mutual written consent.

2. RENT
The monthly rent is Rs.{{monthly_rent}}, payable on or before the {{rent_due_day}}th day of each month. Late payment beyond 7 days from the due date will attract a late fee of Rs.500 per week.

3. SECURITY DEPOSIT
The Tenant has paid a refundable security deposit of Rs.{{security_deposit}} at the time of signing. This deposit shall be refunded within 30 days of vacating the premises, subject to deductions for unpaid dues and damages beyond normal wear and tear.

4. ELECTRICITY
The sanctioned electrical load for the premises is {{sanctioned_load_kw}} kW. Electricity charges (fixed connection charge + units consumed) are billed monthly. The Tenant shall not draw load beyond the sanctioned limit.

5. WATER
Water charges are metered and billed monthly based on actual consumption. The Tenant shall use water judiciously and report any leakage immediately.

6. USE OF PREMISES
The premises shall be used solely for residential purposes. Sub-letting or assigning the premises to any third party is strictly prohibited without prior written consent of the Landlord.

7. MAINTENANCE
The Tenant shall keep the premises clean and in good condition. Minor repairs up to Rs.500 per incident are the Tenant's responsibility. Major structural repairs are the Landlord's responsibility.

8. ALTERATIONS
No structural alterations or modifications shall be made to the premises without prior written consent of the Landlord.

9. NOTICE PERIOD
Either party may terminate this Agreement before its expiry by giving 30 days' written notice.

10. VACATION AND HANDOVER
On termination or expiry, the Tenant shall return all keys and leave the premises in the same condition as received (fair wear and tear excepted).

11. GENERAL CONDITIONS
- The Tenant shall not carry out any illegal activity on the premises.
- The Landlord may inspect the premises with 24 hours' notice.
- The Tenant shall maintain peaceful relations with neighbours and not cause nuisance.
- Pets are permitted only with prior written consent of the Landlord.
- The Tenant shall comply with all rules of the housing society, if applicable.

Signed in agreement by both parties:

Landlord: {{landlord_name}}          Tenant: {{tenant_name}}
Date:     {{lease_start}}`;

const STARTER_HI = `किराया अनुबंध

यह किराया अनुबंध {{lease_start}} को निम्नलिखित पक्षों के बीच किया जाता है:

मकान मालिक: {{landlord_name}}
किरायेदार:  {{tenant_name}}
परिसर:      {{unit_address}}

1. अवधि
यह अनुबंध {{lease_start}} से प्रारम्भ होकर {{lease_end}} तक मान्य है। समाप्ति के बाद दोनों पक्षों की लिखित सहमति से नवीनीकरण हो सकता है।

2. किराया
मासिक किराया ₹{{monthly_rent}} है, जो प्रत्येक माह की {{rent_due_day}} तारीख तक देय है। 7 दिनों की देरी पर प्रति सप्ताह ₹500 विलंब शुल्क लागू होगा।

3. सुरक्षा जमा
किरायेदार ने ₹{{security_deposit}} की वापसी योग्य सुरक्षा राशि जमा की है। परिसर खाली करने के 30 दिनों के भीतर, बकाया राशि और क्षति की कटौती के बाद, यह राशि वापस की जाएगी।

4. बिजली
स्वीकृत बिजली भार {{sanctioned_load_kw}} kW है। बिजली शुल्क मासिक बिल में शामिल होगा। किरायेदार स्वीकृत सीमा से अधिक बिजली नहीं खींचेगा।

5. पानी
पानी का शुल्क मीटर रीडिंग के आधार पर मासिक बिल में लगाया जाएगा।

6. उपयोग
परिसर केवल आवासीय उपयोग के लिए है। मकान मालिक की लिखित अनुमति के बिना उप-किराया देना वर्जित है।

7. रखरखाव
किरायेदार परिसर को साफ और उचित अवस्था में रखेगा। ₹500 तक की छोटी मरम्मत किरायेदार की जिम्मेदारी है।

8. परिवर्तन
मकान मालिक की लिखित सहमति के बिना कोई संरचनात्मक परिवर्तन नहीं होगा।

9. नोटिस अवधि
30 दिनों की लिखित सूचना देकर अनुबंध समाप्त किया जा सकता है।

10. सामान्य शर्तें
- परिसर में कोई अवैध गतिविधि नहीं होगी।
- मकान मालिक 24 घंटे की सूचना के साथ निरीक्षण कर सकता है।
- पड़ोसियों के साथ शांतिपूर्ण संबंध बनाए रखें।

मकान मालिक: {{landlord_name}}       किरायेदार: {{tenant_name}}
दिनांक:     {{lease_start}}`;

// ── Page ───────────────────────────────────────────────────────────────────

export default function TemplatesPage() {
  const [selectedProperty, setSelectedProperty] = useState('');
  const [showEditor, setShowEditor] = useState(false);
  const [contentEn, setContentEn] = useState('');
  const [contentHi, setContentHi] = useState('');
  const [previewTemplateId, setPreviewTemplateId] = useState('');
  const [previewLeaseId, setPreviewLeaseId] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [generateType, setGenerateType] = useState<'residential' | 'commercial'>('residential');

  const { data: properties } = trpc.properties.list.useQuery();
  const { data: templates, refetch } = trpc.templates.list.useQuery(
    { property_id: selectedProperty },
    { enabled: !!selectedProperty }
  );
  const { data: leases } = trpc.leases.list.useQuery(
    { property_id: selectedProperty, status: 'active' },
    { enabled: !!selectedProperty }
  );
  const { data: preview } = trpc.templates.fillPlaceholders.useQuery(
    { template_id: previewTemplateId, lease_id: previewLeaseId },
    { enabled: !!previewTemplateId && !!previewLeaseId }
  );
  const createMut = trpc.templates.create.useMutation();
  const generateDefault = trpc.templates.generateDefault.useMutation({
    onSuccess: () => { toast.success('Default template generated'); setShowGenerateModal(false); refetch(); },
    onError: (err) => toast.error(err.message),
  });

  const propertyOptions = (properties ?? []).map((p) => ({ value: p.id, label: p.name }));
  const leaseOptions = (leases ?? []).map((l) => ({
    value: l.id,
    label: `${l.unit.unit_number} — ${l.tenant.full_name}`,
  }));

  const PLACEHOLDERS = [
    '{{tenant_name}}', '{{landlord_name}}', '{{unit_address}}',
    '{{monthly_rent}}', '{{security_deposit}}', '{{sanctioned_load_kw}}',
    '{{lease_start}}', '{{lease_end}}', '{{rent_due_day}}',
  ];

  function openNewEditor() {
    setContentEn('');
    setContentHi('');
    setShowEditor(true);
  }

  function loadStarter() {
    setContentEn(STARTER_EN);
    setContentHi(STARTER_HI);
  }

  async function handleSave() {
    if (!selectedProperty) return toast.error('Select a property first');
    if (!contentEn.trim()) return toast.error('English content is required');
    try {
      await createMut.mutateAsync({
        property_id: selectedProperty,
        content_en: contentEn,
        content_hi: contentHi || undefined,
      });
      toast.success('Template saved');
      setShowEditor(false);
      refetch();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to save');
    }
  }

  function openPreview(templateId: string) {
    setPreviewTemplateId(templateId);
    setPreviewLeaseId('');
    setShowPreview(true);
  }

  return (
    <div className="flex flex-col flex-1">
      <Topbar
        title="Lease Templates"
        action={
          selectedProperty && !showEditor ? (
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setShowGenerateModal(true)}>
                <Wand2 className="w-4 h-4" />
                Generate Default
              </Button>
              <Button onClick={openNewEditor}>
                <Plus className="w-4 h-4" />
                New Template
              </Button>
            </div>
          ) : undefined
        }
      />

      <main className="flex-1 p-6 max-w-5xl mx-auto w-full">
        <div className="mb-6 max-w-xs">
          <Select
            label="Property"
            value={selectedProperty}
            onValueChange={(v) => { setSelectedProperty(v); setShowEditor(false); }}
            options={propertyOptions}
            placeholder="Select property…"
          />
        </div>

        {!selectedProperty && (
          <EmptyState
            icon={BookTemplate}
            title="Select a property"
            description="Templates are per-property. Select one above to get started."
          />
        )}

        {selectedProperty && !showEditor && templates?.length === 0 && (
          <Card className="text-center py-10">
            <BookTemplate className="w-10 h-10 text-slate mx-auto mb-3" />
            <p className="font-semibold text-navy mb-1">No templates yet</p>
            <p className="text-sm text-slate mb-5">Create a lease agreement template for this property</p>
            <Button onClick={openNewEditor}>
              <Plus className="w-4 h-4" />
              Create Template
            </Button>
          </Card>
        )}

        {!showEditor && templates && templates.length > 0 && (
          <div className="space-y-3">
            {templates.map((t) => (
              <Card key={t.id}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${t.is_active ? 'bg-sage/15' : 'bg-slate-light'}`}>
                      {t.is_active
                        ? <CheckCircle className="w-4 h-4 text-sage" />
                        : <BookTemplate className="w-4 h-4 text-slate" />
                      }
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-navy">Version {t.version}</p>
                        {t.is_active && <span className="text-xs px-2 py-0.5 bg-sage/15 text-sage rounded-full font-medium">Active</span>}
                        <span className="text-xs px-2 py-0.5 bg-slate-light text-slate rounded-full capitalize">{t.template_type}</span>
                      </div>
                      <p className="text-xs text-slate">
                        Created {format(new Date(t.created_at), 'dd MMM yyyy')}
                        {t.content_hi ? ' · Bilingual (EN + HI)' : ' · English only'}
                      </p>
                    </div>
                  </div>
                  <Button variant="secondary" size="sm" onClick={() => openPreview(t.id)}>
                    <Eye className="w-3.5 h-3.5" />
                    Preview
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}

        {showEditor && (
          <Card>
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="font-semibold text-navy">New Template</h2>
                <p className="text-xs text-slate mt-0.5">Use placeholders — they are replaced automatically when a lease is filled</p>
              </div>
              <Button variant="secondary" size="sm" onClick={loadStarter}>
                Load starter template
              </Button>
            </div>

            <div className="mb-4 p-3 bg-bg rounded-lg">
              <p className="text-xs font-semibold text-slate uppercase tracking-wide mb-2">Available placeholders</p>
              <div className="flex flex-wrap gap-1.5">
                {PLACEHOLDERS.map((p) => (
                  <code key={p} className="text-xs px-2 py-0.5 bg-surface border border-border rounded text-navy font-mono">{p}</code>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-navy mb-1.5">
                  Content — English <span className="text-coral">*</span>
                </label>
                <textarea
                  value={contentEn}
                  onChange={(e) => setContentEn(e.target.value)}
                  rows={24}
                  placeholder="Type your lease agreement here, or click 'Load starter template' above…"
                  className="w-full px-3 py-2.5 rounded-lg border border-border text-sm font-mono leading-relaxed focus:outline-none focus:ring-2 focus:ring-saffron/30 focus:border-saffron resize-y"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-navy mb-1.5">
                  Content — Hindi <span className="text-slate font-normal">(optional)</span>
                </label>
                <textarea
                  value={contentHi}
                  onChange={(e) => setContentHi(e.target.value)}
                  rows={14}
                  placeholder="हिन्दी में अनुबंध (वैकल्पिक)…"
                  className="w-full px-3 py-2.5 rounded-lg border border-border text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-saffron/30 focus:border-saffron resize-y"
                  style={{ fontFamily: 'serif' }}
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-5 pt-4 border-t border-border">
              <Button variant="secondary" onClick={() => setShowEditor(false)}>Cancel</Button>
              <Button onClick={handleSave} loading={createMut.isLoading} disabled={!contentEn.trim()}>
                Save Template
              </Button>
            </div>
          </Card>
        )}
      </main>

      {/* Generate default modal */}
      <Modal open={showGenerateModal} onClose={() => setShowGenerateModal(false)} title="Generate Default Template">
        <p className="text-sm text-slate mb-4">
          Generate a standard lease template pre-filled in both English and Hindi. You can edit it afterwards.
        </p>
        <div className="space-y-3 mb-6">
          {(['residential', 'commercial'] as const).map((type) => (
            <label key={type} className="flex items-start gap-3 p-3 border border-border rounded-lg cursor-pointer hover:border-saffron transition has-[:checked]:border-saffron has-[:checked]:bg-saffron-light">
              <input
                type="radio"
                name="templateType"
                value={type}
                checked={generateType === type}
                onChange={() => setGenerateType(type)}
                className="mt-0.5"
              />
              <div>
                <p className="font-medium text-navy capitalize">{type}</p>
                <p className="text-xs text-slate mt-0.5">
                  {type === 'residential'
                    ? 'For homes, flats, and rooms. 1-month notice period, 30-day deposit refund.'
                    : 'For shops, offices, and warehouses. GST applicable, 3-month notice, 45-day deposit refund.'}
                </p>
              </div>
            </label>
          ))}
        </div>
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setShowGenerateModal(false)}>Cancel</Button>
          <Button
            loading={generateDefault.isLoading}
            onClick={() => generateDefault.mutate({ property_id: selectedProperty, template_type: generateType })}
          >
            <Wand2 className="w-4 h-4" />
            Generate
          </Button>
        </div>
      </Modal>

      {/* Preview modal */}
      <Modal open={showPreview} onClose={() => setShowPreview(false)} title="Preview Template" size="lg">
        <div className="mb-4">
          <Select
            label="Fill with a real lease"
            value={previewLeaseId}
            onValueChange={setPreviewLeaseId}
            options={leaseOptions}
            placeholder="Select an active lease to fill in real values…"
          />
        </div>

        {previewLeaseId && preview ? (
          <div className="space-y-4 max-h-[60vh] overflow-y-auto">
            <div>
              <p className="text-xs font-semibold text-slate uppercase tracking-wide mb-2">English</p>
              <pre className="text-xs leading-relaxed text-navy whitespace-pre-wrap bg-bg p-4 rounded-lg border border-border font-sans">
                {preview.filled_en}
              </pre>
            </div>
            {preview.filled_hi && (
              <div>
                <p className="text-xs font-semibold text-slate uppercase tracking-wide mb-2">Hindi</p>
                <pre className="text-xs leading-relaxed text-navy whitespace-pre-wrap bg-bg p-4 rounded-lg border border-border" style={{ fontFamily: 'serif' }}>
                  {preview.filled_hi}
                </pre>
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-slate text-center py-8">
            Select a lease above to preview the template with real values filled in
          </p>
        )}

        <div className="flex justify-end mt-4 pt-4 border-t border-border">
          <Button variant="secondary" onClick={() => setShowPreview(false)}>Close</Button>
        </div>
      </Modal>
    </div>
  );
}
