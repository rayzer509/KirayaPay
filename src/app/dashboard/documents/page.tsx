'use client';

import { useState, useRef, useCallback } from 'react';
import { trpc } from '@/lib/trpc';
import { createSupabaseBrowserClient } from '@/lib/supabase';
import { Topbar } from '@/components/layout/Topbar';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import { EmptyState } from '@/components/ui/EmptyState';
import { formatDateTime } from '@/lib/utils';
import {
  Upload, FileText, FileImage, File, Trash2,
  ExternalLink, FolderOpen, X, CheckCircle2,
  AlertCircle, Loader2,
} from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { cn } from '@/lib/utils';

const ACCEPTED = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic'];
const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB

function fileIcon(fileType: string) {
  if (fileType === 'application/pdf') return FileText;
  if (fileType.startsWith('image/')) return FileImage;
  return File;
}

interface UploadFile {
  file: File;
  status: 'pending' | 'uploading' | 'done' | 'error';
  error?: string;
}

export default function DocumentsPage() {
  const supabase = createSupabaseBrowserClient();
  const [showUpload, setShowUpload] = useState(false);
  const [selectedLeaseId, setSelectedLeaseId] = useState('');
  const [docName, setDocName] = useState('');
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: leases } = trpc.leases.list.useQuery({ status: 'active' });
  const { data: documents, refetch } = trpc.documents.list.useQuery({
    entity_type: 'lease',
  });
  const createDoc = trpc.documents.create.useMutation();
  const deleteDoc = trpc.documents.delete.useMutation();

  function addFiles(incoming: FileList | File[]) {
    const arr = Array.from(incoming);
    const valid = arr.filter((f) => {
      if (!ACCEPTED.includes(f.type)) {
        toast.error(`${f.name}: unsupported file type`);
        return false;
      }
      if (f.size > MAX_FILE_SIZE) {
        toast.error(`${f.name}: file too large (max 20 MB)`);
        return false;
      }
      return true;
    });
    setFiles((prev) => [...prev, ...valid.map((f) => ({ file: f, status: 'pending' as const }))]);
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    addFiles(e.dataTransfer.files);
  }, []);

  function removeFile(idx: number) {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
  }

  function resetModal() {
    setFiles([]);
    setSelectedLeaseId('');
    setDocName('');
    setShowUpload(false);
  }

  async function handleUpload() {
    if (!selectedLeaseId) return toast.error('Select a lease first');
    if (files.length === 0) return toast.error('Add at least one file');

    setUploading(true);
    let anyError = false;

    for (let i = 0; i < files.length; i++) {
      const item = files[i];
      setFiles((prev) => prev.map((f, idx) => idx === i ? { ...f, status: 'uploading' } : f));

      const ext = item.file.name.split('.').pop() ?? 'bin';
      const path = `leases/${selectedLeaseId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

      const { error: storageError } = await supabase.storage
        .from('documents')
        .upload(path, item.file, { contentType: item.file.type, upsert: false });

      if (storageError) {
        setFiles((prev) => prev.map((f, idx) => idx === i ? { ...f, status: 'error', error: storageError.message } : f));
        anyError = true;
        continue;
      }

      try {
        const name = files.length === 1 && docName.trim()
          ? docName.trim()
          : docName.trim()
          ? `${docName.trim()} (${i + 1})`
          : item.file.name;

        await createDoc.mutateAsync({
          entity_type: 'lease',
          entity_id: selectedLeaseId,
          name,
          file_url: path,
          file_type: item.file.type,
        });

        setFiles((prev) => prev.map((f, idx) => idx === i ? { ...f, status: 'done' } : f));
      } catch (err: unknown) {
        setFiles((prev) => prev.map((f, idx) => idx === i ? { ...f, status: 'error', error: err instanceof Error ? err.message : 'Failed to save' } : f));
        anyError = true;
      }
    }

    setUploading(false);
    refetch();

    if (!anyError) {
      toast.success(`${files.length} file${files.length > 1 ? 's' : ''} uploaded`);
      resetModal();
    }
  }

  async function handleView(fileUrl: string) {
    const { data, error } = await supabase.storage
      .from('documents')
      .createSignedUrl(fileUrl, 3600);
    if (error || !data) return toast.error('Could not open file');
    window.open(data.signedUrl, '_blank');
  }

  async function handleDelete(id: string, fileUrl: string) {
    try {
      await deleteDoc.mutateAsync({ id });
      await supabase.storage.from('documents').remove([fileUrl]);
      refetch();
      toast.success('Document deleted');
    } catch {
      toast.error('Failed to delete document');
    }
  }

  // Group documents by lease
  const grouped = (documents ?? []).reduce<Record<string, typeof documents>>((acc, doc) => {
    if (!doc) return acc;
    const key = doc.entity_id;
    if (!acc[key]) acc[key] = [];
    acc[key]!.push(doc);
    return acc;
  }, {});

  const leaseMap = Object.fromEntries(
    (leases ?? []).map((l) => [l.id, l])
  );

  return (
    <div className="flex flex-col flex-1">
      <Topbar
        title="Lease Documents"
        subtitle="Upload scanned paper leases and agreements"
        action={
          <Button onClick={() => setShowUpload(true)}>
            <Upload className="w-4 h-4" />
            Upload Documents
          </Button>
        }
      />

      <main className="flex-1 p-6 max-w-5xl mx-auto w-full">
        {!documents || documents.length === 0 ? (
          <EmptyState
            icon={FolderOpen}
            title="No documents yet"
            description="Upload scanned paper leases, agreements, or any lease-related documents."
            action={
              <Button onClick={() => setShowUpload(true)}>
                <Upload className="w-4 h-4" />
                Upload Documents
              </Button>
            }
          />
        ) : (
          <div className="space-y-6">
            {Object.entries(grouped).map(([leaseId, docs]) => {
              const lease = leaseMap[leaseId];
              return (
                <div key={leaseId}>
                  <h3 className="text-sm font-semibold text-slate uppercase tracking-wide mb-3">
                    {lease
                      ? `${lease.tenant?.full_name ?? 'Tenant'} · ${(lease as { unit?: { unit_number?: string; property?: { name?: string } } }).unit?.unit_number ?? ''} · ${(lease as { unit?: { unit_number?: string; property?: { name?: string } } }).unit?.property?.name ?? ''}`
                      : `Lease ${leaseId.slice(-8)}`}
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {(docs ?? []).map((doc) => {
                      if (!doc) return null;
                      const Icon = fileIcon(doc.file_type);
                      const isPdf = doc.file_type === 'application/pdf';
                      return (
                        <Card key={doc.id} padding="none" className="overflow-hidden">
                          {/* Preview strip */}
                          <div className={cn(
                            'h-20 flex items-center justify-center',
                            isPdf ? 'bg-coral-light' : 'bg-sage-light'
                          )}>
                            <Icon className={cn('w-8 h-8', isPdf ? 'text-coral' : 'text-sage')} />
                          </div>
                          <div className="p-3">
                            <p className="text-sm font-medium text-navy truncate mb-0.5">{doc.name}</p>
                            <p className="text-xs text-slate mb-3">
                              {format(new Date(doc.created_at), 'dd MMM yyyy')}
                              {' · '}{doc.uploader.full_name}
                            </p>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="secondary"
                                className="flex-1 text-xs"
                                onClick={() => handleView(doc.file_url)}
                              >
                                <ExternalLink size={12} />
                                View
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleDelete(doc.id, doc.file_url)}
                              >
                                <Trash2 size={13} className="text-coral" />
                              </Button>
                            </div>
                          </div>
                        </Card>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Upload modal */}
      <Modal open={showUpload} onClose={resetModal} title="Upload Lease Documents">
        <div className="space-y-4">
          {/* Lease select */}
          <div>
            <label className="block text-sm font-medium text-navy mb-1.5">
              Lease <span className="text-coral">*</span>
            </label>
            <select
              value={selectedLeaseId}
              onChange={(e) => setSelectedLeaseId(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg border border-border bg-surface text-navy text-sm focus:outline-none focus:ring-2 focus:ring-saffron/30 focus:border-saffron"
            >
              <option value="">Select a lease…</option>
              {(leases ?? []).map((lease) => (
                <option key={lease.id} value={lease.id}>
                  {(lease as { tenant?: { full_name?: string } }).tenant?.full_name ?? 'Tenant'} —{' '}
                  {(lease as { unit?: { unit_number?: string; property?: { name?: string } } }).unit?.unit_number} ·{' '}
                  {(lease as { unit?: { unit_number?: string; property?: { name?: string } } }).unit?.property?.name}
                </option>
              ))}
            </select>
          </div>

          {/* Document name */}
          <div>
            <label className="block text-sm font-medium text-navy mb-1.5">
              Document name <span className="text-slate font-normal">(optional)</span>
            </label>
            <input
              type="text"
              placeholder="e.g. Signed Lease Agreement 2024"
              value={docName}
              onChange={(e) => setDocName(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg border border-border bg-surface text-navy placeholder:text-slate/50 text-sm focus:outline-none focus:ring-2 focus:ring-saffron/30 focus:border-saffron"
            />
            <p className="text-xs text-slate mt-1">Leave blank to use the original filename</p>
          </div>

          {/* Drop zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            onClick={() => fileInputRef.current?.click()}
            className={cn(
              'border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition',
              dragging
                ? 'border-saffron bg-saffron/5'
                : 'border-border hover:border-saffron/50 hover:bg-slate-light/50'
            )}
          >
            <Upload className="w-7 h-7 text-slate mx-auto mb-2" />
            <p className="text-sm font-medium text-navy">Drop files here or click to browse</p>
            <p className="text-xs text-slate mt-1">PDF, JPG, PNG, WEBP · Max 20 MB per file · Multiple files supported</p>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept={ACCEPTED.join(',')}
              className="hidden"
              onChange={(e) => e.target.files && addFiles(e.target.files)}
            />
          </div>

          {/* File list */}
          {files.length > 0 && (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {files.map((item, idx) => {
                const Icon = fileIcon(item.file.type);
                return (
                  <div key={idx} className="flex items-center gap-2.5 px-3 py-2 bg-slate-light/50 rounded-lg text-sm">
                    <Icon size={15} className="text-slate shrink-0" />
                    <span className="flex-1 truncate text-navy">{item.file.name}</span>
                    <span className="text-slate text-xs shrink-0">
                      {(item.file.size / 1024).toFixed(0)} KB
                    </span>
                    {item.status === 'pending' && (
                      <button onClick={() => removeFile(idx)} className="text-slate hover:text-coral transition shrink-0">
                        <X size={14} />
                      </button>
                    )}
                    {item.status === 'uploading' && <Loader2 size={14} className="animate-spin text-saffron shrink-0" />}
                    {item.status === 'done' && <CheckCircle2 size={14} className="text-sage shrink-0" />}
                    {item.status === 'error' && (
                      <span title={item.error} className="shrink-0">
                        <AlertCircle size={14} className="text-coral" />
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-1">
            <Button variant="secondary" onClick={resetModal} disabled={uploading}>Cancel</Button>
            <Button
              onClick={handleUpload}
              loading={uploading}
              disabled={uploading || !selectedLeaseId || files.length === 0}
            >
              <Upload className="w-4 h-4" />
              Upload {files.length > 0 ? `${files.length} file${files.length > 1 ? 's' : ''}` : ''}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
