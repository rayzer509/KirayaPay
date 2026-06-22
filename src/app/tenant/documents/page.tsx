'use client';

import { useState, useRef } from 'react';
import { trpc } from '@/lib/trpc';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { createSupabaseBrowserClient } from '@/lib/supabase';
import { FolderOpen, Upload, Trash2, FileText, ExternalLink } from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

const DOC_TYPES = [
  'Aadhaar Card',
  'PAN Card',
  'Passport',
  'Driving Licence',
  'Voter ID',
  'Address Proof',
  'Other',
];

export default function TenantDocumentsPage() {
  const [uploading, setUploading] = useState(false);
  const [selectedDocType, setSelectedDocType] = useState(DOC_TYPES[0]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: documents, isLoading, refetch } = trpc.documents.listMyDocuments.useQuery();
  const { data: me } = trpc.auth.me.useQuery();
  const uploadDoc = trpc.documents.uploadMyDocument.useMutation({
    onSuccess: () => { refetch(); toast.success('Document uploaded'); },
    onError: () => toast.error('Failed to save document record'),
  });
  const deleteDoc = trpc.documents.deleteMyDocument.useMutation({
    onSuccess: () => { refetch(); toast.success('Document removed'); },
    onError: () => toast.error('Failed to remove document'),
  });

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !me) return;

    const maxSize = 5 * 1024 * 1024; // 5 MB
    if (file.size > maxSize) {
      toast.error('File too large — max 5 MB');
      return;
    }

    setUploading(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const ext = file.name.split('.').pop();
      const path = `kyc/${me.id}/${Date.now()}.${ext}`;

      const { error } = await supabase.storage.from('documents').upload(path, file, { upsert: false });
      if (error) throw new Error(error.message);

      const { data: urlData } = supabase.storage.from('documents').getPublicUrl(path);

      await uploadDoc.mutateAsync({
        name: selectedDocType,
        file_url: urlData.publicUrl,
        file_type: file.type || ext || 'unknown',
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  return (
    <div className="lg:ml-48 p-4 lg:p-6 max-w-2xl space-y-4">
      <div className="mb-2">
        <h1 className="text-lg font-bold text-navy">My Documents</h1>
        <p className="text-sm text-slate">Upload your KYC documents for your landlord's records</p>
      </div>

      {/* Upload card */}
      <Card>
        <h2 className="font-semibold text-navy mb-3">Upload Document</h2>
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-end">
          <div className="flex-1">
            <label className="block text-xs font-medium text-slate mb-1">Document Type</label>
            <select
              value={selectedDocType}
              onChange={(e) => setSelectedDocType(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-surface text-navy focus:outline-none focus:ring-2 focus:ring-saffron/30 focus:border-saffron"
            >
              {DOC_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.webp"
              onChange={handleFileChange}
              className="hidden"
              id="doc-upload"
            />
            <Button
              onClick={() => fileInputRef.current?.click()}
              loading={uploading}
              disabled={uploading}
            >
              <Upload className="w-4 h-4" />
              {uploading ? 'Uploading…' : 'Choose File'}
            </Button>
          </div>
        </div>
        <p className="text-xs text-slate mt-2">Accepted: PDF, JPG, PNG · Max 5 MB</p>
      </Card>

      {/* Documents list */}
      {isLoading && <div className="h-24 rounded-xl bg-surface border border-border animate-pulse" />}

      {!isLoading && (!documents || documents.length === 0) && (
        <EmptyState
          icon={FolderOpen}
          title="No documents uploaded"
          description="Upload your Aadhaar, PAN, or other identity documents above"
        />
      )}

      {documents && documents.length > 0 && (
        <div className="space-y-2">
          {documents.map((doc) => (
            <Card key={doc.id} className="py-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-slate-light flex items-center justify-center shrink-0">
                  <FileText className="w-4 h-4 text-slate" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-navy">{doc.name}</p>
                  <p className="text-xs text-slate">{format(new Date(doc.created_at), 'dd MMM yyyy')} · {doc.file_type}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <a
                    href={doc.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1.5 rounded-lg hover:bg-slate-light text-slate hover:text-navy transition"
                    title="View document"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                  <button
                    onClick={() => deleteDoc.mutate({ id: doc.id })}
                    disabled={deleteDoc.isLoading}
                    className="p-1.5 rounded-lg hover:bg-coral/10 text-slate hover:text-coral transition"
                    title="Remove document"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
